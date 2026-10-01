import { AIProviderError } from "./anthropic-provider";
import type { AICompletionInput, AICompletionResult, AIProvider } from "./types";

/**
 * OpenAI Chat Completions vía HTTP (sin SDK).
 * POST https://api.openai.com/v1/chat/completions con response_format json_object.
 * Modelo por defecto configurable con AI_MODEL.
 */
export const OPENAI_DEFAULT_MODEL = "gpt-4.1-mini";
const ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 15_000;

type OpenAIResponse = {
  model?: string;
  choices?: Array<{ message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }>;
  error?: { type?: string; code?: string; message?: string };
};

/** Modelos de razonamiento (o-series, gpt-5) no aceptan temperature distinta al default. */
function supportsTemperature(model: string): boolean {
  return !/^(o\d|gpt-5)/i.test(model);
}

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  readonly isMock = false;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(apiKey: string, model?: string, opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}) {
    this.apiKey = apiKey;
    this.model = model?.trim() || OPENAI_DEFAULT_MODEL;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async complete(input: AICompletionInput): Promise<AICompletionResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        // json_object exige que la palabra "JSON" aparezca en los mensajes.
        {
          role: "system",
          content: input.json ? `${input.system}\n\nResponde en formato JSON.` : input.system,
        },
        { role: "user", content: input.prompt },
      ],
      max_completion_tokens: input.maxTokens ?? 4096,
    };
    if (input.json) body.response_format = { type: "json_object" };
    if (typeof input.temperature === "number" && supportsTemperature(this.model))
      body.temperature = input.temperature;

    const res = await this.fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const data = (await res.json().catch(() => null)) as OpenAIResponse | null;
    if (!res.ok) {
      throw new AIProviderError(
        `OpenAI respondió ${res.status}: ${data?.error?.code ?? data?.error?.type ?? "error"}`,
        res.status,
      );
    }
    const choice = data?.choices?.[0];
    if (!choice) throw new AIProviderError("Respuesta vacía de OpenAI");
    if (choice.message?.refusal) throw new AIProviderError("El modelo declinó la solicitud");
    if (choice.finish_reason === "length") throw new AIProviderError("Respuesta truncada (length)");
    const text = choice.message?.content?.trim();
    if (!text) throw new AIProviderError("OpenAI no devolvió texto");
    return { text, model: data?.model ?? this.model };
  }
}
