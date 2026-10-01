import { describe, expect, it } from "vitest";
import { addDays } from "date-fns";
import { localDateKey } from "@/lib/dates";
import { contactFormSchema, trackEventSchema } from "./schemas";

const valid = {
  name: "Lucía Hernández",
  phone: "55 1234 5678",
  email: "  Lucia@Correo.COM ",
  occasion: "BIRTHDAY",
  eventDate: "",
  message: "Queremos un brunch para 8 amigas en Polanco.",
  consent: true,
  website: "",
};

describe("contactFormSchema", () => {
  it("acepta datos válidos y normaliza el correo", () => {
    const r = contactFormSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("lucia@correo.com");
  });

  it("exige consentimiento de privacidad", () => {
    const r = contactFormSchema.safeParse({ ...valid, consent: false });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.consent?.[0]).toMatch(/autorización/);
  });

  it("valida teléfono de 10–15 dígitos", () => {
    expect(contactFormSchema.safeParse({ ...valid, phone: "12345" }).success).toBe(false);
    expect(contactFormSchema.safeParse({ ...valid, phone: "55-1234-abcd" }).success).toBe(false);
    expect(contactFormSchema.safeParse({ ...valid, phone: "+52 1 55 1234 5678" }).success).toBe(true);
  });

  it("ocasión debe ser un valor del enum", () => {
    expect(contactFormSchema.safeParse({ ...valid, occasion: "WEDDING" }).success).toBe(false);
    expect(contactFormSchema.safeParse({ ...valid, occasion: "" }).success).toBe(false);
  });

  it("fecha opcional, válida y no en el pasado", () => {
    const tomorrow = localDateKey(addDays(new Date(), 2));
    expect(contactFormSchema.safeParse({ ...valid, eventDate: tomorrow }).success).toBe(true);
    expect(contactFormSchema.safeParse({ ...valid, eventDate: "2020-01-01" }).success).toBe(false);
    expect(contactFormSchema.safeParse({ ...valid, eventDate: "2026-02-31" }).success).toBe(false);
    expect(contactFormSchema.safeParse({ ...valid, eventDate: undefined }).success).toBe(true);
  });

  it("mensaje mínimo y máximo", () => {
    expect(contactFormSchema.safeParse({ ...valid, message: "Hola" }).success).toBe(false);
    expect(contactFormSchema.safeParse({ ...valid, message: "x".repeat(2001) }).success).toBe(false);
  });

  it("honeypot pasa la validación (se descarta en el servicio, sin avisar al bot)", () => {
    expect(contactFormSchema.safeParse({ ...valid, website: "http://spam.example" }).success).toBe(true);
  });
});

describe("trackEventSchema", () => {
  it("acepta tipos de la lista blanca", () => {
    expect(
      trackEventSchema.safeParse({ type: "VIEW_EXPERIENCE", experienceId: "cmabc12345xyz", path: "/experiencias/x", sessionId: "abcdef123456" })
        .success,
    ).toBe(true);
    expect(trackEventSchema.safeParse({ type: "START_CONFIGURATOR" }).success).toBe(true);
  });

  it("rechaza tipos de servidor, campos extra y valores malformados", () => {
    expect(trackEventSchema.safeParse({ type: "PAYMENT_SUCCESS" }).success).toBe(false);
    expect(trackEventSchema.safeParse({ type: "VIEW_EXPERIENCE", leadId: "x" }).success).toBe(false);
    expect(trackEventSchema.safeParse({ type: "VIEW_EXPERIENCE", experienceId: "'; drop table" }).success).toBe(false);
    expect(trackEventSchema.safeParse({ type: "VIEW_EXPERIENCE", sessionId: "short" }).success).toBe(false);
    const tooMany = Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`k${i}`, i]));
    expect(trackEventSchema.safeParse({ type: "VIEW_EXPERIENCE", metadata: tooMany }).success).toBe(false);
  });
});
