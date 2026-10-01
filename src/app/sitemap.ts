import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getSitemapExperiences } from "@/features/marketing/server/queries";

export const dynamic = "force-dynamic";

const STATIC_ROUTES: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/experiencias", priority: 0.9, changeFrequency: "weekly" },
  { path: "/crear-experiencia", priority: 0.8, changeFrequency: "monthly" },
  { path: "/como-funciona", priority: 0.7, changeFrequency: "monthly" },
  { path: "/nuestra-historia", priority: 0.6, changeFrequency: "yearly" },
  { path: "/contacto", priority: 0.6, changeFrequency: "yearly" },
  { path: "/privacidad", priority: 0.2, changeFrequency: "yearly" },
  { path: "/terminos", priority: 0.2, changeFrequency: "yearly" },
];

/** sitemap.xml: rutas públicas + experiencias activas. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: appUrl(r.path),
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
  try {
    const experiences = await getSitemapExperiences();
    for (const e of experiences) {
      entries.push({
        url: appUrl(`/experiencias/${e.slug}`),
        lastModified: new Date(e.updatedAt),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  } catch (error) {
    logger.warn("sitemap.experiences_failed", { error });
  }
  return entries;
}
