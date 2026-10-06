import { notFound } from "next/navigation";
import { getExperienceDetail } from "@/features/marketing/server/queries";

export const dynamic = "force-dynamic";

/**
 * Valida el slug ANTES de cualquier límite de carga (loading.tsx) para responder un 404 real
 * (no un soft-404 con HTTP 200) a experiencias inexistentes o inactivas. Mismo patrón que
 * `cotizacion/[token]/layout.tsx`.
 *
 * Por eso ningún segmento por encima de éste tiene loading.tsx: los esqueletos del inicio y del
 * catálogo viven en los grupos `(public)/(inicio)` y `experiencias/(catalogo)`. El notFound() de aquí
 * lo muestra `experiencias/not-found.tsx` (la frontera del segmento padre).
 * `getExperienceDetail` está en caché (unstable_cache), así que la página no repite la consulta.
 */
export default async function ExperienceSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const experience = await getExperienceDetail(slug);
  if (!experience) notFound();
  return children;
}
