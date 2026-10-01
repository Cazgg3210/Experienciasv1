"use client";

import { useId, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CAPSULE_MESSAGE_MAX, CAPSULE_TITLE_MAX } from "../domain/capsule";
import { updateCapsuleSchema, type UpdateCapsuleInput } from "../schemas";
import { updateCapsuleAction } from "../server/actions";

function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border bg-card/60 px-3 py-3">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p id={`${id}-desc`} className="text-muted-foreground text-xs">
          {description}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={`${id}-desc`}
        className="mt-1"
      />
    </div>
  );
}

export function CapsuleSettingsForm({
  capsule,
}: {
  capsule: { id: string; title: string; message: string | null; published: boolean; allowGuestUploads: boolean };
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<UpdateCapsuleInput>({
    resolver: zodResolver(updateCapsuleSchema),
    defaultValues: {
      capsuleId: capsule.id,
      title: capsule.title,
      message: capsule.message ?? "",
      published: capsule.published,
      allowGuestUploads: capsule.allowGuestUploads,
    },
  });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await updateCapsuleAction(values);
      if (
        handleActionResult(res, {
          form,
          success:
            res.ok && res.data.published !== capsule.published
              ? res.data.published
                ? "Cápsula publicada ✨"
                : "La cápsula volvió a preparación"
              : "Cambios guardados",
        })
      ) {
        form.reset(values);
      }
    }),
  );

  const { errors, isDirty } = form.formState;
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Título" required error={errors.title?.message}>
        {/* defaultValue: el HTML del servidor ya trae el texto (register() sólo lo pone al hidratar). */}
        {(p) => <Input {...p} maxLength={CAPSULE_TITLE_MAX} defaultValue={capsule.title} {...form.register("title")} />}
      </Field>
      <Field label="Mensaje" description="Se muestra debajo del título en la cápsula." error={errors.message?.message}>
        {(p) => (
          <Textarea
            {...p}
            rows={5}
            maxLength={CAPSULE_MESSAGE_MAX}
            defaultValue={capsule.message ?? ""}
            {...form.register("message")}
          />
        )}
      </Field>
      <Controller
        control={form.control}
        name="published"
        render={({ field }) => (
          <SwitchRow
            label="Publicada"
            description="Si está apagado, el enlace muestra un aviso de “en preparación” sin fotos."
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />
      <Controller
        control={form.control}
        name="allowGuestUploads"
        render={({ field }) => (
          <SwitchRow
            label="Permitir fotos de invitadas"
            description="Las fotos llegan ocultas hasta que las apruebes."
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />
      {/* pending explícito: SubmitButton deja que props.disabled sobrescriba el estado pending. */}
      <SubmitButton pending={pending} disabled={pending || !isDirty} className="w-full sm:w-auto">
        Guardar cambios
      </SubmitButton>
    </form>
  );
}
