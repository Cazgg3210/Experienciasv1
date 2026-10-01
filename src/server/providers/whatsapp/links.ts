/** Normaliza un teléfono mexicano a formato wa.me (52 + 10 dígitos). */
export function normalizeMxPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `52${digits}`;
  if (digits.length === 12 && digits.startsWith("52")) return digits;
  if (digits.length === 13 && digits.startsWith("521")) return `52${digits.slice(3)}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

/** Deep link de WhatsApp (funciona sin API): https://wa.me/<numero>?text=<mensaje> */
export function whatsappLink(phone: string | null | undefined, text?: string): string {
  const number = normalizeMxPhone(phone) ?? "";
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${number}${q}`;
}
