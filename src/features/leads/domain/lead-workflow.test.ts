import { describe, expect, it } from "vitest";
import {
  buildEmailBody,
  buildEmailSubject,
  buildWhatsappMessage,
  firstName,
  isContactActivity,
  mailtoLink,
  nextLeadStatuses,
  requiresLostReason,
  shouldAutoContact,
  telLink,
} from "./lead-workflow";
import { leadCsvRow, occasionText } from "./lead-export";
import { relativeTime } from "./format";

describe("reglas de contacto", () => {
  it("sólo llamadas, WhatsApp y email cuentan como contacto", () => {
    expect(isContactActivity("CALL")).toBe(true);
    expect(isContactActivity("WHATSAPP")).toBe(true);
    expect(isContactActivity("EMAIL")).toBe(true);
    expect(isContactActivity("NOTE")).toBe(false);
    expect(isContactActivity("SYSTEM")).toBe(false);
  });

  it("un contacto mueve NEW → CONTACTED; una nota no", () => {
    expect(shouldAutoContact("NEW", "CALL")).toBe(true);
    expect(shouldAutoContact("NEW", "NOTE")).toBe(false);
    expect(shouldAutoContact("QUALIFIED", "WHATSAPP")).toBe(false);
  });

  it("siguientes estados y motivo de pérdida", () => {
    expect(nextLeadStatuses("NEW")).toEqual(["CONTACTED", "QUALIFIED", "QUOTED", "LOST"]);
    expect(nextLeadStatuses("WON")).toEqual([]);
    expect(requiresLostReason("LOST")).toBe(true);
    expect(requiresLostReason("WON")).toBe(false);
  });
});

describe("mensajes plantilla", () => {
  const ctx = {
    leadName: "Sofía Ramírez",
    senderName: "Ivonne",
    occasion: "BIRTHDAY" as const,
    eventDateLabel: "sábado 7 de noviembre de 2026",
    guestCount: 8,
    experienceName: "Signature Brunch",
  };

  it("WhatsApp: cálido, con nombre, ocasión, fecha e invitadas", () => {
    const msg = buildWhatsappMessage(ctx);
    expect(msg).toContain("¡Hola, Sofía!");
    expect(msg).toContain("Soy Ivonne");
    expect(msg).toContain("tu cumpleaños el sábado 7 de noviembre de 2026 para 8 personas");
    expect(msg).toContain("Signature Brunch");
  });

  it("WhatsApp sin datos opcionales sigue siendo correcto", () => {
    const msg = buildWhatsappMessage({ leadName: "Ana" });
    expect(msg).toBe(
      "¡Hola, Ana! Te escribimos de Ivonne & Rosa. Gracias por escribirnos. ¿Te parece si te comparto opciones y resolvemos tus dudas por aquí?",
    );
  });

  it("ocasión OTRA usa el texto libre", () => {
    expect(buildWhatsappMessage({ leadName: "Ana", occasion: "OTHER", occasionOther: "Graduación" })).toContain(
      "tu graduación",
    );
  });

  it("email: asunto y cuerpo", () => {
    expect(buildEmailSubject(ctx)).toBe("Tu cumpleaños con Ivonne & Rosa");
    const body = buildEmailBody(ctx);
    expect(body.startsWith("Hola, Sofía:")).toBe(true);
    expect(body).toContain("Ivonne · Ivonne & Rosa");
  });

  it("links mailto y tel", () => {
    expect(mailtoLink("sofi@example.com", "Hola", "a b")).toBe("mailto:sofi@example.com?subject=Hola&body=a%20b");
    expect(telLink("+52 55 5102-3315")).toBe("tel:+525551023315");
  });

  it("firstName", () => {
    expect(firstName("  María José  López ")).toBe("María");
    expect(firstName(null)).toBe("");
  });
});

describe("exportación CSV", () => {
  it("arma la fila con etiquetas en español", () => {
    const row = leadCsvRow({
      code: "L-2610-AAAA",
      name: "Sofía",
      phone: "5551023315",
      email: null,
      occasion: "OTHER",
      occasionOther: "Graduación",
      experienceName: "Signature Brunch",
      eventDate: new Date("2026-11-07T00:00:00.000Z"),
      guestCount: 8,
      budgetLabel: "$15,000 – $20,000",
      estimatedTotalCents: 1715000,
      status: "QUALIFIED",
      source: "INSTAGRAM",
      zone: "Polanco",
      outOfArea: false,
      specialRequest: true,
      assignedToName: "Rosa",
      lostReason: null,
      createdAt: new Date("2026-10-01T18:00:00.000Z"),
      lastContactedAt: null,
    });
    expect(row).toEqual([
      "L-2610-AAAA",
      "Sofía",
      "5551023315",
      null,
      "Otra celebración: Graduación",
      "Signature Brunch",
      "2026-11-07",
      8,
      "$15,000 – $20,000",
      "17150.00",
      "Calificado",
      "Instagram",
      "Polanco",
      "No",
      "Sí",
      "Rosa",
      null,
      "1 oct 2026, 12:00",
      null,
    ]);
  });

  it("occasionText", () => {
    expect(occasionText("BRIDAL")).toBe("Bridal brunch");
    expect(occasionText("OTHER", "  ")).toBe("Otra celebración");
  });
});

describe("relativeTime", () => {
  it("formatea en español", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    expect(relativeTime(new Date("2026-10-01T11:59:30Z"), now)).toBe("justo ahora");
    expect(relativeTime(new Date("2026-09-28T12:00:00Z"), now)).toBe("hace 3 días");
  });
});
