"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DIETARY_LABELS, RSVP_STATUS_LABELS, toOptions } from "@/lib/labels";
import { DIETARY_VALUES, guestSchema, type GuestInput } from "../schemas";
import { saveGuestAction } from "../server/actions";
import { inputSizeClass, nativeSelectClass } from "./form-styles";
import { useReturnFocus } from "./use-return-focus";

export type GuestFormValues = Omit<GuestInput, "eventId">;

export function GuestFormDialog({
  eventId,
  guest,
  open,
  onOpenChange,
}: {
  eventId: string;
  guest: (GuestFormValues & { guestId: string }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const onCloseAutoFocus = useReturnFocus(open);
  const [duplicate, setDuplicate] = React.useState<string | null>(null);
  const duplicateRef = React.useRef<HTMLDivElement>(null);
  const form = useForm<GuestInput>({
    resolver: zodResolver(guestSchema),
    defaultValues: {
      eventId,
      guestId: guest?.guestId ?? "",
      name: guest?.name ?? "",
      email: guest?.email ?? "",
      phone: guest?.phone ?? "",
      rsvpStatus: guest?.rsvpStatus ?? "PENDING",
      plusOne: guest?.plusOne ?? false,
      plusOneName: guest?.plusOneName ?? "",
      dietaryRestrictions: guest?.dietaryRestrictions ?? [],
      dietaryNotes: guest?.dietaryNotes ?? "",
      comment: guest?.comment ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const plusOne = useWatch({ control: form.control, name: "plusOne" });
  const dietary = useWatch({ control: form.control, name: "dietaryRestrictions" });

  async function onSubmit(values: GuestInput, allowDuplicateContact = false) {
    const res = await saveGuestAction({ ...values, allowDuplicateContact });
    if (!res.ok && res.code === "DUPLICATE_GUEST") {
      // Aviso confirmable: puede ser otra persona que comparte WhatsApp o correo.
      for (const [field, messages] of Object.entries(res.fieldErrors ?? {})) {
        form.setError(field as "email" | "phone", { type: "server", message: messages[0] });
      }
      setDuplicate(res.error);
      requestAnimationFrame(() => duplicateRef.current?.focus());
      return;
    }
    if (!handleActionResult(res, { form, success: guest ? "Invitada actualizada" : "Invitada agregada" }))
      return;
    setDuplicate(null);
    onOpenChange(false);
  }

  function toggleDietary(value: (typeof DIETARY_VALUES)[number], checked: boolean) {
    const set = new Set(dietary);
    if (checked) set.add(value);
    else set.delete(value);
    form.setValue("dietaryRestrictions", Array.from(set), { shouldDirty: true });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[92dvh] overflow-y-auto sm:max-w-lg"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <form onSubmit={form.handleSubmit((v) => onSubmit(v))} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{guest ? `Editar a ${guest.name}` : "Agregar invitada"}</DialogTitle>
            <DialogDescription>
              {guest
                ? "Los cambios se reflejan en el micrositio y en el conteo de la clienta."
                : "Se genera un link personal de RSVP para ella."}
            </DialogDescription>
          </DialogHeader>
          <Field label="Nombre" required error={errors.name?.message}>
            {(p) => <Input {...p} {...form.register("name")} autoComplete="off" className={inputSizeClass} />}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="WhatsApp" error={errors.phone?.message}>
              {(p) => (
                <Input
                  {...p}
                  {...form.register("phone")}
                  type="tel"
                  inputMode="tel"
                  className={inputSizeClass}
                />
              )}
            </Field>
            <Field label="Correo" error={errors.email?.message}>
              {(p) => <Input {...p} {...form.register("email")} type="email" className={inputSizeClass} />}
            </Field>
          </div>
          <Field label="Asistencia" error={errors.rsvpStatus?.message}>
            {(p) => (
              <select {...p} {...form.register("rsvpStatus")} className={nativeSelectClass}>
                {toOptions(RSVP_STATUS_LABELS).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <div className="space-y-3 rounded-lg border px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="guest-plus-one" className="text-sm font-medium">
                Viene con acompañante
              </label>
              <Switch
                id="guest-plus-one"
                checked={plusOne}
                onCheckedChange={(v) => {
                  form.setValue("plusOne", v, { shouldDirty: true });
                  if (!v) form.setValue("plusOneName", "");
                }}
              />
            </div>
            {plusOne ? (
              <Field label="Nombre del acompañante" error={errors.plusOneName?.message}>
                {(p) => <Input {...p} {...form.register("plusOneName")} className={inputSizeClass} />}
              </Field>
            ) : null}
            {!plusOne && errors.plusOneName?.message ? (
              <p className="text-destructive text-xs" role="alert">
                {errors.plusOneName.message}
              </p>
            ) : null}
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Restricciones alimentarias</legend>
            <div className="grid grid-cols-2 gap-2">
              {DIETARY_VALUES.map((d) => {
                const id = `diet-${d}`;
                return (
                  <div key={d} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={dietary.includes(d)}
                      onCheckedChange={(v) => toggleDietary(d, v === true)}
                    />
                    <label htmlFor={id} className="text-sm">
                      {DIETARY_LABELS[d]}
                    </label>
                  </div>
                );
              })}
            </div>
          </fieldset>
          <Field label="Notas alimentarias" error={errors.dietaryNotes?.message}>
            {(p) => (
              <Textarea
                {...p}
                {...form.register("dietaryNotes")}
                rows={2}
                placeholder="Alergias, intensidad…"
              />
            )}
          </Field>
          <Field label="Comentario" error={errors.comment?.message}>
            {(p) => <Textarea {...p} {...form.register("comment")} rows={2} />}
          </Field>
          {duplicate ? (
            <div
              ref={duplicateRef}
              tabIndex={-1}
              role="alert"
              className="border-warning/40 bg-warning/10 space-y-2 rounded-lg border p-3 text-sm outline-none"
            >
              <p>{duplicate}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={form.handleSubmit((v) => onSubmit(v, true))}
                >
                  Es otra persona, guardar
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setDuplicate(null)}>
                  Revisar datos
                </Button>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <SubmitButton pending={isSubmitting}>
              {guest ? "Guardar cambios" : "Agregar invitada"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
