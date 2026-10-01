import { describe, expect, it } from "vitest";
import {
  GUEST_CSV_HEADERS,
  aggregateDietary,
  guestCsvFilename,
  guestCsvRows,
  summarizeRsvp,
  type GuestCsvLike,
} from "./guest-summary";

const g = (over: Partial<GuestCsvLike> & { name: string }): GuestCsvLike => ({
  rsvpStatus: "PENDING",
  plusOne: false,
  plusOneName: null,
  dietaryRestrictions: [],
  dietaryNotes: null,
  email: null,
  phone: null,
  comment: null,
  source: "HOST",
  respondedAt: null,
  ...over,
});

describe("summarizeRsvp", () => {
  it("cuenta confirmadas incluyendo acompañantes", () => {
    const s = summarizeRsvp([
      g({ name: "Ana", rsvpStatus: "ATTENDING", plusOne: true }),
      g({ name: "Bea", rsvpStatus: "ATTENDING" }),
      g({ name: "Caro", rsvpStatus: "NOT_ATTENDING", plusOne: true }),
      g({ name: "Dani", rsvpStatus: "MAYBE" }),
      g({ name: "Eli" }),
    ]);
    expect(s).toEqual({
      attending: 2,
      plusOnes: 1,
      attendingTotal: 3,
      pending: 1,
      notAttending: 1,
      maybe: 1,
      total: 5,
    });
  });
  it("lista vacía", () => {
    expect(summarizeRsvp([]).total).toBe(0);
  });
});

describe("aggregateDietary", () => {
  it("agrupa por restricción con nombres, excluye a quien no asiste y ordena por frecuencia", () => {
    const agg = aggregateDietary([
      g({ name: "Ana", rsvpStatus: "ATTENDING", dietaryRestrictions: ["VEGAN", "GLUTEN_FREE"] }),
      g({
        name: "Bea",
        rsvpStatus: "PENDING",
        dietaryRestrictions: ["GLUTEN_FREE"],
        dietaryNotes: "Celiaca",
      }),
      g({ name: "Caro", rsvpStatus: "NOT_ATTENDING", dietaryRestrictions: ["VEGAN"] }),
      g({ name: "Dani", rsvpStatus: "MAYBE", dietaryNotes: "  " }),
    ]);
    expect(agg.restrictions.map((r) => [r.restriction, r.count])).toEqual([
      ["GLUTEN_FREE", 2],
      ["VEGAN", 1],
    ]);
    expect(agg.restrictions[0]!.names).toEqual(["Ana", "Bea"]);
    expect(agg.restrictions[0]!.label).toBe("Sin gluten");
    expect(agg.notes).toEqual([{ name: "Bea", notes: "Celiaca" }]);
    expect(agg.peopleWithRestrictions).toBe(2);
  });
});

describe("CSV de invitadas", () => {
  it("genera filas en español con el mismo número de columnas que los encabezados", () => {
    const rows = guestCsvRows(
      [
        g({
          name: "Ana",
          email: "ana@x.com",
          phone: "5512345678",
          rsvpStatus: "ATTENDING",
          plusOne: true,
          plusOneName: "Luis",
          dietaryRestrictions: ["VEGETARIAN", "NUT_ALLERGY"],
          comment: "¡Ahí estaré!",
          source: "SELF_RSVP",
          respondedAt: new Date("2026-10-01T18:00:00Z"),
        }),
        g({ name: "Bea", plusOneName: "ignorado" }),
      ],
      () => "1 oct 2026, 12:00",
    );
    expect(rows[0]).toEqual([
      "Ana",
      "ana@x.com",
      "5512345678",
      "Asiste",
      "Sí",
      "Luis",
      "Vegetariana; Alergia a nueces",
      "",
      "¡Ahí estaré!",
      "Auto-registro",
      "1 oct 2026, 12:00",
    ]);
    expect(rows[1]![4]).toBe("No");
    expect(rows[1]![5]).toBe("");
    for (const r of rows) expect(r).toHaveLength(GUEST_CSV_HEADERS.length);
  });
  it("nombre de archivo seguro", () => {
    expect(guestCsvFilename("EV-2610-AB12")).toBe("invitadas-EV-2610-AB12.csv");
    expect(guestCsvFilename('EV"/../x')).toBe("invitadas-EVx.csv");
  });
});
