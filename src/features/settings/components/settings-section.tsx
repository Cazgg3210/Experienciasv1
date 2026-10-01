import { Lock } from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Encabezado + contenedor de cada sección de configuración. */
export function SettingsSection({
  title,
  description,
  meta,
  readOnly,
  actions,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  meta?: { updatedAt: Date; updatedBy: string | null } | null;
  readOnly?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby="settings-section-title" className={cn("space-y-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 id="settings-section-title" className="font-heading text-2xl font-semibold">
            {title}
          </h2>
          {description ? <p className="text-muted-foreground max-w-2xl text-sm">{description}</p> : null}
          {meta ? (
            <p className="text-muted-foreground text-xs">
              Última actualización: {formatDateTime(meta.updatedAt)}
              {meta.updatedBy ? ` · ${meta.updatedBy}` : ""}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {readOnly ? (
        <p className="bg-sand-soft text-charcoal flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <Lock className="size-4 shrink-0" aria-hidden />
          Puedes consultar esta sección, pero no tienes permiso para modificarla.
        </p>
      ) : null}
      {children}
    </section>
  );
}

/** Tarjeta de bloque de formulario */
export function FormCard({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-card rounded-xl border p-4 shadow-xs sm:p-6", className)}>
      {title ? <h3 className="font-heading text-lg font-semibold">{title}</h3> : null}
      {description ? <p className="text-muted-foreground mt-0.5 text-sm">{description}</p> : null}
      <div className={cn(title || description ? "mt-4" : undefined)}>{children}</div>
    </div>
  );
}
