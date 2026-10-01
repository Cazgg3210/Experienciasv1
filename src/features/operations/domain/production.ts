/**
 * Lógica pura de la orden de producción: porciones, restricciones alimentarias,
 * faltantes de inventario por fecha.
 */
import type {
  DietaryRestriction,
  InventoryCategory,
  InventoryReservationStatus,
  MenuCourse,
  RsvpStatus,
} from "@prisma/client";
import { dateOnly, localDateKey } from "@/lib/dates";

export type GuestForProduction = {
  name: string;
  rsvpStatus: RsvpStatus;
  plusOne: boolean;
  plusOneName: string | null;
  dietaryRestrictions: DietaryRestriction[];
  dietaryNotes: string | null;
};

export type HeadCount = {
  planned: number;
  invited: number;
  attending: number;
  plusOnes: number;
  confirmedTotal: number;
  pending: number;
  maybe: number;
  notAttending: number;
  /** max(planeadas, confirmadas + acompañantes) */
  portions: number;
};

export function computeHeadCount(plannedGuests: number, guests: GuestForProduction[]): HeadCount {
  let attending = 0;
  let plusOnes = 0;
  let pending = 0;
  let maybe = 0;
  let notAttending = 0;
  for (const g of guests) {
    if (g.rsvpStatus === "ATTENDING") {
      attending++;
      if (g.plusOne) plusOnes++;
    } else if (g.rsvpStatus === "PENDING") pending++;
    else if (g.rsvpStatus === "MAYBE") maybe++;
    else notAttending++;
  }
  const confirmedTotal = attending + plusOnes;
  return {
    planned: plannedGuests,
    invited: guests.length,
    attending,
    plusOnes,
    confirmedTotal,
    pending,
    maybe,
    notAttending,
    portions: Math.max(plannedGuests, confirmedTotal),
  };
}

/** Porciones de cortesía sugeridas (10 %, mínimo 1). */
export function bufferPortions(portions: number): number {
  if (portions <= 0) return 0;
  return Math.max(1, Math.ceil(portions * 0.1));
}

/** Factor de escala sobre la receta base de la experiencia (p. ej. base 6 → 9 personas = ×1.5). */
export function scaleFactor(portions: number, baseGuests: number): number {
  if (baseGuests <= 0) return 1;
  return Math.round((portions / baseGuests) * 100) / 100;
}

export const COURSE_ORDER: MenuCourse[] = ["DRINK", "STARTER", "MAIN", "SIDE", "DESSERT", "OTHER"];

export function groupByCourse<T extends { course: MenuCourse; sortOrder: number }>(
  items: T[],
): Array<{ course: MenuCourse; items: T[] }> {
  return COURSE_ORDER.map((course) => ({
    course,
    items: items.filter((i) => i.course === course).sort((a, b) => a.sortOrder - b.sortOrder),
  })).filter((g) => g.items.length > 0);
}

export type DietaryEntry = { name: string; rsvpStatus: RsvpStatus; notes: string | null };
export type DietarySummary = {
  byRestriction: Array<{ restriction: DietaryRestriction; guests: DietaryEntry[] }>;
  /** Invitadas con notas pero sin restricción marcada */
  notesOnly: DietaryEntry[];
  totalGuestsWithNeeds: number;
};

const RESTRICTION_ORDER: DietaryRestriction[] = [
  "NUT_ALLERGY",
  "SEAFOOD_ALLERGY",
  "GLUTEN_FREE",
  "LACTOSE_FREE",
  "VEGAN",
  "VEGETARIAN",
  "KOSHER",
  "HALAL",
  "OTHER",
];

/** Agrega restricciones de invitadas que asisten o aún no responden (excluye "No asiste"). */
export function aggregateDietary(guests: GuestForProduction[]): DietarySummary {
  const relevant = guests.filter((g) => g.rsvpStatus !== "NOT_ATTENDING");
  const map = new Map<DietaryRestriction, DietaryEntry[]>();
  const notesOnly: DietaryEntry[] = [];
  let withNeeds = 0;
  for (const g of relevant) {
    const notes = g.dietaryNotes?.trim() || null;
    if (g.dietaryRestrictions.length === 0 && !notes) continue;
    withNeeds++;
    if (g.dietaryRestrictions.length === 0) {
      notesOnly.push({ name: g.name, rsvpStatus: g.rsvpStatus, notes });
      continue;
    }
    for (const r of new Set(g.dietaryRestrictions)) {
      const list = map.get(r) ?? [];
      list.push({ name: g.name, rsvpStatus: g.rsvpStatus, notes });
      map.set(r, list);
    }
  }
  return {
    byRestriction: RESTRICTION_ORDER.filter((r) => map.has(r)).map((r) => ({ restriction: r, guests: map.get(r)! })),
    notesOnly,
    totalGuestsWithNeeds: withNeeds,
  };
}

/** Categorías de la sección "Mesa" (vajilla, cristalería, mantelería, cubiertos). */
export const TABLE_CATEGORIES: InventoryCategory[] = ["DINNERWARE", "GLASSWARE", "LINENS", "CUTLERY"];

export function isFloralAddOn(addOn: { slug: string; name: string }): boolean {
  const s = `${addOn.slug} ${addOn.name}`.toLowerCase();
  return s.includes("flor") || s.includes("floral");
}

// -----------------------------------------------------------------------------
// Faltantes de inventario por fecha
// -----------------------------------------------------------------------------

export const ACTIVE_RESERVATION_STATUSES: InventoryReservationStatus[] = ["RESERVED", "CHECKED_OUT"];

export type ReservationForShortage = {
  eventId: string;
  dateKey: string;
  inventoryItemId: string;
  quantity: number;
  status: InventoryReservationStatus;
};

export type StockForShortage = { id: string; totalQuantity: number; maintenanceQuantity: number };

export type ShortageInfo = { inventoryItemId: string; dateKey: string; reserved: number; available: number };

/**
 * Para cada fecha, suma las reservas activas por artículo y compara con el stock utilizable
 * (total − mantenimiento). Devuelve, por evento, los artículos en conflicto.
 */
export function computeShortagesByEvent(
  reservations: ReservationForShortage[],
  stock: StockForShortage[],
): Map<string, ShortageInfo[]> {
  const usable = new Map(stock.map((s) => [s.id, Math.max(0, s.totalQuantity - s.maintenanceQuantity)]));
  const totals = new Map<string, number>();
  const active = reservations.filter((r) => ACTIVE_RESERVATION_STATUSES.includes(r.status));
  for (const r of active) {
    const key = `${r.dateKey}|${r.inventoryItemId}`;
    totals.set(key, (totals.get(key) ?? 0) + r.quantity);
  }
  const result = new Map<string, ShortageInfo[]>();
  for (const r of active) {
    const reserved = totals.get(`${r.dateKey}|${r.inventoryItemId}`) ?? 0;
    const available = usable.get(r.inventoryItemId) ?? 0;
    if (reserved > available) {
      const list = result.get(r.eventId) ?? [];
      if (!list.some((s) => s.inventoryItemId === r.inventoryItemId)) {
        list.push({ inventoryItemId: r.inventoryItemId, dateKey: r.dateKey, reserved, available });
      }
      result.set(r.eventId, list);
    }
  }
  return result;
}

/** URL de mapas: la guardada o una búsqueda de Google Maps con la dirección completa. */
export function mapsLink(event: {
  mapsUrl: string | null;
  addressLine: string | null;
  neighborhood: string | null;
  city: string | null;
  postalCode: string | null;
}): string | null {
  if (event.mapsUrl && /^https?:\/\//i.test(event.mapsUrl)) return event.mapsUrl;
  const address = fullAddress(event);
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function fullAddress(event: {
  addressLine: string | null;
  neighborhood: string | null;
  city: string | null;
  postalCode: string | null;
}): string | null {
  if (!event.addressLine && !event.neighborhood) return null;
  const parts = [
    event.addressLine,
    event.neighborhood ? `Col. ${event.neighborhood}` : null,
    event.postalCode ? `C.P. ${event.postalCode}` : null,
    event.city,
  ].filter(Boolean);
  return parts.join(", ");
}

/** Primera letra en mayúscula ("sábado 10 de octubre" → "Sábado 10 de octubre"). */
export function ucfirst(value: string): string {
  return value ? value.charAt(0).toLocaleUpperCase("es-MX") + value.slice(1) : value;
}

/**
 * Días naturales entre hoy (CDMX) y una fecha @db.Date (medianoche UTC).
 * Evita el desfase de `daysUntil` con columnas de sólo fecha.
 */
export function daysUntilDateOnly(eventDate: Date, now: Date = new Date()): number {
  const todayUtc = dateOnly(localDateKey(now)).getTime();
  const target = Date.UTC(eventDate.getUTCFullYear(), eventDate.getUTCMonth(), eventDate.getUTCDate());
  return Math.round((target - todayUtc) / 86_400_000);
}
