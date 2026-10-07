"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { addressFormSchema, type AddressFormValues } from "../schemas";
import { updateAddressAction } from "../server/actions";

/** Edición de dirección por la anfitriona (hasta 48 h antes del evento). */
export function AddressEditor({
  token,
  initial,
  startOpen = false,
}: {
  token: string;
  initial: AddressFormValues;
  startOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(startOpen);
  // Sin defaultValues a propósito: si la anfitriona aún no tiene dirección, el formulario llega abierto desde el
  // servidor y react-hook-form, al registrar cada campo, toma lo que ya hay en el DOM (lo escrito antes de que la
  // página hidratara; con "" lo borraría). El valor actual va como `defaultValue` de cada campo.
  const form = useForm<AddressFormValues>({ resolver: zodResolver(addressFormSchema) });
  const pending = form.formState.isSubmitting;
  const formId = React.useId();

  async function onSubmit(values: AddressFormValues) {
    const res = await updateAddressAction({ token, ...values });
    if (handleActionResult(res, { form, success: res.ok && res.data.changed === 0 ? "No hubo cambios" : "Dirección actualizada" })) {
      setOpen(false);
      router.refresh();
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-full px-5"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        aria-controls={formId}
      >
        <Pencil aria-hidden /> Editar dirección
      </Button>
    );
  }

  return (
    <form
      id={formId}
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="bg-sand-soft/60 space-y-4 rounded-2xl border p-4 sm:p-5"
    >
      <p className="font-heading text-lg font-semibold">Detalles de la dirección</p>
      <Field label="Calle, número e interior" required error={form.formState.errors.addressLine?.message}>
        {(p) => (
          <Input
            {...p}
            {...form.register("addressLine")}
            defaultValue={initial.addressLine}
            autoComplete="street-address"
            className="h-12 text-base"
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <Field label="Colonia" required error={form.formState.errors.neighborhood?.message}>
          {(p) => (
            <Input {...p} {...form.register("neighborhood")} defaultValue={initial.neighborhood} className="h-12 text-base" />
          )}
        </Field>
        <Field label="Código postal" error={form.formState.errors.postalCode?.message}>
          {(p) => (
            <Input
              {...p}
              {...form.register("postalCode")}
              defaultValue={initial.postalCode}
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              className="h-12 text-base"
            />
          )}
        </Field>
      </div>
      <Field
        label="Indicaciones de acceso"
        description="Portón, caseta, estacionamiento, elevador de servicio… nos ayuda a llegar a tiempo."
        error={form.formState.errors.addressNotes?.message}
      >
        {(p) => (
          <Textarea
            {...p}
            {...form.register("addressNotes")}
            defaultValue={initial.addressNotes}
            rows={3}
            className="text-base"
          />
        )}
      </Field>
      <Field
        label="Enlace de Google Maps (opcional)"
        error={form.formState.errors.mapsUrl?.message}
      >
        {(p) => (
          <Input
            {...p}
            {...form.register("mapsUrl")}
            defaultValue={initial.mapsUrl}
            inputMode="url"
            placeholder="https://maps.app.goo.gl/…"
            className="h-12 text-base"
          />
        )}
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          className="h-12 rounded-full px-6 text-base"
          onClick={() => {
            form.reset(initial);
            setOpen(false);
          }}
        >
          Cancelar
        </Button>
        <SubmitButton pending={pending} size="xl">
          Guardar dirección
        </SubmitButton>
      </div>
    </form>
  );
}
