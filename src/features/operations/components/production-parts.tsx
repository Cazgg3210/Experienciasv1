import { cn } from "@/lib/utils";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Muestras de color (sólo hex válidos; el resto se muestra como texto). */
export function ColorSwatches({ colors, label }: { colors: string[]; label: string }) {
  if (!colors.length) return <p className="text-muted-foreground text-sm">Sin colores definidos.</p>;
  return (
    <ul className="flex flex-wrap gap-3" aria-label={label}>
      {colors.map((c, i) => (
        <li key={`${c}-${i}`} className="flex items-center gap-2 text-xs">
          {HEX.test(c) ? (
            <span
              className="size-7 rounded-full border shadow-xs print:[print-color-adjust:exact]"
              style={{ backgroundColor: c }}
              aria-hidden
            />
          ) : null}
          <span className="font-mono uppercase">{c}</span>
        </li>
      ))}
    </ul>
  );
}

/** Lista de definición compacta (etiqueta / valor). */
export function InfoList({ rows, className }: { rows: Array<[string, React.ReactNode]>; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-2 text-sm", className)}>
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Tarjeta de sección con ancla y estilos de impresión. */
export function OpsSection({
  id,
  title,
  description,
  actions,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const headingId = `${id}-titulo`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        "bg-card scroll-mt-32 rounded-2xl border p-4 shadow-xs sm:p-6 print:break-inside-avoid-page print:rounded-none print:border-0 print:p-0 print:shadow-none",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id={headingId} className="font-heading text-2xl font-semibold">
            {title}
          </h2>
          {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function SubCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-ivory/60 rounded-xl border p-4 print:break-inside-avoid", className)}>
      <h3 className="eyebrow mb-3">{title}</h3>
      {children}
    </div>
  );
}
