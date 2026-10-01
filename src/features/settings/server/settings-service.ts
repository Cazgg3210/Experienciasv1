import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { env } from "@/lib/env";
import { audit } from "@/server/audit";
import type { SessionUser } from "@/server/auth/session";
import {
  settingsSchemas,
  type FlagSettings,
  type SettingsKey,
  type SettingsMap,
} from "@/features/settings/domain/settings-schema";
import { FLAG_KEYS, resolveFlagState, type FlagKey, type FlagState } from "@/features/settings/domain/flags-meta";

type Tx = Prisma.TransactionClient;

/** Lee una sección de configuración (con defaults). Cacheado por request. */
export const getSettings = cache(async <K extends SettingsKey>(key: K): Promise<SettingsMap[K]> => {
  const row = await prisma.setting.findUnique({ where: { key } });
  const parsed = settingsSchemas[key].safeParse(row?.value ?? {});
  if (parsed.success) return parsed.data as SettingsMap[K];
  // Si la fila está corrupta, usar defaults (y no romper la app)
  return settingsSchemas[key].parse({}) as SettingsMap[K];
});

/** Lectura sin caché de request (para servicios que leen-modifican-escriben). */
async function readSettingsFresh<K extends SettingsKey>(key: K, db: Tx = prisma): Promise<SettingsMap[K]> {
  const row = await db.setting.findUnique({ where: { key } });
  const parsed = settingsSchemas[key].safeParse(row?.value ?? {});
  return (parsed.success ? parsed.data : settingsSchemas[key].parse({})) as SettingsMap[K];
}

/** Llave base de los locks transaccionales por sección (una llave por SettingsKey). */
const SETTINGS_LOCK_BASE = 72_011_100;
const SETTINGS_KEYS = Object.keys(settingsSchemas) as SettingsKey[];

/**
 * Ejecuta `fn` en una transacción con lock por sección: dos guardados simultáneos
 * (p. ej. dos switches de Funciones o dos fundadoras editando) no se pisan entre sí, y la
 * auditoría se escribe en la misma transacción (si no se puede auditar, no se guarda).
 */
async function withSettingsLock<T>(key: SettingsKey, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const lockId = SETTINGS_LOCK_BASE + SETTINGS_KEYS.indexOf(key);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;
    return fn(tx);
  });
}

async function writeSettings<K extends SettingsKey>(
  tx: Tx,
  key: K,
  value: unknown,
  actor: SessionUser,
): Promise<SettingsMap[K]> {
  const parsed = settingsSchemas[key].parse(value) as SettingsMap[K];
  const before = await tx.setting.findUnique({ where: { key } });
  await tx.setting.upsert({
    where: { key },
    create: { key, value: parsed as Prisma.InputJsonValue, updatedById: actor.id },
    update: { value: parsed as Prisma.InputJsonValue, updatedById: actor.id },
  });
  await audit(
    {
      action: key === "pricing" ? "settings.pricing_changed" : "settings.updated",
      entityType: "Setting",
      entityId: key,
      before: before?.value,
      after: parsed,
      actor,
    },
    tx,
  );
  return parsed;
}

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
  return withSettingsLock(key, (tx) => writeSettings(tx, key, value, actor));
}

/**
 * Lee la sección vigente (sin caché y bajo lock), aplica `updater`, guarda y audita.
 * Devuelve el valor anterior y el nuevo (p. ej. para describir los cambios en la UI).
 */
export async function updateSettingsWith<K extends SettingsKey>(
  key: K,
  updater: (current: SettingsMap[K]) => SettingsMap[K],
  actor: SessionUser,
): Promise<{ before: SettingsMap[K]; after: SettingsMap[K] }> {
  return withSettingsLock(key, async (tx) => {
    const before = await readSettingsFresh(key, tx);
    const after = await writeSettings(tx, key, updater(before), actor);
    return { before, after };
  });
}

/**
 * Actualiza sólo los campos indicados de una sección (conserva el resto) y audita.
 * Útil para formularios parciales: nunca borra campos que el formulario no conoce.
 */
export async function patchSettings<K extends SettingsKey>(
  key: K,
  patch: Partial<SettingsMap[K]>,
  actor: SessionUser,
): Promise<SettingsMap[K]> {
  const { after } = await updateSettingsWith(key, (current) => ({ ...current, ...patch }), actor);
  return after;
}

/** Fecha y autor de la última actualización de cada sección (para mostrar en la UI). */
export async function getSettingsMeta(): Promise<
  Partial<Record<SettingsKey, { updatedAt: Date; updatedBy: string | null }>>
> {
  const rows = await prisma.setting.findMany({
    select: { key: true, updatedAt: true, updatedBy: { select: { name: true } } },
  });
  const out: Partial<Record<SettingsKey, { updatedAt: Date; updatedBy: string | null }>> = {};
  for (const r of rows) {
    if (r.key in settingsSchemas) {
      out[r.key as SettingsKey] = { updatedAt: r.updatedAt, updatedBy: r.updatedBy?.name ?? null };
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// Feature flags (override en DB sobre la variable de entorno)
// -----------------------------------------------------------------------------

function envFlagDefault(flag: FlagKey): boolean {
  try {
    return env()[flag];
  } catch {
    return true;
  }
}

/** Estado de cada flag: valor de entorno, override guardado y valor efectivo. */
export async function getFlagStates(): Promise<FlagState[]> {
  const overrides = await readSettingsFresh("flags");
  return FLAG_KEYS.map((flag) => resolveFlagState(flag, envFlagDefault(flag), overrides[flag]));
}

async function writeFlags(tx: Tx, next: FlagSettings, actor: SessionUser) {
  const value = settingsSchemas.flags.parse(next);
  await tx.setting.upsert({
    where: { key: "flags" },
    create: { key: "flags", value: value as Prisma.InputJsonValue, updatedById: actor.id },
    update: { value: value as Prisma.InputJsonValue, updatedById: actor.id },
  });
}

/** Guarda un override de flag en DB (tiene prioridad sobre la variable de entorno). */
export async function setFlagOverride(flag: FlagKey, enabled: boolean, actor: SessionUser): Promise<FlagState> {
  return withSettingsLock("flags", async (tx) => {
    const current = await readSettingsFresh("flags", tx);
    const before = resolveFlagState(flag, envFlagDefault(flag), current[flag]);
    await writeFlags(tx, { ...current, [flag]: enabled }, actor);
    const after = resolveFlagState(flag, envFlagDefault(flag), enabled);
    await audit(
      {
        action: "settings.flag_changed",
        entityType: "Setting",
        entityId: `flags.${flag}`,
        before: { override: before.override ?? null, effective: before.effective },
        after: { override: enabled, effective: after.effective },
        actor,
      },
      tx,
    );
    return after;
  });
}

/** Elimina el override: el flag vuelve a tomar el valor de la variable de entorno. */
export async function resetFlagOverride(flag: FlagKey, actor: SessionUser): Promise<FlagState> {
  return withSettingsLock("flags", async (tx) => {
    const current = await readSettingsFresh("flags", tx);
    const before = resolveFlagState(flag, envFlagDefault(flag), current[flag]);
    const next: FlagSettings = { ...current };
    delete next[flag];
    await writeFlags(tx, next, actor);
    const after = resolveFlagState(flag, envFlagDefault(flag), undefined);
    await audit(
      {
        action: "settings.flag_reset",
        entityType: "Setting",
        entityId: `flags.${flag}`,
        before: { override: before.override ?? null, effective: before.effective },
        after: { override: null, effective: after.effective },
        actor,
      },
      tx,
    );
    return after;
  });
}
