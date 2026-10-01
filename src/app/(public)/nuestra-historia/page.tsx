import Link from "next/link";
import { ArrowRight, ChefHat, Flower2, HeartHandshake, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CtaBand } from "@/features/marketing/components/cta-band";
import { PageIntro } from "@/features/marketing/components/page-intro";
import { SectionHeading } from "@/features/marketing/components/section-heading";
import { SiteImage } from "@/features/marketing/components/site-image";
import { getExperienceDetail, getSiteSettings } from "@/features/marketing/server/queries";
import { pageMetadata } from "@/features/marketing/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Nuestra historia",
  description:
    "Ivonne y Rosa: amigas, mamás y anfitrionas con raíces en Perú y México. Creamos experiencias íntimas en CDMX cuidando cada detalle para que tú sólo disfrutes.",
  path: "/nuestra-historia",
});

const VALUES = [
  {
    icon: Flower2,
    title: "Cuidamos cada detalle",
    body: "La flor de temporada, la servilleta bien doblada, el café a tiempo. Lo pequeño es lo que se recuerda.",
  },
  {
    icon: HeartHandshake,
    title: "Cercanas, nunca corporativas",
    body: "Te escuchamos como amigas: tu historia, tus invitadas y lo que hace especial esta reunión.",
  },
  {
    icon: ChefHat,
    title: "Hecho en sitio, hecho con calma",
    body: "Cocinamos frente a ti con ingredientes frescos y recetas que traemos de nuestras dos casas.",
  },
  {
    icon: Sparkles,
    title: "Tu tiempo es para disfrutar",
    body: "Montamos, servimos y desmontamos. La anfitriona también merece sentarse a la mesa.",
  },
] as const;

export default async function OurStoryPage() {
  const [{ business }, peruMexico] = await Promise.all([
    getSiteSettings(),
    getExperienceDetail("peru-x-mexico").catch(() => null),
  ]);
  const peruHref = peruMexico ? `/experiencias/${peruMexico.slug}` : "/experiencias";

  return (
    <>
      <PageIntro
        eyebrow="Nuestra historia"
        title="Dos amigas, dos países y una misma forma de recibir."
        description="Somos Ivonne y Rosa. Creemos que reunir a las personas que quieres alrededor de una mesa bonita es uno de los regalos más grandes que existen."
        breadcrumbs={[{ href: "/", label: "Inicio" }, { label: "Nuestra historia" }]}
      />

      <section aria-labelledby="quienes-title" className="container-page pb-20 sm:pb-28">
        <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="bg-sand-soft relative aspect-[4/3] overflow-hidden rounded-[2rem] lg:sticky lg:top-24 lg:col-span-6">
            <SiteImage
              src="/images/placeholders/founders.svg"
              alt="Ivonne y Rosa, fundadoras, preparando juntas una mesa de brunch"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="lg:col-span-6">
            <h2 id="quienes-title" className="font-heading text-charcoal text-3xl leading-tight font-medium sm:text-4xl">
              Amigas antes que socias
            </h2>
            <div className="text-charcoal/90 mt-6 space-y-5 text-lg leading-relaxed">
              <p>
                Antes de ser socias fuimos amigas, y antes de cualquier negocio fuimos —y seguimos siendo— las que ofrecen su casa
                para la reunión. Somos mamás, sabemos lo que es organizar con el tiempo contado y conocemos el gusto de ver a
                todos felices alrededor de la mesa.
              </p>
              <p>
                Una con raíces en Perú y otra en México, crecimos en familias donde la mesa era el centro de todo: ahí se
                celebraba, se platicaba largo y se resolvía la vida. De ahí nos viene el amor por recibir.
              </p>
              <p>
                Con los años notamos algo: a quien organiza casi nunca le toca disfrutar. Entre comprar, cocinar, decorar y
                recoger, la celebración se pasa sin vivirla. {business.brandName} nació para cambiar eso.
              </p>
              <p>
                Hoy llevamos nuestra forma de recibir a casas, terrazas y jardines de {business.city}: mesas vestidas con flores
                de temporada, un brunch preparado en sitio y un equipo que cuida cada detalle para que tú sólo te sientes a
                disfrutar con las tuyas.
              </p>
            </div>
            <figure className="border-olive/40 mt-10 border-l-2 pl-6">
              <blockquote className="font-heading text-olive text-3xl leading-snug italic">
                “Recibir es una forma de querer.”
              </blockquote>
              <figcaption className="text-muted-foreground mt-3 text-sm">— Ivonne y Rosa</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section aria-labelledby="raices-title" className="bg-sage-soft py-20 sm:py-28">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="lg:order-2">
            <div className="bg-ivory relative aspect-[4/3] overflow-hidden rounded-[2rem]">
              <SiteImage
                src="/images/placeholders/peru-mexico.svg"
                alt="Mesa con sabores de Perú y México"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
          <div className="lg:order-1">
            <p className="eyebrow">Perú x México</p>
            <h2 id="raices-title" className="font-heading text-charcoal mt-4 text-3xl leading-tight font-medium sm:text-4xl lg:text-5xl">
              Lo mejor de nuestras dos cocinas
            </h2>
            <p className="text-charcoal/90 mt-6 text-lg leading-relaxed">
              De Perú, la frescura, los ajíes y el gusto por compartir al centro de la mesa. De México, el pan dulce, los
              chilaquiles y el café que invita a quedarse. Los reinterpretamos con un toque contemporáneo y elegante —sin
              folclor de más— en nuestra experiencia insignia.
            </p>
            <Button asChild variant="outline" size="lg" className="mt-8 h-11 rounded-full px-6">
              <Link href={peruHref}>
                Conoce Perú x México
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="valores-title" className="py-20 sm:py-28">
        <div className="container-page">
          <SectionHeading
            id="valores-title"
            eyebrow="Lo que nos mueve"
            title="Nuestros valores en cada mesa"
            align="center"
          />
          <ul className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="text-center sm:text-left">
                <span className="bg-sand-soft text-olive mx-auto flex size-12 items-center justify-center rounded-full sm:mx-0">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="font-heading text-charcoal mt-5 text-2xl font-medium">{title}</h3>
                <p className="text-muted-foreground mt-2 leading-relaxed">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand
        eyebrow="Te esperamos en la mesa"
        title="Cuéntanos qué quieres celebrar."
        secondary={{ href: "/experiencias", label: "Ver experiencias" }}
        className="pt-0 sm:pt-0"
      />
    </>
  );
}
