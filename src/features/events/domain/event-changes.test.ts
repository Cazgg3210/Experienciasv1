import { describe, expect, it } from "vitest";
import {
  blankToNull,
  diffFields,
  hasSensitiveChange,
  needsAvailabilityCheck,
  parseColorList,
} from "./event-changes";

describe("diffFields", () => {
  it("detecta sólo los campos que cambian (fechas, arrays, null vs vacío)", () => {
    const before = {
      title: "Cumple",
      guestCount: 10,
      startsAt: new Date("2026-10-10T17:00:00Z"),
      colors: ["Rosa"],
      notes: null,
      extra: "ignorado",
    };
    const after = {
      title: "Cumple",
      guestCount: 12,
      startsAt: new Date("2026-10-10T18:00:00Z"),
      colors: ["Rosa"],
      notes: "",
    };
    const d = diffFields(before, after);
    expect(d.changed.sort()).toEqual(["guestCount", "startsAt"]);
    expect(d.before).toEqual({ guestCount: 10, startsAt: "2026-10-10T17:00:00.000Z" });
    expect(d.after).toEqual({ guestCount: 12, startsAt: "2026-10-10T18:00:00.000Z" });
  });

  it("guarda arrays como arrays en la bitácora", () => {
    const d = diffFields({ colors: [] }, { colors: ["Rosa", "Salvia"] });
    expect(d.before).toEqual({ colors: [] });
    expect(d.after).toEqual({ colors: ["Rosa", "Salvia"] });
  });

  it("sin cambios devuelve lista vacía", () => {
    expect(diffFields({ a: "x" }, { a: "x" }).changed).toEqual([]);
  });
});

describe("clasificación de cambios", () => {
  it("cambios sensibles se auditan", () => {
    expect(hasSensitiveChange(["guestCount"])).toBe(true);
    expect(hasSensitiveChange(["menuId"])).toBe(true);
    expect(hasSensitiveChange(["hostMessage", "colors"])).toBe(false);
  });
  it("fecha/hora/zona obligan a revisar disponibilidad", () => {
    expect(needsAvailabilityCheck(["eventDate"])).toBe(true);
    expect(needsAvailabilityCheck(["serviceAreaId"])).toBe(true);
    expect(needsAvailabilityCheck(["guestCount", "title"])).toBe(false);
  });
});

describe("normalización de textos", () => {
  it("parsea colores sin vacíos ni duplicados", () => {
    expect(parseColorList("Rosa palo, salvia,, rosa PALO; dorado\n")).toEqual([
      "Rosa palo",
      "salvia",
      "dorado",
    ]);
    expect(parseColorList("")).toEqual([]);
    expect(parseColorList(null)).toEqual([]);
  });
  it("convierte blancos a null", () => {
    expect(blankToNull("  ")).toBeNull();
    expect(blankToNull(" hola ")).toBe("hola");
    expect(blankToNull(undefined)).toBeNull();
  });
});
