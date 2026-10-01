"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { INVENTORY_CATEGORY_LABELS, toOptions } from "@/lib/labels";
import { createInventoryItemSchema, updateInventoryItemSchema } from "../schemas";
import { createInventoryItemAction, updateInventoryItemAction } from "../server/actions";
import { moneyHint } from "@/features/purchases/components/money-hint";

const categoryOptions = toOptions(INVENTORY_CATEGORY_LABELS);

export type InventoryItemFormValues = {
  id: string;
  sku: string;
  name: string;
  category: z.input<typeof createInventoryItemSchema>["category"];
  unit: string;
  lowStockThreshold: number;
  replacementCostCents: number;
  location: string | null;
  notes: string | null;
  active: boolean;
};

const createResolver = zodResolver(createInventoryItemSchema);
const updateResolver = zodResolver(updateInventoryItemSchema);

type FormShape = z.input<typeof createInventoryItemSchema> & { id?: string };

/** Alta / edición de artículo de inventario (diálogo). */
export function ItemFormDialog({
  item,
  trigger,
  onSaved,
}: {
  item?: InventoryItemFormValues;
  trigger?: React.ReactNode;
  onSaved?: (id: string) => void;
}) {
  const isEdit = Boolean(item);
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const defaults: FormShape = item
    ? { ...item, totalQuantity: 0, location: item.location ?? "", notes: item.notes ?? "" }
    : {
        sku: "",
        name: "",
        category: "DINNERWARE",
        unit: "pz",
        totalQuantity: 0,
        lowStockThreshold: 0,
        replacementCostCents: 0,
        location: "",
        notes: "",
        active: true,
      };
  const form = useForm<FormShape>({
    // En edición la cantidad total no se valida (sólo cambia con ajustes de stock).
    resolver: (values, ctx, opts) =>
      isEdit
        ? (updateResolver as unknown as typeof createResolver)(values, ctx, opts)
        : createResolver(values, ctx, opts),
    defaultValues: defaults,
  });
  const errors = form.formState.errors;

  React.useEffect(() => {
    if (open) form.reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: FormShape) {
    const payload = {
      ...values,
      location: values.location || null,
      notes: values.notes || null,
    };
    const res =
      isEdit && item
        ? await updateInventoryItemAction({ ...payload, id: item.id })
        : await createInventoryItemAction(payload);
    if (handleActionResult(res, { form, success: isEdit ? "Artículo actualizado" : "Artículo creado" })) {
      setOpen(false);
      onSaved?.(res.data.id);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            {isEdit ? <Pencil className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            {isEdit ? "Editar" : "Nuevo artículo"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">{isEdit ? "Editar artículo" : "Nuevo artículo"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Las cantidades se modifican con “Ajustar stock” para que quede registro en el historial."
              : "Da de alta una pieza del inventario. La cantidad inicial queda registrada como alta."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SKU" required error={errors.sku?.message} description="Único. Ej. PLT-DIN-01">
              {(p) => <Input {...p} autoComplete="off" className="uppercase" {...form.register("sku")} />}
            </Field>
            <Field label="Categoría" required error={errors.category?.message}>
              {(p) => (
                <Controller
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger {...p} className="w-full">
                        <SelectValue placeholder="Elige una categoría" />
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
          </div>
          <Field label="Nombre" required error={errors.name?.message}>
            {(p) => <Input {...p} {...form.register("name")} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Unidad" required error={errors.unit?.message}>
              {(p) => <Input {...p} {...form.register("unit")} />}
            </Field>
            {!isEdit ? (
              <Field label="Cantidad inicial" required error={errors.totalQuantity?.message}>
                {(p) => (
                  <Input {...p} type="number" inputMode="numeric" min={0} {...form.register("totalQuantity", { valueAsNumber: true })} />
                )}
              </Field>
            ) : null}
            <Field label="Umbral bajo" error={errors.lowStockThreshold?.message} description="Avisa cuando quede esto o menos.">
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  {...form.register("lowStockThreshold", { valueAsNumber: true })}
                />
              )}
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Costo de reposición (por pieza)"
              error={errors.replacementCostCents?.message}
              description={moneyHint(form.watch("replacementCostCents"))}
            >
              {(p) => (
                <Controller
                  control={form.control}
                  name="replacementCostCents"
                  render={({ field }) => (
                    <MoneyInput {...p} value={field.value} onValueChange={(v) => field.onChange(v ?? 0)} onBlur={field.onBlur} />
                  )}
                />
              )}
            </Field>
            <Field label="Ubicación" error={errors.location?.message}>
              {(p) => <Input {...p} placeholder="Bodega Narvarte · Anaquel A" {...form.register("location")} />}
            </Field>
          </div>
          <Field label="Notas" error={errors.notes?.message}>
            {(p) => <Textarea {...p} rows={3} {...form.register("notes")} />}
          </Field>
          <Controller
            control={form.control}
            name="active"
            render={({ field }) => (
              <div className="bg-sand-soft/50 flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div>
                  <label htmlFor="item-active" className="text-sm font-medium">
                    Artículo activo
                  </label>
                  <p className="text-muted-foreground text-xs">Los inactivos se ocultan del listado y no se pueden agregar a mano a un evento.</p>
                </div>
                <Switch id="item-active" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={form.formState.isSubmitting}>{isEdit ? "Guardar cambios" : "Crear artículo"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
