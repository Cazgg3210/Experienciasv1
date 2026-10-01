import type { AICompletionInput, AICompletionResult, AIProvider } from "./types";

/**
 * Anthropic Messages API vía HTTP (sin SDK: no agregamos dependencias).
 * POST https://api.anthropic.com/v1/messages
 * Modelo por defecto configurable con AI_MODEL.
 */
export const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4-5";
const ENDPOINT = "https://api.anthropic.com/v1/messages";
const DEFAULT_TIMEOUT_MS = 15_000;

type AnthropicContentBlock = { type: string; text?: string };
type AnthropicResponse = {
  model?: string;
  content?: AnthropicContentBlock[];
  stop_reason?: string | null;
  error?: { type?: string; message?: string };
};

export class AIProviderError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AIProviderError";
    this.status = status;
  }
}

export class AnthropicAIProvider implements AIProvider {
  readonly name = "anthropic";
  readonly isMock = false;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(apiKey: string, model?: string, opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}) {
    this.apiKey = apiKey;
    this.model = model?.trim() || ANTHROPIC_DEFAULT_MODEL;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async complete(input: AICompletionInput): Promise<AICompletionResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: input.maxTokens ?? 4096,
      system: input.json
        ? `${input.system}\n\nResponde únicamente con JSON válido, sin texto adicional ni bloques de código.`
        : input.system,
      messages: [{ role: "user", content: input.prompt }],
    };
    // Los modelos más recientes rechazan parámetros de muestreo; sólo se envía si se pide explícitamente.
    if (typeof input.temperature === "number") body.temperature = input.temperature;

    const res = await this.fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const data = (await res.json().catch(() => null)) as AnthropicResponse | null;
    if (!res.ok) {
      // Nunca incluir la API key ni el prompt en el error.
      throw new AIProviderError(
        `Anthropic respondió ${res.status}: ${data?.error?.type ?? "error"}`,
        res.status,
      );
    }
    if (!data) throw new AIProviderError("Respuesta vacía de Anthropic");
    if (data.stop_reason === "refusal") throw new AIProviderError("El modelo declinó la solicitud");
    if (data.stop_reason === "max_tokens") throw new AIProviderError("Respuesta truncada (max_tokens)");

    // content[0] suele ser el texto; con modelos que razonan puede haber bloques previos.
    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) throw new AIProviderError("Anthropic no devolvió texto");
    return { text, model: data.model ?? this.model };
  }
}
