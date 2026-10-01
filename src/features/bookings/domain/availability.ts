/**
 * Disponibilidad V1 (pura, sin I/O). Sin optimización compleja: reglas por día de la semana,
 * excepciones (bloqueos/blackouts/capacidad), capacidad máxima de eventos por día, buffers,
 * anticipación mínima/máxima y zonas. Evita double-booking básico por capacidad.
 */

export type AvailabilityStatus =
  | "AVAILABLE"
  | "LIMITED"
  | "FULL"
  | "CLOSED"
  | "BLOCKED"
  | "TOO_SOON"
  | "TOO_FAR"
  | "PAST"
  | "OUT_OF_HOURS";

export type DayRule = { isOpen: boolean; maxEvents: number; earliestStart: string; latestEnd: string };

export type DayException = {
  type: "BLOCKED" | "BLACKOUT" | "CAPACITY_OVERRIDE";
  maxEvents: number | null;
  serviceAreaId: string | null;
  reason: string | null;
};

export type BookedEvent = { id: string; startsAt: Date; endsAt: Date; serviceAreaId: string | null };

export type AvailabilityContext = {
  dateKey: string; // YYYY-MM-DD
  todayKey: string; // YYYY-MM-DD (CDMX)
  rule: DayRule | null;
  exceptions: DayException[];
  events: BookedEvent[]; // eventos que ocupan capacidad ese día
  settings: { bufferMinutes: number; minLeadDays: number; maxAdvanceDays: number };
  serviceAreaId?: string | null;
  /** Horario solicitado (opcional) en HH:mm local y duración */
  startTime?: string | null;
  durationMinutes?: number | null;
  /** Al reprogramar un evento existente, no contarlo contra sí mismo */
  excludeEventId?: string | null;
  /** Instantes UTC del horario solicitado (si se conocen) para detectar traslapes con buffer */
  requestedStartsAt?: Date | null;
  requestedEndsAt?: Date | null;
};

export type AvailabilityResult = {
  status: AvailabilityStatus;
  /** true si se puede reservar (AVAILABLE o LIMITED) */
  available: boolean;
  /** true si se puede dejar una solicitud aunque no esté disponible (sujeto a revisión) */
  acceptsRequests: boolean;
  capacity: number;
  booked: number;
  remaining: number;
  reason: string;
  overlaps: string[]; // ids de eventos que se traslapan considerando buffer
};

function daysBetween(fromKey: string, toKey: string): number {
  const a = Date.UTC(+fromKey.slice(0, 4), +fromKey.slice(5, 7) - 1, +fromKey.slice(8, 10));
  const b = Date.UTC(+toKey.slice(0, 4), +toKey.slice(5, 7) - 1, +toKey.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function evaluateAvailability(ctx: AvailabilityContext): AvailabilityResult {
  const relevantEvents = ctx.events.filter((e) => e.id !== ctx.excludeEventId);
  const booked = relevantEvents.length;
  const base = { booked, overlaps: [] as string[] };
  const result = (
    status: AvailabilityStatus,
    reason: string,
    capacity: number,
    acceptsRequests: boolean,
  ): AvailabilityResult => ({
    ...base,
    status,
    reason,
    capacity,
    remaining: Math.max(0, capacity - booked),
    available: status === "AVAILABLE" || status === "LIMITED",
    acceptsRequests,
  });

  const lead = daysBetween(ctx.todayKey, ctx.dateKey);
  if (lead < 0) return result("PAST", "La fecha ya pasó.", 0, false);

  const appliesToArea = (ex: DayException) => !ex.serviceAreaId || ex.serviceAreaId === ctx.serviceAreaId;
  const block = ctx.exceptions.find((ex) => (ex.type === "BLOCKED" || ex.type === "BLACKOUT") && appliesToArea(ex));
  if (block) {
    return result(
      "BLOCKED",
      block.type === "BLACKOUT"
        ? `Fecha no disponible${block.reason ? `: ${block.reason}` : ""}.`
        : "No tenemos operación este día.",
      0,
      false,
    );
  }

  const override = ctx.exceptions.find((ex) => ex.type === "CAPACITY_OVERRIDE" && appliesToArea(ex));
  if (!ctx.rule?.isOpen && !override) return result("CLOSED", "No abrimos este día de la semana.", 0, false);

  const capacity = Math.max(0, override?.maxEvents ?? ctx.rule?.maxEvents ?? 0);

  if (lead < ctx.settings.minLeadDays) {
    return result(
      "TOO_SOON",
      `Necesitamos al menos ${ctx.settings.minLeadDays} días de anticipación; podemos revisar tu caso.`,
      capacity,
      true,
    );
  }
  if (lead > ctx.settings.maxAdvanceDays) {
    return result("TOO_FAR", "Aún no abrimos reservas para esa fecha.", capacity, true);
  }

  if (ctx.startTime && ctx.rule) {
    const start = toMinutes(ctx.startTime);
    const end = start + (ctx.durationMinutes ?? 0);
    if (start < toMinutes(ctx.rule.earliestStart) || end > toMinutes(ctx.rule.latestEnd)) {
      return result(
        "OUT_OF_HOURS",
        `Nuestro horario ese día es de ${ctx.rule.earliestStart} a ${ctx.rule.latestEnd}.`,
        capacity,
        true,
      );
    }
  }

  // Traslapes con buffer (informativo: con capacidad > 1 puede haber eventos en paralelo)
  if (ctx.requestedStartsAt && ctx.requestedEndsAt) {
    const bufferMs = ctx.settings.bufferMinutes * 60_000;
    const rs = ctx.requestedStartsAt.getTime() - bufferMs;
    const re = ctx.requestedEndsAt.getTime() + bufferMs;
    base.overlaps = relevantEvents
      .filter((e) => e.startsAt.getTime() < re && e.endsAt.getTime() > rs)
      .map((e) => e.id);
  }

  if (booked >= capacity) return result("FULL", "Ya no tenemos lugar ese día.", capacity, true);

  // Con capacidad 1 un traslape (incluyendo buffer) es double-booking
  if (capacity - booked === 1 && base.overlaps.length > 0 && capacity === 1) {
    return result("FULL", "El horario se cruza con otro evento.", capacity, true);
  }

  const remaining = capacity - booked;
  if (remaining === 1 && capacity > 1) return result("LIMITED", "¡Queda un último lugar ese día!", capacity, true);
  return result("AVAILABLE", "Fecha disponible.", capacity, true);
}

export const AVAILABILITY_STATUS_LABELS: Record<AvailabilityStatus, string> = {
  AVAILABLE: "Disponible",
  LIMITED: "Último lugar",
  FULL: "Lleno",
  CLOSED: "Cerrado",
  BLOCKED: "Bloqueado",
  TOO_SOON: "Muy pronto",
  TOO_FAR: "Muy lejos",
  PAST: "Pasado",
  OUT_OF_HOURS: "Fuera de horario",
};
