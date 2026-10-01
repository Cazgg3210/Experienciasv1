import { describe, expect, it } from "vitest";
import {
  AnthropicAIProvider,
  ANTHROPIC_DEFAULT_MODEL,
  AIProviderError,
} from "@/server/providers/ai/anthropic-provider";
import { OpenAIProvider, OPENAI_DEFAULT_MODEL } from "@/server/providers/ai/openai-provider";
import { createRealAIProvider } from "@/server/providers/ai/real";

type Captured = { url: string; init: RequestInit };

function fakeFetch(status: number, body: unknown, captured: Captured[]): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    captured.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

describe("createRealAIProvider", () => {
  it("crea Anthropic/OpenAI con modelo por defecto o AI_MODEL; null sin key", () => {
    const a = createRealAIProvider("anthropic", "sk-test");
    expect(a?.name).toBe("anthropic");
    expect(a?.isMock).toBe(false);
    expect(createRealAIProvider("openai", "sk-test")?.name).toBe("openai");
    expect(createRealAIProvider("anthropic", "  ")).toBeNull();
    expect(createRealAIProvider("nada" as "openai", "sk")).toBeNull();
  });
});

describe("AnthropicAIProvider", () => {
  it("envía headers y cuerpo correctos y concatena los bloques de texto", async () => {
    const captured: Captured[] = [];
    const provider = new AnthropicAIProvider("sk-ant-test", undefined, {
      fetchImpl: fakeFetch(
        200,
        {
          model: "claude-sonnet-4-5",
          stop_reason: "end_turn",
          content: [{ type: "thinking" }, { type: "text", text: '{"ok":true}' }],
        },
        captured,
      ),
    });
    const res = await provider.complete({ system: "sys", prompt: "hola", json: true, maxTokens: 1000 });
    expect(res).toEqual({ text: '{"ok":true}', model: "claude-sonnet-4-5" });
    expect(captured[0]!.url).toBe("https://api.anthropic.com/v1/messages");
    const headers = captured[0]!.init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-ant-test");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["content-type"]).toBe("application/json");
    const body = JSON.parse(String(captured[0]!.init.body));
    expect(body.model).toBe(ANTHROPIC_DEFAULT_MODEL);
    expect(body.max_tokens).toBe(1000);
    expect(body.messages).toEqual([{ role: "user", content: "hola" }]);
    expect(body.system).toMatch(/^sys/);
    expect(body).not.toHaveProperty("temperature");
    expect(captured[0]!.init.signal).toBeDefined();
  });

  it("respeta AI_MODEL y lanza errores sin filtrar la key", async () => {
    const captured: Captured[] = [];
    const provider = new AnthropicAIProvider("sk-secret", "claude-opus-5-5", {
      fetchImpl: fakeFetch(401, { error: { type: "authentication_error" } }, captured),
    });
    await expect(provider.complete({ system: "s", prompt: "p", json: true })).rejects.toThrow(
      AIProviderError,
    );
    await expect(provider.complete({ system: "s", prompt: "p", json: true })).rejects.not.toThrow(
      /sk-secret/,
    );
    expect(JSON.parse(String(captured[0]!.init.body)).model).toBe("claude-opus-5-5");
  });

  it("trata refusal y max_tokens como error (para caer a reglas)", async () => {
    for (const stop_reason of ["refusal", "max_tokens"]) {
      const provider = new AnthropicAIProvider("k", undefined, {
        fetchImpl: fakeFetch(200, { stop_reason, content: [{ type: "text", text: "{" }] }, []),
      });
      await expect(provider.complete({ system: "s", prompt: "p", json: true })).rejects.toThrow(
        AIProviderError,
      );
    }
  });
});

describe("OpenAIProvider", () => {
  it("usa chat/completions con response_format json_object y modelo por defecto", async () => {
    const captured: Captured[] = [];
    const provider = new OpenAIProvider("sk-openai", undefined, {
      fetchImpl: fakeFetch(
        200,
        { model: "gpt-4.1-mini", choices: [{ message: { content: '{"a":1}' }, finish_reason: "stop" }] },
        captured,
      ),
    });
    const res = await provider.complete({ system: "sys", prompt: "hola", json: true, temperature: 0.7 });
    expect(res).toEqual({ text: '{"a":1}', model: "gpt-4.1-mini" });
    expect(captured[0]!.url).toBe("https://api.openai.com/v1/chat/completions");
    const headers = captured[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer sk-openai");
    const body = JSON.parse(String(captured[0]!.init.body));
    expect(body.model).toBe(OPENAI_DEFAULT_MODEL);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toMatch(/JSON/);
    expect(body.temperature).toBe(0.7);
  });

  it("lanza error en HTTP no-OK, respuesta truncada o vacía", async () => {
    const cases: Array<[number, unknown]> = [
      [500, { error: { code: "server_error" } }],
      [200, { choices: [{ message: { content: "{" }, finish_reason: "length" }] }],
      [200, { choices: [] }],
    ];
    for (const [status, body] of cases) {
      const provider = new OpenAIProvider("k", undefined, { fetchImpl: fakeFetch(status, body, []) });
      await expect(provider.complete({ system: "s", prompt: "p", json: true })).rejects.toThrow(
        AIProviderError,
      );
    }
  });
});
