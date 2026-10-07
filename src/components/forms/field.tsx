"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { usePaintedId } from "./use-painted-id";

/**
 * Campo de formulario accesible: label asociado, descripción y error con aria-describedby.
 *
 * <Field label="Nombre" error={form.formState.errors.name?.message} required>
 *   {(props) => <Input {...props} {...form.register("name")} />}
 * </Field>
 */
export function Field({
  label,
  description,
  error,
  required,
  className,
  children,
  id: idProp,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  id?: string;
  children: (props: {
    id: string;
    "aria-invalid": boolean | undefined;
    "aria-describedby": string | undefined;
    "aria-required": boolean | undefined;
  }) => React.ReactNode;
}) {
  const autoId = React.useId();
  const labelRef = React.useRef<HTMLLabelElement>(null);
  // Adopta el id con que el servidor pintó la etiqueta si difiere del de useId al hidratar (EVT-005): si no, al
  // aparecer el error la descripción quedaría fuera de aria-describedby, o un input nuevo quedaría sin etiqueta.
  const id = usePaintedId(idProp ?? autoId, labelRef, { attr: "for" });
  const descId = description ? `${id}-desc` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [descId, errId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label ref={labelRef} htmlFor={id} className="text-sm font-medium">
        {label}
        {required ? (
          <span className="text-destructive ml-0.5" aria-hidden>
            *
          </span>
        ) : null}
      </Label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        "aria-required": required || undefined,
      })}
      {description ? (
        <p id={descId} className="text-muted-foreground text-xs">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errId} role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm">
      {message}
    </div>
  );
}
