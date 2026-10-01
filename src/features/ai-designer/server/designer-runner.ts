import "server-only";
import { logger } from "@/lib/logger";
import type { AIProvider } from "@/server/providers/ai/types";
import { PROMPT_VERSION } from "../constants";
import {
  buildUserPrompt,
  LlmOutputError,
  mapLlmDesign,
  parseLlmJson,
  SYSTEM_PROMPT,
  validateLlmDesign,
} from "../domain/llm";
import { buildContext, designFromContext, evaluateBudget } from "../domain/rules-engine";
import type { BudgetFit, DesignerCatalog, DesignProposal } from "../domain/types";
import type { DesignerInput } from "../schemas";

/**
 * Orquesta la generación (sin I/O de base de datos, testeable con un AIProvider simulado):
 *  - Proveedor mock → motor de reglas (usedFallback = true, provider "mock").
 *  - Proveedor real → prompt con catálogo SIN precios → JSON → Zod → ids reales → ajuste al presupuesto.
 *  - Cualquier error, salida inválida o timeout → motor de reglas (usedFallback = true).
 */
export const LLM_TIMEOUT_MS = 15_000;

export type FallbackReason = "mock_provider" | "timeout" | "provider_error" | LlmOutputError["reason"];

export type DesignerRun = {
  design: DesignProposal;
  dietaryNote: string | null;
  fit: BudgetFit;
  provider: string;
  model: string | null;
  /** prompt de usuario enviado al LLM, o "rules" si se usó el motor de reglas */
  prompt: string;
  promptVersion: string;
  usedFallback: boolean;
  fallbackReason: FallbackReason | null;
  dropped: string[];
};

export class LlmTimeoutError extends Error {
  constructor(ms: number) {
    super(`El modelo no respondió en ${ms} ms`);
    this.name = "LlmTimeoutError";
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new LlmTimeoutError(ms)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runDesigner(args: {
  input: DesignerInput;
  catalog: DesignerCatalog;
  provider: AIProvider;
  timeoutMs?: number;
}): Promise<DesignerRun> {
  const { input, catalog, provider } = args;
  const ctx = buildContext(input, catalog);
  const rules = designFromContext(ctx);

  const rulesRun = (reason: FallbackReason, providerName: string): DesignerRun => ({
    design: rules.design,
    dietaryNote: rules.dietaryNote,
    fit: rules.fit,
    provider: providerName,
    model: null,
    prompt: "rules",
    promptVersion: PROMPT_VERSION,
    usedFallback: true,
    fallbackReason: reason,
    dropped: [],
  });

  if (provider.isMock) return rulesRun("mock_provider", "mock");

  const maxExtras = rules.fit.overBudget
    ? 0
    : ctx.budget && ctx.budget.maxCents == null
      ? 4
      : Math.max(1, rules.selection.addOnIds.length);
  const prompt = buildUserPrompt(ctx, { maxExtras, recommendedAddOnIds: rules.selection.addOnIds });

  try {
    const res = await withTimeout(
      provider.complete({ system: SYSTEM_PROMPT, prompt, json: true, maxTokens: 4096 }),
      args.timeoutMs ?? LLM_TIMEOUT_MS,
    );
    const llm = validateLlmDesign(parseLlmJson(res.text));
    const mapped = mapLlmDesign(ctx, llm, { selection: rules.selection, styleId: rules.styleId });
    const fit = evaluateBudget(
      ctx,
      {
        experienceId: mapped.design.experienceId,
        menuId: mapped.design.menuId,
        addOnIds: mapped.design.addOnIds,
      },
      mapped.totalCents,
    );
    if (mapped.dropped.length) logger.info("ai_designer.llm_ids_dropped", { dropped: mapped.dropped });
    return {
      design: mapped.design,
      dietaryNote: mapped.dietaryNote,
      fit,
      provider: provider.name,
      model: res.model,
      prompt,
      promptVersion: PROMPT_VERSION,
      usedFallback: false,
      fallbackReason: null,
      dropped: mapped.dropped,
    };
  } catch (error) {
    const reason: FallbackReason =
      error instanceof LlmOutputError
        ? error.reason
        : error instanceof LlmTimeoutError || (error instanceof Error && error.name === "TimeoutError")
          ? "timeout"
          : "provider_error";
    logger.warn("ai_designer.llm_fallback", {
      reason,
      provider: provider.name,
      message: error instanceof Error ? error.message : String(error),
    });
    return rulesRun(reason, provider.name);
  }
}
