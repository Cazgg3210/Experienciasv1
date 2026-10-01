import Link from "next/link";
import { CalendarClock, CalendarDays, Check, FileText, MapPin, Undo2, Users, Wallet } from "lucide-react";
import { CtaBand } from "@/features/marketing/components/cta-band";
import { FaqList } from "@/features/marketing/components/faq-list";
import { HowItWorksSteps } from "@/features/marketing/components/how-it-works-steps";
import { JsonLd } from "@/features/marketing/components/json-ld";
import { PageIntro } from "@/features/marketing/components/page-intro";
import { SectionHeading } from "@/features/marketing/components/section-heading";
import { percentFromBps } from "@/features/marketing/domain/display";
import { faqPageJsonLd } from "@/features/marketing/domain/json-ld";
import { getGeneralFaqs, getSiteSettings } from "@/features/marketing/server/queries";
import { pageMetadata } from "@/features/marketing/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Cómo funciona",
  description:
    "Diseña tu experiencia en línea, recibe tu propuesta con disponibilidad confirmada, reserva con anticipo seguro y disfruta: nosotras montamos, servimos y desmontamos.",
  path: "/como-funciona",
});

const INCLUDED = [
  { title: "Comida preparada en sitio", body: "Menú de brunch a elegir, con opciones vegetarianas, sin gluten y para alergias." },
  { title: "Bebidas", body: "Café de especialidad, jugos naturales y aguas frescas (mimosas y mocktails como add-on)." },
  { title: "Mesa vestida", body: "Mantelería de lino, vajilla de porcelana, cristalería y cubiertos para todas." },
  { title: "Flores y decoración", body: "Centro de mesa con flores de temporada, velas y detalles según el estilo que elijas." },
  { title: "Servicio", body: "Coordinadora y mesera/anfitriona durante toda la experiencia." },
  { title: "Montaje y desmontaje", body: "Llegamos antes para montar y al final recogemos y dejamos tu espacio limpio." },
] as const;

export default async function HowItWorksPage() {
  const [settings, faqs] = await Promise.all([getSiteSettings(), getGeneralFaqs(10).catch(() => [])]);
  const { business, pricing, availability } = settings;

  const policies = [
    {
      icon: Wallet,
      title: "Anticipo para reservar",
      body: `Tu fecha se confirma con un anticipo del ${percentFromBps(pricing.depositBps)} del total, pagado en línea de forma segura.`,
    },
    {
      icon: CalendarClock,
      title: "Saldo",
      body: `El saldo restante se liquida a más tardar ${pricing.balanceDueDaysBefore} ${pricing.balanceDueDaysBefore === 1 ? "día" : "días"} antes de tu evento.`,
    },
    {
      icon: FileText,
      title: "Vigencia de la propuesta",
      body: `Cada cotización tiene una vigencia de ${pricing.quoteValidityDays} ${pricing.quoteValidityDays === 1 ? "día" : "días"}; después, precio y disponibilidad pueden cambiar.`,
    },
    {
      icon: CalendarDays,
      title: "Anticipación",
      body: `Reserva con al menos ${availability.minLeadDays} ${availability.minLeadDays === 1 ? "día" : "días"} de anticipación. Fines de semana se llenan primero.`,
    },
    {
      icon: Users,
      title: "Tamaño del grupo",
      body: `Experiencias para ${pricing.minStandardGuests}–${pricing.maxStandardGuests} personas. Grupos más grandes: consulta especial.`,
    },
    {
      icon: MapPin,
      title: "Zonas",
      body: "Polanco, Granada e Irrigación (CDMX). Otras zonas cercanas, sujetas a disponibilidad y costo de logística.",
    },
  ];

  return (
    <>
      <JsonLd data={faqPageJsonLd(faqs)} />
      <PageIntro
        eyebrow="Cómo funciona"
        title="Celebrar sin trabajar en tu propia fiesta."
        description="Diseñas en línea en unos minutos, te confirmamos disponibilidad y propuesta, reservas con anticipo seguro y el día del evento sólo llegas a disfrutar."
        breadcrumbs={[{ href: "/", label: "Inicio" }, { label: "Cómo funciona" }]}
      />

      <section aria-labelledby="pasos-title" className="bg-sage-soft py-20 sm:py-28">
        <div className="container-page">
          <SectionHeading id="pasos-title" eyebrow="El proceso" title="Cuatro pasos, cero estrés" />
          <HowItWorksSteps className="mt-14" />
        </div>
      </section>

      <section aria-labelledby="incluye-title" className="py-20 sm:py-28">
        <div className="container-page grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionHeading
              id="incluye-title"
              eyebrow="Llave en mano"
              title="Qué incluye tu experiencia"
              description="Cada experiencia detalla lo que incluye; esto es lo que nunca falta."
            />
          </div>
          <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:col-span-8">
            {INCLUDED.map((item) => (
              <li key={item.title} className="flex gap-4">
                <span className="bg-sage-soft text-olive mt-1 flex size-7 shrink-0 items-center justify-center rounded-full">
                  <Check className="size-4" aria-hidden />
                </span>
                <div>
                  <h3 className="font-heading text-charcoal text-xl font-medium">{item.title}</h3>
                  <p className="text-muted-foreground mt-1 leading-relaxed">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="politicas-title" className="bg-sand-soft py-20 sm:py-28">
        <div className="container-page">
          <SectionHeading
            id="politicas-title"
            eyebrow="Claridad desde el inicio"
            title="Nuestras políticas, en resumen"
            description={
              <>
                Sin letras chiquitas. Consulta el detalle en nuestros{" "}
                <Link href="/terminos" className="text-olive font-medium underline underline-offset-4">
                  términos y condiciones
                </Link>
                .
              </>
            }
          />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {policies.map(({ icon: Icon, title, body }) => (
              <li key={title} className="bg-card border-border/70 rounded-2xl border p-6">
                <Icon className="text-olive size-5" aria-hidden />
                <h3 className="font-heading text-charcoal mt-4 text-xl font-medium">{title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{body}</p>
              </li>
            ))}
          </ul>
          <div className="bg-card border-border/70 mt-4 flex gap-4 rounded-2xl border p-6">
            <Undo2 className="text-olive mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <h3 className="font-heading text-charcoal text-xl font-medium">Cancelaciones y cambios de fecha</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{business.cancellationPolicy}</p>
            </div>
          </div>
        </div>
      </section>

      {faqs.length > 0 ? (
        <section aria-labelledby="faq-title" className="py-20 sm:py-28">
          <div className="container-page grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <SectionHeading id="faq-title" eyebrow="Preguntas frecuentes" title="¿Tienes dudas?" />
              <p className="text-muted-foreground mt-4">
                Si no encuentras tu respuesta,{" "}
                <Link href="/contacto" className="text-olive font-medium underline underline-offset-4">
                  escríbenos
                </Link>
                .
              </p>
            </div>
            <FaqList items={faqs} className="lg:col-span-8" />
          </div>
        </section>
      ) : null}

      <CtaBand secondary={{ href: "/experiencias", label: "Ver experiencias" }} className={faqs.length > 0 ? "pt-0 sm:pt-0" : undefined} />
    </>
  );
}
