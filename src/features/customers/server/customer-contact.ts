import "server-only";
import type { Customer, Prisma, PrismaClient } from "@prisma/client";
import { ValidationError } from "@/lib/errors";
import { normalizePhone, phoneMatchKeys } from "@/lib/phone";

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

/**
 * Clienta con ese teléfono, aunque se haya guardado con otro formato antes de la forma canónica
 * ("55 1234 5678", "5512345678", "+52 1 55…"): compara sólo los dígitos contra las formas del mismo
 * número (`phoneMatchKeys`). Si varias coinciden, la más antigua. No modifica datos.
 */
export async function findCustomerByPhone(db: Db, phone: string | null | undefined): Promise<Customer | null> {
  const keys = phoneMatchKeys(phone);
  if (!keys.length) return null;
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Customer"
    WHERE "phone" IS NOT NULL
      AND regexp_replace("phone", '[^0-9]', '', 'g') = ANY(${keys}::text[])
    ORDER BY "createdAt" ASC, "id" ASC
    LIMIT 1`;
  return rows[0] ? db.customer.findUnique({ where: { id: rows[0].id } }) : null;
}

/** Regla única «busca o crea clienta»: primero por correo (exacto, en minúsculas) y después por teléfono. */
export async function findCustomerByContact(
  db: Db,
  contact: { email: string | null; phone: string | null },
): Promise<Customer | null> {
  const byEmail = contact.email ? await db.customer.findUnique({ where: { email: contact.email } }) : null;
  return byEmail ?? (await findCustomerByPhone(db, contact.phone));
}
