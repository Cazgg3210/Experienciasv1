import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MessageCircle, WandSparkles } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { localDateKey } from "@/lib/dates";
import { isEnabled } from "@/lib/flags";
import { getSettings } from "@/features/settings/server/settings-service";
import { whatsappLink } from "@/server/providers/whatsapp/links";
import { ConfiguratorWizard } from "@/features/configurator/components/configurator-wizard";
import { parseOccasionParam } from "@/features/configurator/domain/wizard";
import { getConfiguratorCatalog } from "@/features/configurator/server/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Crea tu experiencia",
  description:
    "Arma tu brunch o celebración íntima en CDMX en 10 pasos: fecha, estilo, menú y detalles. Recibe un estimado al momento, sin compromiso.",
  alternates: { canonical: "/crear-experiencia" },
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s ? s.trim() : null;
}

function cleanToken(v: string | null, max: number): string | null {
  if (!v) return null;
  const s = v.slice(0, max);
  return /^[\w.\-]+$/.test(s) ? s : null;
}

export default async function CrearExperienciaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const [catalog, aiEnabled, business] = await Promise.all([
    getConfiguratorCatalog(),
    isEnabled("AI_DESIGNER_ENABLED"),
    getSettings("business"),
  ]);

  const slug = first(sp.experiencia);
  const preselected = slug ? catalog.experiences.find((e) => e.slug === slug) : undefined;
  const occasion = parseOccasionParam(sp.ocasion);
  const attribution = {
    utmSource: cleanToken(first(sp.utm_source), 60),
    referredByCode: cleanToken(first(sp.ref), 40),
  };

  return (
    <div className="bg-ivory min-h-[70dvh]">
      <section aria-labelledby="crear-experiencia-titulo" className="container-page pt-8 pb-2 sm:pt-14">
        <p className="eyebrow">Crea tu experiencia</p>
        <h1
          id="crear-experiencia-titulo"
          className="font-heading mt-2 max-w-3xl text-4xl leading-[1.05] font-semibold text-balance sm:text-5xl lg:text-6xl"
        >
          Diseñemos juntas tu celebración
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-base sm:text-lg">
          Responde 10 preguntas rápidas y recibe un estimado al momento. Sin compromiso: después confirmamos
          disponibilidad contigo.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {preselected ? (
            <p className="text-charcoal">
              Partimos de <strong className="font-semibold">{preselected.name}</strong>; puedes cambiarla
              cuando quieras.
            </p>
          ) : null}
          {aiEnabled ? (
            <Link
              href="/crear-experiencia/ai"
              className="text-olive inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
            >
              <WandSparkles className="size-4" aria-hidden />
              ¿Prefieres que te propongamos una idea? Prueba el diseñador con IA
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      </section>

      <div className="container-page pt-8 sm:pt-10">
        {catalog.experiences.length === 0 ? (
          <EmptyState
            className="mb-16"
            title="Estamos preparando nuevas experiencias"
            description="Mientras tanto, escríbenos por WhatsApp y armamos tu celebración a la medida."
            action={
              <Button asChild size="xl">
                <a
                  href={whatsappLink(
                    business.whatsappNumber,
                    "Hola, me gustaría armar una experiencia con ustedes.",
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle aria-hidden /> Escríbenos por WhatsApp
                </a>
              </Button>
            }
          />
        ) : (
          <ConfiguratorWizard
            key={`${preselected?.id ?? "-"}:${occasion ?? "-"}`}
            catalog={catalog}
            preselect={{ occasion, experienceId: preselected?.id ?? null }}
            todayKey={localDateKey()}
            attribution={attribution}
          />
        )}
      </div>
    </div>
  );
}
