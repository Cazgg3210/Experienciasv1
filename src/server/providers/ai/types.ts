export type AICompletionInput = {
  system: string;
  prompt: string;
  /** Pista para el proveedor de que se espera JSON estricto */
  json: boolean;
  maxTokens?: number;
  temperature?: number;
};

export type AICompletionResult = {
  text: string;
  model: string;
};

/**
 * Proveedor LLM desacoplado del vendor. El AI Experience Designer siempre valida la salida
 * con Zod y la mapea a SKUs reales del catálogo; nunca usa precios inventados por el modelo.
 */
export interface AIProvider {
  readonly name: string;
  readonly isMock: boolean;
  complete(input: AICompletionInput): Promise<AICompletionResult>;
}
