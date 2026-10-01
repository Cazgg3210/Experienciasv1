import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, HeartHandshake, ShieldCheck, WandSparkles } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { isEnabled } from "@/lib/flags";
import { getSettings } from "@/features/settings/server/settings-service";
import { DesignerStudio } from "@/features/ai-designer/components/designer-studio";
import { getDesignerPageData } from "@/features/ai-designer/server/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Diseña tu experiencia con IA",
  description:
    "Cuéntanos la idea y en un minuto te proponemos concepto, paleta, menú, extras y dinámicas con experiencias reales de Ivonne & Rosa y un precio estimado.",
  alternates: { canonical: "/crear-experiencia/ai" },
};

function Unavailable({ reason }: { reason: "disabled" | "catalog" }) {
  return (
    <div className="bg-ivory min-h-[60dvh]">
      <div className="container-page max-w-3xl py-14 sm:py-24">
        <h1 className="sr-only">Diseñador de experiencias con IA</h1>
        <EmptyState
          icon={WandSparkles}
          title={
            reason === "disabled"
              ? "El diseñador con IA está tomando una pausa"
              : "Estamos renovando nuestras experiencias"
          }
          description={
            reason === "disabled"
              ? "Mientras tanto, crea tu experiencia paso a paso: eliges ocasión, fecha, estilo y menú, y te damos un estimado al momento."
              : "En unos días tendremos nuevas propuestas. Mientras tanto, cuéntanos tu idea y la armamos contigo."
          }
          action={
            <Button asChild size="xl">
              <Link href="/crear-experiencia">
                Crear mi experiencia paso a paso
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}

const PROMISES = [
  { icon: BadgeCheck, text: "Experiencias y precios reales del catálogo" },
  { icon: HeartHandshake, text: "Sin compromiso: lo afinamos contigo" },
  { icon: ShieldCheck, text: "Tus datos sólo si decides avanzar" },
];

export default async function AiDesignerPage() {
  if (!(await isEnabled("AI_DESIGNER_ENABLED"))) return <Unavailable reason="disabled" />;

  const [data, pricing] = await Promise.all([getDesignerPageData(), getSettings("pricing")]);
  if (!data.hasCatalog) return <Unavailable reason="catalog" />;

  return (
    <div className="bg-ivory min-h-[70dvh]">
      <section
        aria-labelledby="ai-designer-title"
        className="container-page max-w-5xl pt-8 pb-8 sm:pt-14 sm:pb-12"
      >
        <div className="bg-sand-soft relative overflow-hidden rounded-[2rem] px-6 py-9 sm:px-10 sm:py-12 lg:grid lg:grid-cols-[1.4fr_1fr] lg:items-center lg:gap-10">
          <div className="relative space-y-4">
            <p className="eyebrow">Diseñador con IA</p>
            <h1
              id="ai-designer-title"
              className="font-heading text-4xl leading-[1.05] font-semibold text-balance sm:text-5xl lg:text-6xl"
            >
              Cuéntanos la idea. Nosotras la volvemos experiencia.
            </h1>
            <p className="text-muted-foreground max-w-xl text-base sm:text-lg">
              En un minuto te proponemos concepto, paleta, menú, extras y dinámicas — con experiencias que sí
              podemos llevar a tu mesa y un precio estimado al momento.
            </p>
            <ul className="flex flex-col gap-2 pt-1 text-sm sm:flex-row sm:flex-wrap sm:gap-x-5">
              {PROMISES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2">
                  <Icon aria-hidden className="text-olive size-4 shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative mt-8 hidden aspect-[4/3] overflow-hidden rounded-3xl lg:mt-0 lg:block">
            <Image
              src="/images/placeholders/brunch-table.svg"
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 380px, 0px"
              className="object-cover"
            />
          </div>
        </div>
        <p className="text-muted-foreground mt-4 text-center text-sm">
          ¿Ya sabes lo que quieres?{" "}
          <Link
            href="/crear-experiencia"
            className="text-olive font-medium underline-offset-4 hover:underline"
          >
            Arma tu experiencia paso a paso
          </Link>
        </p>
      </section>

      <div className="container-page max-w-4xl pb-20">
        <DesignerStudio
          options={{ budgets: data.budgets, areas: data.areas }}
          maxStandardGuests={pricing.maxStandardGuests}
        />
      </div>
    </div>
  );
}
