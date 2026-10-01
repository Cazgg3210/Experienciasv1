import { Check } from "lucide-react";
import { DIETARY_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { MenuView } from "../domain/menu";

/** Menú agrupado por tiempos con etiquetas alimentarias (portal, micrositio y resumen). */
export function MenuList({
  menu,
  includes,
  experienceName,
  addOns,
  className,
  compact = false,
}: {
  menu: MenuView | null;
  includes?: string[];
  experienceName?: string | null;
  addOns?: Array<{ id: string; name: string; quantity: number }>;
  className?: string;
  compact?: boolean;
}) {
  if (!menu && !includes?.length && !addOns?.length) {
    return (
      <p className="text-muted-foreground text-sm">
        Estamos terminando de definir tu menú. Muy pronto lo verás aquí.
      </p>
    );
  }
  return (
    <div className={cn("space-y-6", className)}>
      {menu ? (
        <div className="space-y-5">
          <div>
            <p className="font-heading text-xl font-semibold">{menu.name}</p>
            {menu.description ? <p className="text-muted-foreground mt-1 text-sm">{menu.description}</p> : null}
            {menu.dietaryTags.length ? (
              <p className="text-muted-foreground mt-2 text-xs">
                Opciones: {menu.dietaryTags.map((t) => DIETARY_LABELS[t]).join(" · ")}
              </p>
            ) : null}
          </div>
          {menu.courses.map((course) => (
            <div key={course.course} className="print:break-inside-avoid">
              <h3 className="eyebrow mb-2">{course.label}</h3>
              <ul className={cn("divide-border/70 divide-y", compact && "divide-y-0")}>
                {course.items.map((item) => (
                  <li key={item.id} className={cn("py-2.5", compact && "py-1")}>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-medium">{item.name}</span>
                      {item.dietaryTags.map((t) => (
                        <span
                          key={t}
                          className="bg-sage-soft text-olive rounded-full px-2 py-0.5 text-[11px] font-medium"
                        >
                          {DIETARY_LABELS[t]}
                        </span>
                      ))}
                    </div>
                    {item.description && !compact ? (
                      <p className="text-muted-foreground mt-0.5 text-sm">{item.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {includes?.length ? (
        <div className="print:break-inside-avoid">
          <h3 className="eyebrow mb-2">{experienceName ? `${experienceName} incluye` : "Tu experiencia incluye"}</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {includes.map((inc) => (
              <li key={inc} className="flex items-start gap-2 text-sm">
                <Check className="text-olive mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{inc}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {addOns?.length ? (
        <div className="print:break-inside-avoid">
          <h3 className="eyebrow mb-2">Extras de tu celebración</h3>
          <ul className="flex flex-wrap gap-2">
            {addOns.map((a) => (
              <li key={a.id} className="bg-sand-soft rounded-full px-3 py-1 text-sm">
                {a.name}
                {a.quantity > 1 ? ` × ${a.quantity}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
