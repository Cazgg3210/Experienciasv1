import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Clock, Leaf, Sparkles, Users } from "lucide-react";
import { WhatsAppIcon } from "@/components/site/brand-icons";
import { Button } from "@/components/ui/button";
import { appUrl } from "@/lib/env";
import { DIETARY_LABELS, EXPERIENCE_TYPE_LABELS, OCCASION_LABELS } from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import { CtaBand } from "@/features/marketing/components/cta-band";
import { ExperienceCard } from "@/features/marketing/components/experience-card";
import { ExperienceGallery } from "@/features/marketing/components/experience-gallery";
import { FaqList } from "@/features/marketing/components/faq-list";
import { JsonLd } from "@/features/marketing/components/json-ld";
import { PageIntro } from "@/features/marketing/components/page-intro";
import { ViewBeacon } from "@/features/marketing/components/view-beacon";
import {
  addOnPriceLabel,
  durationLabel,
  extraGuestLabel,
  guestRangeLabel,
  menuPriceLabel,
  paragraphs,
  truncate,
} from "@/features/marketing/domain/display";
import { breadcrumbJsonLd, experienceServiceJsonLd } from "@/features/marketing/domain/json-ld";
import {
  getExperienceDetail,
  getGeneralFaqs,
  getRelatedExperiences,
  getSiteSettings,
} from "@/features/marketing/server/queries";
import { pageMetadata } from "@/features/marketing/seo";
import { whatsappLink } from "@/server/providers/whatsapp/links";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const experience = await getExperienceDetail(slug).catch(() => null);
  // Slug inexistente/inactivo → página not-found con <meta name="robots" content="noindex">.
  // Nota: como la ruta transmite (streaming) detrás de loading.tsx, Next responde HTTP 200
  // (no 404) aun para crawlers; el noindex evita que se indexe (soft 404 controlado).
  if (!experience) notFound();
  const description = truncate(
    [experience.tagline, paragraphs(experience.description)[0]].filter(Boolean).join(" "),
    160,
  );
  return pageMetadata({
    title: experience.name,
    description,
    path: `/experiencias/${experience.slug}`,
    images: "file",
  });
}

export default async function ExperienceDetailPage({ params }: Props) {
  const { slug } = await params;
  const experience = await getExperienceDetail(slug);
  if (!experience) notFound();

  const [settings, generalFaqs, related] = await Promise.all([
    getSiteSettings(),
    getGeneralFaqs(8).catch(() => []),
    getRelatedExperiences({ id: experience.id, type: experience.type, occasions: experience.occasions }, 3).catch(() => []),
  ]);
  const { business, pricing } = settings;
  const e = experience;
  const extra = extraGuestLabel(e.extraGuestPriceCents);
  const seen = new Set(e.faqs.map((f) => f.question.trim().toLowerCase()));
  const faqs = [...e.faqs, ...generalFaqs.filter((f) => !seen.has(f.question.trim().toLowerCase()))].slice(0, 10);
  const configuratorHref = `/crear-experiencia?experiencia=${encodeURIComponent(e.slug)}`;
  const whatsappHref = whatsappLink(
    business.whatsappNumber,
    `Hola Ivonne & Rosa, quiero información de la experiencia ${e.name}`,
  );
  const baseUrl = appUrl();

  return (
    <>
      <ViewBeacon type="VIEW_EXPERIENCE" experienceId={e.id} />
      <JsonLd
        data={[
          experienceServiceJsonLd({
            baseUrl,
            businessName: business.brandName,
            city: business.city,
            slug: e.slug,
            name: e.name,
            description: truncate(e.tagline ? `${e.tagline} ${e.description}` : e.description, 300),
            image: e.cover.src.startsWith("/") || e.cover.src.startsWith("http") ? e.cover.src : null,
            priceCents: e.basePriceCents,
            minGuests: e.minGuests,
            maxGuests: e.maxGuests,
          }),
          breadcrumbJsonLd(baseUrl, [
            { name: "Inicio", path: "/" },
            { name: "Experiencias", path: "/experiencias" },
            { name: e.name, path: `/experiencias/${e.slug}` },
          ]),
        ]}
      />

      <PageIntro
        eyebrow={
          <>
            {EXPERIENCE_TYPE_LABELS[e.type]}
            {e.occasions.length > 0 ? ` · ${e.occasions.slice(0, 3).map((o) => OCCASION_LABELS[o]).join(" · ")}` : null}
          </>
        }
        title={e.name}
        description={e.tagline ?? undefined}
        breadcrumbs={[{ href: "/", label: "Inicio" }, { href: "/experiencias", label: "Experiencias" }, { label: e.name }]}
        className="pb-8 sm:pb-10"
      />

      <div className="container-page grid gap-10 pb-20 lg:grid-cols-12 lg:gap-x-12 lg:gap-y-16">
        {/* Galería */}
        <div className="lg:col-span-7 lg:row-start-1">
          <ExperienceGallery images={e.images} name={e.name} />
        </div>

        {/* Precio + CTA (sticky en escritorio) */}
        <aside aria-labelledby="precio-title" className="lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
          <div className="bg-card border-border/70 rounded-[1.75rem] border p-6 sm:p-8 lg:sticky lg:top-24">
            <h2 id="precio-title" className="eyebrow">
              Precio
            </h2>
            <p className="mt-3">
              <span className="font-heading text-charcoal block text-4xl font-medium sm:text-5xl">
                Desde {formatMXN(e.basePriceCents)}
              </span>
              <span className="text-charcoal mt-2 block text-sm">
                para {e.baseGuests} personas{extra ? ` · ${extra.charAt(0).toLowerCase()}${extra.slice(1)}` : ""}
              </span>
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              {pricing.pricesIncludeTax ? "IVA incluido. " : "Precios más IVA. "}Precio sujeto a disponibilidad, zona y
              personalización.
            </p>

            <dl className="border-border/70 my-6 grid grid-cols-3 gap-2 border-y py-5 text-center">
              <div>
                <dt className="text-muted-foreground flex items-center justify-center gap-1 text-[11px] tracking-wide uppercase">
                  <Users className="size-3.5" aria-hidden />
                  Personas
                </dt>
                <dd className="font-heading text-charcoal mt-1 text-xl">{guestRangeLabel(e.minGuests, e.maxGuests).replace(" personas", "")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground flex items-center justify-center gap-1 text-[11px] tracking-wide uppercase">
                  <Sparkles className="size-3.5" aria-hidden />
                  Base
                </dt>
                <dd className="font-heading text-charcoal mt-1 text-xl">{e.baseGuests} invitadas</dd>
              </div>
              <div>
                <dt className="text-muted-foreground flex items-center justify-center gap-1 text-[11px] tracking-wide uppercase">
                  <Clock className="size-3.5" aria-hidden />
                  Duración
                </dt>
                <dd className="font-heading text-charcoal mt-1 text-xl">{durationLabel(e.durationMinutes) || "—"}</dd>
              </div>
            </dl>

            <Button asChild size="xl" className="w-full">
              <Link href={configuratorHref}>
                Diseña esta experiencia
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground mt-4 flex items-center justify-center gap-2 text-sm transition-colors"
            >
              <WhatsAppIcon className="size-4" />
              ¿Dudas? Pregúntanos por WhatsApp
            </a>
            {e.maxGuests > 0 ? (
              <p className="text-muted-foreground mt-5 text-center text-xs">
                ¿Más de {e.maxGuests} personas? Lo vemos como consulta especial.
              </p>
            ) : null}
          </div>
        </aside>

        {/* Contenido */}
        <div className="space-y-16 lg:col-span-7 lg:row-start-2">
          <section aria-labelledby="descripcion-title">
            <h2 id="descripcion-title" className="sr-only">
              Descripción
            </h2>
            <div className="text-charcoal/90 space-y-5 text-lg leading-relaxed">
              {paragraphs(e.description).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>

          {e.includes.length > 0 ? (
            <section aria-labelledby="incluye-title">
              <h2 id="incluye-title" className="font-heading text-charcoal text-3xl font-medium">
                Incluye
              </h2>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {e.includes.map((item) => (
                  <li key={item} className="flex gap-3 text-base leading-relaxed">
                    <span className="bg-sage-soft text-olive mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full">
                      <Check className="size-3.5" aria-hidden />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {e.styles.length > 0 ? (
            <section aria-labelledby="estilos-title">
              <h2 id="estilos-title" className="font-heading text-charcoal text-3xl font-medium">
                Estilos disponibles
              </h2>
              <ul className="mt-5 flex flex-wrap gap-2">
                {e.styles.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/experiencias?estilo=${encodeURIComponent(s.slug)}`}
                      className="border-border hover:bg-sand-soft inline-flex rounded-full border px-4 py-1.5 text-sm transition-colors"
                    >
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {e.menus.length > 0 ? (
            <section aria-labelledby="menus-title">
              <h2 id="menus-title" className="font-heading text-charcoal text-3xl font-medium">
                Menús compatibles
              </h2>
              <p className="text-muted-foreground mt-2">Eliges uno al diseñar tu experiencia. Todos se preparan en sitio.</p>
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {e.menus.map((m) => (
                  <li key={m.id} className="bg-card border-border/70 flex flex-col gap-3 rounded-2xl border p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-heading text-charcoal text-xl leading-snug font-medium">{m.name}</h3>
                      <span className="text-olive shrink-0 text-xs font-medium">{menuPriceLabel(m)}</span>
                    </div>
                    {m.description ? <p className="text-muted-foreground text-sm leading-relaxed">{m.description}</p> : null}
                    {m.dietaryTags.length > 0 ? (
                      <ul className="mt-auto flex flex-wrap gap-1.5" aria-label="Opciones de dieta">
                        {m.dietaryTags.map((t) => (
                          <li key={t} className="bg-sage-soft text-olive inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs">
                            <Leaf className="size-3" aria-hidden />
                            {DIETARY_LABELS[t]}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {e.addOns.length > 0 ? (
            <section aria-labelledby="addons-title">
              <h2 id="addons-title" className="font-heading text-charcoal text-3xl font-medium">
                Haz tu experiencia aún más especial
              </h2>
              <p className="text-muted-foreground mt-2">Add-ons opcionales que puedes sumar al diseñar tu experiencia.</p>
              <ul className="divide-border/70 border-border/70 mt-6 divide-y border-y">
                {e.addOns.map((a) => (
                  <li key={a.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                    <div>
                      <h3 className="text-charcoal font-medium">{a.name}</h3>
                      {a.description ? <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{a.description}</p> : null}
                    </div>
                    <p className="text-charcoal shrink-0 text-sm font-medium sm:text-right">
                      {addOnPriceLabel(a)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {faqs.length > 0 ? (
            <section aria-labelledby="faq-title">
              <h2 id="faq-title" className="font-heading text-charcoal text-3xl font-medium">
                Preguntas frecuentes
              </h2>
              <FaqList items={faqs} className="mt-6" />
            </section>
          ) : null}
        </div>
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="relacionadas-title" className="bg-sand-soft py-20 sm:py-24">
          <div className="container-page">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Sigue explorando</p>
                <h2 id="relacionadas-title" className="font-heading text-charcoal mt-3 text-3xl font-medium sm:text-4xl">
                  También te puede gustar
                </h2>
              </div>
              <Link href="/experiencias" className="text-olive text-sm font-medium underline-offset-4 hover:underline">
                Ver todas las experiencias
              </Link>
            </div>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {related.map((r) => (
                <li key={r.id}>
                  <ExperienceCard experience={r} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <CtaBand
        eyebrow={e.name}
        title="Hagámosla tuya."
        description="Elige fecha, invitadas, menú y detalles. Te confirmamos disponibilidad y te enviamos tu propuesta."
        primary={{ href: configuratorHref, label: "Diseña esta experiencia" }}
      />
    </>
  );
}
