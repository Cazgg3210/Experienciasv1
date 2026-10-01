"use client";

import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { quoteDetailsSchema, type QuoteDetailsInput } from "../schemas";
import { updateQuoteDetailsAction } from "../server/actions";
import { NativeSelect } from "./form-controls";

export function QuoteDetailsForm({
  defaults,
  styles,
}: {
  defaults: Required<Omit<QuoteDetailsInput, "styleId">> & { styleId: string };
  styles: Array<{ id: string; name: string; active: boolean }>;
}) {
  const router = useRouter();
  const form = useForm<QuoteDetailsInput>({ resolver: zodResolver(quoteDetailsSchema), defaultValues: defaults });
  const { register, formState, control } = form;
  const errors = formState.errors;
  const guestCount = useWatch({ control, name: "guestCount" });
  const guestsChanged = Number(guestCount) !== defaults.guestCount;

  async function onSubmit(values: QuoteDetailsInput) {
    const res = await updateQuoteDetailsAction(values);
    if (handleActionResult(res, { form, success: "Datos actualizados" })) {
      form.reset(values);
      router.refresh();
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="bg-card space-y-4 rounded-2xl border p-4 sm:p-5" aria-labelledby="details-title">
      <div>
        <h2 id="details-title" className="font-heading text-xl font-semibold">
          Datos de la propuesta
        </h2>
        <p className="text-muted-foreground text-xs">Título, fecha, invitadas, vigencia y notas.</p>
      </div>
      <input type="hidden" {...register("quoteId")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Título" required error={errors.title?.message} className="sm:col-span-2">
          {(p) => <Input {...p} className="h-9" maxLength={140} {...register("title")} />}
        </Field>
        <Field label="Fecha del evento" error={errors.eventDate?.message}>
          {(p) => <Input {...p} type="date" className="h-9" {...register("eventDate")} />}
        </Field>
        <Field label="Hora de inicio" error={errors.startTime?.message}>
          {(p) => <Input {...p} type="time" step={900} className="h-9" {...register("startTime")} />}
        </Field>
        <Field
          label="Invitadas"
          required
          error={errors.guestCount?.message}
          description={guestsChanged ? "Se ajustarán invitadas adicionales, menú y add-ons por persona (conservando precios)." : undefined}
        >
          {(p) => <Input {...p} type="number" min={1} max={200} inputMode="numeric" className="h-9" {...register("guestCount", { valueAsNumber: true })} />}
        </Field>
        <Field label="Estilo" error={errors.styleId?.message}>
          {(p) => (
            <NativeSelect {...p} {...register("styleId")}>
              <option value="">Sin estilo definido</option>
              {styles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.active ? "" : " (inactivo)"}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Vigente hasta" error={errors.validUntil?.message} description="Se renueva automáticamente al enviar si ya pasó.">
          {(p) => <Input {...p} type="date" className="h-9" {...register("validUntil")} />}
        </Field>
        <Field label="Notas para la clienta" error={errors.notesForCustomer?.message} className="sm:col-span-2" description="Visibles en la propuesta pública.">
          {(p) => <Textarea {...p} rows={3} maxLength={2000} {...register("notesForCustomer")} />}
        </Field>
        <Field label="Notas internas" error={errors.internalNotes?.message} className="sm:col-span-2" description="Sólo para el equipo.">
          {(p) => <Textarea {...p} rows={3} maxLength={2000} {...register("internalNotes")} />}
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton pending={formState.isSubmitting} disabled={!formState.isDirty} size="lg">
          Guardar datos
        </SubmitButton>
      </div>
    </form>
  );
}
