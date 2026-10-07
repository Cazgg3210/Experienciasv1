/**
 * Teléfonos: UNA forma canónica para guardar y comparar (E.164).
 *  - México (por defecto): "+52" + 10 dígitos. Acepta los 10 dígitos, +52 / 52 y el prefijo legado de
 *    celulares 521 (+52 1), con espacios, guiones, puntos y paréntesis. El número nacional nunca empieza
 *    con 0 ni con 1 (las ladas de México van del 2 al 9; 044/045/01 eran prefijos de marcación).
 *  - Otros países: "+" + lada + número (11 a 15 dígitos en total). Una lada que empieza con 52 ES México,
 *    así que sólo vale con su longitud mexicana (52 + 10 o 521 + 10).
 *  - Con "+" al inicio siempre viene la lada: "+" seguido de 10 dígitos no es un número nacional.
 * Pura y sin dependencias: la usan los esquemas Zod (cliente y servidor), los servicios, las búsquedas y
 * los enlaces/avisos de WhatsApp (`whatsappDigits` en @/server/providers/whatsapp/links).
 */

const SEPARATORS = /[\s().-]/g;

/** Dígitos del teléfono y si traía "+" (lada explícita), o null si trae otra cosa (letras, "+" en medio…). */
function phoneParts(input: string | null | undefined): { digits: string; plus: boolean } | null {
  if (typeof input !== "string") return null;
  const match = /^(\+?)(\d+)$/.exec(input.replace(SEPARATORS, ""));
  return match ? { digits: match[2]!, plus: match[1] === "+" } : null;
}

const MX_NATIONAL = /^[2-9]\d{9}$/;

/** Número nacional de México a 10 dígitos, o null si no es un teléfono mexicano válido. */
export function mxNationalNumber(input: string | null | undefined): string | null {
  const parts = phoneParts(input);
  if (!parts) return null;
  const { digits, plus } = parts;
  let national: string | null = null;
  if (digits.length === 10 && !plus) national = digits;
  else if (digits.length === 12 && digits.startsWith("52")) national = digits.slice(2);
  else if (digits.length === 13 && digits.startsWith("521")) national = digits.slice(3);
  return national && MX_NATIONAL.test(national) ? national : null;
}

/**
 * Forma canónica para guardar: "+525512345678" (México) o "+<lada><número>" (otro país).
 * null si viene vacío o no es un teléfono válido.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  const national = mxNationalNumber(input);
  if (national) return `+52${national}`;
  const digits = phoneParts(input)?.digits;
  if (!digits || digits.length < 11 || digits.length > 15) return null;
  // Lada internacional: nunca empieza con 0 (044/045/01 eran prefijos de marcación nacional, no ladas) y
  // una que empieza con 52 es México con una longitud equivocada ("+52 55 1234 567", "52 1 55 1234 567").
  if (digits.startsWith("0") || digits.startsWith("52")) return null;
  return `+${digits}`;
}

export function isValidPhone(input: string | null | undefined): boolean {
  return normalizePhone(input) !== null;
}

/**
 * ¿Es el mismo teléfono aunque esté escrito distinto? ("55 1234 5678" = "+525512345678"). Dos vacíos son
 * iguales; si ninguno es un teléfono válido se comparan tal cual. Sirve para no reportar como cambio
 * (timeline/auditoría) un dato que sólo pasa a la forma canónica.
 */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (na || nb) return na === nb;
  return (a?.trim() || null) === (b?.trim() || null);
}

/**
 * Formas en sólo dígitos con que pudo quedar guardado el MISMO número antes de la forma canónica
 * (10 dígitos, 52 + 10, 521 + 10). Sirven para reconocer a una clienta aunque su teléfono se haya
 * escrito con otro formato. Vacío si no es un teléfono válido.
 */
export function phoneMatchKeys(input: string | null | undefined): string[] {
  const national = mxNationalNumber(input);
  if (national) return [national, `52${national}`, `521${national}`];
  const canonical = normalizePhone(input);
  return canonical ? [canonical.slice(1)] : [];
}

/**
 * Dígitos para buscar un teléfono con "contiene": el número nacional si lo escrito es un teléfono de
 * México completo (así "+52 1 55…" encuentra "+5255…" y "55…"); si no, los dígitos tal cual (búsqueda parcial).
 */
export function phoneSearchDigits(query: string): string {
  return mxNationalNumber(query) ?? query.replace(/\D/g, "");
}
