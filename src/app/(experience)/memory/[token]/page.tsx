import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Camera, Heart, ImageIcon, MessageSquareHeart, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { formatLongDate, formatShortDate, toDateKey } from "@/lib/dates";
import { isEnabled } from "@/lib/flags";
import { isPlausibleToken } from "@/lib/tokens";
import { buildPublicShareText, capitalizeFirst } from "@/features/memory-capsule/domain/capsule";
import { getPublicCapsule, type PublicMessage } from "@/features/memory-capsule/server/public-service";
import { CapsuleGallery } from "@/features/memory-capsule/components/capsule-gallery";
import { ShareCapsuleButton } from "@/features/memory-capsule/components/share-capsule-button";
import { GuestbookForm } from "@/features/memory-capsule/components/guestbook-form";
import { GuestUploadForm } from "@/features/memory-capsule/components/guest-upload-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

const loadCapsule = cache(async (token: string) => {
  if (!isPlausibleToken(token)) return { enabled: true, view: null } as const;
  const enabled = await isEnabled("MEMORY_CAPSULE_ENABLED");
  if (!enabled) return { enabled: false, view: null } as const;
  return { enabled: true, view: await getPublicCapsule(token) } as const;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const { view } = await loadCapsule(token);
  return {
    title: view ? view.title : "Memory Capsule",
    description: "Fotos y mensajes de una celebración con Ivonne & Rosa.",
    robots: { index: false, follow: false, nocache: true },
    // "same-origin": nunca envía el enlace (con token) a terceros, pero conserva un Origin válido en
    // los POST a la propia app (subida de fotos y libro de visitas). Con "no-referrer" el estándar
    // Fetch manda `Origin: null` en POST y la verificación de misma-origen los rechazaría.
    referrer: "same-origin",
  };
}

export default async function MemoryCapsulePage({ params }: Props) {
  const { token } = await params;
  if (!isPlausibleToken(token)) notFound();
  const { enabled, view } = await loadCapsule(token);

  if (!enabled) {
    return (
      <Shell>
        <CenteredNotice
          title="Las Memory Capsules no están disponibles por ahora"
          body="Estamos haciendo algunos ajustes. Vuelve a intentarlo más tarde; tus fotos y mensajes siguen a salvo."
        />
      </Shell>
    );
  }
  if (!view) notFound();

  if (view.status === "draft") {
    return (
      <Shell>
        <CenteredNotice
          title="Tu Memory Capsule está en preparación ✨"
          body={`Estamos curando con cariño las fotos y los mensajes de “${view.title}”. Vuelve pronto: este mismo enlace se abrirá en cuanto esté lista.`}
        />
      </Shell>
    );
  }

  const shareText = buildPublicShareText(view.title);
  const photoCount = view.photos.length;
  const messageCount = view.messages.length;

  return (
    <Shell shareTitle={view.title} shareText={shareText}>
      {/* HERO */}
      <section aria-labelledby="capsule-title" className="mx-auto grid max-w-6xl items-center gap-8 px-4 pt-2 pb-12 sm:px-6 md:grid-cols-2 md:gap-12 md:pb-20">
        <div className="order-2 space-y-5 md:order-1">
          <p className="eyebrow text-olive">Memory Capsule</p>
          <h1 id="capsule-title" className="font-heading text-4xl leading-[1.05] font-semibold text-balance sm:text-5xl lg:text-6xl">
            {view.title}
          </h1>
          <p className="text-taupe text-sm tracking-wide">
            <time dateTime={toDateKey(view.eventDate)}>{capitalizeFirst(formatLongDate(view.eventDate))}</time>
          </p>
          {view.message ? (
            <p className="text-charcoal/85 max-w-prose text-base leading-relaxed whitespace-pre-line sm:text-lg">
              {view.message}
            </p>
          ) : null}
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <ImageIcon className="size-4" aria-hidden />
              {photoCount === 1 ? "1 foto" : `${photoCount} fotos`}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageSquareHeart className="size-4" aria-hidden />
              {messageCount === 1 ? "1 mensaje" : `${messageCount} mensajes`}
            </span>
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild size="xl">
              <a href={photoCount ? "#galeria" : "#mensajes"}>{photoCount ? "Ver la galería" : "Leer los mensajes"}</a>
            </Button>
            <ShareCapsuleButton title={view.title} text={shareText} size="xl" variant="outline" label="Compartir" />
          </div>
        </div>
        <div className="order-1 md:order-2">
          {view.cover ? (
            <figure className="bg-sand-soft relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-sm md:aspect-[4/5]">
              <Image
                src={view.cover.url}
                alt={view.cover.alt}
                fill
                priority
                unoptimized
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            </figure>
          ) : (
            <div
              className="bg-sage-soft text-olive flex aspect-[4/3] items-center justify-center rounded-[2rem] md:aspect-[4/5]"
              aria-hidden
            >
              <Sparkles className="size-10" />
            </div>
          )}
        </div>
      </section>

      {/* GALERÍA */}
      <section id="galeria" aria-labelledby="galeria-title" className="bg-sand-soft/50 scroll-mt-6 py-12 md:py-16">
        <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
          <SectionTitle id="galeria-title" eyebrow="Galería" title="Los momentos" />
          {photoCount ? (
            <CapsuleGallery photos={view.photos} title={view.title} />
          ) : (
            <EmptyState
              icon={Camera}
              title="Las fotos vienen en camino"
              description={
                view.allowGuestUploads
                  ? "Todavía no hay fotos publicadas. ¿Tienes alguna del día? Compártela más abajo."
                  : "Todavía no hay fotos publicadas. Vuelve pronto."
              }
            />
          )}
        </div>
      </section>

      {/* MENSAJES */}
      <section id="mensajes" aria-labelledby="mensajes-title" className="scroll-mt-6 py-12 md:py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-6">
            <SectionTitle id="mensajes-title" eyebrow="Mensajes" title="Con todo nuestro cariño" />
            {messageCount ? (
              <MessagesWall messages={view.messages} />
            ) : (
              <EmptyState
                icon={MessageSquareHeart}
                title="Aún no hay mensajes"
                description="¡Sé la primera en dejar unas palabras para recordar este día!"
              />
            )}
          </div>
          <aside aria-labelledby="libro-title" className="lg:sticky lg:top-6 lg:self-start">
            <div className="bg-card rounded-3xl border p-5 shadow-xs sm:p-6">
              <h2 id="libro-title" className="font-heading text-2xl font-semibold">
                Deja tu mensaje
              </h2>
              <p className="text-muted-foreground mt-1 mb-5 text-sm">Unas palabras bonitas para guardar en la cápsula.</p>
              <GuestbookForm token={token} />
            </div>
          </aside>
        </div>
      </section>

      {/* SUBIR FOTOS */}
      {view.allowGuestUploads ? (
        <section id="comparte-fotos" aria-labelledby="subir-title" className="bg-sage-soft/50 scroll-mt-6 py-12 md:py-16">
          <div className="mx-auto max-w-2xl space-y-6 px-4 sm:px-6">
            <SectionTitle
              id="subir-title"
              eyebrow="Comparte"
              title="¿Tienes fotos del día?"
              description="Súbelas aquí. Las revisamos con cariño antes de publicarlas en la cápsula."
            />
            <div className="bg-card rounded-3xl border p-5 shadow-xs sm:p-6">
              <GuestUploadForm token={token} />
            </div>
          </div>
        </section>
      ) : null}
    </Shell>
  );
}

// ---------------------------------------------------------------------------

function Shell({
  children,
  shareTitle,
  shareText,
}: {
  children: React.ReactNode;
  shareTitle?: string;
  shareText?: string;
}) {
  return (
    <div className="bg-ivory text-charcoal flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Logo href={null} subtitle="Memory Capsule" />
        {shareTitle && shareText ? (
          <ShareCapsuleButton title={shareTitle} text={shareText} size="default" variant="ghost" />
        ) : null}
      </header>
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center gap-1 px-4 py-8 text-center text-xs sm:px-6">
          <p className="inline-flex items-center gap-1.5">
            Hecho con <Heart className="text-olive size-3.5" aria-label="cariño" /> por Ivonne & Rosa
          </p>
          <p>Este espacio es privado: sólo quien tiene el enlace puede verlo.</p>
        </div>
      </footer>
    </div>
  );
}

function CenteredNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center sm:py-24">
      <div className="bg-sage-soft text-olive mb-6 flex size-14 items-center justify-center rounded-full">
        <Sparkles className="size-6" aria-hidden />
      </div>
      <h1 className="font-heading text-3xl leading-tight font-semibold text-balance sm:text-4xl">{title}</h1>
      <p className="text-muted-foreground mt-4 text-base leading-relaxed">{body}</p>
    </div>
  );
}

function SectionTitle({
  id,
  eyebrow,
  title,
  description,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="eyebrow text-olive">{eyebrow}</p>
      <h2 id={id} className="font-heading text-3xl font-semibold sm:text-4xl">
        {title}
      </h2>
      {description ? <p className="text-muted-foreground text-sm sm:text-base">{description}</p> : null}
    </div>
  );
}

function MessagesWall({ messages }: { messages: PublicMessage[] }) {
  return (
    <ul className="columns-1 gap-4 sm:columns-2">
      {messages.map((m) => (
        <li key={m.id} className="mb-4 break-inside-avoid">
          <figure className="bg-card rounded-2xl border p-5 shadow-xs">
            <blockquote className="text-charcoal/90 text-[15px] leading-relaxed whitespace-pre-line">
              “{m.body}”
            </blockquote>
            <figcaption className="mt-3 flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">— {m.authorName}</span>
              <span className="text-muted-foreground text-xs">
                {m.kind === "HONOREE" ? "Para la homenajeada · " : ""}
                <time dateTime={m.createdAt.toISOString()}>{formatShortDate(m.createdAt)}</time>
              </span>
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
