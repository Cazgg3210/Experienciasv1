import { describe, expect, it } from "vitest";
import { isValidPhone, mxNationalNumber, normalizePhone, phoneMatchKeys, phoneSearchDigits, samePhone } from "./phone";

describe("normalizePhone (forma canónica E.164)", () => {
  it.each([
    ["5512345678", "+525512345678"],
    ["55 1234 5678", "+525512345678"],
    ["55-1234-5678", "+525512345678"],
    ["55.1234.5678", "+525512345678"],
    ["(55) 1234 5678", "+525512345678"],
    ["  55 1234 5678  ", "+525512345678"],
    ["+52 55 1234 5678", "+525512345678"],
    ["+525512345678", "+525512345678"],
    ["52 55 1234 5678", "+525512345678"],
    ["525512345678", "+525512345678"],
    ["+52 1 55 1234 5678", "+525512345678"],
    ["+521 55 1234 5678", "+525512345678"],
    ["5215512345678", "+525512345678"],
    ["+52 (81) 5102-3302", "+528151023302"],
    ["(+52) 55 1234 5678", "+525512345678"],
  ])("México: %s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it("es idempotente: la forma canónica no cambia", () => {
    for (const v of ["+525512345678", "+14155550123", "+34912345678"]) {
      expect(normalizePhone(normalizePhone(v))).toBe(v);
    }
  });

  it("otros países conservan su lada", () => {
    expect(normalizePhone("+1 (415) 555-0123")).toBe("+14155550123");
    expect(normalizePhone("+34 912 345 678")).toBe("+34912345678");
    expect(normalizePhone("14155550123")).toBe("+14155550123");
  });

  it.each([
    [null],
    [undefined],
    [""],
    ["   "],
    ["123"],
    ["55 1234 567"], // 9 dígitos
    ["55-ABC-1234"],
    ["tel: 5512345678"],
    ["55+12345678"], // "+" en medio
    ["+52 55 1234 5678 ext 2"],
    ["0445512345678"], // prefijo de marcación, no lada
    ["1234567890123456"], // 16 dígitos
    // Lada de México (52) con longitud equivocada: no se cuela como "internacional"
    ["+52 55 1234 567"], // 52 + 9
    ["+52 55 1234 56789"], // 52 + 11
    ["52551234567"],
    ["5255123456789"], // 13 dígitos sin el 1 de celular
    ["52 1 55 1234 567"], // 521 + 9: no es 52 + "1551234567"
    ["+52 1 55 1234 56789"], // 521 + 11
    // "+" siempre trae lada: "+" + 10 dígitos no es un número nacional
    ["+1 415 555 012"],
    ["+55 1234 5678"],
    // El número nacional de México empieza del 2 al 9
    ["0123456789"],
    ["1234567890"],
    ["+52 01 234 5678"],
  ])("inválido o vacío: %s → null", (input) => {
    expect(normalizePhone(input as string | null | undefined)).toBeNull();
    expect(isValidPhone(input as string | null | undefined)).toBe(false);
  });

  it("una lada internacional que no es 52 conserva cualquier longitud válida (11 a 15)", () => {
    expect(normalizePhone("+34 91 234 56 78")).toBe("+34912345678");
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhone("+1 415 555 0123")).toBe("+14155550123");
  });
});

describe("mxNationalNumber", () => {
  it("devuelve los 10 dígitos nacionales para cualquier formato mexicano", () => {
    expect(mxNationalNumber("+52 1 55 1234 5678")).toBe("5512345678");
    expect(mxNationalNumber("52 55 1234 5678")).toBe("5512345678");
    expect(mxNationalNumber("55 1234 5678")).toBe("5512345678");
  });
  it("null para teléfonos de otros países o inválidos", () => {
    expect(mxNationalNumber("+1 415 555 0123")).toBeNull();
    expect(mxNationalNumber("12345")).toBeNull();
    expect(mxNationalNumber(null)).toBeNull();
    expect(mxNationalNumber("+1 415 555 012")).toBeNull(); // "+" + 10 dígitos: trae lada, no es nacional
    expect(mxNationalNumber("52 1 55 1234 567")).toBeNull(); // 521 + 9 dígitos
    expect(mxNationalNumber("1555123456")).toBeNull(); // ninguna lada mexicana empieza con 1
  });
});

describe("phoneMatchKeys (reconocer el mismo número guardado con otro formato)", () => {
  it("México: 10 dígitos, 52 + 10 y 521 + 10", () => {
    const keys = ["5512345678", "525512345678", "5215512345678"];
    expect(phoneMatchKeys("55 1234 5678")).toEqual(keys);
    expect(phoneMatchKeys("+52 1 55 1234 5678")).toEqual(keys);
    expect(phoneMatchKeys("+525512345678")).toEqual(keys);
  });
  it("otro país: sus dígitos con lada; inválido: ninguna", () => {
    expect(phoneMatchKeys("+1 415 555 0123")).toEqual(["14155550123"]);
    expect(phoneMatchKeys("123")).toEqual([]);
    expect(phoneMatchKeys("")).toEqual([]);
  });
});

describe("samePhone", () => {
  it("el mismo número con distinto formato es el mismo teléfono", () => {
    expect(samePhone("55 1234 5678", "+525512345678")).toBe(true);
    expect(samePhone("5215512345678", "+52 55 1234-5678")).toBe(true);
    expect(samePhone(null, "")).toBe(true);
  });
  it("números distintos, o uno vacío, no son el mismo", () => {
    expect(samePhone("5512345678", "5512345679")).toBe(false);
    expect(samePhone("5512345678", null)).toBe(false);
    expect(samePhone("", "+525512345678")).toBe(false);
  });
  it("valores que no son teléfono se comparan tal cual", () => {
    expect(samePhone(" ext 12 ", "ext 12")).toBe(true);
    expect(samePhone("ext 12", "ext 13")).toBe(false);
  });
});

describe("phoneSearchDigits", () => {
  it("un teléfono mexicano completo se busca por su número nacional", () => {
    expect(phoneSearchDigits("+52 1 55 1234 5678")).toBe("5512345678");
    expect(phoneSearchDigits("+52 55 1234-5678")).toBe("5512345678");
    expect(phoneSearchDigits("5512345678")).toBe("5512345678");
  });
  it("un fragmento se busca por sus dígitos", () => {
    expect(phoneSearchDigits("4321 9876")).toBe("43219876");
    expect(phoneSearchDigits("Sofía")).toBe("");
  });
});
