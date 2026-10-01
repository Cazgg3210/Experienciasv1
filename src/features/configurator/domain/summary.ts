/**
 * Resumen legible (español) de las elecciones del wizard. Puro: recibe el catálogo público.
 */
import { OCCASION_LABELS } from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import type { Occasion } from "@prisma/client";
import { longDateLabel } from "./calendar";
import type { ConfiguratorDraft, StepId } from "./wizard";

type CatalogLike = {
  areas: Array<{ id: string; name: string }>;
  styles: Array<{ id: string; name: string }>;
  experiences: Array<{ id: string; name: string }>;
  menus: Array<{ id: string; name: string; pricingType: string; priceCents: number }>;
  addOns: Array<{ id: string; name: string }>;
  budgetRanges: Array<{ id: string; label: string }>;
};

export type SummaryRow = { step: StepId; label: string; value: string | null };

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function occasionText(d: Pick<ConfiguratorDraft, "occasion" | "occasionOther">): string | null {
  if (!d.occasion) return null;
  if (d.occasion === "OTHER")
    return d.occasionOther.trim() ? `Otra: ${d.occasionOther.trim()}` : OCCASION_LABELS.OTHER;
  return OCCASION_LABELS[d.occasion as Occasion];
}

export function menuPriceLabel(m: { pricingType: string; priceCents: number }): string {
  if (m.pricingType === "PER_GUEST") return `+${formatMXN(m.priceCents)} por persona`;
  if (m.pricingType === "FLAT") return `+${formatMXN(m.priceCents)} por evento`;
  return "Incluido";
}

export function summaryRows(d: ConfiguratorDraft, c: CatalogLike): SummaryRow[] {
  const area = c.areas.find((a) => a.id === d.serviceAreaId);
  const zone = d.zoneOther
    ? d.zoneText.trim()
      ? `Otra zona: ${d.zoneText.trim()}`
      : "Otra zona"
    : (area?.name ?? null);
  const menu = c.menus.find((m) => m.id === d.menuId);
  const addOns = Object.entries(d.addOns)
    .map(([id, qty]) => {
      const a = c.addOns.find((x) => x.id === id);
      return a ? (qty > 1 ? `${a.name} ×${qty}` : a.name) : null;
    })
    .filter((x): x is string => !!x);
  const budget = d.budgetUndecided
    ? "Prefiero platicarlo"
    : (c.budgetRanges.find((b) => b.id === d.budgetRangeId)?.label ?? null);

  return [
    { step: 1, label: "Ocasión", value: occasionText(d) },
    {
      step: 2,
      label: "Fecha",
      value: d.eventDate ? `${capitalize(longDateLabel(d.eventDate))} · ${d.startTime} h` : null,
    },
    { step: 3, label: "Zona", value: zone },
    { step: 4, label: "Invitadas", value: `${d.guestCount} personas` },
    { step: 5, label: "Estilo", value: c.styles.find((s) => s.id === d.styleId)?.name ?? null },
    {
      step: 6,
      label: "Experiencia",
      value: c.experiences.find((e) => e.id === d.experienceId)?.name ?? null,
    },
    { step: 7, label: "Menú", value: menu ? `${menu.name} (${menuPriceLabel(menu).toLowerCase()})` : null },
    { step: 8, label: "Extras", value: addOns.length ? addOns.join(", ") : "Sin extras" },
    { step: 9, label: "Colores", value: d.colors.length ? d.colors.join(", ") : null },
    { step: 9, label: "Homenajeada", value: d.honoreeName.trim() || null },
    { step: 9, label: "Inspiración", value: d.inspiration.trim() || null },
    { step: 9, label: "Notas", value: d.notes.trim() || null },
    { step: 10, label: "Presupuesto", value: budget },
  ];
}
