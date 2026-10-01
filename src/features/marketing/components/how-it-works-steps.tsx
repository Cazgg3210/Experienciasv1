import { cn } from "@/lib/utils";

export const HOW_IT_WORKS_STEPS = [
  {
    title: "Diseña tu experiencia en línea",
    body: "Elige la experiencia, tu fecha, cuántas son y el estilo de mesa. Ves un estimado al instante, sin compromiso.",
  },
  {
    title: "Te confirmamos disponibilidad y propuesta",
    body: "Revisamos cada detalle y te enviamos una propuesta clara, con todo incluido y sin letras chiquitas.",
  },
  {
    title: "Reserva con anticipo seguro",
    body: "Apartas tu fecha con un anticipo en línea. El saldo lo liquidas unos días antes de tu evento.",
  },
  {
    title: "Disfruta",
    body: "Nosotras montamos, servimos y desmontamos. Tú sólo llegas, brindas y disfrutas con las tuyas.",
  },
] as const;

/** Los 4 pasos de "Cómo funciona" (home y /como-funciona). */
export function HowItWorksSteps({ className, headingLevel: Heading = "h3" }: { className?: string; headingLevel?: "h2" | "h3" }) {
  return (
    <ol className={cn("grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {HOW_IT_WORKS_STEPS.map((step, i) => (
        <li key={step.title} className="relative">
          <div className="flex items-center gap-4">
            <span
              className="font-heading border-olive/30 text-olive flex size-12 shrink-0 items-center justify-center rounded-full border text-xl"
              aria-hidden
            >
              {i + 1}
            </span>
            <span className="bg-border hidden h-px flex-1 lg:block" aria-hidden />
          </div>
          <Heading className="font-heading text-charcoal mt-5 text-2xl leading-snug font-medium">
            <span className="sr-only">Paso {i + 1}: </span>
            {step.title}
          </Heading>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed sm:text-base">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
