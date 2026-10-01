"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { handleActionResult } from "@/components/forms/action-result";
import { notificationsFormSchema, type NotificationsFormValues } from "../schemas";
import { updateNotificationSettingsAction } from "../server/actions";
import { FormCard } from "./settings-section";
import { FormFooter } from "./form-footer";

export function NotificationSettingsForm({ defaults, canEdit }: { defaults: NotificationsFormValues; canEdit: boolean }) {
  const form = useForm<NotificationsFormValues>({ resolver: zodResolver(notificationsFormSchema), defaultValues: defaults });
  const [pending, startTransition] = useTransition();
  const errors = form.formState.errors;
  const num = { valueAsNumber: true } as const;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await updateNotificationSettingsAction(values);
      if (handleActionResult(res, { form, success: "Preferencias de notificación guardadas" })) form.reset(values);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <fieldset disabled={!canEdit || pending} className="space-y-5">
        <legend className="sr-only">Notificaciones</legend>
        <FormCard title="Recordatorios automáticos" description="Cuándo se envían los recordatorios programados.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Recordatorio de RSVP"
              description="Días antes del evento para recordar a las invitadas que no han confirmado."
              error={errors.rsvpReminderDaysBefore?.message}
              required
            >
              {(p) => <Input {...p} type="number" inputMode="numeric" min={1} max={30} className="tabular" {...form.register("rsvpReminderDaysBefore", num)} defaultValue={defaults.rsvpReminderDaysBefore} />}
            </Field>
            <Field
              label="Aviso de cotización por vencer"
              description="Horas antes del vencimiento para avisar a la clienta."
              error={errors.quoteExpiringHoursBefore?.message}
              required
            >
              {(p) => <Input {...p} type="number" inputMode="numeric" min={1} max={240} className="tabular" {...form.register("quoteExpiringHoursBefore", num)} defaultValue={defaults.quoteExpiringHoursBefore} />}
            </Field>
          </div>
        </FormCard>
        <FormCard title="Avisos al equipo" description="Leads nuevos, propuestas aceptadas y pagos recibidos.">
          <Field label="Correo del equipo" error={errors.ownerNotificationEmail?.message} required className="sm:max-w-md">
            {(p) => <Input {...p} type="email" autoComplete="email" {...form.register("ownerNotificationEmail")} defaultValue={defaults.ownerNotificationEmail} />}
          </Field>
        </FormCard>
      </fieldset>
      <FormFooter pending={pending} dirty={form.formState.isDirty} disabled={!canEdit} onReset={() => form.reset()} />
    </form>
  );
}
