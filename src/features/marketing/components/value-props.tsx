import { ChefHat, Flower2, PackageOpen, PartyPopper, Wine } from "lucide-react";
import { cn } from "@/lib/utils";

export const VALUE_PROPS = [
  {
    icon: ChefHat,
    title: "La comida",
    body: "Brunch de autor preparado en sitio, con opciones para cada dieta y alergia.",
  },
  {
    icon: Wine,
    title: "La mesa",
    body: "Lino, porcelana, cristalería y servicio de anfitriona durante toda la experiencia.",
  },
  {
    icon: Flower2,
    title: "La decoración",
    body: "Flores de temporada, velas y detalles personalizados con su nombre y sus colores.",
  },
  {
    icon: PackageOpen,
    title: "Montaje y desmontaje",
    body: "Llegamos antes, montamos todo y al final dejamos tu espacio impecable.",
  },
  {
    icon: PartyPopper,
    title: "La dinámica",
    body: "Brindis, karaoke, taller floral o el momento del pastel: el plan para que nadie mire el reloj.",
  },
] as const;

/** Propuesta de valor llave en mano. */
export function ValueProps({ className }: { className?: string }) {
  return (
    <ul className={cn("grid gap-px overflow-hidden rounded-3xl border bg-border sm:grid-cols-2 lg:grid-cols-5", className)}>
      {VALUE_PROPS.map(({ icon: Icon, title, body }) => (
        <li key={title} className="bg-card flex gap-4 p-5 sm:flex-col sm:gap-3 sm:p-7 sm:last:col-span-2 lg:last:col-span-1">
          <span className="bg-sage-soft text-olive flex size-11 shrink-0 items-center justify-center rounded-full">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="space-y-1.5 sm:space-y-3">
            <h3 className="font-heading text-charcoal text-xl font-medium">{title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
