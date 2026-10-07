import { normalizePhone } from "@/lib/phone";

/**
 * Número para WhatsApp (wa.me y avisos por WhatsApp): la forma canónica de `normalizePhone` sin el "+"
 * ("525512345678", "14155550123"). Mismo criterio que el resto de la app (una sola regla de
 * normalización): un valor que no es un teléfono válido da null, en lugar de un enlace a un número
 * inventado.
 */
export function whatsappDigits(phone: string | null | undefined): string | null {
  return normalizePhone(phone)?.slice(1) ?? null;
}

/**
 * Deep link de WhatsApp (funciona sin API): https://wa.me/<numero>?text=<mensaje>.
 * Sin un número válido abre WhatsApp para elegir el contacto (https://wa.me/?text=…).
 */
export function whatsappLink(phone: string | null | undefined, text?: string): string {
  const number = whatsappDigits(phone) ?? "";
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${number}${q}`;
}
