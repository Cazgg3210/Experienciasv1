import { AnthropicAIProvider } from "./anthropic-provider";
import { OpenAIProvider } from "./openai-provider";
import type { AIProvider } from "./types";

/**
 * Proveedores LLM reales (Anthropic / OpenAI vía HTTP, sin SDK).
 * Devuelve null si el proveedor no está soportado o falta la API key
 * (el registro cae al Mock y el diseñador usa el motor de reglas).
 */
export function createRealAIProvider(
  provider: "anthropic" | "openai",
  apiKey: string,
  model?: string,
): AIProvider | null {
  const key = apiKey?.trim();
  if (!key) return null;
  switch (provider) {
    case "anthropic":
      return new AnthropicAIProvider(key, model);
    case "openai":
      return new OpenAIProvider(key, model);
    default:
      return null;
  }
}
