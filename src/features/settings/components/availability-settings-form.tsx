"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { handleActionResult } from "@/components/forms/action-result";
import { availabilityFormSchema, type AvailabilityFormValues } from "../schemas";
import { updateAvailabilitySettingsAction } from "../server/actions";
import { FormCard } from "./settings-section";
import { FormFooter } from "./form-footer";

export function AvailabilitySettingsForm({ defaults, canEdit }: { defaults: AvailabilityFormValues; canEdit: boolean }) {
  const form = useForm<AvailabilityFormValues>({ resolver: zodResolver(availabilityFormSchema), defaultValues: defaults });
  const [pending, startTransition] = useTransition();
  const errors = form.formState.errors;
  const num = { valueAsNumber: true } as const;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await updateAvailabilitySettingsAction(values);
      if (handleActionResult(res, { form, success: "Reglas de disponibilidad guardadas" })) form.reset(values);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <fieldset disabled={!canEdit || pending} className="space-y-5">
        <legend className="sr-only">Disponibilidad</legend>
        <FormCard title="Agenda" description="Reglas generales para ofrecer fechas en el configurador y el calendario.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Anticipación mínima"
              description="Días mínimos entre hoy y la fecha del evento."
              error={errors.minLeadDays?.message}
              required
            >
              {(p) => <Input {...p} type="number" inputMode="numeric" min={0} max={90} className="tabular" {...form.register("minLeadDays", num)} defaultValue={defaults.minLeadDays} />}
            </Field>
            <Field
              label="Reservas con hasta"
              description="Días máximos hacia adelante que se pueden reservar."
              error={errors.maxAdvanceDays?.message}
              required
            >
              {(p) => <Input {...p} type="number" inputMode="numeric" min={7} max={730} className="tabular" {...form.register("maxAdvanceDays", num)} defaultValue={defaults.maxAdvanceDays} />}
            </Field>
            <Field
              label="Margen entre eventos"
              description="Minutos de montaje/desmontaje y traslado que se bloquean alrededor de cada evento."
              error={errors.bufferMinutes?.message}
              required
            >
              {(p) => <Input {...p} type="number" inputMode="numeric" min={0} max={600} step={5} className="tabular" {...form.register("bufferMinutes", num)} defaultValue={defaults.bufferMinutes} />}
            </Field>
            <Field
              label="Hora de inicio sugerida"
              description="Se propone por defecto en el configurador."
              error={errors.defaultStartTime?.message}
              required
            >
              {(p) => <Input {...p} type="time" step={900} className="tabular" {...form.register("defaultStartTime")} defaultValue={defaults.defaultStartTime} />}
            </Field>
          </div>
        </FormCard>
      </fieldset>
      <FormFooter pending={pending} dirty={form.formState.isDirty} disabled={!canEdit} onReset={() => form.reset()} />
    </form>
  );
}
