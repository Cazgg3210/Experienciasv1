import type { AICompletionInput, AICompletionResult, AIProvider } from "./types";

/** Sin API key: el diseñador usa el motor de reglas. complete() no se invoca en modo mock. */
export class MockAIProvider implements AIProvider {
  readonly name = "mock-ai";
  readonly isMock = true;
  async complete(_input: AICompletionInput): Promise<AICompletionResult> {
    throw new Error("MockAIProvider no genera texto: usar el motor de reglas (fallback).");
  }
}
