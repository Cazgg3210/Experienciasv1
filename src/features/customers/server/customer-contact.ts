import "server-only";
import type { Customer, Prisma, PrismaClient } from "@prisma/client";
import { ValidationError } from "@/lib/errors";
import { mxNationalNumber, normalizePhone, phoneMatchKeys, phoneSearchDigits } from "@/lib/phone";

type Db = PrismaClient | Prisma.TransactionClient;

const INVALID_PHONE = "Escribe un teléfono de 10 dígitos (puedes incluir lada +52).";

/**
 * Teléfono listo para guardar en su forma canónica (`normalizePhone`). Vacío → null.
 * Un valor que no es teléfono no se guarda tal cual ni se descarta en silencio: ValidationError en `field`
 * (los esquemas Zod ya lo rechazan; esto protege a quien llame al servicio sin pasar por ellos).
 */
export function phoneForStorage(value: string | null | undefined, field = "phone"): string | null {
  if (!value?.trim()) return null;
  const phone = normalizePhone(value);
  if (!phone) throw new ValidationError("Revisa el teléfono.", { [field]: [INVALID_PHONE] });
  return phone;
}

type PhoneLookup = {
  /** Sólo clientas SIN correo (quien escribió un correo distinto es otra persona que comparte el número). */
  onlyWithoutEmail?: boolean;
};

/**
 * Clienta con ese teléfono (en `phone` o en `whatsapp`), aunque se haya guardado con otro formato antes de
 * la forma canónica ("55 1234 5678", "5512345678", "+52 1 55…"). Si varias coinciden, la más antigua.
 *  1. Igualdad exacta con la forma canónica (usa el índice de `phone`): el caso normal desde BUG-008.
 *  2. Respaldo para filas anteriores a la forma canónica: compara sólo los dígitos contra las formas del
 *     mismo número (`phoneMatchKeys`). Recorre la tabla (sin índice), por eso va después del paso 1; deja de
 *     hacer falta cuando todos los teléfonos guardados estén en la forma canónica.
 * No modifica datos.
 */
export async function findCustomerByPhone(
  db: Db,
  phone: string | null | undefined,
  opts: PhoneLookup = {},
): Promise<Customer | null> {
  const canonical = normalizePhone(phone);
  if (!canonical) return null;
  const emailFilter: Prisma.CustomerWhereInput = opts.onlyWithoutEmail ? { email: null } : {};
  const exact = await db.customer.findFirst({
    where: { ...emailFilter, OR: [{ phone: canonical }, { whatsapp: canonical }] },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (exact) return exact;

  const keys = phoneMatchKeys(canonical);
  const rows = opts.onlyWithoutEmail
    ? await db.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Customer"
        WHERE "email" IS NULL
          AND (regexp_replace(coalesce("phone", ''), '[^0-9]', '', 'g') = ANY(${keys}::text[])
            OR regexp_replace(coalesce("whatsapp", ''), '[^0-9]', '', 'g') = ANY(${keys}::text[]))
        ORDER BY "createdAt" ASC, "id" ASC
        LIMIT 1`
    : await db.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Customer"
        WHERE regexp_replace(coalesce("phone", ''), '[^0-9]', '', 'g') = ANY(${keys}::text[])
           OR regexp_replace(coalesce("whatsapp", ''), '[^0-9]', '', 'g') = ANY(${keys}::text[])
        ORDER BY "createdAt" ASC, "id" ASC
        LIMIT 1`;
  return rows[0] ? db.customer.findUnique({ where: { id: rows[0].id } }) : null;
}

export type CustomerContactMatch = { customer: Customer; by: "email" | "phone" };

/**
 * Regla única «busca o crea clienta» (captura de leads, «Clienta nueva» de cotización y de evento):
 *  1. por correo (exacto, en minúsculas): el correo es único y basta para reconocerla;
 *  2. si no, por teléfono o WhatsApp (cualquier formato guardado), pero si se escribió un correo sólo se
 *     reutiliza una clienta que NO tenga correo: dos personas pueden compartir teléfono (CUST-009) y, si
 *     cada una tiene su propio correo, son clientas distintas. Así un lead o una cotización nunca quedan
 *     ligados a otra persona sólo por el teléfono (ni el correo escrito se pierde en silencio).
 */
export async function findCustomerByContact(
  db: Db,
  contact: { email: string | null; phone: string | null },
): Promise<CustomerContactMatch | null> {
  const byEmail = contact.email ? await db.customer.findUnique({ where: { email: contact.email } }) : null;
  if (byEmail) return { customer: byEmail, by: "email" };
  const byPhone = await findCustomerByPhone(db, contact.phone, { onlyWithoutEmail: !!contact.email });
  return byPhone ? { customer: byPhone, by: "phone" } : null;
}

/**
 * Serializa «busca o crea clienta» para los mismos datos de contacto (candado de transacción por correo y
 * por número): dos capturas simultáneas con el mismo teléfono o correo nuevos ya no crean dos clientas (ni
 * fallan por el correo único). Debe llamarse dentro de la transacción, antes de `findCustomerByContact`.
 */
export async function lockCustomerContact(
  tx: Prisma.TransactionClient,
  contact: { email: string | null; phone: string | null },
): Promise<void> {
  const phoneKey = mxNationalNumber(contact.phone) ?? normalizePhone(contact.phone);
  const keys = [contact.email ? `customer-contact:email:${contact.email}` : null, phoneKey ? `customer-contact:phone:${phoneKey}` : null]
    .filter((k): k is string => k !== null)
    .sort(); // mismo orden en todas las transacciones: sin interbloqueos
  for (const key of keys) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }
}

/** Máximo de clientas que aporta una búsqueda por teléfono a los buscadores del panel. */
const PHONE_SEARCH_LIMIT = 500;

/**
 * Filtro de búsqueda por teléfono para los buscadores del panel (clientas, eventos, cotizaciones y los
 * selectores de clienta): clientas cuyo teléfono o WhatsApp CONTIENE esos dígitos sin importar el formato
 * guardado (forma canónica "+52…", 10 dígitos o filas antiguas con espacios/guiones). Un teléfono mexicano
 * completo se busca por su número nacional (`phoneSearchDigits`), así "+52 1 55…", "55 1234 5678" y
 * "5512345678" encuentran lo mismo. null si lo buscado no parece un teléfono (sólo dígitos, espacios, "+",
 * guiones, puntos o paréntesis: un folio como "EV-2345" no busca teléfonos) o tiene menos de 4 dígitos.
 */
export async function customerPhoneSearchFilter(db: Db, query: string): Promise<Prisma.CustomerWhereInput | null> {
  const q = query.trim();
  if (!/^[+\d\s().-]+$/.test(q)) return null;
  const digits = phoneSearchDigits(q);
  if (digits.length < 4) return null;
  const pattern = `%${digits}%`; // sólo dígitos: sin comodines de LIKE
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Customer"
    WHERE regexp_replace(coalesce("phone", ''), '[^0-9]', '', 'g') LIKE ${pattern}
       OR regexp_replace(coalesce("whatsapp", ''), '[^0-9]', '', 'g') LIKE ${pattern}
    ORDER BY "createdAt" DESC
    LIMIT ${PHONE_SEARCH_LIMIT}`;
  return { id: { in: rows.map((r) => r.id) } };
}
