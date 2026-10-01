import { describe, expect, it } from "vitest";
import { applyBps, formatBps, formatMXN, marginBps, pesosToCents } from "@/lib/money";
import { toCsv } from "@/lib/csv";
import { generateCode } from "@/lib/codes";
import { slugify } from "@/lib/slug";
import { dateOnly, isValidDateKey, toDateKey, zonedDateTime } from "@/lib/dates";
import { verifyMockSignature, signMockPayload } from "@/server/providers/payments/mock-signature";
import { normalizeMxPhone, whatsappLink } from "@/server/providers/whatsapp/links";

describe("money", () => {
  it("formatea MXN y opera con bps", () => {
    expect(formatMXN(1_490_000)).toMatch(/14,900/);
    expect(formatMXN(null)).toBe("—");
    expect(pesosToCents(149.995)).toBe(15_000);
    expect(applyBps(10_000, 1600)).toBe(1600);
    expect(formatBps(3550)).toBe("35.5%");
    expect(marginBps(25, 100)).toBe(2500);
    expect(marginBps(25, 0)).toBe(0);
  });
});

describe("csv", () => {
  it("escapa comas y comillas, y neutraliza fórmulas", () => {
    const csv = toCsv(["a", "b"], [["x,y", "=HYPERLINK(1)"]]);
    expect(csv).toContain('"x,y"');
    expect(csv).toContain("'=HYPERLINK(1)");
  });
});

describe("codes & slugs", () => {
  it("genera códigos legibles no secuenciales", () => {
    const code = generateCode("Q", new Date(Date.UTC(2026, 9, 5)));
    expect(code).toMatch(/^Q-2610-[2-9A-HJ-NP-Z]{4}$/);
  });
  it("slugify quita acentos", () => {
    expect(slugify("Perú x México & Amigas")).toBe("peru-x-mexico-y-amigas");
  });
});

describe("dates", () => {
  it("convierte hora local CDMX a UTC (UTC-6)", () => {
    expect(zonedDateTime("2026-10-17", "11:00").toISOString()).toBe("2026-10-17T17:00:00.000Z");
  });
  it("valida date keys", () => {
    expect(isValidDateKey("2026-02-30")).toBe(false);
    expect(isValidDateKey("2026-02-28")).toBe(true);
    expect(toDateKey(dateOnly("2026-12-24"))).toBe("2026-12-24");
  });
});

describe("mock webhook signature", () => {
  it("acepta firmas válidas y rechaza alteradas, de otro secreto o viejas", () => {
    const body = JSON.stringify({ id: "evt_1" });
    const header = signMockPayload(body, "secret", 1000);
    expect(verifyMockSignature(body, header, "secret", 300, 1100).valid).toBe(true);
    expect(verifyMockSignature(body + " ", header, "secret", 300, 1100).valid).toBe(false);
    expect(verifyMockSignature(body, header, "other", 300, 1100).valid).toBe(false);
    expect(verifyMockSignature(body, header, "secret", 300, 2000).valid).toBe(false);
    expect(verifyMockSignature(body, null, "secret").valid).toBe(false);
  });
});

describe("whatsapp links", () => {
  it("normaliza teléfonos MX y arma deep links", () => {
    expect(normalizeMxPhone("55 1234 5678")).toBe("525512345678");
    expect(normalizeMxPhone("+52 1 55 1234 5678")).toBe("525512345678");
    expect(whatsappLink("5512345678", "Hola")).toBe("https://wa.me/525512345678?text=Hola");
  });
});
