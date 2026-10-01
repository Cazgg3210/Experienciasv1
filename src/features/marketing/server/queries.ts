import "server-only";
import { unstable_cache } from "next/cache";
import type { AddOnPricingType, DietaryRestriction, ExperienceType, MenuPricingType, Occasion } from "@prisma/client";
import { prisma } from "@/db";
import { logger } from "@/lib/logger";
import { mediaUrl } from "@/features/media/server/media-url";
import { getSettings } from "@/features/settings/server/settings-service";
import { defaultSettings, type BusinessSettings } from "@/features/settings/domain/settings-schema";
import {
  buildCatalogWhere,
  CATALOG_ORDER_BY,
  catalogCacheKey,
  type CatalogFilters,
  type GuestBounds,
} from "../domain/catalog-filters";
import { FALLBACK_EXPERIENCE_IMAGE } from "../domain/images";

/**
 * Consultas del sitio público. Todo lo que se muestra a visitantes pasa por aquí:
 * sólo datos activos/públicos, sin costos ni márgenes, y cacheado (revalidate 300 s).
 * Invalidar desde el admin con revalidateTag(MARKETING_CACHE_TAGS.catalog | .content | .settings).
 */
export const MARKETING_CACHE_TAGS = {
  catalog: "catalog",
  content: "content",
  settings: "settings",
} as const;

const REVALIDATE_SECONDS = 300;

// -----------------------------------------------------------------------------
// Tipos (serializables: sin Date, porque unstable_cache serializa a JSON)
// -----------------------------------------------------------------------------

export type SiteImage = { src: string; alt: string; width: number; height: number };

export type ExperienceCardData = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  type: ExperienceType;
  occasions: Occasion[];
  basePriceCents: number;
  baseGuests: number;
  minGuests: number;
  maxGuests: number;
  durationMinutes: number;
  featured: boolean;
  cover: SiteImage;
};

export type ExperienceDetail = ExperienceCardData & {
  description: string;
  includes: string[];
  extraGuestPriceCents: number;
  images: SiteImage[];
  styles: Array<{ slug: string; name: string }>;
  menus: Array<{
    id: string;
    name: string;
    description: string | null;
    pricingType: MenuPricingType;
    priceCents: number;
    dietaryTags: DietaryRestriction[];
  }>;
  addOns: Array<{
    id: string;
    name: string;
    description: string | null;
    pricingType: AddOnPricingType;
    priceCents: number;
  }>;
  faqs: FaqItem[];
};

export type FaqItem = { id: string; question: string; answer: string };
export type TestimonialItem = { id: string; authorName: string; occasion: string | null; body: string; rating: number };

export type SiteSettings = {
  business: BusinessSettings;
  pricing: {
    depositBps: number;
    quoteValidityDays: number;
    balanceDueDaysBefore: number;
    minStandardGuests: number;
    maxStandardGuests: number;
    pricesIncludeTax: boolean;
  };
  availability: { minLeadDays: number };
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

type MediaRow = {
  id: string;
  driver: "S3" | "LOCAL" | "EXTERNAL";
  url: string | null;
  storageKey: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  alt: string | null;
  width: number | null;
  height: number | null;
};

const mediaSelect = {
  id: true,
  driver: true,
  url: true,
  storageKey: true,
  visibility: true,
  alt: true,
  width: true,
  height: true,
} as const;

function toSiteImage(asset: MediaRow, fallbackAlt: string): SiteImage | null {
  try {
    return {
      src: mediaUrl(asset),
      alt: asset.alt?.trim() || fallbackAlt,
      width: asset.width ?? 1200,
      height: asset.height ?? 800,
    };
  } catch (error) {
    logger.warn("marketing.media_url_failed", { error, mediaId: asset.id });
    return null;
  }
}

/**
 * Imágenes de experiencia visibles en el sitio: sólo imágenes aprobadas y PÚBLICAS
 * (defensa en profundidad: un asset privado nunca debe obtener URL firmada en una página pública).
 */
const PUBLIC_EXPERIENCE_IMAGE = { mediaAsset: { kind: "IMAGE", approved: true, visibility: "PUBLIC" } } as const;

const cardSelect = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  type: true,
  occasions: true,
  basePriceCents: true,
  baseGuests: true,
  minGuests: true,
  maxGuests: true,
  durationMinutes: true,
  featured: true,
  coverImageUrl: true,
  images: {
    orderBy: { sortOrder: "asc" },
    take: 1,
    where: PUBLIC_EXPERIENCE_IMAGE,
    select: { mediaAsset: { select: mediaSelect } },
  },
} as const;

type CardRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  type: ExperienceType;
  occasions: Occasion[];
  basePriceCents: number;
  baseGuests: number;
  minGuests: number;
  maxGuests: number;
  durationMinutes: number;
  featured: boolean;
  coverImageUrl: string | null;
  images: Array<{ mediaAsset: MediaRow }>;
};

function toCard(row: CardRow): ExperienceCardData {
  const alt = `${row.name} — Ivonne & Rosa`;
  const firstImage = row.images[0] ? toSiteImage(row.images[0].mediaAsset, alt) : null;
  const cover: SiteImage = row.coverImageUrl
    ? { src: row.coverImageUrl, alt, width: 1200, height: 800 }
    : (firstImage ?? { src: FALLBACK_EXPERIENCE_IMAGE, alt, width: 1200, height: 800 });
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    type: row.type,
    occasions: row.occasions,
    basePriceCents: row.basePriceCents,
    baseGuests: row.baseGuests,
    minGuests: row.minGuests,
    maxGuests: row.maxGuests,
    durationMinutes: row.durationMinutes,
    featured: row.featured,
    cover,
  };
}

// -----------------------------------------------------------------------------
// Configuración pública
// -----------------------------------------------------------------------------

export async function loadSiteSettings(): Promise<SiteSettings> {
  const [business, pricing, availability] = await Promise.all([
    getSettings("business"),
    getSettings("pricing"),
    getSettings("availability"),
  ]);
  return {
    business,
    pricing: {
      depositBps: pricing.depositBps,
      quoteValidityDays: pricing.quoteValidityDays,
      balanceDueDaysBefore: pricing.balanceDueDaysBefore,
      minStandardGuests: pricing.minStandardGuests,
      maxStandardGuests: pricing.maxStandardGuests,
      pricesIncludeTax: pricing.pricesIncludeTax,
    },
    availability: { minLeadDays: availability.minLeadDays },
  };
}

function defaultSiteSettings(): SiteSettings {
  const pricing = defaultSettings("pricing");
  return {
    business: defaultSettings("business"),
    pricing: {
      depositBps: pricing.depositBps,
      quoteValidityDays: pricing.quoteValidityDays,
      balanceDueDaysBefore: pricing.balanceDueDaysBefore,
      minStandardGuests: pricing.minStandardGuests,
      maxStandardGuests: pricing.maxStandardGuests,
      pricesIncludeTax: pricing.pricesIncludeTax,
    },
    availability: { minLeadDays: defaultSettings("availability").minLeadDays },
  };
}

const cachedSiteSettings = unstable_cache(loadSiteSettings, ["marketing:site-settings"], {
  revalidate: REVALIDATE_SECONDS,
  tags: [MARKETING_CACHE_TAGS.settings, MARKETING_CACHE_TAGS.content],
});

/** Configuración pública del negocio. Nunca falla: si la DB no responde usa los defaults. */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    return await cachedSiteSettings();
  } catch (error) {
    logger.warn("marketing.settings_fallback", { error });
    return defaultSiteSettings();
  }
}

export function guestBoundsOf(settings: SiteSettings): GuestBounds {
  return {
    minStandardGuests: settings.pricing.minStandardGuests,
    maxStandardGuests: settings.pricing.maxStandardGuests,
  };
}

// -----------------------------------------------------------------------------
// Catálogo
// -----------------------------------------------------------------------------

export async function loadCatalog(filters: CatalogFilters, bounds?: GuestBounds): Promise<ExperienceCardData[]> {
  const rows = await prisma.experience.findMany({
    where: buildCatalogWhere(filters, bounds),
    orderBy: CATALOG_ORDER_BY,
    select: cardSelect,
  });
  return rows.map(toCard);
}

export function getCatalog(filters: CatalogFilters, bounds?: GuestBounds): Promise<ExperienceCardData[]> {
  return unstable_cache(() => loadCatalog(filters, bounds), ["marketing:catalog", catalogCacheKey(filters), JSON.stringify(bounds ?? null)], {
    revalidate: REVALIDATE_SECONDS,
    tags: [MARKETING_CACHE_TAGS.catalog],
  })();
}

export async function loadFeaturedExperiences(limit = 4): Promise<ExperienceCardData[]> {
  const featured = await prisma.experience.findMany({
    where: { active: true, featured: true },
    orderBy: CATALOG_ORDER_BY,
    take: limit,
    select: cardSelect,
  });
  if (featured.length > 0) return featured.map(toCard);
  // Sin destacadas: mostrar las activas en orden editorial
  const active = await prisma.experience.findMany({
    where: { active: true },
    orderBy: CATALOG_ORDER_BY,
    take: limit,
    select: cardSelect,
  });
  return active.map(toCard);
}

export const getFeaturedExperiences = unstable_cache(loadFeaturedExperiences, ["marketing:featured"], {
  revalidate: REVALIDATE_SECONDS,
  tags: [MARKETING_CACHE_TAGS.catalog],
});

export type CatalogFacets = {
  styles: Array<{ slug: string; name: string }>;
  types: ExperienceType[];
  occasions: Occasion[];
};

/** Opciones de filtro: sólo valores presentes en experiencias activas (no ofrecer filtros vacíos). */
export async function loadCatalogFacets(): Promise<CatalogFacets> {
  const [rows, styles] = await Promise.all([
    prisma.experience.findMany({ where: { active: true }, select: { type: true, occasions: true } }),
    prisma.style.findMany({
      where: { active: true, experiences: { some: { active: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { slug: true, name: true },
    }),
  ]);
  const types = new Set<ExperienceType>();
  const occasions = new Set<Occasion>();
  for (const r of rows) {
    types.add(r.type);
    r.occasions.forEach((o) => occasions.add(o));
  }
  return { styles, types: [...types], occasions: [...occasions] };
}

export const getCatalogFacets = unstable_cache(loadCatalogFacets, ["marketing:facets"], {
  revalidate: REVALIDATE_SECONDS,
  tags: [MARKETING_CACHE_TAGS.catalog],
});

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isPlausibleSlug(slug: string | undefined | null): slug is string {
  return typeof slug === "string" && slug.length <= 120 && SLUG_RE.test(slug);
}

export async function loadExperienceDetail(slug: string): Promise<ExperienceDetail | null> {
  if (!isPlausibleSlug(slug)) return null;
  const row = await prisma.experience.findUnique({
    where: { slug },
    select: {
      ...cardSelect,
      active: true,
      description: true,
      includes: true,
      extraGuestPriceCents: true,
      images: {
        orderBy: { sortOrder: "asc" },
        where: PUBLIC_EXPERIENCE_IMAGE,
        select: { mediaAsset: { select: mediaSelect } },
      },
      styles: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { slug: true, name: true } },
      menus: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, description: true, pricingType: true, priceCents: true, dietaryTags: true },
      },
      addOns: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, description: true, pricingType: true, priceCents: true },
      },
      faqs: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, question: true, answer: true },
      },
    },
  });
  if (!row || !row.active) return null;
  const card = toCard({ ...row, images: row.images.slice(0, 1) });
  const alt = `${row.name} — Ivonne & Rosa`;
  const images = row.images
    .map((img, i) => toSiteImage(img.mediaAsset, `${alt} (${i + 1})`))
    .filter((img): img is SiteImage => img !== null);
  return {
    ...card,
    description: row.description,
    includes: row.includes,
    extraGuestPriceCents: row.extraGuestPriceCents,
    images: images.length > 0 ? images : [card.cover],
    styles: row.styles,
    menus: row.menus,
    addOns: row.addOns,
    faqs: row.faqs,
  };
}

export function getExperienceDetail(slug: string): Promise<ExperienceDetail | null> {
  if (!isPlausibleSlug(slug)) return Promise.resolve(null);
  return unstable_cache(() => loadExperienceDetail(slug), ["marketing:experience", slug], {
    revalidate: REVALIDATE_SECONDS,
    tags: [MARKETING_CACHE_TAGS.catalog],
  })();
}

/** Relacionadas: mismo tipo u ocasión compartida; completa con otras activas. */
export async function loadRelatedExperiences(
  current: { id: string; type: ExperienceType; occasions: Occasion[] },
  limit = 3,
): Promise<ExperienceCardData[]> {
  const similar = await prisma.experience.findMany({
    where: {
      active: true,
      id: { not: current.id },
      OR: [{ type: current.type }, ...(current.occasions.length ? [{ occasions: { hasSome: current.occasions } }] : [])],
    },
    orderBy: CATALOG_ORDER_BY,
    take: limit,
    select: cardSelect,
  });
  if (similar.length >= limit) return similar.map(toCard);
  const rest = await prisma.experience.findMany({
    where: { active: true, id: { notIn: [current.id, ...similar.map((s) => s.id)] } },
    orderBy: CATALOG_ORDER_BY,
    take: limit - similar.length,
    select: cardSelect,
  });
  return [...similar, ...rest].map(toCard);
}

export function getRelatedExperiences(
  current: { id: string; type: ExperienceType; occasions: Occasion[] },
  limit = 3,
): Promise<ExperienceCardData[]> {
  return unstable_cache(() => loadRelatedExperiences(current, limit), ["marketing:related", current.id, String(limit)], {
    revalidate: REVALIDATE_SECONDS,
    tags: [MARKETING_CACHE_TAGS.catalog],
  })();
}

/** Para sitemap.xml: slugs activos + última modificación (ISO). */
export async function loadSitemapExperiences(): Promise<Array<{ slug: string; updatedAt: string }>> {
  const rows = await prisma.experience.findMany({
    where: { active: true },
    orderBy: CATALOG_ORDER_BY,
    select: { slug: true, updatedAt: true },
  });
  return rows.map((r) => ({ slug: r.slug, updatedAt: r.updatedAt.toISOString() }));
}

export const getSitemapExperiences = unstable_cache(loadSitemapExperiences, ["marketing:sitemap"], {
  revalidate: REVALIDATE_SECONDS,
  tags: [MARKETING_CACHE_TAGS.catalog],
});

// -----------------------------------------------------------------------------
// Contenido administrable (galería, testimonios, FAQ)
// -----------------------------------------------------------------------------

export async function loadGalleryImages(limit = 8): Promise<SiteImage[]> {
  const rows = await prisma.mediaAsset.findMany({
    where: { purpose: "GALLERY", visibility: "PUBLIC", kind: "IMAGE", approved: true },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    take: limit,
    select: mediaSelect,
  });
  return rows
    .map((row, i) => toSiteImage(row, `Experiencia Ivonne & Rosa (${i + 1})`))
    .filter((img): img is SiteImage => img !== null);
}

export const getGalleryImages = unstable_cache(loadGalleryImages, ["marketing:gallery"], {
  revalidate: REVALIDATE_SECONDS,
  tags: [MARKETING_CACHE_TAGS.content],
});

export async function loadTestimonials(limit = 6): Promise<TestimonialItem[]> {
  return prisma.testimonial.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: limit,
    select: { id: true, authorName: true, occasion: true, body: true, rating: true },
  });
}

export const getTestimonials = unstable_cache(loadTestimonials, ["marketing:testimonials"], {
  revalidate: REVALIDATE_SECONDS,
  tags: [MARKETING_CACHE_TAGS.content],
});

/** FAQ generales (sin experiencia asociada). */
export async function loadGeneralFaqs(limit = 20): Promise<FaqItem[]> {
  return prisma.faq.findMany({
    where: { active: true, experienceId: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: { id: true, question: true, answer: true },
  });
}

export const getGeneralFaqs = unstable_cache(loadGeneralFaqs, ["marketing:faqs"], {
  revalidate: REVALIDATE_SECONDS,
  tags: [MARKETING_CACHE_TAGS.content],
});

/** Valida que una experiencia exista (para analítica). Sin caché: es barata y por id. */
export async function experienceExists(id: string): Promise<boolean> {
  const row = await prisma.experience.findUnique({ where: { id }, select: { id: true } });
  return row !== null;
}

// -----------------------------------------------------------------------------
// Página de inicio (degradación elegante: si una sección falla, se omite)
// -----------------------------------------------------------------------------

async function orFallback<T>(label: string, promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    logger.warn("marketing.section_failed", { section: label, error });
    return fallback;
  }
}

export type HomePageData = {
  settings: SiteSettings;
  experiences: ExperienceCardData[];
  gallery: SiteImage[];
  testimonials: TestimonialItem[];
  faqs: FaqItem[];
};

export async function getHomePageData(): Promise<HomePageData> {
  const [settings, experiences, gallery, testimonials, faqs] = await Promise.all([
    getSiteSettings(),
    orFallback("experiences", getFeaturedExperiences(4), [] as ExperienceCardData[]),
    orFallback("gallery", getGalleryImages(8), [] as SiteImage[]),
    orFallback("testimonials", getTestimonials(5), [] as TestimonialItem[]),
    orFallback("faqs", getGeneralFaqs(6), [] as FaqItem[]),
  ]);
  return { settings, experiences, gallery, testimonials, faqs };
}
