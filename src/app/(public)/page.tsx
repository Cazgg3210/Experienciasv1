import Link from "next/link";
import { ArrowRight, CalendarCheck, MapPin, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { appUrl } from "@/lib/env";
import { cn } from "@/lib/utils";
import { CtaBand } from "@/features/marketing/components/cta-band";
import { ExperienceCard } from "@/features/marketing/components/experience-card";
import { FaqList } from "@/features/marketing/components/faq-list";
import { GalleryGrid } from "@/features/marketing/components/gallery-grid";
import { HowItWorksSteps } from "@/features/marketing/components/how-it-works-steps";
import { InstagramGrid } from "@/features/marketing/components/instagram-grid";
import { JsonLd } from "@/features/marketing/components/json-ld";
import { SectionHeading } from "@/features/marketing/components/section-heading";
import { SiteImage } from "@/features/marketing/components/site-image";
import { Testimonials } from "@/features/marketing/components/testimonials";
import { ValueProps } from "@/features/marketing/components/value-props";
import { faqPageJsonLd, localBusinessJsonLd } from "@/features/marketing/domain/json-ld";
import { getHomePageData } from "@/features/marketing/server/queries";
import { pageMetadata } from "@/features/marketing/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Ivonne & Rosa — Experiencias íntimas llave en mano en CDMX",
  absoluteTitle: true,
  description:
    "Brunches y experiencias íntimas para 6–12 personas en Polanco, Granada e Irrigación. Comida, mesa, decoración, montaje y desmontaje: tú sólo disfrutas.",
  path: "/",
});

function experienceGridCols(count: number): string {
  if (count >= 4) return "sm:grid-cols-2";
  if (count === 3) return "sm:grid-cols-2 lg:grid-cols-3";
  if (count === 2) return "sm:grid-cols-2";
  return "max-w-xl";
}

export default async function HomePage() {
  const { settings, experiences, gallery, testimonials, faqs } = await getHomePageData();
  const { business } = settings;
  const minGuests = settings.pricing.minStandardGuests;
  const maxGuests = settings.pricing.maxStandardGuests;

  const jsonLd = [
    localBusinessJsonLd({
      baseUrl: appUrl(),
      name: business.brandName,
      description: `Brunches y experiencias íntimas llave en mano para ${minGuests}–${maxGuests} personas en ${business.city}.`,
      telephone: business.whatsappNumber,
      email: business.contactEmail,
      instagramHandle: business.instagramHandle,
      city: business.city,
      image: "/opengraph-image",
    }),
    faqPageJsonLd(faqs),
  ].filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <>
      <JsonLd data={jsonLd} />

      {/* 1. Hero */}
      <section aria-labelledby="hero-title" className="relative">
        <div className="container-page grid items-center gap-10 pt-10 pb-16 sm:pt-14 lg:grid-cols-12 lg:gap-14 lg:pt-20 lg:pb-24">
          <div className="lg:col-span-6">
            <p className="eyebrow">Experiencias íntimas llave en mano</p>
            <h1
              id="hero-title"
              className="font-heading text-charcoal mt-5 text-[2.75rem] leading-[0.98] font-medium text-balance sm:text-6xl lg:text-7xl"
            >
              Momentos bonitos, listos para disfrutar.
            </h1>
            <p className="text-muted-foreground mt-6 max-w-md text-lg leading-relaxed sm:text-xl">
              {`Brunches y experiencias íntimas para ${minGuests}–${maxGuests} personas en CDMX.`}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="xl">
                <Link href="/crear-experiencia">
                  Diseña tu experiencia
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline" className="rounded-full">
                <Link href="/experiencias">Ver experiencias</Link>
              </Button>
            </div>
            <ul className="text-muted-foreground mt-10 grid gap-3 text-sm sm:grid-cols-3 sm:gap-4">
              <li className="flex items-center gap-2">
                <MapPin className="text-olive size-4 shrink-0" aria-hidden />
                Polanco · Granada · Irrigación
              </li>
              <li className="flex items-center gap-2">
                <CalendarCheck className="text-olive size-4 shrink-0" aria-hidden />
                Disponibilidad confirmada
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="text-olive size-4 shrink-0" aria-hidden />
                Anticipo seguro en línea
              </li>
            </ul>
          </div>
          <div className="relative lg:col-span-6">
            <div className="bg-sand-soft relative aspect-[5/4] overflow-hidden rounded-[2rem]">
              <SiteImage
                src="/images/placeholders/hero.svg"
                alt="Mesa de brunch montada con flores de temporada, lino y porcelana"
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="bg-ivory/95 border-border/70 absolute -bottom-6 left-4 hidden max-w-[16rem] rounded-2xl border p-5 shadow-lg shadow-black/5 sm:block lg:-left-8">
              <p className="font-heading text-olive text-xl leading-snug italic">“Tú sólo llegas, brindas y disfrutas.”</p>
              <p className="text-muted-foreground mt-2 text-xs">Montamos, servimos y desmontamos por ti.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Propuesta de valor */}
      <section aria-labelledby="valor-title" className="bg-sand-soft py-20 sm:py-28">
        <div className="container-page">
          <SectionHeading
            id="valor-title"
            eyebrow="Llave en mano"
            title="Nosotras nos encargamos de todo. Tú sólo disfrutas."
            description="Una experiencia completa en tu casa, terraza o jardín: sin proveedores sueltos, sin estrés y sin trabajar en tu propia celebración."
          />
          <ValueProps className="mt-12" />
        </div>
      </section>

      {/* 3. Experiencias */}
      <section aria-labelledby="experiencias-title" className="py-20 sm:py-28">
        <div className="container-page">
          <SectionHeading
            id="experiencias-title"
            eyebrow="Experiencias"
            title="Elige la mesa que va con tu celebración"
            description="Experiencias pre-diseñadas que puedes personalizar: estilo, menú, colores y detalles para la homenajeada."
            action={
              <Button asChild variant="ghost" className="text-olive h-10 rounded-full px-4">
                <Link href="/experiencias">
                  Ver todas las experiencias
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            }
          />
          {experiences.length > 0 ? (
            <ul className={cn("mt-12 grid gap-6 lg:gap-8", experienceGridCols(experiences.length))}>
              {experiences.map((e) => (
                <li key={e.id}>
                  <ExperienceCard experience={e} sizes="(min-width: 640px) 50vw, 100vw" />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              className="mt-12"
              title="Estamos preparando nuevas experiencias"
              description="Mientras tanto, cuéntanos qué quieres celebrar y diseñamos una propuesta a tu medida."
              action={
                <Button asChild className="rounded-full">
                  <Link href="/crear-experiencia">Diseña tu experiencia</Link>
                </Button>
              }
            />
          )}
        </div>
      </section>

      {/* 4. Cómo funciona */}
      <section aria-labelledby="como-title" className="bg-sage-soft py-20 sm:py-28">
        <div className="container-page">
          <SectionHeading
            id="como-title"
            eyebrow="Cómo funciona"
            title="De la idea a la mesa puesta, en cuatro pasos"
            action={
              <Button asChild variant="ghost" className="text-olive h-10 rounded-full px-4">
                <Link href="/como-funciona">
                  Conoce el proceso
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            }
          />
          <HowItWorksSteps className="mt-14" />
        </div>
      </section>

      {/* 5. Galería */}
      {gallery.length > 0 ? (
        <section aria-labelledby="galeria-title" className="py-20 sm:py-28">
          <div className="container-page">
            <SectionHeading
              id="galeria-title"
              eyebrow="Galería"
              title="Mesas que se sienten hechas a mano"
              description="Cada experiencia es distinta, pero todas tienen algo en común: el cuidado en cada detalle."
            />
            <GalleryGrid images={gallery} className="mt-12" />
          </div>
        </section>
      ) : null}

      {/* 6. Historia */}
      <section aria-labelledby="historia-title" className="bg-sand-soft py-20 sm:py-28">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="bg-ivory relative aspect-[4/3] overflow-hidden rounded-[2rem]">
            <SiteImage
              src="/images/placeholders/founders.svg"
              alt="Ivonne y Rosa, fundadoras, preparando una mesa"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div>
            <p className="eyebrow">Nuestra historia</p>
            <h2 id="historia-title" className="font-heading text-charcoal mt-4 text-3xl leading-[1.05] font-medium text-balance sm:text-4xl lg:text-5xl">
              Somos Ivonne y Rosa: amigas, mamás y anfitrionas de corazón.
            </h2>
            <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
              Entre Perú y México aprendimos que recibir es una forma de querer. Por eso cuidamos cada detalle como si la
              celebración fuera nuestra: la flor correcta, el café a tiempo, la mesa que invita a quedarse.
            </p>
            <Button asChild variant="outline" size="lg" className="mt-8 h-11 rounded-full px-6">
              <Link href="/nuestra-historia">
                Conoce nuestra historia
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 7. Testimonios */}
      {testimonials.length > 0 ? (
        <section aria-labelledby="testimonios-title" className="py-20 sm:py-28">
          <div className="container-page">
            <SectionHeading id="testimonios-title" eyebrow="Testimonios" title="Lo que dicen las anfitrionas" />
            <Testimonials items={testimonials} className="mt-12" />
          </div>
        </section>
      ) : null}

      {/* 8. FAQ */}
      {faqs.length > 0 ? (
        <section aria-labelledby="faq-title" className="border-border/70 border-t py-20 sm:py-28">
          <div className="container-page grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="eyebrow">Preguntas frecuentes</p>
              <h2 id="faq-title" className="font-heading text-charcoal mt-4 text-3xl leading-tight font-medium sm:text-4xl">
                Todo lo que necesitas saber
              </h2>
              <p className="text-muted-foreground mt-4">
                ¿Te quedó alguna duda?{" "}
                <Link href="/contacto" className="text-olive font-medium underline underline-offset-4">
                  Escríbenos
                </Link>{" "}
                y te respondemos el mismo día.
              </p>
            </div>
            <FaqList items={faqs} className="lg:col-span-8" />
          </div>
        </section>
      ) : null}

      {/* 9. CTA final */}
      <CtaBand secondary={{ href: "/experiencias", label: "Ver experiencias" }} />

      {/* 10. Instagram */}
      <section aria-labelledby="instagram-title" className="pb-24">
        <div className="container-page">
          <SectionHeading
            id="instagram-title"
            align="center"
            eyebrow="Instagram"
            title="Inspiración para tu próxima mesa"
          />
          <InstagramGrid handle={business.instagramHandle} className="mt-10" />
        </div>
      </section>
    </>
  );
}
