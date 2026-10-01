import { describe, expect, it } from "vitest";
import { cancelEventSchema, createEventSchema, guestSchema, updateEventSchema } from "./schemas";
import { availabilityExceptionSchema, weeklyRulesSchema } from "@/features/bookings/schemas";

const baseCreate = {
  customerMode: "existing" as const,
  customerId: "cmcustomer00001",
  newCustomer: { name: "", email: "", phone: "" },
  title: "Cumpleaños de Ana",
  occasion: "BIRTHDAY" as const,
  honoreeName: "",
  date: "2026-11-14",
  startTime: "11:00",
  durationMinutes: 180,
  experienceId: "",
  guestCount: 8,
  serviceAreaId: "",
  addressLine: "",
  neighborhood: "",
  postalCode: "",
  internalNotes: "",
  confirmUnavailable: false,
};

describe("createEventSchema", () => {
  it("acepta una clienta existente", () => {
    expect(createEventSchema.safeParse(baseCreate).success).toBe(true);
  });
  it("exige elegir clienta existente", () => {
    const r = createEventSchema.safeParse({ ...baseCreate, customerId: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["customerId"]);
  });
  it("nueva clienta requiere nombre y algún contacto", () => {
    const r = createEventSchema.safeParse({
      ...baseCreate,
      customerMode: "new",
      customerId: "",
      newCustomer: { name: "A", email: "", phone: "" },
    });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join("."));
    expect(paths).toContain("newCustomer.name");
    expect(paths).toContain("newCustomer.phone");
    const ok = createEventSchema.safeParse({
      ...baseCreate,
      customerMode: "new",
      customerId: "",
      newCustomer: { name: "Ana López", email: "", phone: "55 1234 5678" },
    });
    expect(ok.success).toBe(true);
  });
  it("valida fecha, hora, CP e invitadas", () => {
    const r = createEventSchema.safeParse({
      ...baseCreate,
      date: "2026-02-31",
      startTime: "7pm",
      postalCode: "123",
      guestCount: 0,
    });
    const paths = r.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["date", "startTime", "postalCode", "guestCount"]));
  });
});

describe("updateEventSchema", () => {
  it("valida URLs opcionales", () => {
    const base = {
      eventId: "cmevent00000001",
      title: "Brunch",
      occasion: "OTHER" as const,
      date: "2026-11-14",
      startTime: "11:00",
      endTime: "14:00",
      guestCount: 8,
      experienceId: "",
      menuId: "",
      styleId: "",
      serviceAreaId: "",
      addressLine: "",
      neighborhood: "",
      postalCode: "",
      mapsUrl: "",
      addressNotes: "",
      honoreeName: "",
      colors: "",
      dressCode: "",
      hostMessage: "",
      playlistUrl: "javascript:alert(1)",
      customerNotes: "",
      internalNotes: "",
      micrositeEnabled: true,
      confirmUnavailable: false,
    };
    const r = updateEventSchema.safeParse(base);
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.path).toEqual(["playlistUrl"]);
    expect(updateEventSchema.safeParse({ ...base, playlistUrl: "https://open.spotify.com/x" }).success).toBe(
      true,
    );
  });
});

describe("cancelEventSchema", () => {
  it("requiere motivo", () => {
    expect(
      cancelEventSchema.safeParse({ eventId: "cmevent00000001", reason: "no", notifyCustomer: false })
        .success,
    ).toBe(false);
    expect(
      cancelEventSchema.safeParse({
        eventId: "cmevent00000001",
        reason: "La clienta canceló",
        notifyCustomer: true,
      }).success,
    ).toBe(true);
  });
});

describe("guestSchema", () => {
  const guest = {
    eventId: "cmevent00000001",
    guestId: "",
    name: "Ana",
    email: "",
    phone: "",
    rsvpStatus: "ATTENDING" as const,
    plusOne: false,
    plusOneName: "",
    dietaryRestrictions: ["VEGAN" as const],
    dietaryNotes: "",
    comment: "",
  };
  it("acepta una invitada válida", () => {
    expect(guestSchema.safeParse(guest).success).toBe(true);
  });
  it("no permite nombre de acompañante sin acompañante y valida correo", () => {
    const r = guestSchema.safeParse({ ...guest, plusOneName: "Luis", email: "no-es-correo" });
    const paths = r.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["plusOneName", "email"]));
  });
});

describe("esquemas de disponibilidad", () => {
  const rules = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    isOpen: weekday !== 1,
    maxEvents: weekday === 1 ? 0 : 2,
    earliestStart: "08:00",
    latestEnd: "21:00",
  }));
  it("acepta 7 días válidos", () => {
    expect(weeklyRulesSchema.safeParse({ rules }).success).toBe(true);
  });
  it("rechaza días duplicados o faltantes", () => {
    expect(weeklyRulesSchema.safeParse({ rules: rules.slice(0, 6) }).success).toBe(false);
    expect(weeklyRulesSchema.safeParse({ rules: [...rules.slice(0, 6), { ...rules[0]! }] }).success).toBe(
      false,
    );
  });
  it("capacidad especial requiere máximo de eventos", () => {
    const base = {
      date: "2026-11-28",
      type: "CAPACITY_OVERRIDE" as const,
      maxEvents: null,
      reason: "",
      serviceAreaId: "",
    };
    expect(availabilityExceptionSchema.safeParse(base).success).toBe(false);
    expect(availabilityExceptionSchema.safeParse({ ...base, maxEvents: 3 }).success).toBe(true);
    expect(availabilityExceptionSchema.safeParse({ ...base, type: "BLOCKED" }).success).toBe(true);
  });
});
