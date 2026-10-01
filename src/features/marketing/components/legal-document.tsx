import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";

export type LegalSection = { id: string; title: string; content: React.ReactNode };

/** Aviso visible: los textos legales deben validarse con asesoría legal en México. */
export function LegalReviewNotice({ className }: { className?: string }) {
  return (
    <div role="note" className={cn("bg-sand-soft border-taupe/40 flex gap-3 rounded-2xl border p-5", className)}>
      <Scale className="text-olive mt-0.5 size-5 shrink-0" aria-hidden />
      <p className="text-sm leading-relaxed">
        <span className="text-charcoal font-medium">Documento en revisión.</span>{" "}
        <span className="text-muted-foreground">
          Este texto es una base de trabajo y debe ser revisado y validado por un asesor legal en México antes de su uso
          definitivo.
        </span>
      </p>
    </div>
  );
}

/** Documento legal con índice navegable y tipografía de lectura cómoda. */
export function LegalDocument({ sections, version }: { sections: LegalSection[]; version?: string }) {
  return (
    <div className="container-page grid gap-10 pb-24 lg:grid-cols-12 lg:gap-14">
      <nav aria-label="Contenido del documento" className="lg:col-span-4">
        <div className="lg:sticky lg:top-24">
          <p className="eyebrow mb-4">Contenido</p>
          <ol className="border-border/70 space-y-1 border-l text-sm">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-muted-foreground hover:text-foreground hover:border-olive -ml-px block border-l border-transparent py-1.5 pl-4 transition-colors"
                >
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
          {version ? <p className="text-muted-foreground mt-6 text-xs">Versión {version}</p> : null}
        </div>
      </nav>
      <article className="space-y-12 lg:col-span-8">
        <LegalReviewNotice />
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-28">
            <h2 id={`${s.id}-title`} className="font-heading text-charcoal text-2xl font-medium sm:text-3xl">
              {i + 1}. {s.title}
            </h2>
            <div
              className={cn(
                "text-charcoal/90 mt-4 space-y-4 text-base leading-relaxed",
                "[&_a]:text-olive [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4",
                "[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_strong]:text-charcoal [&_strong]:font-medium",
              )}
            >
              {s.content}
            </div>
          </section>
        ))}
      </article>
    </div>
  );
}
