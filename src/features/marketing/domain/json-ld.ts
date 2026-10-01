/**
 * Datos estructurados (schema.org JSON-LD) para SEO. Lógica pura.
 */

export const SERVICE_AREAS_CDMX = ["Polanco", "Granada", "Irrigación"] as const;

export type JsonLd = Record<string, unknown>;

/** Serializa JSON-LD de forma segura para incrustar en <script> (evita cerrar la etiqueta / XSS). */
const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), "g");
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), "g");

export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(LINE_SEPARATOR, "\\u2028")
    .replace(PARAGRAPH_SEPARATOR, "\\u2029");
}

function absolute(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/** "+5215512345678" a partir de dígitos (sin validar país). */
export function toE164(digits: string): string {
  const d = digits.replace(/\D/g, "");
  return d ? `+${d}` : "";
}

function areaServed(city: string) {
  return SERVICE_AREAS_CDMX.map((name) => ({
    "@type": "Place",
    name: `${name}, ${city}`,
  }));
}

export function localBusinessJsonLd(input: {
  baseUrl: string;
  name: string;
  description: string;
  telephone: string;
  email: string;
  instagramHandle?: string;
  city: string;
  image?: string;
}): JsonLd {
  const sameAs = input.instagramHandle ? [`https://www.instagram.com/${input.instagramHandle}`] : undefined;
  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "FoodEstablishment"],
    "@id": absolute(input.baseUrl, "/#negocio"),
    name: input.name,
    description: input.description,
    url: absolute(input.baseUrl, "/"),
    telephone: toE164(input.telephone),
    email: input.email,
    priceRange: "$$$",
    image: input.image ? absolute(input.baseUrl, input.image) : undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: input.city,
      addressRegion: "CDMX",
      addressCountry: "MX",
    },
    areaServed: areaServed(input.city),
    servesCuisine: ["Brunch", "Mexicana", "Peruana"],
    makesOffer: {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        serviceType: "Experiencias íntimas llave en mano (brunch y celebraciones a domicilio)",
      },
    },
    sameAs,
  };
}

export function experienceServiceJsonLd(input: {
  baseUrl: string;
  businessName: string;
  city: string;
  slug: string;
  name: string;
  description: string;
  image?: string | null;
  priceCents: number;
  minGuests: number;
  maxGuests: number;
}): JsonLd {
  const url = absolute(input.baseUrl, `/experiencias/${input.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#servicio`,
    name: input.name,
    description: input.description,
    url,
    serviceType: "Experiencia íntima llave en mano",
    image: input.image ? absolute(input.baseUrl, input.image) : undefined,
    provider: {
      "@type": "LocalBusiness",
      "@id": absolute(input.baseUrl, "/#negocio"),
      name: input.businessName,
      url: absolute(input.baseUrl, "/"),
    },
    areaServed: areaServed(input.city),
    audience: {
      "@type": "PeopleAudience",
      description: `Grupos de ${input.minGuests} a ${input.maxGuests} personas`,
    },
    offers: {
      "@type": "Offer",
      url,
      price: (input.priceCents / 100).toFixed(2),
      priceCurrency: "MXN",
      availability: "https://schema.org/InStock",
      eligibleQuantity: {
        "@type": "QuantitativeValue",
        minValue: input.minGuests,
        maxValue: input.maxGuests,
        unitText: "personas",
      },
    },
  };
}

export function faqPageJsonLd(faqs: Array<{ question: string; answer: string }>): JsonLd | null {
  if (faqs.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

export function breadcrumbJsonLd(baseUrl: string, items: Array<{ name: string; path: string }>): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absolute(baseUrl, item.path),
    })),
  };
}
