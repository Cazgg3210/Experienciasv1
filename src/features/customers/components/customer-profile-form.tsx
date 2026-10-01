"use client";

import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { updateCustomerSchema, type UpdateCustomerInput } from "../schemas";
import { updateCustomerAction } from "../server/actions";

type Values = {
  customerId: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  notes: string;
  marketingOptIn: boolean;
};

export function CustomerProfileForm({ defaultValues, readOnly }: { defaultValues: Values; readOnly?: boolean }) {
  const form = useForm<Values>({
    resolver: zodResolver(updateCustomerSchema) as unknown as Resolver<Values>,
    defaultValues,
  });
  const {
    register,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  async function onSubmit(values: Values) {
    const res = await updateCustomerAction(values as UpdateCustomerInput);
    if (
      handleActionResult(res, {
        form,
        success: res.ok && res.data.changed.length === 0 ? "No hubo cambios" : "Perfil actualizado",
      })
    ) {
      reset(values);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <fieldset disabled={readOnly || isSubmitting} className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Datos de la clienta</legend>
        <Field label="Nombre" required error={errors.name?.message} className="sm:col-span-2">
          {(p) => <Input {...p} autoComplete="name" defaultValue={defaultValues.name} {...register("name")} />}
        </Field>
        <Field label="Email" error={errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" defaultValue={defaultValues.email} {...register("email")} />}
        </Field>
        <Field label="Teléfono" error={errors.phone?.message}>
          {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" defaultValue={defaultValues.phone} {...register("phone")} />}
        </Field>
        <Field label="WhatsApp" error={errors.whatsapp?.message} description="Si es distinto al teléfono.">
          {(p) => <Input {...p} type="tel" inputMode="tel" defaultValue={defaultValues.whatsapp} {...register("whatsapp")} />}
        </Field>
        <Field label="Instagram" error={errors.instagram?.message}>
          {(p) => <Input {...p} placeholder="@usuario" defaultValue={defaultValues.instagram} {...register("instagram")} />}
        </Field>
        <Field label="Notas internas" error={errors.notes?.message} className="sm:col-span-2">
          {(p) => (
            <Textarea
              {...p}
              rows={4}
              defaultValue={defaultValues.notes}
              placeholder="Preferencias, alergias, fechas importantes, cómo le gusta que la contacten…"
              {...register("notes")}
            />
          )}
        </Field>
        <div className="bg-sand-soft/50 flex items-start justify-between gap-4 rounded-xl border p-3 sm:col-span-2">
          <div>
            <Label htmlFor="marketingOptIn" className="text-sm font-medium">
              Acepta novedades y promociones
            </Label>
            <p className="text-muted-foreground text-xs">Sólo enviamos marketing a quien lo autorizó.</p>
          </div>
          <Controller
            control={control}
            name="marketingOptIn"
            render={({ field }) => (
              <Switch id="marketingOptIn" checked={field.value} onCheckedChange={field.onChange} onBlur={field.onBlur} />
            )}
          />
        </div>
      </fieldset>
      {!readOnly ? (
        <div className="flex justify-end">
          <SubmitButton pending={isSubmitting} disabled={!isDirty}>
            Guardar perfil
          </SubmitButton>
        </div>
      ) : null}
    </form>
  );
}
