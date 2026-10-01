import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { audit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/session";
import {
  settingsSchemas,
  type SettingsKey,
  type SettingsMap,
} from "@/features/settings/domain/settings-schema";

/** Lee una sección de configuración (con defaults). Cacheado por request. */
export const getSettings = cache(async <K extends SettingsKey>(key: K): Promise<SettingsMap[K]> => {
  const row = await prisma.setting.findUnique({ where: { key } });
  const parsed = settingsSchemas[key].safeParse(row?.value ?? {});
  if (parsed.success) return parsed.data as SettingsMap[K];
  // Si la fila está corrupta, usar defaults (y no romper la app)
  return settingsSchemas[key].parse({}) as SettingsMap[K];
});

export async function getAllSettings(): Promise<SettingsMap> {
  const [business, pricing, availability, notifications, flags] = await Promise.all([
    getSettings("business"),
    getSettings("pricing"),
    getSettings("availability"),
    getSettings("notifications"),
    getSettings("flags"),
  ]);
  return { business, pricing, availability, notifications, flags };
}

export async function updateSettings<K extends SettingsKey>(
  key: K,
  value: unknown,
  actor: SessionUser,
): Promise<SettingsMap[K]> {
  const parsed = settingsSchemas[key].parse(value) as SettingsMap[K];
  const before = await prisma.setting.findUnique({ where: { key } });
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: parsed as Prisma.InputJsonValue, updatedById: actor.id },
    update: { value: parsed as Prisma.InputJsonValue, updatedById: actor.id },
  });
  await audit({
    action: key === "pricing" ? "settings.pricing_changed" : "settings.updated",
    entityType: "Setting",
    entityId: key,
    before: before?.value,
    after: parsed,
    actor,
  });
  return parsed;
}
