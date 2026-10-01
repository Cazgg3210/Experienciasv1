"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { logisticsSchema, type LogisticsInput } from "../schemas";
import { updateLogisticsAction } from "../server/actions";

type Out = z.output<typeof logisticsSchema>;

export function LogisticsForm({
  eventId,
  departureAt,
  setupStartsAt,
  teardownAt,
  canWrite,
}: {
  eventId: string;
  departureAt: string;
  setupStartsAt: string;
  teardownAt: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const form = useForm<LogisticsInput, unknown, Out>({
    resolver: zodResolver(logisticsSchema),
    defaultValues: { eventId, departureAt, setupStartsAt, teardownAt },
  });
  const errors = form.formState.errors;

  async function onSubmit(values: Out) {
    const res = await updateLogisticsAction(values);
    if (handleActionResult(res, { form, success: "Logística guardada" })) {
      form.reset({
        eventId,
        departureAt: values.departureAt ?? "",
        setupStartsAt: values.setupStartsAt ?? "",
        teardownAt: values.teardownAt ?? "",
      });
      router.refresh();
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Salida de bodega" description="Hora CDMX" error={errors.departureAt?.message}>
          {(p) => <Input {...p} type="datetime-local" disabled={!canWrite} {...form.register("departureAt")} />}
        </Field>
        <Field label="Inicio de montaje" description="Hora CDMX" error={errors.setupStartsAt?.message}>
          {(p) => <Input {...p} type="datetime-local" disabled={!canWrite} {...form.register("setupStartsAt")} />}
        </Field>
        <Field label="Desmontaje" description="Hora CDMX" error={errors.teardownAt?.message}>
          {(p) => <Input {...p} type="datetime-local" disabled={!canWrite} {...form.register("teardownAt")} />}
        </Field>
      </div>
      {canWrite ? (
        <div className="print:hidden">
          <SubmitButton pending={form.formState.isSubmitting} disabled={!form.formState.isDirty} variant="outline">
            Guardar logística
          </SubmitButton>
        </div>
      ) : null}
    </form>
  );
}
