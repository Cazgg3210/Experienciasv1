import { describe, expect, it } from "vitest";
import {
  aggregateDietary,
  bufferPortions,
  computeHeadCount,
  computeShortagesByEvent,
  daysUntilDateOnly,
  fullAddress,
  groupByCourse,
  isFloralAddOn,
  mapsLink,
  scaleFactor,
  ucfirst,
  type GuestForProduction,
} from "./production";

const g = (name: string, over: Partial<GuestForProduction> = {}): GuestForProduction => ({
  name,
  rsvpStatus: "ATTENDING",
  plusOne: false,
  plusOneName: null,
  dietaryRestrictions: [],
  dietaryNotes: null,
  ...over,
});

describe("conteo de invitadas y porciones", () => {
  it("porciones = max(planeadas, confirmadas + acompañantes)", () => {
    const guests = [g("Ana", { plusOne: true }), g("Bea"), g("Caro", { rsvpStatus: "PENDING" }), g("Dani", { rsvpStatus: "NOT_ATTENDING", plusOne: true })];
    const hc = computeHeadCount(8, guests);
    expect(hc).toMatchObject({ attending: 2, plusOnes: 1, confirmedTotal: 3, pending: 1, notAttending: 1, portions: 8 });
    const many = Array.from({ length: 9 }, (_, i) => g(`G${i}`, { plusOne: i < 2 }));
    expect(computeHeadCount(8, many).portions).toBe(11);
  });

  it("margen de cortesía y factor de escala", () => {
    expect(bufferPortions(0)).toBe(0);
    expect(bufferPortions(8)).toBe(1);
    expect(bufferPortions(12)).toBe(2);
    expect(scaleFactor(9, 6)).toBe(1.5);
    expect(scaleFactor(10, 6)).toBe(1.67);
    expect(scaleFactor(10, 0)).toBe(1);
  });
});

describe("restricciones alimentarias", () => {
  it("agrega por restricción con nombres y notas; excluye a quien no asiste", () => {
    const summary = aggregateDietary([
      g("Ana", { dietaryRestrictions: ["VEGAN", "NUT_ALLERGY"], dietaryNotes: "Alergia severa" }),
      g("Bea", { dietaryRestrictions: ["VEGAN"], rsvpStatus: "PENDING" }),
      g("Caro", { dietaryNotes: "Sin cebolla" }),
      g("Dani", { dietaryRestrictions: ["GLUTEN_FREE"], rsvpStatus: "NOT_ATTENDING" }),
      g("Eva"),
    ]);
    expect(summary.totalGuestsWithNeeds).toBe(3);
    expect(summary.byRestriction.map((r) => r.restriction)).toEqual(["NUT_ALLERGY", "VEGAN"]);
    expect(summary.byRestriction[1]!.guests.map((x) => x.name)).toEqual(["Ana", "Bea"]);
    expect(summary.byRestriction[0]!.guests[0]!.notes).toBe("Alergia severa");
    expect(summary.notesOnly).toEqual([{ name: "Caro", rsvpStatus: "ATTENDING", notes: "Sin cebolla" }]);
  });
});

describe("menú por tiempos", () => {
  it("agrupa en orden de servicio", () => {
    const groups = groupByCourse([
      { course: "DESSERT" as const, sortOrder: 1, name: "Pastel" },
      { course: "DRINK" as const, sortOrder: 2, name: "Mimosa" },
      { course: "DRINK" as const, sortOrder: 1, name: "Café" },
    ]);
    expect(groups.map((x) => x.course)).toEqual(["DRINK", "DESSERT"]);
    expect(groups[0]!.items.map((i) => i.name)).toEqual(["Café", "Mimosa"]);
  });
});

describe("faltantes de inventario por fecha", () => {
  it("suma reservas activas del mismo día contra stock utilizable (total − mantenimiento)", () => {
    const stock = [
      { id: "copa", totalQuantity: 24, maintenanceQuantity: 2 },
      { id: "plato", totalQuantity: 60, maintenanceQuantity: 0 },
    ];
    const res = computeShortagesByEvent(
      [
        { eventId: "e1", dateKey: "2026-10-10", inventoryItemId: "copa", quantity: 12, status: "RESERVED" },
        { eventId: "e2", dateKey: "2026-10-10", inventoryItemId: "copa", quantity: 12, status: "RESERVED" },
        { eventId: "e3", dateKey: "2026-10-17", inventoryItemId: "copa", quantity: 20, status: "RESERVED" },
        { eventId: "e1", dateKey: "2026-10-10", inventoryItemId: "plato", quantity: 30, status: "RESERVED" },
        { eventId: "e4", dateKey: "2026-10-10", inventoryItemId: "plato", quantity: 40, status: "CANCELLED" },
      ],
      stock,
    );
    expect(res.get("e1")).toEqual([{ inventoryItemId: "copa", dateKey: "2026-10-10", reserved: 24, available: 22 }]);
    expect(res.get("e2")).toHaveLength(1);
    expect(res.has("e3")).toBe(false);
    expect(res.has("e4")).toBe(false);
  });
});

describe("dirección y mapas", () => {
  const base = { mapsUrl: null, addressLine: "Ámsterdam 210", neighborhood: "Hipódromo", city: "Ciudad de México", postalCode: "06100" };
  it("arma dirección completa y liga de búsqueda", () => {
    expect(fullAddress(base)).toBe("Ámsterdam 210, Col. Hipódromo, C.P. 06100, Ciudad de México");
    expect(mapsLink(base)).toContain("https://www.google.com/maps/search/?api=1&query=");
    expect(mapsLink({ ...base, mapsUrl: "https://maps.app.goo.gl/abc" })).toBe("https://maps.app.goo.gl/abc");
    expect(mapsLink({ ...base, mapsUrl: "javascript:alert(1)" })).toContain("google.com/maps");
    expect(mapsLink({ ...base, addressLine: null, neighborhood: null })).toBeNull();
  });

  it("detecta add-ons florales", () => {
    expect(isFloralAddOn({ slug: "upgrade-floral", name: "Upgrade floral" })).toBe(true);
    expect(isFloralAddOn({ slug: "mimosa-bar", name: "Mimosa bar" })).toBe(false);
  });
});

describe("días hasta una fecha @db.Date", () => {
  it("no se desfasa un día por la zona horaria", () => {
    const now = new Date("2026-10-01T15:00:00Z"); // 1 oct, 9:00 CDMX
    expect(daysUntilDateOnly(new Date("2026-10-10T00:00:00Z"), now)).toBe(9);
    expect(daysUntilDateOnly(new Date("2026-10-01T00:00:00Z"), now)).toBe(0);
    const lateNight = new Date("2026-10-02T05:30:00Z"); // 1 oct, 23:30 CDMX
    expect(daysUntilDateOnly(new Date("2026-10-02T00:00:00Z"), lateNight)).toBe(1);
    expect(ucfirst("sábado 10 de octubre")).toBe("Sábado 10 de octubre");
  });
});
