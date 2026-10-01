"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { StaffFunction, StaffRateType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { STAFF_FUNCTION_LABELS, STAFF_RATE_LABELS, toOptions } from "@/lib/labels";
import { NativeSelect } from "@/features/operations/components/native-select";
import { staffMemberSchema, type StaffMemberFormValues } from "../schemas";
import { createStaffMemberAction, updateStaffMemberAction } from "../server/actions";
import { WeekdayChips } from "./weekday-chips";

type Out = z.output<typeof staffMemberSchema>;

export type StaffFormInitial = {
  id: string;
  name: string;
  primaryFunction: StaffFunction;
  phone: string | null;
  email: string | null;
  rateCents: number;
  rateType: StaffRateType;
  availableWeekdays: number[];
  availabilityNotes: string | null;
  active: boolean;
};

export function StaffForm({ initial, canWrite = true }: { initial?: StaffFormInitial; canWrite?: boolean }) {
  const router = useRouter();
  const form = useForm<StaffMemberFormValues, unknown, Out>({
    resolver: zodResolver(staffMemberSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          primaryFunction: initial.primaryFunction,
          phone: initial.phone ?? "",
          email: initial.email ?? "",
          rateCents: initial.rateCents,
          rateType: initial.rateType,
          availableWeekdays: initial.availableWeekdays,
          availabilityNotes: initial.availabilityNotes ?? "",
          active: initial.active,
        }
      : {
          name: "",
          primaryFunction: "SERVER",
          phone: "",
          email: "",
          rateCents: 0,
          rateType: "PER_EVENT",
          availableWeekdays: [5, 6, 0],
          availabilityNotes: "",
          active: true,
        },
  });
  const errors = form.formState.errors;
  const disabled = !canWrite;

  async function onSubmit(values: Out) {
    if (initial) {
      const res = await updateStaffMemberAction({ ...values, id: initial.id });
      if (handleActionResult(res, { form, success: "Datos guardados" })) {
        form.reset({ ...values, phone: values.phone ?? "", email: values.email ?? "", availabilityNotes: values.availabilityNotes ?? "" });
        router.refresh();
      }
      return;
    }
    const res = await createStaffMemberAction(values);
    if (handleActionResult(res, { form, success: "Integrante agregado al equipo" })) {
      router.push(`/admin/staff/${res.data.id}`);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre completo" error={errors.name?.message} required className="sm:col-span-2">
          {(p) => <Input {...p} autoComplete="name" disabled={disabled} {...form.register("name")} />}
        </Field>
        <Field label="Función principal" error={errors.primaryFunction?.message} required>
          {(p) => (
            <NativeSelect {...p} disabled={disabled} {...form.register("primaryFunction")}>
              {toOptions(STAFF_FUNCTION_LABELS).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Teléfono / WhatsApp" error={errors.phone?.message} description="10 dígitos">
          {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" disabled={disabled} {...form.register("phone")} />}
        </Field>
        <Field label="Correo" error={errors.email?.message} description="Para avisos de asignación" className="sm:col-span-2">
          {(p) => <Input {...p} type="email" autoComplete="email" disabled={disabled} {...form.register("email")} />}
        </Field>
        <Field label="Tarifa" error={errors.rateCents?.message} required>
          {(p) => (
            <Controller
              control={form.control}
              name="rateCents"
              render={({ field }) => (
                <MoneyInput {...p} disabled={disabled} value={field.value} onValueChange={(v) => field.onChange(v ?? 0)} />
              )}
            />
          )}
        </Field>
        <Field label="Tipo de tarifa" error={errors.rateType?.message} required>
          {(p) => (
            <NativeSelect {...p} disabled={disabled} {...form.register("rateType")}>
              {toOptions(STAFF_RATE_LABELS).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
      </div>

      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-sm font-medium">Días disponibles</legend>
        <Controller
          control={form.control}
          name="availableWeekdays"
          render={({ field }) => <WeekdayChips value={field.value ?? []} onChange={field.onChange} disabled={disabled} />}
        />
        {errors.availableWeekdays?.message ? (
          <p role="alert" className="text-destructive text-xs font-medium">
            {errors.availableWeekdays.message}
          </p>
        ) : null}
      </fieldset>

      <Field label="Notas de disponibilidad" error={errors.availabilityNotes?.message}>
        {(p) => (
          <Textarea {...p} rows={2} disabled={disabled} placeholder="Ej. Sábados sólo por la mañana" {...form.register("availabilityNotes")} />
        )}
      </Field>

      <label className="flex items-center gap-3 text-sm font-medium">
        <Switch
          aria-label="Activa en el equipo"
          checked={!!form.watch("active")}
          disabled={disabled}
          onCheckedChange={(v) => form.setValue("active", v, { shouldDirty: true })}
        />
        Activa en el equipo (aparece al asignar staff)
      </label>

      {canWrite ? (
        <div className="flex flex-wrap justify-end gap-2">
          {!initial ? (
            <Button type="button" variant="outline" onClick={() => router.push("/admin/staff")}>
              Cancelar
            </Button>
          ) : null}
          <SubmitButton pending={form.formState.isSubmitting} disabled={initial ? !form.formState.isDirty : false}>
            {initial ? "Guardar cambios" : "Agregar al equipo"}
          </SubmitButton>
        </div>
      ) : null}
    </form>
  );
}
