import { describe, expect, it } from "vitest";
import { CAPACITY_STATUSES } from "./event-status";
import { entersCapacity, isScheduleLocked, statusActionsFor } from "./status-actions";
import { baseMicrositeSlug, slugCandidates } from "./microsite-slug";
import { firstName, formatDuration, formatEventDay, formatTimeRange, relativeDayLabel } from "./format";

describe("statusActionsFor", () => {
  it("sigue la máquina de estados y marca la cancelación como destructiva", () => {
    const actions = statusActionsFor("INQUIRY");
    expect(actions.map((a) => a.to)).toEqual(["PENDING_PAYMENT", "CONFIRMED", "CANCELLED"]);
    expect(actions.find((a) => a.to === "CANCELLED")?.destructive).toBe(true);
    expect(actions.find((a) => a.to === "CONFIRMED")?.label).toBe("Confirmar evento");
  });
  it("estados finales no tienen acciones", () => {
    expect(statusActionsFor("COMPLETED")).toEqual([]);
    expect(statusActionsFor("CANCELLED")).toEqual([]);
  });
  it("en curso sólo puede completarse", () => {
    expect(statusActionsFor("IN_PROGRESS").map((a) => a.to)).toEqual(["COMPLETED"]);
  });
});

describe("reglas de estado", () => {
  it("bloquea reprogramar eventos cerrados", () => {
    expect(isScheduleLocked("CANCELLED")).toBe(true);
    expect(isScheduleLocked("COMPLETED")).toBe(true);
    expect(isScheduleLocked("PLANNING")).toBe(false);
  });
  it("detecta cuando un evento empieza a ocupar capacidad", () => {
    expect(entersCapacity("INQUIRY", "CONFIRMED", CAPACITY_STATUSES)).toBe(true);
    expect(entersCapacity("INQUIRY", "PENDING_PAYMENT", CAPACITY_STATUSES)).toBe(true);
    expect(entersCapacity("PENDING_PAYMENT", "CONFIRMED", CAPACITY_STATUSES)).toBe(false);
    expect(entersCapacity("READY", "IN_PROGRESS", CAPACITY_STATUSES)).toBe(false);
  });
});

describe("slug del micrositio", () => {
  it("usa el título sin acentos", () => {
    expect(baseMicrositeSlug({ title: "Cumpleaños de Sofía" })).toBe("cumpleanos-de-sofia");
  });
  it("cae a la homenajeada o a un default", () => {
    expect(baseMicrositeSlug({ title: "¡¡!!", honoreeName: "Ana Paula" })).toBe("ana-paula");
    expect(baseMicrositeSlug({ title: "***" })).toBe("celebracion");
  });
  it("recorta a 48 caracteres sin guion final", () => {
    const s = baseMicrositeSlug({ title: "a".repeat(47) + " bbbbbb" });
    expect(s.length).toBeLessThanOrEqual(48);
    expect(s.endsWith("-")).toBe(false);
  });
  it("genera candidatos con sufijos", () => {
    expect(slugCandidates("cumple", "AB12", 3)).toEqual(["cumple", "cumple-2", "cumple-3", "cumple-ab12"]);
  });
});

describe("formatos", () => {
  it("día corto sin desfase de zona", () => {
    expect(formatEventDay(new Date("2026-10-10T00:00:00Z"))).toBe("sáb 10 oct 2026");
  });
  it("rango de horas local", () => {
    expect(formatTimeRange(new Date("2026-10-10T17:00:00Z"), new Date("2026-10-10T20:30:00Z"))).toBe(
      "11:00–14:30",
    );
  });
  it("etiqueta relativa de días", () => {
    expect(relativeDayLabel(0)).toBe("Hoy");
    expect(relativeDayLabel(1)).toBe("Mañana");
    expect(relativeDayLabel(-1)).toBe("Ayer");
    expect(relativeDayLabel(12)).toBe("En 12 días");
    expect(relativeDayLabel(-3)).toBe("Hace 3 días");
  });
  it("duración y primer nombre", () => {
    expect(formatDuration(180)).toBe("3 h");
    expect(formatDuration(210)).toBe("3 h 30 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(firstName("  Sofía Martínez ")).toBe("Sofía");
    expect(firstName(null)).toBe("");
  });
});
