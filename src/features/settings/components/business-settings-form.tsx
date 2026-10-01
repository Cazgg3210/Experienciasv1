"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { handleActionResult } from "@/components/forms/action-result";
import { businessFormSchema, type BusinessFormValues } from "../schemas";
import { updateBusinessSettingsAction } from "../server/actions";
import { FormCard } from "./settings-section";
import { FormFooter } from "./form-footer";

export function BusinessSettingsForm({ defaults, canEdit }: { defaults: BusinessFormValues; canEdit: boolean }) {
  const form = useForm<BusinessFormValues>({ resolver: zodResolver(businessFormSchema), defaultValues: defaults });
  const [pending, startTransition] = useTransition();
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await updateBusinessSettingsAction(values);
      if (handleActionResult(res, { form, success: "Datos del negocio guardados" })) {
        form.reset({ ...values, instagramHandle: values.instagramHandle.replace(/^@/, "") });
      }
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <fieldset disabled={!canEdit || pending} className="space-y-5">
        <legend className="sr-only">Datos del negocio</legend>
        <FormCard title="Marca" description="Cómo se presenta el negocio en el sitio, los correos y los mensajes.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre de la marca" error={errors.brandName?.message} required>
              {(p) => <Input {...p} autoComplete="organization" {...form.register("brandName")} defaultValue={defaults.brandName} />}
            </Field>
            <Field label="Ciudad" error={errors.city?.message} required>
              {(p) => <Input {...p} autoComplete="address-level2" {...form.register("city")} defaultValue={defaults.city} />}
            </Field>
            <Field
              label="Frase de marca"
              description="Aparece en el pie de los correos y en el sitio."
              error={errors.tagline?.message}
              className="sm:col-span-2"
            >
              {(p) => <Input {...p} {...form.register("tagline")} defaultValue={defaults.tagline} />}
            </Field>
          </div>
        </FormCard>

        <FormCard title="Contacto" description="Datos que ven las clientas para escribirles.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Correo de contacto" error={errors.contactEmail?.message} required>
              {(p) => <Input {...p} type="email" autoComplete="email" {...form.register("contactEmail")} defaultValue={defaults.contactEmail} />}
            </Field>
            <Field
              label="WhatsApp del negocio"
              description="Sólo números con lada de país, ej. 5215512345678."
              error={errors.whatsappNumber?.message}
              required
            >
              {(p) => <Input {...p} inputMode="numeric" autoComplete="tel" {...form.register("whatsappNumber")} defaultValue={defaults.whatsappNumber} />}
            </Field>
            <Field label="Instagram" description="Sin la arroba." error={errors.instagramHandle?.message}>
              {(p) => <Input {...p} {...form.register("instagramHandle")} defaultValue={defaults.instagramHandle} />}
            </Field>
          </div>
        </FormCard>

        <FormCard title="Políticas" description="Se muestran al aceptar la propuesta y quedan registradas en cada reserva.">
          <div className="grid gap-4">
            <Field label="Política de cancelación" error={errors.cancellationPolicy?.message} required>
              {(p) => <Textarea {...p} rows={5} {...form.register("cancellationPolicy")} defaultValue={defaults.cancellationPolicy} />}
            </Field>
            <Field
              label="Versión de términos"
              description="Cámbiala cuando actualices los términos: cada reserva guarda la versión que aceptó la clienta."
              error={errors.termsVersion?.message}
              required
              className="sm:max-w-xs"
            >
              {(p) => <Input {...p} {...form.register("termsVersion")} defaultValue={defaults.termsVersion} />}
            </Field>
          </div>
        </FormCard>
      </fieldset>
      <FormFooter
        pending={pending}
        dirty={form.formState.isDirty}
        disabled={!canEdit}
        onReset={() => form.reset()}
      />
    </form>
  );
}
