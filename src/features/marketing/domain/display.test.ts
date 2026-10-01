import { describe, expect, it } from "vitest";
import {
  addOnPriceLabel,
  cardPriceLine,
  durationLabel,
  extraGuestLabel,
  fromPriceLabel,
  guestRangeLabel,
  menuPriceLabel,
  paragraphs,
  percentFromBps,
  truncate,
} from "./display";
import { canOptimizeImage } from "./images";

// Intl puede usar espacios especiales según el runtime; normalizamos para comparar.
const norm = (s: string) => s.replace(/\s/g, " ");

describe("textos de precio y personas", () => {
  it("rango de personas", () => {
    expect(guestRangeLabel(6, 12)).toBe("6–12 personas");
    expect(guestRangeLabel(8, 8)).toBe("8 personas");
  });

  it("línea de precio de tarjeta", () => {
    expect(norm(cardPriceLine({ basePriceCents: 1_490_000, minGuests: 6, maxGuests: 12 }))).toBe("desde $14,900 · 6–12 personas");
  });

  it("precio desde y invitada adicional", () => {
    expect(norm(fromPriceLabel({ basePriceCents: 1_690_000, baseGuests: 6 }))).toBe("Desde $16,900 para 6 personas");
    expect(norm(extraGuestLabel(150_000)!)).toBe("Invitada adicional $1,500");
    expect(extraGuestLabel(0)).toBeNull();
  });

  it("add-ons: fijo vs por persona", () => {
    expect(norm(addOnPriceLabel({ priceCents: 250_000, pricingType: "FLAT" }))).toBe("$2,500");
    expect(norm(addOnPriceLabel({ priceCents: 18_000, pricingType: "PER_GUEST" }))).toBe("$180 por persona");
    expect(addOnPriceLabel({ priceCents: 0, pricingType: "FLAT" })).toBe("Sin costo");
  });

  it("menús: incluido / upgrade por persona / por evento", () => {
    expect(menuPriceLabel({ priceCents: 0, pricingType: "INCLUDED" })).toBe("Incluido");
    expect(menuPriceLabel({ priceCents: 50_000, pricingType: "INCLUDED" })).toBe("Incluido");
    expect(norm(menuPriceLabel({ priceCents: 12_000, pricingType: "PER_GUEST" }))).toBe("+$120 por persona");
    expect(norm(menuPriceLabel({ priceCents: 90_000, pricingType: "FLAT" }))).toBe("+$900 por evento");
  });

  it("porcentaje desde bps", () => {
    expect(percentFromBps(5000)).toBe("50%");
    expect(percentFromBps(1650)).toBe("16.5%");
  });
});

describe("duración, párrafos y recorte", () => {
  it("duración legible", () => {
    expect(durationLabel(180)).toBe("3 h");
    expect(durationLabel(210)).toBe("3 h 30 min");
    expect(durationLabel(45)).toBe("45 min");
    expect(durationLabel(0)).toBe("");
  });

  it("divide párrafos por línea en blanco", () => {
    expect(paragraphs("Uno.\n\nDos.\n  \nTres.")).toEqual(["Uno.", "Dos.", "Tres."]);
  });

  it("recorta sin cortar palabras y agrega elipsis", () => {
    const text = "Una mesa larga vestida con lino, flores de temporada y vajilla de porcelana, montada en tu casa.";
    const out = truncate(text, 40);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith("…")).toBe(true);
    expect(truncate("Corto", 40)).toBe("Corto");
  });
});

describe("canOptimizeImage", () => {
  it("no optimiza SVG, URLs firmadas ni hosts no permitidos", () => {
    expect(canOptimizeImage("/images/placeholders/hero.svg")).toBe(false);
    expect(canOptimizeImage("/api/media/abc?exp=1&sig=x")).toBe(false);
    expect(canOptimizeImage("https://cdn.otro.com/foto.jpg")).toBe(false);
    expect(canOptimizeImage("//evil.com/x.jpg")).toBe(false);
    expect(canOptimizeImage("")).toBe(false);
  });

  it("optimiza estáticos locales y buckets permitidos", () => {
    expect(canOptimizeImage("/images/foto.jpg")).toBe(true);
    expect(canOptimizeImage("https://bucket.s3.amazonaws.com/a.webp")).toBe(true);
    expect(canOptimizeImage("http://localhost:9000/ivonne-rosa/a.jpg")).toBe(true);
  });
});
