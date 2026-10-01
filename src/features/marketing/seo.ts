import type { Metadata } from "next";

/** Metadatos SEO / OpenGraph consistentes para las páginas públicas. */

export const SITE_NAME = "Ivonne & Rosa";

export const DEFAULT_OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Ivonne & Rosa — experiencias íntimas llave en mano en CDMX",
};

export type OgImage = { url: string; width?: number; height?: number; alt?: string };

export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  images,
  noindex = false,
}: {
  title: string;
  description: string;
  /** Ruta canónica (sin query), p. ej. "/experiencias" */
  path: string;
  /** true = no aplicar la plantilla "%s · Ivonne & Rosa" */
  absoluteTitle?: boolean;
  /** "file" = la ruta tiene su propio opengraph-image.tsx (Next genera la URL, con hash en route groups). */
  images?: OgImage[] | "file";
  noindex?: boolean;
}): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} · ${SITE_NAME}`;
  const fileBased = images === "file";
  const ogImages = !fileBased && images && images.length > 0 ? images : [DEFAULT_OG_IMAGE];
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "es_MX",
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      url: path,
      ...(fileBased ? {} : { images: ogImages }),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      ...(fileBased ? {} : { images: ogImages.map((i) => i.url) }),
    },
    robots: noindex ? { index: false, follow: true } : undefined,
  };
}
