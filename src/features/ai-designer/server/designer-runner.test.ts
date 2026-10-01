import { describe, expect, it, vi } from "vitest";
import type { AICompletionInput, AIProvider } from "@/server/providers/ai/types";
import { PROMPT_VERSION } from "../constants";
import { baseInput, fixtureCatalog } from "../domain/catalog.fixture";
import { designWithRules } from "../domain/rules-engine";
import { runDesigner } from "./designer-runner";

const catalog = fixtureCatalog();

function fakeProvider(
  impl: (input: AICompletionInput) => Promise<{ text: string; model: string }>,
  isMock = false,
): AIProvider & {
  calls: AICompletionInput[];
} {
  const calls: AICompletionInput[] = [];
  return {
    name: isMock ? "mock-ai" : "fake-llm",
    isMock,
    calls,
    complete: async (input) => {
      calls.push(input);
      return impl(input);
    },
  };
}

const goodJson = JSON.stringify({
  name: "Cumple Jardín de Sofi",
  concept: "Un cumpleaños entre flores, velas y sobremesa larga.",
  description:
    "Una mesa llena de flores para celebrar a Sofi rodeada de sus amigas.\n\nServimos un brunch fresco y brindamos al final.",
  palette: [
    { name: "Blush", hex: "#E9C9BE" },
    { name: "Salvia", hex: "#A3B18A" },
    { name: "Marfil", hex: "#F7F3EC" },
    { name: "Dorado", hex: "#C6A15B" },
  ],
  experienceId: "exp_birthday-table",
  styleId: "style_romantico",
  menuId: "menu_brunch-clasico",
  addOnIds: ["addon_upgrade-floral", "addon_inventado"],
  activities: ["Ronda de deseos", "Brindis con cartas", "Fotos con luz natural"],
  tableDesign: "Mesa larga con lino blush, rosas de jardín y velas encendidas.",
  playlistVibe: "Bossa nova y pop suave.",
});

describe("runDesigner", () => {
  it("proveedor mock → motor de reglas sin llamar al LLM (usedFallback, provider mock, prompt rules)", async () => {
    const provider = fakeProvider(async () => ({ text: goodJson, model: "x" }), true);
    const run = await runDesigner({ input: baseInput(), catalog, provider });
    expect(provider.calls).toHaveLength(0);
    expect(run.usedFallback).toBe(true);
    expect(run.provider).toBe("mock");
    expect(run.prompt).toBe("rules");
    expect(run.promptVersion).toBe(PROMPT_VERSION);
    expect(run.fallbackReason).toBe("mock_provider");
    expect(run.design).toEqual(designWithRules(baseInput(), catalog).design);
  });

  it("LLM válido → usa su propuesta mapeada a ids reales y guarda el prompt", async () => {
    const provider = fakeProvider(async () => ({
      text: "```json\n" + goodJson + "\n```",
      model: "fake-model-1",
    }));
    const run = await runDesigner({ input: baseInput({ budgetRangeId: "budget_4" }), catalog, provider });
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]!.json).toBe(true);
    expect(run.usedFallback).toBe(false);
    expect(run.provider).toBe("fake-llm");
    expect(run.model).toBe("fake-model-1");
    expect(run.prompt).toBe(provider.calls[0]!.prompt);
    expect(run.prompt).not.toMatch(/priceCents|\$\s?\d/);
    expect(run.design.name).toBe("Cumple Jardín de Sofi");
    expect(run.design.addOnIds).toEqual(["addon_upgrade-floral"]);
    expect(run.dropped).toContain("addon:addon_inventado");
  });

  it.each([
    ["JSON malformado", async () => ({ text: '{"name": "Cumple", "concept": ', model: "m" }), "invalid_json"],
    [
      "texto sin JSON",
      async () => ({ text: "Lo siento, no puedo ayudar con eso.", model: "m" }),
      "invalid_json",
    ],
    [
      "esquema inválido",
      async () => ({ text: JSON.stringify({ name: "Hola", experienceId: 3 }), model: "m" }),
      "validation",
    ],
    ["respuesta vacía", async () => ({ text: "   ", model: "m" }), "empty"],
    [
      "error del proveedor",
      async () => {
        throw new Error("Anthropic respondió 529: overloaded_error");
      },
      "provider_error",
    ],
  ] as const)("%s → fallback a reglas", async (_label, impl, reason) => {
    const provider = fakeProvider(impl as () => Promise<{ text: string; model: string }>);
    const run = await runDesigner({ input: baseInput(), catalog, provider });
    expect(run.usedFallback).toBe(true);
    expect(run.fallbackReason).toBe(reason);
    expect(run.provider).toBe("fake-llm");
    expect(run.model).toBeNull();
    expect(run.prompt).toBe("rules");
    expect(run.design).toEqual(designWithRules(baseInput(), catalog).design);
  });

  it("timeout → fallback a reglas sin esperar al modelo", async () => {
    vi.useFakeTimers();
    try {
      const provider = fakeProvider(() => new Promise(() => {}));
      const promise = runDesigner({ input: baseInput(), catalog, provider, timeoutMs: 15_000 });
      await vi.advanceTimersByTimeAsync(15_001);
      const run = await promise;
      expect(run.usedFallback).toBe(true);
      expect(run.fallbackReason).toBe("timeout");
    } finally {
      vi.useRealTimers();
    }
  });

  it("AbortSignal.timeout del proveedor (TimeoutError) también cuenta como timeout", async () => {
    const provider = fakeProvider(async () => {
      const err = new Error("The operation was aborted due to timeout");
      err.name = "TimeoutError";
      throw err;
    });
    const run = await runDesigner({ input: baseInput(), catalog, provider });
    expect(run.fallbackReason).toBe("timeout");
  });
});
