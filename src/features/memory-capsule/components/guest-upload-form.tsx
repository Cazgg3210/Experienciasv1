"use client";

import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Heart } from "lucide-react";
import { Field } from "@/components/forms/field";
import { MediaUploader } from "@/components/media/media-uploader";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GUEST_UPLOAD_CONSENT_TEXT } from "../domain/capsule";
import { guestUploadFormSchema, type GuestUploadFormValues } from "../schemas";

/**
 * Subida de fotos de invitadas: nombre + consentimiento obligatorio habilitan el uploader,
 * que envía a /api/memory/[token]/upload. Las fotos quedan pendientes de revisión.
 */
export function GuestUploadForm({ token }: { token: string }) {
  const consentId = useId();
  const [uploaded, setUploaded] = useState(0);
  const form = useForm<GuestUploadFormValues>({
    resolver: zodResolver(guestUploadFormSchema),
    mode: "onChange",
    // Sin `name` en defaultValues: al registrarlo, react-hook-form toma lo que ya hay en el DOM (lo escrito
    // antes de hidratar). Con "" lo vaciaría.
    defaultValues: { consent: false },
  });
  const values = form.watch();
  const ready = guestUploadFormSchema.safeParse(values).success;
  const { errors } = form.formState;

  return (
    <div className="space-y-5">
      <Field label="Tu nombre" required error={errors.name?.message}>
        {(p) => <Input {...p} autoComplete="name" maxLength={80} {...form.register("name")} />}
      </Field>

      <div className="space-y-1.5">
        <div className="flex items-start gap-3">
          <Controller
            control={form.control}
            name="consent"
            render={({ field }) => (
              <Checkbox
                id={consentId}
                checked={field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
                onBlur={field.onBlur}
                aria-invalid={errors.consent ? true : undefined}
                aria-describedby={errors.consent ? `${consentId}-err` : undefined}
                aria-required
                className="mt-0.5"
              />
            )}
          />
          <Label htmlFor={consentId} className="block text-sm leading-snug font-normal">
            <span>
              {GUEST_UPLOAD_CONSENT_TEXT}
              <span className="text-destructive ml-0.5" aria-hidden>
                *
              </span>
            </span>
          </Label>
        </div>
        {errors.consent ? (
          <p id={`${consentId}-err`} role="alert" className="text-destructive text-xs font-medium">
            {errors.consent.message}
          </p>
        ) : null}
      </div>

      <MediaUploader
        endpoint={`/api/memory/${token}/upload`}
        fields={{ name: values.name?.trim() ?? "", consent: values.consent ? "true" : "false" }}
        multiple
        disabled={!ready}
        label={ready ? "Elige tus fotos" : "Escribe tu nombre y confirma el permiso para subir"}
        hint="JPG, PNG o WEBP · máx. 8 MB por foto"
        onUploaded={() => setUploaded((n) => n + 1)}
      />

      <div aria-live="polite" role="status">
        {uploaded > 0 ? (
          <p className="bg-sage-soft text-olive flex items-start gap-2 rounded-xl px-4 py-3 text-sm">
            <Heart className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              ¡Gracias! La revisaremos antes de publicarla.
              {uploaded > 1 ? ` (${uploaded} fotos recibidas)` : ""}
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
