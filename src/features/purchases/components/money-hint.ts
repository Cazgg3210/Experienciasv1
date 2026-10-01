import { formatMXN } from "@/lib/money";

/**
 * Texto de ayuda para campos de dinero: muestra cómo se interpretó lo escrito para evitar
 * errores con separadores (escribir sin comas de miles, p. ej. 1250.50).
 */
export function moneyHint(cents: number | null | undefined): string {
  if (cents == null || Number.isNaN(cents)) return "Escribe el monto sin comas de miles (ej. 1250.50).";
  return `Se registrará como ${formatMXN(cents)}. Sin comas de miles (ej. 1250.50).`;
}
