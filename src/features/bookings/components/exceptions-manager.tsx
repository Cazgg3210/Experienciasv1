"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/data/status-badge";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AVAILABILITY_EXCEPTION_LABELS, type Tone } from "@/lib/labels";
import { inputSizeClass, nativeSelectClass } from "@/features/events/components/form-styles";
import { EXCEPTION_TYPES, availabilityExceptionSchema, type AvailabilityExceptionInput } from "../schemas";
import { createAvailabilityExceptionAction, deleteAvailabilityExceptionAction } from "../server/actions";

export type ExceptionView = {
  id: string;
  date: string;
  dateLabel: string;
  type: (typeof EXCEPTION_TYPES)[number];
  maxEvents: number | null;
  reason: string | null;
  serviceAreaName: string | null;
};

const TYPE_TONES: Record<ExceptionView["type"], Tone> = {
  BLOCKED: "danger",
  BLACKOUT: "warning",
  CAPACITY_OVERRIDE: "info",
};

const TYPE_HINTS: Record<ExceptionView["type"], string> = {
  BLOCKED: "No hay operación ese día (vacaciones, descanso).",
  BLACKOUT: "Fecha especial sin reservas (festivos, eventos privados).",
  CAPACITY_OVERRIDE: "Cambia el máximo de eventos sólo ese día.",
};

/** Excepciones de disponibilidad: lista + alta + baja. */
export function ExceptionsManager({
  exceptions,
  serviceAreas,
  minDate,
}: {
  exceptions: ExceptionView[];
  serviceAreas: Array<{ id: string; name: string }>;
  minDate: string;
}) {
  const form = useForm<AvailabilityExceptionInput>({
    resolver: zodResolver(availabilityExceptionSchema),
    defaultValues: { date: "", type: "BLOCKED", maxEvents: null, reason: "", serviceAreaId: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const type = useWatch({ control: form.control, name: "type" });

  async function onSubmit(values: AvailabilityExceptionInput) {
    const res = await createAvailabilityExceptionAction({
      ...values,
      maxEvents: values.type === "CAPACITY_OVERRIDE" ? values.maxEvents : null,
    });
    if (!handleActionResult(res, { form })) return;
    const n = res.data.eventsThatDay;
    if (n > 0 && values.type !== "CAPACITY_OVERRIDE") {
      toast.warning("Excepción agregada", {
        description: `Ese día ya ${n === 1 ? "hay 1 evento" : `hay ${n} eventos`} con fecha apartada; el bloqueo no los cancela. Revísalos en el calendario.`,
      });
    } else if (n > 0 && values.maxEvents != null && n > values.maxEvents) {
      toast.warning("Excepción agregada", {
        description: `Ese día ya hay ${n} eventos con fecha apartada, más que el nuevo máximo (${values.maxEvents}).`,
      });
    } else {
      toast.success("Excepción agregada");
    }
    form.reset({ date: "", type: values.type, maxEvents: null, reason: "", serviceAreaId: "" });
  }

  async function remove(ex: ExceptionView) {
    const res = await deleteAvailabilityExceptionAction({ id: ex.id });
    if (handleActionResult(res)) toast.success("Excepción eliminada");
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-heading text-xl font-semibold">Fechas especiales</h3>
        <p className="text-muted-foreground text-sm">Bloqueos, blackouts y días con capacidad distinta.</p>
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="bg-sand-soft/40 space-y-3 rounded-lg border p-3"
        aria-label="Agregar excepción"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fecha" required error={errors.date?.message}>
            {(p) => (
              <Input {...p} {...form.register("date")} type="date" min={minDate} className={inputSizeClass} />
            )}
          </Field>
          <Field label="Tipo" required error={errors.type?.message} description={TYPE_HINTS[type]}>
            {(p) => (
              <select {...p} {...form.register("type")} className={nativeSelectClass}>
                {EXCEPTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {AVAILABILITY_EXCEPTION_LABELS[t]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {type === "CAPACITY_OVERRIDE" ? (
            <Field label="Máx. eventos ese día" required error={errors.maxEvents?.message}>
              {(p) => (
                <Input
                  {...p}
                  {...form.register("maxEvents", {
                    setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                  })}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={20}
                  className={inputSizeClass}
                />
              )}
            </Field>
          ) : null}
          <Field
            label="Zona"
            error={errors.serviceAreaId?.message}
            description="Opcional: aplica sólo a esa zona."
          >
            {(p) => (
              <select {...p} {...form.register("serviceAreaId")} className={nativeSelectClass}>
                <option value="">Todas las zonas</option>
                {serviceAreas.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Motivo" error={errors.reason?.message} className="sm:col-span-2">
            {(p) => (
              <Input
                {...p}
                {...form.register("reason")}
                placeholder="Ej. Vacaciones del equipo"
                className={inputSizeClass}
              />
            )}
          </Field>
        </div>
        <div className="flex justify-end">
          <SubmitButton pending={isSubmitting} pendingText="Agregando…">
            <Plus aria-hidden />
            Agregar excepción
          </SubmitButton>
        </div>
      </form>

      {exceptions.length === 0 ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <CalendarOff className="size-4" aria-hidden />
          No hay fechas especiales próximas.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border" aria-label="Fechas especiales próximas">
          {exceptions.map((ex) => (
            <li key={ex.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-block text-sm font-medium first-letter:uppercase">
                    {ex.dateLabel}
                  </span>
                  <StatusBadge tone={TYPE_TONES[ex.type]}>
                    {AVAILABILITY_EXCEPTION_LABELS[ex.type]}
                    {ex.type === "CAPACITY_OVERRIDE" && ex.maxEvents != null ? ` · ${ex.maxEvents}` : ""}
                  </StatusBadge>
                </div>
                <p className="text-muted-foreground text-xs">
                  {[ex.reason, ex.serviceAreaName ? `Zona: ${ex.serviceAreaName}` : "Todas las zonas"]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <ConfirmDialog
                title="¿Eliminar esta excepción?"
                description={`${ex.dateLabel.charAt(0).toUpperCase()}${ex.dateLabel.slice(1)}: el día volverá a seguir el horario semanal.`}
                confirmLabel="Eliminar"
                destructive
                onConfirm={() => remove(ex)}
                trigger={
                  <Button variant="ghost" size="icon" aria-label={`Eliminar excepción del ${ex.dateLabel}`}>
                    <Trash2 aria-hidden />
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
