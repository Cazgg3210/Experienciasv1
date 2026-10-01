"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDownUp } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { cn } from "@/lib/utils";
import { applyStockAdjustment, StockAdjustmentError, type StockAdjustmentType } from "../domain/stock";
import { stockAdjustmentSchema, type StockAdjustmentInput } from "../schemas";
import { adjustStockAction } from "../server/actions";

const TYPES: Array<{ value: StockAdjustmentType; label: string; hint: string }> = [
  { value: "PURCHASE_IN", label: "Entrada por compra", hint: "Llegaron piezas nuevas: suma al total." },
  { value: "LOSS", label: "Pérdida o rotura", hint: "Baja definitiva: resta del total." },
  { value: "MAINTENANCE_OUT", label: "Enviar a mantenimiento", hint: "No disponibles mientras se reparan." },
  { value: "MAINTENANCE_IN", label: "Regreso de mantenimiento", hint: "Vuelven a estar disponibles." },
  { value: "ADJUSTMENT", label: "Ajuste por conteo", hint: "Corrige el total tras un conteo físico (±)." },
];

export function StockAdjustDialog({
  item,
  trigger,
}: {
  item: { id: string; sku: string; name: string; unit: string; totalQuantity: number; maintenanceQuantity: number };
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const form = useForm<StockAdjustmentInput>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: { itemId: item.id, type: "PURCHASE_IN", quantity: 1, direction: "IN", reason: "" },
  });
  const errors = form.formState.errors;
  const type = form.watch("type");
  const quantity = form.watch("quantity");
  const direction = form.watch("direction");

  React.useEffect(() => {
    if (open) form.reset({ itemId: item.id, type: "PURCHASE_IN", quantity: 1, direction: "IN", reason: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item.id]);

  let preview: { total: number; maintenance: number } | null = null;
  let previewError: string | null = null;
  if (Number.isFinite(quantity) && quantity > 0) {
    try {
      const next = applyStockAdjustment(item, { type, quantity, direction: direction === "OUT" ? -1 : 1 });
      preview = { total: next.totalQuantity, maintenance: next.maintenanceQuantity };
    } catch (e) {
      previewError = e instanceof StockAdjustmentError ? e.message : "Revisa la cantidad.";
    }
  }

  async function onSubmit(values: StockAdjustmentInput) {
    const res = await adjustStockAction(values);
    if (handleActionResult(res, { form, success: "Stock actualizado" })) {
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <ArrowDownUp className="size-4" aria-hidden /> Ajustar stock
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Ajustar stock</DialogTitle>
          <DialogDescription>
            {item.name} · <span className="font-mono text-xs">{item.sku}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Tipo de movimiento</legend>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <RadioGroup aria-label="Tipo de movimiento" value={field.value} onValueChange={field.onChange} className="grid gap-2">
                  {TYPES.map((t) => {
                    const id = `adj-${item.id}-${t.value}`;
                    return (
                      <label
                        key={t.value}
                        htmlFor={id}
                        className={cn(
                          "hover:bg-muted/60 flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2",
                          field.value === t.value && "border-olive bg-sage-soft/40",
                        )}
                      >
                        <RadioGroupItem id={id} value={t.value} className="mt-0.5" />
                        <span>
                          <span className="block text-sm font-medium">{t.label}</span>
                          <span className="text-muted-foreground block text-xs">{t.hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </RadioGroup>
              )}
            />
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            {type === "ADJUSTMENT" ? (
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Sentido</legend>
                <Controller
                  control={form.control}
                  name="direction"
                  render={({ field }) => (
                    <RadioGroup aria-label="Sentido del ajuste" value={field.value ?? "IN"} onValueChange={field.onChange} className="flex gap-4 pt-1">
                      <label className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value="IN" /> Sumar
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value="OUT" /> Restar
                      </label>
                    </RadioGroup>
                  )}
                />
              </fieldset>
            ) : null}
            <Field label={`Cantidad (${item.unit})`} required error={errors.quantity?.message}>
              {(p) => (
                <Input {...p} type="number" inputMode="numeric" min={1} {...form.register("quantity", { valueAsNumber: true })} />
              )}
            </Field>
          </div>
          <Field label="Motivo" required error={errors.reason?.message}>
            {(p) => (
              <Textarea {...p} rows={2} placeholder="Ej. Copas despostilladas: a revisión." {...form.register("reason")} />
            )}
          </Field>
          <div
            className={cn(
              "rounded-lg border px-3 py-2 text-sm",
              previewError ? "border-destructive/30 bg-destructive/5 text-destructive" : "bg-sand-soft/50",
            )}
            aria-live="polite"
          >
            {previewError ? (
              previewError
            ) : preview ? (
              <span className="tabular">
                Total {item.totalQuantity} → <strong>{preview.total}</strong> · Mantenimiento {item.maintenanceQuantity} →{" "}
                <strong>{preview.maintenance}</strong> · Utilizable <strong>{preview.total - preview.maintenance}</strong>
              </span>
            ) : (
              "Escribe una cantidad para ver el resultado."
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={form.formState.isSubmitting} disabled={Boolean(previewError)}>
              Registrar movimiento
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
