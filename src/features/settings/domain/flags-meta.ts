/**
 * Metadatos de feature flags para la UI (cliente y servidor). La lista debe coincidir con
 * FEATURE_FLAGS de @/lib/flags (server-only); aquí se repite para poder usarla en el cliente.
 */
export const FLAG_KEYS = [
  "AI_DESIGNER_ENABLED",
  "PAYMENTS_ENABLED",
  "WHATSAPP_ENABLED",
  "MEMORY_CAPSULE_ENABLED",
] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];

export const FLAG_META: Record<FlagKey, { label: string; description: string; offImpact: string }> = {
  AI_DESIGNER_ENABLED: {
    label: "Diseñador con IA",
    description: "Muestra el diseñador de experiencias con IA en el sitio público.",
    offImpact: "El sitio oculta el diseñador; el configurador sigue funcionando.",
  },
  PAYMENTS_ENABLED: {
    label: "Pagos en línea",
    description: "Permite pagar anticipos y saldos en línea desde la propuesta y el portal de la clienta.",
    offImpact: "Las clientas verán instrucciones para pagar por transferencia o con el equipo.",
  },
  WHATSAPP_ENABLED: {
    label: "Mensajes por WhatsApp",
    description: "Envía notificaciones automáticas por WhatsApp además del email.",
    offImpact: "Los mensajes de WhatsApp se registran como omitidos en la bandeja.",
  },
  MEMORY_CAPSULE_ENABLED: {
    label: "Memory Capsule",
    description: "Habilita el álbum de recuerdos post-evento para clientas e invitadas.",
    offImpact: "Los enlaces a la Memory Capsule dejan de compartirse en los mensajes post-evento.",
  },
};

export type FlagState = {
  flag: FlagKey;
  /** Valor de la variable de entorno (default true si no está definida) */
  envDefault: boolean;
  /** Valor guardado en la base (undefined = sin override) */
  override: boolean | undefined;
  /** Valor efectivo que usa la app */
  effective: boolean;
};

/** Resuelve el estado efectivo: override de DB > variable de entorno. */
export function resolveFlagState(flag: FlagKey, envDefault: boolean, override: boolean | undefined): FlagState {
  return { flag, envDefault, override, effective: typeof override === "boolean" ? override : envDefault };
}
