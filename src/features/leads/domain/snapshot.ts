/**
 * Lectura defensiva de ConfigurationSnapshot (JSON) y AiDesign.output para el admin.
 * El configurador y el diseñador IA pueden evolucionar su forma: aquí sólo se interpretan
 * campos conocidos y el resto se muestra de forma genérica. Puro, sin I/O.
 */
import type { Occasion } from "@prisma/client";
import { OCCASION_LABELS } from "@/lib/labels";
import { formatLongDate, isValidDateKey } from "@/lib/dates";

type Json = unknown;

function isRecord(value: Json): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function int(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Math.round(Number(value));
  return null;
}

export type CatalogRef = { id?: string; slug?: string };

export type SnapshotDataView = {
  experience: CatalogRef | null;
  menu: CatalogRef | null;
  style: CatalogRef | null;
  serviceArea: CatalogRef | null;
  addOns: Array<CatalogRef & { quantity: number }>;
  guestCount: number | null;
  /** Campos legibles (etiqueta + valor) listos para mostrarse. */
  fields: Array<{ key: string; label: string; value: string }>;
};

const FIELD_LABELS: Record<string, string> = {
  occasion: "Ocasión",
  occasionOther: "Otra ocasión",
  honoreeName: "Homenajeada",
  guestCount: "Invitadas",
  eventDate: "Fecha",
  startTime: "Hora de inicio",
  colors: "Colores",
  inspiration: "Inspiración",
  notes: "Notas",
  zoneText: "Zona escrita",
  postalCode: "Código postal",
  dietary: "Restricciones alimentarias",
  vibe: "Ambiente",
  budgetNotes: "Notas de presupuesto",
};

/** Llaves que se representan aparte (referencias de catálogo) o que no aportan al admin. */
const SKIP_KEYS = new Set([
  "experienceSlug",
  "experienceId",
  "menuSlug",
  "menuId",
  "styleSlug",
  "styleId",
  "serviceAreaSlug",
  "serviceAreaId",
  "addOns",
  "budgetRangeId",
  "contact",
  "step",
  "sessionId",
  "estimate",
  "marketingOptIn",
  "acceptPrivacy",
  // Metadatos técnicos (configurador v2 / diseñador IA)
  "meta",
  "aiDesignId",
  "promptVersion",
]);

function ref(data: Record<string, unknown>, base: string): CatalogRef | null {
  const id = str(data[`${base}Id`]);
  const slug = str(data[`${base}Slug`]);
  if (!id && !slug) return null;
  return { ...(id ? { id } : {}), ...(slug ? { slug } : {}) };
}

function humanize(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function formatValue(key: string, value: unknown): string | null {
  if (value == null) return null;
  if (key === "occasion" && typeof value === "string" && value in OCCASION_LABELS) {
    return OCCASION_LABELS[value as Occasion];
  }
  if (key === "eventDate" && typeof value === "string" && isValidDateKey(value)) return formatLongDate(value);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (Array.isArray(value)) {
    const parts = value.map((v) => str(v)).filter((v): v is string => !!v);
    return parts.length ? parts.join(", ") : null;
  }
  if (isRecord(value)) return null;
  return str(value);
}

export function parseSnapshotData(raw: Json): SnapshotDataView {
  const data = isRecord(raw) ? raw : {};
  const addOnsRaw = Array.isArray(data.addOns) ? data.addOns : [];
  const addOns = addOnsRaw
    .map((a) => {
      if (typeof a === "string") return { slug: a, quantity: 1 };
      if (!isRecord(a)) return null;
      const id = str(a.addOnId) ?? str(a.id);
      const slug = str(a.slug) ?? str(a.addOnSlug);
      if (!id && !slug) return null;
      return { ...(id ? { id } : {}), ...(slug ? { slug } : {}), quantity: Math.max(1, int(a.quantity) ?? 1) };
    })
    .filter((a): a is CatalogRef & { quantity: number } => a != null);

  const fields: SnapshotDataView["fields"] = [];
  const ordered = [
    ...Object.keys(FIELD_LABELS).filter((k) => k in data),
    ...Object.keys(data).filter((k) => !(k in FIELD_LABELS)),
  ];
  for (const key of ordered) {
    if (SKIP_KEYS.has(key)) continue;
    const value = formatValue(key, data[key]);
    if (!value) continue;
    fields.push({ key, label: FIELD_LABELS[key] ?? humanize(key), value });
  }

  return {
    experience: ref(data, "experience"),
    menu: ref(data, "menu"),
    style: ref(data, "style"),
    serviceArea: ref(data, "serviceArea"),
    addOns,
    guestCount: int(data.guestCount),
    fields,
  };
}

export type SnapshotContact = { name: string | null; email: string | null; phone: string | null };

export function parseSnapshotContact(raw: Json): SnapshotContact | null {
  if (!isRecord(raw) || !isRecord(raw.contact)) return null;
  const c = raw.contact;
  const contact = { name: str(c.name), email: str(c.email), phone: str(c.phone) };
  return contact.name || contact.email || contact.phone ? contact : null;
}

export type EstimateLine = {
  type: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number | null;
  totalPriceCents: number;
};

export type SnapshotEstimateView = {
  pricingVersion: string | null;
  lines: EstimateLine[];
  subtotalCents: number | null;
  discountCents: number | null;
  logisticsCents: number | null;
  taxCents: number | null;
  totalCents: number | null;
  depositCents: number | null;
  pricesIncludeTax: boolean | null;
  /** Avisos que también vio la clienta (grupo grande, mínimo de invitadas…). */
  warnings: string[];
  /** Avisos internos del motor (margen bajo/negativo, descuento topado). Sólo equipo con financials:read. */
  internalWarnings: string[];
  /** Sólo si el snapshot guardó costos (nunca se muestra al público). */
  internal: {
    estimatedCostCents: number | null;
    estimatedMarginCents: number | null;
    marginBps: number | null;
    belowMinMargin?: boolean;
  } | null;
};

/** Códigos de aviso del motor de precios que revelan costos/márgenes (no son para la clienta). */
export const INTERNAL_WARNING_CODES: readonly string[] = ["MARGIN_BELOW_MINIMUM", "NEGATIVE_MARGIN", "DISCOUNT_CAPPED"];

export function parseSnapshotEstimate(raw: Json): SnapshotEstimateView | null {
  if (!isRecord(raw)) return null;
  const lines = (Array.isArray(raw.lines) ? raw.lines : [])
    .map((l): EstimateLine | null => {
      if (!isRecord(l)) return null;
      const description = str(l.description);
      const total = int(l.totalPriceCents);
      if (!description || total == null) return null;
      return {
        type: str(l.type),
        description,
        quantity: int(l.quantity) ?? 1,
        unitPriceCents: int(l.unitPriceCents),
        totalPriceCents: total,
      };
    })
    .filter((l): l is EstimateLine => l != null);

  const totalCents = int(raw.totalCents);
  if (!lines.length && totalCents == null) return null;

  const cost = int(raw.estimatedCostCents);
  const margin = int(raw.estimatedMarginCents);
  const marginBps = int(raw.marginBps);
  const warnings: string[] = [];
  const internalWarnings: string[] = [];
  for (const w of Array.isArray(raw.warnings) ? raw.warnings : []) {
    const message = isRecord(w) ? str(w.message) : str(w);
    if (!message) continue;
    const code = isRecord(w) ? str(w.code) : null;
    (code && INTERNAL_WARNING_CODES.includes(code) ? internalWarnings : warnings).push(message);
  }
  return {
    pricingVersion: str(raw.pricingVersion),
    lines,
    subtotalCents: int(raw.subtotalCents),
    discountCents: int(raw.discountCents),
    logisticsCents: int(raw.logisticsCents),
    taxCents: int(raw.taxCents),
    totalCents,
    depositCents: int(raw.depositCents),
    pricesIncludeTax: typeof raw.pricesIncludeTax === "boolean" ? raw.pricesIncludeTax : null,
    warnings,
    internalWarnings,
    internal:
      cost != null || margin != null || marginBps != null
        ? {
            estimatedCostCents: cost,
            estimatedMarginCents: margin,
            marginBps,
            ...(typeof raw.belowMinMargin === "boolean" ? { belowMinMargin: raw.belowMinMargin } : {}),
          }
        : null,
  };
}

export type AiDesignView = {
  title: string | null;
  concept: string | null;
  palette: string[];
  details: Array<{ label: string; value: string }>;
  estimatedFromCents: number | null;
  disclaimer: string | null;
};

const AI_DETAIL_LABELS: Record<string, string> = {
  tableDescription: "Mesa",
  flowers: "Flores",
  music: "Música",
  menuIdea: "Idea de menú",
  experienceSlug: "Experiencia sugerida",
  styleSlug: "Estilo sugerido",
  menuSlug: "Menú sugerido",
  addOnSlugs: "Extras sugeridos",
};

const HEX_RE = /^#[0-9a-f]{3,8}$/i;

export function parseAiDesignOutput(raw: Json): AiDesignView | null {
  if (!isRecord(raw)) return null;
  const palette = (Array.isArray(raw.palette) ? raw.palette : [])
    .map((c) => str(c))
    .filter((c): c is string => !!c && HEX_RE.test(c))
    .slice(0, 8);
  const details: AiDesignView["details"] = [];
  for (const [key, label] of Object.entries(AI_DETAIL_LABELS)) {
    const value = formatValue(key, raw[key]);
    if (value) details.push({ label, value });
  }
  const view: AiDesignView = {
    title: str(raw.title),
    concept: str(raw.concept),
    palette,
    details,
    estimatedFromCents: int(raw.estimatedFromCents),
    disclaimer: str(raw.disclaimer),
  };
  return view.title || view.concept || details.length ? view : null;
}
