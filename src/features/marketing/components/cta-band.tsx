import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Bloque de llamada a la acción final (un único CTA principal + secundario opcional). */
export function CtaBand({
  eyebrow = "Tu próxima reunión",
  title = "Tú reúne a las tuyas. Nosotras hacemos el resto.",
  description = "Diseña tu experiencia en minutos y recibe una propuesta personalizada con disponibilidad confirmada.",
  primary = { href: "/crear-experiencia", label: "Diseña tu experiencia" },
  secondary,
  className,
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string; external?: boolean };
  className?: string;
}) {
  return (
    <section aria-labelledby="cta-final" className={cn("container-page py-16 sm:py-24", className)}>
      <div className="bg-sage-soft relative overflow-hidden rounded-[2rem] px-6 py-14 text-center sm:px-12 sm:py-20">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id="cta-final" className="font-heading text-charcoal mx-auto mt-4 max-w-3xl text-4xl leading-[1.05] font-medium text-balance sm:text-5xl">
          {title}
        </h2>
        <p className="text-muted-foreground mx-auto mt-5 max-w-xl text-base sm:text-lg">{description}</p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="xl">
            <Link href={primary.href}>
              {primary.label}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          {secondary ? (
            secondary.external ? (
              <Button asChild size="xl" variant="ghost" className="rounded-full">
                <a href={secondary.href} target="_blank" rel="noopener noreferrer">
                  {secondary.label}
                </a>
              </Button>
            ) : (
              <Button asChild size="xl" variant="ghost" className="rounded-full">
                <Link href={secondary.href}>{secondary.label}</Link>
              </Button>
            )
          ) : null}
        </div>
      </div>
    </section>
  );
}
