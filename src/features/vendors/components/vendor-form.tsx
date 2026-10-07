"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { VENDOR_CATEGORY_LABELS, VENDOR_STATUS_LABELS, toOptions } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { vendorBaseSchema, type VendorFormInput } from "../schemas";
import { createVendorAction, updateVendorAction } from "../server/actions";
import { useHydrated } from "@/components/forms/use-hydrated";

const categoryOptions = toOptions(VENDOR_CATEGORY_LABELS);
const statusOptions = toOptions(VENDOR_STATUS_LABELS);

export type VendorFormValues = VendorFormInput & { id?: string };

function RatingInput({
  value,
  onChange,
  id,
  describedBy,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  id: string;
  describedBy?: string;
}) {
  return (
    <div role="radiogroup" id={id} aria-label="Calificación" aria-describedby={describedBy} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value != null && n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} de 5`}
            onClick={() => onChange(value === n ? null : n)}
            className="focus-visible:ring-ring/50 rounded-md p-1 outline-none focus-visible:ring-3"
          >
            <Star className={cn("size-6", active ? "fill-warning text-warning" : "text-muted-foreground")} aria-hidden />
          </button>
        );
      })}
      <span className="text-muted-foreground ml-2 text-sm">{value ? `${value}/5` : "Sin calificar"}</span>
    </div>
  );
}

/** Alta / edición de proveedor. */
export function VendorForm({ vendor }: { vendor?: VendorFormValues & { id: string } }) {
  const router = useRouter();
  const isEdit = Boolean(vendor);
  const hydrated = useHydrated();
  const form = useForm<VendorFormInput>({
    resolver: zodResolver(vendorBaseSchema),
    defaultValues: vendor
      ? {
          ...vendor,
          contactName: vendor.contactName ?? "",
          phone: vendor.phone ?? "",
          whatsapp: vendor.whatsapp ?? "",
          email: vendor.email ?? "",
          slaNotes: vendor.slaNotes ?? "",
          notes: vendor.notes ?? "",
        }
      : {
          name: "",
          category: "FLOWERS",
          contactName: "",
          phone: "",
          whatsapp: "",
          email: "",
          slaNotes: "",
          notes: "",
          status: "ACTIVE",
          rating: null,
        },
  });
  const errors = form.formState.errors;

  return (
    <form
      noValidate
      method="post"
      className="space-y-6"
      onSubmit={form.handleSubmit(async (values) => {
        const res = vendor ? await updateVendorAction({ ...values, id: vendor.id }) : await createVendorAction(values);
        if (handleActionResult(res, { form, success: isEdit ? "Proveedor actualizado" : "Proveedor creado" })) {
          router.push(`/admin/vendors/${res.data.id}`);
          router.refresh();
        }
      })}
    >
      <fieldset className="bg-card space-y-4 rounded-xl border p-4 sm:p-6">
        <legend className="font-heading px-1 text-lg font-semibold">Datos del proveedor</legend>
        <Field label="Nombre" required error={errors.name?.message}>
          {(p) => <Input {...p} autoComplete="organization" {...form.register("name")} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoría" required error={errors.category?.message}>
            {(p) => (
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...p} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </Field>
          <Field
            label="Estado"
            required
            error={errors.status?.message}
            description="Los bloqueados no aparecen al registrar compras."
          >
            {(p) => (
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...p} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </Field>
        </div>
        <Field label="Calificación" error={errors.rating?.message} description="Qué tan confiable es (1 a 5).">
          {(p) => (
            <Controller
              control={form.control}
              name="rating"
              render={({ field }) => (
                <RatingInput id={p.id} describedBy={p["aria-describedby"]} value={field.value} onChange={field.onChange} />
              )}
            />
          )}
        </Field>
      </fieldset>

      <fieldset className="bg-card space-y-4 rounded-xl border p-4 sm:p-6">
        <legend className="font-heading px-1 text-lg font-semibold">Contacto</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Persona de contacto" error={errors.contactName?.message}>
            {(p) => <Input {...p} autoComplete="name" {...form.register("contactName")} />}
          </Field>
          <Field label="Email" error={errors.email?.message}>
            {(p) => <Input {...p} type="email" autoComplete="email" {...form.register("email")} />}
          </Field>
          <Field label="Teléfono" error={errors.phone?.message}>
            {(p) => <Input {...p} type="tel" autoComplete="tel" placeholder="55 1234 5678" {...form.register("phone")} />}
          </Field>
          <Field label="WhatsApp" error={errors.whatsapp?.message} description="10 dígitos; se usa para el enlace directo.">
            {(p) => <Input {...p} type="tel" placeholder="55 1234 5678" {...form.register("whatsapp")} />}
          </Field>
        </div>
      </fieldset>

      <fieldset className="bg-card space-y-4 rounded-xl border p-4 sm:p-6">
        <legend className="font-heading px-1 text-lg font-semibold">Acuerdos y notas</legend>
        <Field
          label="SLA / condiciones"
          error={errors.slaNotes?.message}
          description="Tiempos de entrega, anticipo, horarios, mínimos de compra…"
        >
          {(p) => <Textarea {...p} rows={3} {...form.register("slaNotes")} />}
        </Field>
        <Field label="Notas internas" error={errors.notes?.message}>
          {(p) => <Textarea {...p} rows={3} {...form.register("notes")} />}
        </Field>
      </fieldset>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" asChild>
          <Link href={vendor ? `/admin/vendors/${vendor.id}` : "/admin/vendors"}>Cancelar</Link>
        </Button>
        <SubmitButton pending={form.formState.isSubmitting} disabled={!hydrated} size="lg">
          {isEdit ? "Guardar cambios" : "Crear proveedor"}
        </SubmitButton>
      </div>
    </form>
  );
}
