/**
 * Slug del micrositio de un evento (/e/<slug>/<token>). Puro.
 * Base legible a partir de la homenajeada o el título; si está ocupado se agrega un sufijo.
 */
import { slugify } from "@/lib/slug";

export function baseMicrositeSlug(input: { title: string; honoreeName?: string | null }): string {
  const fromTitle = slugify(input.title);
  const base = fromTitle || slugify(input.honoreeName ?? "") || "celebracion";
  return base.slice(0, 48).replace(/-+$/g, "") || "celebracion";
}

/** Candidatos en orden: base, base-2, base-3 … y al final uno con sufijo aleatorio. */
export function slugCandidates(base: string, randomSuffix: string, count = 5): string[] {
  const out = [base];
  for (let i = 2; i <= count; i++) out.push(`${base}-${i}`);
  out.push(`${base}-${randomSuffix.toLowerCase()}`);
  return out;
}
