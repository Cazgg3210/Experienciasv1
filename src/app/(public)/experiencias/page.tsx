import Link from "next/link";
import { Info, SearchX } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { WHATSAPP_DEFAULT_MESSAGE } from "@/components/site/nav-config";
import { Button } from "@/components/ui/button";
import { CatalogFilterForm } from "@/features/marketing/components/catalog-filters";
import { CtaBand } from "@/features/marketing/components/cta-band";
import { ExperienceCard } from "@/features/marketing/components/experience-card";
import { PageIntro } from "@/features/marketing/components/page-intro";
import { isSmallGroup, isSpecialGroup, parseCatalogFilters } from "@/features/marketing/domain/catalog-filters";
import { buildFilterOptions, describeFilters } from "@/features/marketing/domain/filter-options";
import { getCatalog, getCatalogFacets, getSiteSettings, guestBoundsOf } from "@/features/marketing/server/queries";
import { pageMetadata } from "@/features/marketing/seo";
import { whatsappLink } from "@/server/providers/whatsapp/links";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Experiencias",
  description:
    "Brunches privados, mesas de cumpleaños, bridal brunch, karaoke & mimosas y más: experiencias íntimas para 6–12 personas en CDMX, listas para disfrutar.",
  path: "/experiencias",
});

export default async function ExperiencesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseCatalogFilters(await searchParams);
  const settings = await getSiteSettings();
  const bounds = guestBoundsOf(settings);
  const [experiences, facets] = await Promise.all([getCatalog(filters, bounds), getCatalogFacets()]);

  const options = buildFilterOptions(facets, filters, bounds);
  const styleName = filters.estilo ? facets.styles.find((s) => s.slug === filters.estilo)?.name : null;
  const summary = describeFilters(filters, styleName);
  const special = isSpecialGroup(filters.personas, bounds);
  const small = isSmallGroup(filters.personas, bounds);
  const whatsappHref = whatsappLink(
    settings.business.whatsappNumber,
    filters.personas
      ? `Hola Ivonne & Rosa, quiero información de una experiencia para ${filters.personas} personas`
      : WHATSAPP_DEFAULT_MESSAGE,
  );

  return (
    <>
      <PageIntro
        eyebrow="Catálogo"
        title="Experiencias para celebrar a las tuyas"
        description={`Mesas pre-diseñadas para ${bounds.minStandardGuests}–${bounds.maxStandardGuests} personas que adaptamos a tu ocasión, tu estilo y tus invitadas. Todas incluyen comida, montaje, servicio y desmontaje.`}
        breadcrumbs={[{ href: "/", label: "Inicio" }, { label: "Experiencias" }]}
      />

      <section aria-labelledby="resultados-title" className="container-page pb-20 sm:pb-24">
        <h2 id="resultados-title" className="sr-only">
          Resultados
        </h2>
        <CatalogFilterForm {...options} />

        <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2" aria-live="polite">
          <p className="text-muted-foreground text-sm">
            {experiences.length === 1 ? "1 experiencia" : `${experiences.length} experiencias`}
            {summary ? <span> para “{summary}”</span> : null}
          </p>
        </div>

        {special ? (
          <div className="bg-sand-soft border-border/70 mt-6 flex gap-3 rounded-2xl border p-5" role="note">
            <Info className="text-olive mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="text-sm leading-relaxed">
              <p className="text-charcoal font-medium">
                ¿Son más de {bounds.maxStandardGuests}? Lo tratamos como consulta especial.
              </p>
              <p className="text-muted-foreground mt-1">
                Nuestras experiencias están pensadas para {bounds.minStandardGuests}–{bounds.maxStandardGuests} personas, pero podemos
                adaptar cualquiera de estas para grupos más grandes. Diseña tu experiencia o{" "}
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="text-olive font-medium underline underline-offset-4">
                  escríbenos por WhatsApp
                </a>{" "}
                y te enviamos una propuesta a la medida.
              </p>
            </div>
          </div>
        ) : null}
        {small ? (
          <div className="bg-sand-soft border-border/70 mt-6 flex gap-3 rounded-2xl border p-5" role="note">
            <Info className="text-olive mt-0.5 size-5 shrink-0" aria-hidden />
            <p className="text-muted-foreground text-sm leading-relaxed">
              <span className="text-charcoal font-medium">¿Un grupo más pequeño?</span> Nuestras experiencias parten de{" "}
              {bounds.minStandardGuests} personas. Para algo más íntimo,{" "}
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="text-olive font-medium underline underline-offset-4">
                escríbenos
              </a>{" "}
              y lo platicamos.
            </p>
          </div>
        ) : null}

        {experiences.length > 0 ? (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {experiences.map((e) => (
              <li key={e.id}>
                <ExperienceCard experience={e} showBadge />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            className="mt-8"
            icon={SearchX}
            title="Ninguna experiencia coincide con tu búsqueda"
            description="Ajusta los filtros o diseña una experiencia a tu medida: la armamos contigo."
            action={
              <div className="flex flex-col items-center gap-2 sm:flex-row">
                <Button asChild className="h-10 rounded-full px-5">
                  <Link href="/crear-experiencia">Diseña tu experiencia</Link>
                </Button>
                <Button asChild variant="ghost" className="h-10 rounded-full px-5">
                  <Link href="/experiencias">Ver todas las experiencias</Link>
                </Button>
              </div>
            }
          />
        )}
      </section>

      <CtaBand
        eyebrow="¿No encuentras la tuya?"
        title="Diseñamos una mesa sólo para ti."
        description="Cuéntanos la ocasión, la fecha y el estilo. Te enviamos una propuesta clara con disponibilidad confirmada."
        secondary={{ href: whatsappHref, label: "Escríbenos por WhatsApp", external: true }}
        className="pt-0 sm:pt-0"
      />
    </>
  );
}
