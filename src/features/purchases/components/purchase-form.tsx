"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { COST_CATEGORY_LABELS, VENDOR_CATEGORY_LABELS, toOptions } from "@/lib/labels";
import { purchaseBaseSchema, type CreatePurchaseInput } from "../schemas";
import { createPurchaseAction, updatePurchaseAction } from "../server/actions";
import { useHydrated } from "@/features/inventory/components/use-hydrated";
import { moneyHint } from "./money-hint";

const NONE = "none";
const categoryOptions = toOptions(COST_CATEGORY_LABELS);

export type PurchaseFormOptions = {
  events: Array<{ id: string; label: string; dateKey: string }>;
  vendors: Array<{ id: string; name: string; category: keyof typeof VENDOR_CATEGORY_LABELS; status: string }>;
};

/** Alta / edición de compra. `?eventId=` y `?vendorId=` llegan como valores iniciales. */
export function PurchaseForm({
  options,
  initial,
  purchaseId,
  compact = false,
}: {
  options: PurchaseFormOptions;
  initial?: Partial<CreatePurchaseInput>;
  purchaseId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const isEdit = Boolean(purchaseId);
  const hydrated = useHydrated();
  const defaults: CreatePurchaseInput = {
    eventId: initial?.eventId ?? null,
    vendorId: initial?.vendorId ?? null,
    concept: initial?.concept ?? "",
    category: initial?.category ?? "VENDOR",
    expectedAmountCents: initial?.expectedAmountCents ?? (undefined as unknown as number),
    neededBy: initial?.neededBy ?? "",
    notes: initial?.notes ?? "",
  };
  const form = useForm<CreatePurchaseInput>({
    resolver: zodResolver(purchaseBaseSchema),
    defaultValues: defaults,
  });
  const errors = form.formState.errors;
  const selectedEvent = options.events.find((e) => e.id === form.watch("eventId"));

  return (
    <form
      noValidate
      method="post"
      className="space-y-5"
      onSubmit={form.handleSubmit(async (values) => {
        const res = purchaseId ? await updatePurchaseAction({ ...values, id: purchaseId }) : await createPurchaseAction(values);
        if (handleActionResult(res, { form, success: isEdit ? "Compra actualizada" : "Compra registrada" })) {
          if (!isEdit) router.push(`/admin/purchases/${res.data.id}`);
          else form.reset(values);
          router.refresh();
        }
      })}
    >
      <Field label="Concepto" required error={errors.concept?.message}>
        {(p) => <Input {...p} placeholder="Ej. Rosas de jardín y astromelias blush" {...form.register("concept")} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Evento" error={errors.eventId?.message} description="Opcional: déjalo vacío para compras generales.">
          {(p) => (
            <Controller
              control={form.control}
              name="eventId"
              render={({ field }) => (
                <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? null : v)}>
                  <SelectTrigger {...p} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin evento (compra general)</SelectItem>
                    {options.events.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Field>
        <Field label="Proveedor" error={errors.vendorId?.message}>
          {(p) => (
            <Controller
              control={form.control}
              name="vendorId"
              render={({ field }) => (
                <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? null : v)}>
                  <SelectTrigger {...p} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin proveedor</SelectItem>
                    {options.vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} · {VENDOR_CATEGORY_LABELS[v.category]}
                        {v.status === "INACTIVE" ? " (inactivo)" : v.status === "BLOCKED" ? " (bloqueado)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Field>
      </div>
      <div className={compact ? "grid gap-4 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-3"}>
        <Field label="Categoría de costo" required error={errors.category?.message}>
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
          label="Monto esperado"
          required
          error={errors.expectedAmountCents?.message}
          description={moneyHint(form.watch("expectedAmountCents"))}
        >
          {(p) => (
            <Controller
              control={form.control}
              name="expectedAmountCents"
              render={({ field }) => (
                <MoneyInput
                  {...p}
                  value={field.value}
                  onValueChange={(v) => field.onChange(v ?? undefined)}
                  onBlur={field.onBlur}
                  placeholder="0.00"
                />
              )}
            />
          )}
        </Field>
        <Field
          label="Necesario para"
          error={errors.neededBy?.message}
          description={selectedEvent ? `Evento: ${selectedEvent.dateKey}` : undefined}
        >
          {(p) => <Input {...p} type="date" {...form.register("neededBy")} />}
        </Field>
      </div>
      <Field label="Notas" error={errors.notes?.message}>
        {(p) => <Textarea {...p} rows={3} placeholder="Detalles de entrega, cotización, contacto…" {...form.register("notes")} />}
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {!isEdit ? (
          <Button variant="outline" asChild>
            <Link href="/admin/purchases">Cancelar</Link>
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={() => form.reset()} disabled={!form.formState.isDirty}>
            Descartar cambios
          </Button>
        )}
        <SubmitButton pending={form.formState.isSubmitting} disabled={!hydrated || (isEdit && !form.formState.isDirty)}>
          {isEdit ? "Guardar cambios" : "Registrar compra"}
        </SubmitButton>
      </div>
    </form>
  );
}
