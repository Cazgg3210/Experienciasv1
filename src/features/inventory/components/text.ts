/** "sábado 18 de octubre de 2026" → "Sábado 18 de octubre de 2026" (CSS `capitalize` pondría mayúscula a cada palabra). */
export function capitalizeFirst(text: string): string {
  return text ? text.charAt(0).toLocaleUpperCase("es-MX") + text.slice(1) : text;
}
