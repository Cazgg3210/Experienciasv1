import { describe, expect, it } from "vitest";
import {
  ScheduleError,
  addMinutesToTime,
  buildSchedule,
  buildScheduleFromDuration,
  isValidTime,
  scheduleToFormValues,
  shiftInstant,
} from "./event-schedule";

describe("buildSchedule", () => {
  it("convierte fecha + horas locales de CDMX a instantes UTC", () => {
    const s = buildSchedule("2026-10-17", "11:00", "14:30");
    expect(s.eventDate.toISOString()).toBe("2026-10-17T00:00:00.000Z");
    // CDMX = UTC-6 (sin horario de verano desde 2022)
    expect(s.startsAt.toISOString()).toBe("2026-10-17T17:00:00.000Z");
    expect(s.endsAt.toISOString()).toBe("2026-10-17T20:30:00.000Z");
    expect(s.durationMinutes).toBe(210);
  });

  it("rechaza fin anterior o igual al inicio", () => {
    expect(() => buildSchedule("2026-10-17", "14:00", "14:00")).toThrow(ScheduleError);
    try {
      buildSchedule("2026-10-17", "14:00", "13:00");
    } catch (e) {
      expect((e as ScheduleError).field).toBe("endTime");
    }
  });

  it("rechaza fechas y horas inválidas", () => {
    expect(() => buildSchedule("2026-02-30", "10:00", "12:00")).toThrow(/Fecha inválida/);
    expect(() => buildSchedule("2026-10-17", "25:00", "26:00")).toThrow(/inicio/);
    expect(() => buildSchedule("2026-10-17", "10:00", "9:5")).toThrow(/fin/);
  });
});

describe("buildScheduleFromDuration", () => {
  it("calcula la hora de fin con la duración", () => {
    const s = buildScheduleFromDuration("2026-10-17", "11:00", 180);
    expect(s.endsAt.toISOString()).toBe("2026-10-17T20:00:00.000Z");
    expect(s.durationMinutes).toBe(180);
  });
  it("no permite cruzar la medianoche", () => {
    expect(() => buildScheduleFromDuration("2026-10-17", "22:00", 180)).toThrow(/medianoche/);
  });
  it("rechaza duraciones no positivas", () => {
    expect(() => buildScheduleFromDuration("2026-10-17", "10:00", 0)).toThrow(ScheduleError);
  });
});

describe("utilidades de horario", () => {
  it("valida HH:mm", () => {
    expect(isValidTime("09:30")).toBe(true);
    expect(isValidTime("9:30")).toBe(false);
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime(null)).toBe(false);
  });
  it("suma minutos con tope 23:59", () => {
    expect(addMinutesToTime("11:00", 90)).toBe("12:30");
    expect(addMinutesToTime("23:00", 120)).toBe("23:59");
  });
  it("devuelve valores de formulario en hora local", () => {
    const v = scheduleToFormValues({
      eventDate: new Date("2026-10-10T00:00:00Z"),
      startsAt: new Date("2026-10-10T17:00:00Z"),
      endsAt: new Date("2026-10-10T21:00:00Z"),
    });
    expect(v).toEqual({ date: "2026-10-10", startTime: "11:00", endTime: "15:00" });
  });
  it("desplaza instantes opcionales", () => {
    expect(shiftInstant(null, 1000)).toBeNull();
    expect(shiftInstant(new Date("2026-01-01T00:00:00Z"), 3_600_000)?.toISOString()).toBe(
      "2026-01-01T01:00:00.000Z",
    );
  });
});
