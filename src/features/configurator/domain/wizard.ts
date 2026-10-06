/**
 * Lógica pura del wizard del configurador (sin I/O ni React): pasos, validación por paso,
 * normalización de datos, reconciliación con el catálogo y armado del payload final.
 */
import { mxNationalNumber } from "@/lib/phone";
import type { ConfiguratorOccasion } from "../schemas";

export const TOTAL_STEPS = 10;

export type StepId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const STEPS: ReadonlyArray<{ id: StepId; key: string; title: string; short: string }> = [
  { id: 1, key: "occasion", title: "¿Qué celebramos?", short: "Ocasión" },
  { id: 2, key: "date", title: "¿Cuándo será?", short: "Fecha" },
  { id: 3, key: "zone", title: "¿Dónde será?", short: "Zona" },
  { id: 4, key: "guests", title: "¿Cuántas personas serán?", short: "Invitados" },
  { id: 5, key: "style", title: "¿Qué estilo te enamora?", short: "Estilo" },
  { id: 6, key: "experience", title: "Elige tu experiencia", short: "Experiencia" },
  { id: 7, key: "menu", title: "¿Qué menú les servimos?", short: "Menú" },
  { id: 8, key: "addons", title: "¿Algún detalle extra?", short: "Extras" },
  { id: 9, key: "preferences", title: "Hazla tuya", short: "Preferencias" },
  { id: 10, key: "budget", title: "¿Qué presupuesto tienes en mente?", short: "Presupuesto" },
];

/** Estado del wizard en el cliente (se persiste en localStorage). */
export type ConfiguratorDraft = {
  occasion: ConfiguratorOccasion | null;
  occasionOther: string;
  eventDate: string | null;
  startTime: string;
  serviceAreaId: string | null;
  zoneOther: boolean;
  zoneText: string;
  guestCount: number;
  styleId: string | null;
  experienceId: string | null;
  menuId: string | null;
  /** addOnId -> cantidad */
  addOns: Record<string, number>;
  colors: string[];
  honoreeName: string;
  notes: string;
  inspiration: string;
  budgetRangeId: string | null;
  budgetUndecided: boolean;
};

export function emptyDraft(opts: { guestCount?: number; startTime?: string } = {}): ConfiguratorDraft {
  return {
    occasion: null,
    occasionOther: "",
    eventDate: null,
    startTime: opts.startTime ?? "11:00",
    serviceAreaId: null,
    zoneOther: false,
    zoneText: "",
    guestCount: opts.guestCount ?? 8,
    styleId: null,
    experienceId: null,
    menuId: null,
    addOns: {},
    colors: [],
    honoreeName: "",
    notes: "",
    inspiration: "",
    budgetRangeId: null,
    budgetUndecided: false,
  };
}

export type StepContext = {
  guestsMin: number;
  guestsMax: number;
  /** Menús compatibles con la experiencia elegida */
  compatibleMenuIds: string[];
  /** Días que no se pueden elegir (lleno/cerrado) si ya se conocen */
  unavailableDates?: ReadonlySet<string>;
  /** false si el catálogo no tiene estilos activos (el paso 5 se puede omitir) */
  hasStyles?: boolean;
};

/** Devuelve un mensaje de error (español) si el paso no está completo, o null si se puede avanzar. */
export function validateStep(step: StepId, d: ConfiguratorDraft, ctx: StepContext): string | null {
  switch (step) {
    case 1:
      if (!d.occasion) return "Elige qué celebramos para continuar.";
      if (d.occasion === "OTHER" && d.occasionOther.trim().length < 2)
        return "Cuéntanos brevemente qué celebramos.";
      return null;
    case 2:
      if (!d.eventDate) return "Elige una fecha en el calendario.";
      if (ctx.unavailableDates?.has(d.eventDate))
        return "Ese día ya no tenemos lugar; elige otra fecha, por favor.";
      if (!isValidTime(d.startTime)) return "Elige una hora de inicio.";
      return null;
    case 3:
      if (d.zoneOther) {
        return d.zoneText.trim().length >= 2 ? null : "Escribe tu colonia o alcaldía.";
      }
      return d.serviceAreaId ? null : "Elige la zona de tu evento.";
    case 4:
      if (!Number.isInteger(d.guestCount)) return "Indica cuántas personas serán.";
      if (d.guestCount < ctx.guestsMin) return `El mínimo es de ${ctx.guestsMin} personas.`;
      if (d.guestCount > ctx.guestsMax)
        return `Para más de ${ctx.guestsMax} personas escríbenos por WhatsApp.`;
      return null;
    case 5:
      if (ctx.hasStyles === false) return null;
      return d.styleId ? null : "Elige el estilo que más te guste.";
    case 6:
      return d.experienceId ? null : "Elige una experiencia base.";
    case 7:
      if (ctx.compatibleMenuIds.length === 0) return null;
      if (!d.menuId) return "Elige un menú.";
      if (!ctx.compatibleMenuIds.includes(d.menuId))
        return "Ese menú no está disponible para esta experiencia.";
      return null;
    case 8:
      return null;
    case 9:
      if (d.notes.length > 1000) return "Tus notas son un poco largas (máximo 1,000 caracteres).";
      if (d.inspiration.length > 500) return "La inspiración admite máximo 500 caracteres.";
      if (d.honoreeName.length > 80) return "El nombre admite máximo 80 caracteres.";
      return null;
    case 10:
      return d.budgetRangeId || d.budgetUndecided
        ? null
        : "Elige un rango o la opción “Prefiero platicarlo”.";
  }
}

/** Primer paso incompleto (o null si todo está listo para el resumen). */
export function firstInvalidStep(d: ConfiguratorDraft, ctx: StepContext): StepId | null {
  for (const s of STEPS) {
    if (validateStep(s.id, d, ctx)) return s.id;
  }
  return null;
}

export function isValidTime(v: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/** Opciones de hora de inicio (HH:mm) cada `stepMinutes` entre `from` y `to` (incluidos). */
export function startTimeOptions(from = "08:00", to = "18:00", stepMinutes = 30): string[] {
  const toMin = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
  const out: string[] = [];
  for (let m = toMin(from); m <= toMin(to); m += stepMinutes) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}

/**
 * Teléfono mexicano a 10 dígitos (acepta espacios, guiones, +52 y 521). null si no es válido.
 * Misma regla que el resto del sistema (`@/lib/phone`); la forma que se guarda es "+52" + estos 10 dígitos.
 */
export function normalizeMxPhone10(input: string | null | undefined): string | null {
  return mxNationalNumber(input);
}

/** "Polanco, Granada e Irrigación" (conjunción española con y/e). */
export function joinSpanishList(items: string[]): string {
  const list = items.filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0]!;
  const last = list[list.length - 1]!;
  const conj = /^(i|hi)(?!e)/i.test(last.normalize("NFD").replace(/[̀-ͯ]/g, "")) ? "e" : "y";
  return `${list.slice(0, -1).join(", ")} ${conj} ${last}`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name.trim();
}

/**
 * Ajusta el borrador cuando cambia la experiencia: quita menú/add-ons incompatibles,
 * limita cantidades al máximo y preselecciona un menú incluido si no hay uno válido.
 */
export function reconcileWithExperience(
  d: ConfiguratorDraft,
  exp: { menuIds: string[]; addOnIds: string[] } | null,
  catalog: {
    menus: Array<{ id: string; pricingType: string }>;
    addOns: Array<{ id: string; maxQuantity: number }>;
  },
): ConfiguratorDraft {
  if (!exp) return { ...d, menuId: null, addOns: {} };
  const menuValid = d.menuId != null && exp.menuIds.includes(d.menuId);
  let menuId = menuValid ? d.menuId : null;
  if (!menuId) {
    const compatible = catalog.menus.filter((m) => exp.menuIds.includes(m.id));
    menuId = (compatible.find((m) => m.pricingType === "INCLUDED") ?? compatible[0])?.id ?? null;
  }
  const addOns: Record<string, number> = {};
  for (const [addOnId, qty] of Object.entries(d.addOns)) {
    if (!exp.addOnIds.includes(addOnId)) continue;
    const a = catalog.addOns.find((x) => x.id === addOnId);
    if (!a) continue;
    const q = Math.min(Math.max(1, Math.floor(qty)), Math.max(1, a.maxQuantity));
    addOns[addOnId] = q;
  }
  return { ...d, menuId, addOns };
}

const OCCASION_SET = new Set<string>([
  "BIRTHDAY",
  "FRIENDS_BRUNCH",
  "BACHELORETTE",
  "BRIDAL",
  "BABY_BRUNCH",
  "GATHERING",
  "OTHER",
]);

export function parseOccasionParam(value: string | string[] | undefined | null): ConfiguratorOccasion | null {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v) return null;
  const up = v.trim().toUpperCase().replace(/-/g, "_");
  return OCCASION_SET.has(up) ? (up as ConfiguratorOccasion) : null;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/**
 * Restaura un borrador guardado (localStorage) validando forma y que los IDs sigan en el catálogo.
 * Nunca confía en lo guardado: todo lo inválido se descarta.
 */
export function sanitizeDraft(
  raw: unknown,
  ids: {
    styles: ReadonlySet<string>;
    experiences: ReadonlySet<string>;
    menus: ReadonlySet<string>;
    addOns: ReadonlySet<string>;
    areas: ReadonlySet<string>;
    budgets: ReadonlySet<string>;
  },
  defaults: {
    guestCount: number;
    startTime: string;
    guestsMin: number;
    guestsMax: number;
    todayKey?: string;
  },
): ConfiguratorDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const base = emptyDraft({ guestCount: defaults.guestCount, startTime: defaults.startTime });
  const occasion =
    typeof r.occasion === "string" && OCCASION_SET.has(r.occasion)
      ? (r.occasion as ConfiguratorOccasion)
      : null;
  // Una fecha guardada que ya pasó se descarta (hay que elegir otra)
  const eventDate =
    typeof r.eventDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.eventDate) &&
    (!defaults.todayKey || r.eventDate >= defaults.todayKey)
      ? r.eventDate
      : null;
  const startTime =
    typeof r.startTime === "string" && isValidTime(r.startTime) ? r.startTime : base.startTime;
  const pick = (v: unknown, set: ReadonlySet<string>) => (typeof v === "string" && set.has(v) ? v : null);
  const guestRaw =
    typeof r.guestCount === "number" && Number.isInteger(r.guestCount) ? r.guestCount : base.guestCount;
  const guestCount = Math.min(defaults.guestsMax, Math.max(defaults.guestsMin, guestRaw));
  const addOns: Record<string, number> = {};
  if (r.addOns && typeof r.addOns === "object" && !Array.isArray(r.addOns)) {
    for (const [k, v] of Object.entries(r.addOns as Record<string, unknown>)) {
      if (ids.addOns.has(k) && typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 20)
        addOns[k] = v;
    }
  }
  const colors = Array.isArray(r.colors)
    ? (r.colors as unknown[])
        .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
        .map((c) => c.slice(0, 30))
        .slice(0, 8)
    : [];
  return {
    occasion,
    occasionOther: str(r.occasionOther, 80),
    eventDate,
    startTime,
    serviceAreaId: pick(r.serviceAreaId, ids.areas),
    zoneOther: r.zoneOther === true,
    zoneText: str(r.zoneText, 120),
    guestCount,
    styleId: pick(r.styleId, ids.styles),
    experienceId: pick(r.experienceId, ids.experiences),
    menuId: pick(r.menuId, ids.menus),
    addOns,
    colors,
    honoreeName: str(r.honoreeName, 80),
    notes: str(r.notes, 1000),
    inspiration: str(r.inspiration, 500),
    budgetRangeId: pick(r.budgetRangeId, ids.budgets),
    budgetUndecided: r.budgetUndecided === true,
  };
}

/** Selección para el estimado en servidor (o null si aún no hay experiencia). */
export function toEstimateSelection(d: ConfiguratorDraft) {
  if (!d.experienceId) return null;
  return {
    experienceId: d.experienceId,
    guestCount: d.guestCount,
    menuId: d.menuId,
    addOns: Object.entries(d.addOns)
      .filter(([, q]) => q > 0)
      .map(([addOnId, quantity]) => ({ addOnId, quantity })),
    serviceAreaId: d.zoneOther ? null : d.serviceAreaId,
  };
}

/** Payload de selecciones para el envío final (el servidor revalida todo). */
export function toSubmitSelections(d: ConfiguratorDraft) {
  return {
    occasion: d.occasion ?? "OTHER",
    occasionOther: d.occasion === "OTHER" ? d.occasionOther.trim() : "",
    eventDate: d.eventDate ?? "",
    startTime: d.startTime,
    serviceAreaId: d.zoneOther ? null : d.serviceAreaId,
    zoneText: d.zoneOther ? d.zoneText.trim() : null,
    guestCount: d.guestCount,
    styleId: d.styleId,
    experienceId: d.experienceId ?? "",
    menuId: d.menuId,
    addOns: Object.entries(d.addOns)
      .filter(([, q]) => q > 0)
      .map(([addOnId, quantity]) => ({ addOnId, quantity })),
    colors: d.colors,
    honoreeName: d.honoreeName.trim(),
    notes: d.notes.trim(),
    inspiration: d.inspiration.trim(),
    budgetRangeId: d.budgetUndecided ? null : d.budgetRangeId,
    budgetUndecided: d.budgetUndecided,
  };
}

/** Mapea un campo con error del servidor al paso donde se edita. */
export function stepForField(field: string): StepId | null {
  const f = field.split(".")[0] ?? field;
  const map: Record<string, StepId> = {
    occasion: 1,
    occasionOther: 1,
    eventDate: 2,
    startTime: 2,
    serviceAreaId: 3,
    zoneText: 3,
    guestCount: 4,
    styleId: 5,
    experienceId: 6,
    menuId: 7,
    addOns: 8,
    colors: 9,
    honoreeName: 9,
    notes: 9,
    inspiration: 9,
    budgetRangeId: 10,
  };
  return map[f] ?? null;
}
