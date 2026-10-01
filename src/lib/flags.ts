import "server-only";
import { env } from "@/lib/env";
import { getSettings } from "@/features/settings/server/settings-service";

export const FEATURE_FLAGS = [
  "AI_DESIGNER_ENABLED",
  "PAYMENTS_ENABLED",
  "WHATSAPP_ENABLED",
  "MEMORY_CAPSULE_ENABLED",
] as const;
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

/**
 * Feature flags: el valor de la DB (Setting "flags", editable en admin) tiene prioridad;
 * si no existe, se usa la variable de entorno (default true).
 */
export async function isEnabled(flag: FeatureFlag): Promise<boolean> {
  try {
    const overrides = await getSettings("flags");
    const override = overrides[flag];
    if (typeof override === "boolean") return override;
  } catch {
    // DB no disponible: caer a env
  }
  return env()[flag];
}

export async function getFlags(): Promise<Record<FeatureFlag, boolean>> {
  const entries = await Promise.all(FEATURE_FLAGS.map(async (f) => [f, await isEnabled(f)] as const));
  return Object.fromEntries(entries) as Record<FeatureFlag, boolean>;
}
