import type { AIProvider } from "./types";

/**
 * STUB — lo implementa el módulo AI Designer (Anthropic / OpenAI vía HTTP, sin SDK).
 * Devuelve null si el proveedor no está soportado (el registro cae al Mock + motor de reglas).
 */
export function createRealAIProvider(
  _provider: "anthropic" | "openai",
  _apiKey: string,
  _model?: string,
): AIProvider | null {
  return null;
}
