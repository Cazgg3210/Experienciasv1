import { describe, expect, it } from "vitest";
import { convertDesignSchema, designerInputSchema, todayInBusinessTz } from "./schemas";

const validConvert = {
  designId: "cm1abcdefghijklmnop",
  name: "Valeria",
  phone: "55 1234 5678",
  email: "",
  eventDate: "",
  consent: true as const,
};

describe("convertDesignSchema", () => {
  it("acepta datos mínimos (fecha y email opcionales)", () => {
    expect(convertDesignSchema.safeParse(validConvert).success).toBe(true);
    expect(
      convertDesignSchema.safeParse({
        ...validConvert,
        eventDate: `${Number(todayInBusinessTz().slice(0, 4)) + 1}-02-28`,
        email: "VAL@Example.com",
      }).success,
    ).toBe(true);
  });

  it("rechaza fechas que no existen en el calendario", () => {
    for (const eventDate of ["2027-02-30", "2027-13-01", "2027-00-10", "1999-12-31", "27-01-01"]) {
      const r = convertDesignSchema.safeParse({ ...validConvert, eventDate });
      expect(r.success, eventDate).toBe(false);
    }
  });

  it("rechaza fechas pasadas (zona CDMX) y acepta hoy", () => {
    const past = convertDesignSchema.safeParse({ ...validConvert, eventDate: "2020-01-01" });
    expect(past.success).toBe(false);
    expect(past.error?.issues[0]?.message).toBe("Elige una fecha a partir de hoy.");
    expect(convertDesignSchema.safeParse({ ...validConvert, eventDate: todayInBusinessTz() }).success).toBe(
      true,
    );
    // 23:30 del 31-dic en CDMX ya es 1-ene en UTC: "hoy" sigue siendo 31-dic.
    expect(todayInBusinessTz(new Date("2027-01-01T05:30:00Z"))).toBe("2026-12-31");
  });

  it("exige consentimiento y un WhatsApp de 10 a 13 dígitos", () => {
    expect(convertDesignSchema.safeParse({ ...validConvert, consent: false }).success).toBe(false);
    expect(convertDesignSchema.safeParse({ ...validConvert, phone: "12345" }).success).toBe(false);
    expect(convertDesignSchema.safeParse({ ...validConvert, phone: "55-1234-abcd" }).success).toBe(false);
    expect(convertDesignSchema.safeParse({ ...validConvert, phone: "+52 1 55 1234 5678" }).success).toBe(
      true,
    );
  });

  it("rechaza ids de diseño con caracteres fuera de [a-z0-9]", () => {
    expect(convertDesignSchema.safeParse({ ...validConvert, designId: "../../etc/passwd" }).success).toBe(
      false,
    );
  });
});

describe("designerInputSchema", () => {
  const base = {
    occasion: "BIRTHDAY",
    profile: "Mi amiga cumple 30",
    guestCount: 8,
    budgetRangeId: "sin-definir",
    colors: [],
    vibes: ["glam"],
    serviceArea: "otra",
    dietary: [],
  };

  it("limita personas a 6–40, vibras a 1–4 y colores a hex válidos", () => {
    expect(designerInputSchema.safeParse(base).success).toBe(true);
    expect(designerInputSchema.safeParse({ ...base, guestCount: 5 }).success).toBe(false);
    expect(designerInputSchema.safeParse({ ...base, guestCount: 41 }).success).toBe(false);
    expect(designerInputSchema.safeParse({ ...base, guestCount: Number.NaN }).success).toBe(false);
    expect(designerInputSchema.safeParse({ ...base, vibes: [] }).success).toBe(false);
    expect(
      designerInputSchema.safeParse({
        ...base,
        vibes: ["glam", "relajado", "divertido", "intimo", "minimal"],
      }).success,
    ).toBe(false);
    expect(designerInputSchema.safeParse({ ...base, vibes: ["punk"] }).success).toBe(false);
    expect(designerInputSchema.safeParse({ ...base, colors: ["red"] }).success).toBe(false);
    expect(designerInputSchema.safeParse({ ...base, colors: ["#E9C9BE"] }).success).toBe(true);
  });

  it("«Otra» ocasión exige describirla", () => {
    expect(designerInputSchema.safeParse({ ...base, occasion: "OTHER" }).success).toBe(false);
    expect(
      designerInputSchema.safeParse({ ...base, occasion: "OTHER", occasionOther: "Graduación" }).success,
    ).toBe(true);
  });
});
