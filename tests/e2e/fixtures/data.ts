/**
 * Datos de prueba: cada prueba crea lo que necesita con valores ÚNICOS, para que las pruebas sean
 * independientes entre sí y repetibles (no dependen del orden ni de otra prueba).
 *
 * Reglas:
 *  - Lectura: puedes usar entidades del seed DEMO (ver accounts.ts → TOKENS).
 *  - Escritura: crea tu propia entidad con estas factories (nunca mutes las del seed: son compartidas).
 *  - Prefijo "E2E" en nombres/correos para identificarlas en la base.
 * Agrega aquí nuevas factories a medida que se cubren módulos (una por entidad, reutilizables).
 */
import type { PrismaClient, Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";

export function uniq(prefix = "E2E"): string {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

export function uniqEmail(prefix = "e2e"): string {
  return `${uniq(prefix).toLowerCase()}@e2e.ivonne-rosa.test`;
}

/** Teléfono MX de 10 dígitos único (para formularios que lo validan). */
export function uniqPhone(): string {
  return `55${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
}

function code(prefix: string): string {
  return `${prefix}-E2E-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function createCustomer(db: PrismaClient, data: Partial<Prisma.CustomerCreateInput> = {}) {
  const name = data.name ?? `Clienta ${uniq()}`;
  return db.customer.create({
    data: {
      name,
      email: data.email ?? uniqEmail("clienta"),
      phone: data.phone ?? uniqPhone(),
      referralCode: data.referralCode ?? code("IR"),
      source: data.source ?? "MANUAL",
      ...data,
    },
  });
}

export async function createLead(db: PrismaClient, data: Partial<Prisma.LeadUncheckedCreateInput> = {}) {
  const customer = data.customerId ? null : await createCustomer(db);
  return db.lead.create({
    data: {
      code: code("L"),
      name: data.name ?? customer?.name ?? `Lead ${uniq()}`,
      email: data.email ?? customer?.email ?? uniqEmail("lead"),
      phone: data.phone ?? customer?.phone ?? uniqPhone(),
      occasion: data.occasion ?? "BIRTHDAY",
      status: data.status ?? "NEW",
      source: data.source ?? "MANUAL",
      guestCount: data.guestCount ?? 8,
      customerId: data.customerId ?? customer!.id,
      ...data,
    },
  });
}

export async function createUnreadNotification(db: PrismaClient, data: Partial<Prisma.NotificationLogUncheckedCreateInput> = {}) {
  return db.notificationLog.create({
    data: {
      type: data.type ?? "GENERIC",
      channel: data.channel ?? "EMAIL",
      status: data.status ?? "MOCKED",
      provider: data.provider ?? "mock-email",
      to: data.to ?? uniqEmail("aviso"),
      subject: data.subject ?? `E2E aviso ${uniq()}`,
      body: data.body ?? "Mensaje de prueba E2E",
      readAt: null,
      ...data,
    },
  });
}
