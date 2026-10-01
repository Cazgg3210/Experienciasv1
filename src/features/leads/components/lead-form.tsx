"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { LeadSource, Occasion } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { LEAD_SOURCE_LABELS, OCCASION_LABELS, toOptions } from "@/lib/labels";
import { createLeadSchema, updateLeadSchema } from "../schemas";
import { createLeadAction, updateLeadAction } from "../server/actions";
import { NativeSelect } from "./native-select";

export type LeadFormOption = { value: string; label: string; active: boolean };
export type LeadFormOptionsProps = {
  experiences: LeadFormOption[];
  styles: LeadFormOption[];
  menus: LeadFormOption[];
  serviceAreas: LeadFormOption[];
  budgetRanges: LeadFormOption[];
};

export type LeadFormValues = {
  leadId?: string;
  name: string;
  phone?: string;
  email?: string;
  occasion: Occasion;
  occasionOther?: string;
  eventDate?: string;
  guestCount?: string | number;
  budgetRangeId?: string;
  serviceAreaId?: string;
  zoneText?: string;
  experienceId?: string;
  notes?: string;
  source?: LeadSource;
  styleId?: string;
  menuId?: string;
  budgetNotes?: string;
  honoreeName?: string;
  colors?: string;
  inspiration?: string;
};

export const OTHER_ZONE = "__other";

/** Fuentes que tiene sentido capturar a mano (las automáticas las registra el sitio). */
const MANUAL_SOURCES: LeadSource[] = ["MANUAL", "WHATSAPP", "INSTAGRAM", "TIKTOK", "REFERRAL", "GOOGLE", "CONTACT_FORM", "OTHER"];

function OptionList({ options, placeholder }: { options: LeadFormOption[]; placeholder: string }) {
  return (
    <>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </>
  );
}

export function LeadForm({
  mode,
  options,
  defaultValues,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  options: LeadFormOptionsProps;
  defaultValues: LeadFormValues;
  onDone?: (result: { leadId: string }) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const resolver = (mode === "create" ? zodResolver(createLeadSchema) : zodResolver(updateLeadSchema)) as unknown as Resolver<LeadFormValues>;
  const form = useForm<LeadFormValues>({
    resolver,
    defaultValues,
  });
  const {
    register,
    watch,
    formState: { errors, isSubmitting },
  } = form;
  const occasion = watch("occasion");
  const zone = watch("serviceAreaId");

  async function onSubmit(values: LeadFormValues) {
    const payload = {
      ...values,
      serviceAreaId: values.serviceAreaId === OTHER_ZONE ? "" : values.serviceAreaId,
    };
    if (mode === "create") {
      const res = await createLeadAction(payload as Parameters<typeof createLeadAction>[0]);
      if (handleActionResult(res, { form, success: `Lead ${res.ok ? res.data.code : ""} creado` })) {
        onDone?.({ leadId: res.data.leadId });
        router.push(`/admin/leads/${res.data.leadId}`);
      }
    } else {
      const res = await updateLeadAction(payload as Parameters<typeof updateLeadAction>[0]);
      if (
        handleActionResult(res, {
          form,
          success: res.ok && res.data.changed.length === 0 ? "No hubo cambios" : "Datos del lead guardados",
        })
      ) {
        onDone?.({ leadId: values.leadId ?? "" });
      }
    }
  }

  const err = (key: keyof LeadFormValues) => errors[key]?.message as string | undefined;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" required error={err("name")} className="sm:col-span-2">
          {(p) => <Input {...p} autoComplete="name" {...register("name")} />}
        </Field>
        <Field label="Teléfono / WhatsApp" error={err("phone")} description="10 dígitos; puedes incluir +52.">
          {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" {...register("phone")} />}
        </Field>
        <Field label="Email" error={err("email")}>
          {(p) => <Input {...p} type="email" autoComplete="email" {...register("email")} />}
        </Field>
        <Field label="Ocasión" required error={err("occasion")}>
          {(p) => (
            <NativeSelect {...p} {...register("occasion")}>
              {toOptions(OCCASION_LABELS).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        {occasion === "OTHER" ? (
          <Field label="¿Qué celebran?" error={err("occasionOther")}>
            {(p) => <Input {...p} placeholder="Aniversario, graduación…" {...register("occasionOther")} />}
          </Field>
        ) : null}
        <Field label="Experiencia de interés" error={err("experienceId")}>
          {(p) => (
            <NativeSelect {...p} {...register("experienceId")}>
              <OptionList options={options.experiences} placeholder="Aún no sabe" />
            </NativeSelect>
          )}
        </Field>
        <Field label="Fecha del evento" error={err("eventDate")}>
          {(p) => <Input {...p} type="date" {...register("eventDate")} />}
        </Field>
        <Field label="Invitadas" error={err("guestCount")}>
          {(p) => <Input {...p} type="number" inputMode="numeric" min={1} max={500} {...register("guestCount")} />}
        </Field>
        <Field label="Presupuesto" error={err("budgetRangeId")}>
          {(p) => (
            <NativeSelect {...p} {...register("budgetRangeId")}>
              <OptionList options={options.budgetRanges} placeholder="Sin definir" />
            </NativeSelect>
          )}
        </Field>
        <Field label="Zona" error={err("serviceAreaId")}>
          {(p) => (
            <NativeSelect {...p} {...register("serviceAreaId")}>
              <OptionList options={options.serviceAreas} placeholder="Sin definir" />
              <option value={OTHER_ZONE}>Otra zona (fuera de cobertura)</option>
            </NativeSelect>
          )}
        </Field>
        {zone === OTHER_ZONE ? (
          <Field
            label="¿Dónde sería?"
            error={err("zoneText")}
            description="Se marcará como fuera de cobertura para revisarlo."
            className="sm:col-span-2"
          >
            {(p) => <Input {...p} placeholder="Colonia o municipio" {...register("zoneText")} />}
          </Field>
        ) : null}

        {mode === "edit" ? (
          <>
            <Field label="Estilo" error={err("styleId")}>
              {(p) => (
                <NativeSelect {...p} {...register("styleId")}>
                  <OptionList options={options.styles} placeholder="Sin definir" />
                </NativeSelect>
              )}
            </Field>
            <Field label="Menú" error={err("menuId")}>
              {(p) => (
                <NativeSelect {...p} {...register("menuId")}>
                  <OptionList options={options.menus} placeholder="Sin definir" />
                </NativeSelect>
              )}
            </Field>
            <Field label="Homenajeada" error={err("honoreeName")}>
              {(p) => <Input {...p} {...register("honoreeName")} />}
            </Field>
            <Field label="Colores" error={err("colors")} description="Separados por coma.">
              {(p) => <Input {...p} placeholder="salvia, marfil, dorado" {...register("colors")} />}
            </Field>
            <Field label="Notas de presupuesto" error={err("budgetNotes")} className="sm:col-span-2">
              {(p) => <Input {...p} {...register("budgetNotes")} />}
            </Field>
            <Field label="Inspiración" error={err("inspiration")} className="sm:col-span-2">
              {(p) => <Textarea {...p} rows={3} {...register("inspiration")} />}
            </Field>
          </>
        ) : (
          <Field label="Origen" error={err("source")} className="sm:col-span-2">
            {(p) => (
              <NativeSelect {...p} {...register("source")}>
                {MANUAL_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {LEAD_SOURCE_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
        )}
        <Field label="Notas" error={err("notes")} className="sm:col-span-2">
          {(p) => (
            <Textarea {...p} rows={3} placeholder="Lo que nos contó, preferencias, dudas…" {...register("notes")} />
          )}
        </Field>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        ) : null}
        <SubmitButton pending={isSubmitting} pendingText={mode === "create" ? "Creando…" : "Guardando…"}>
          {mode === "create" ? "Crear lead" : "Guardar cambios"}
        </SubmitButton>
      </div>
    </form>
  );
}
