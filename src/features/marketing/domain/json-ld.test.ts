import { describe, expect, it } from "vitest";
import {
  breadcrumbJsonLd,
  experienceServiceJsonLd,
  faqPageJsonLd,
  localBusinessJsonLd,
  serializeJsonLd,
  toE164,
} from "./json-ld";

describe("serializeJsonLd", () => {
  it("escapa caracteres que podrían cerrar el <script> (XSS)", () => {
    const out = serializeJsonLd({ name: "</script><script>alert('x')</script> & más" });
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).toContain("\\u003c/script\\u003e");
    expect(out).toContain("\\u0026");
    // Sigue siendo JSON válido que se decodifica al texto original
    expect(JSON.parse(out).name).toBe("</script><script>alert('x')</script> & más");
  });

  it("escapa separadores de línea Unicode", () => {
    const out = serializeJsonLd({ a: `x${String.fromCharCode(0x2028)}y${String.fromCharCode(0x2029)}z` });
    expect(out).toContain("\\u2028");
    expect(out).toContain("\\u2029");
  });
});

describe("localBusinessJsonLd", () => {
  it("incluye zonas de CDMX, teléfono E.164, url absoluta y rango de precio", () => {
    const data = localBusinessJsonLd({
      baseUrl: "https://ivonne-rosa.mx/",
      name: "Ivonne & Rosa",
      description: "Experiencias íntimas",
      telephone: "5215512345678",
      email: "hola@ivonne-rosa.mx",
      instagramHandle: "ivonneyrosa",
      city: "Ciudad de México",
      image: "/opengraph-image",
    });
    expect(data["@type"]).toContain("LocalBusiness");
    expect(data.url).toBe("https://ivonne-rosa.mx/");
    expect(data.telephone).toBe("+5215512345678");
    expect(data.priceRange).toBe("$$$");
    expect(data.image).toBe("https://ivonne-rosa.mx/opengraph-image");
    expect((data.areaServed as Array<{ name: string }>).map((a) => a.name)).toEqual([
      "Polanco, Ciudad de México",
      "Granada, Ciudad de México",
      "Irrigación, Ciudad de México",
    ]);
    expect(data.sameAs).toEqual(["https://www.instagram.com/ivonneyrosa"]);
  });

  it("toE164 limpia el número", () => {
    expect(toE164("55 1234-5678")).toBe("+5512345678");
    expect(toE164("")).toBe("");
  });
});

describe("experienceServiceJsonLd", () => {
  it("genera Service con Offer en MXN y rango de personas", () => {
    const data = experienceServiceJsonLd({
      baseUrl: "http://localhost:3000",
      businessName: "Ivonne & Rosa",
      city: "Ciudad de México",
      slug: "signature-brunch",
      name: "Signature Brunch",
      description: "Brunch",
      image: "/images/placeholders/brunch-table.svg",
      priceCents: 1_490_000,
      minGuests: 6,
      maxGuests: 12,
    });
    expect(data["@type"]).toBe("Service");
    expect(data.url).toBe("http://localhost:3000/experiencias/signature-brunch");
    expect(data.image).toBe("http://localhost:3000/images/placeholders/brunch-table.svg");
    const offer = data.offers as Record<string, unknown>;
    expect(offer.price).toBe("14900.00");
    expect(offer.priceCurrency).toBe("MXN");
    expect(offer.eligibleQuantity).toMatchObject({ minValue: 6, maxValue: 12 });
  });
});

describe("faqPageJsonLd / breadcrumbJsonLd", () => {
  it("FAQPage vacío devuelve null", () => {
    expect(faqPageJsonLd([])).toBeNull();
    const faq = faqPageJsonLd([{ question: "¿Hay opción sin gluten?", answer: "Sí." }])!;
    expect(faq["@type"]).toBe("FAQPage");
    expect((faq.mainEntity as unknown[]).length).toBe(1);
  });

  it("breadcrumb con posiciones y urls absolutas", () => {
    const b = breadcrumbJsonLd("https://x.mx", [
      { name: "Inicio", path: "/" },
      { name: "Experiencias", path: "/experiencias" },
    ]);
    expect(b.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Inicio", item: "https://x.mx/" },
      { "@type": "ListItem", position: 2, name: "Experiencias", item: "https://x.mx/experiencias" },
    ]);
  });
});
