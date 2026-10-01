"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { budgetFormSchema, type BudgetFormValues } from "../schemas";
import { createBudgetRangeAction, updateBudgetRangeAction } from "../server/actions";
import { suggestBudgetLabel } from "../domain/budget-label";
import { SwitchField } from "./form-bits";

/** Alta/edición de rangos de presupuesto (opciones del configurador y de leads). */
export function BudgetDialog({
  mode,
  budgetId,
  defaultValues,
  trigger,
}: {
  mode: "create" | "edit";
  budgetId?: string;
  defaultValues: BudgetFormValues;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent showCloseButton={false} className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        {open ? <BudgetForm mode={mode} budgetId={budgetId} defaultValues={defaultValues} onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function BudgetForm({
  mode,
  budgetId,
  defaultValues,
  onDone,
}: {
  mode: "create" | "edit";
  budgetId?: string;
  defaultValues: BudgetFormValues;
  onDone: () => void;
}) {
  const router = useRouter();
  const form = useForm<BudgetFormValues>({ resolver: zodResolver(budgetFormSchema), defaultValues });
  const { register, control, formState } = form;
  const errors = formState.errors;
  const [minCents, maxCents] = useWatch({ control, name: ["minCents", "maxCents"] });
  const noLimitId = React.useId();
  const [noLimit, setNoLimit] = React.useState(defaultValues.maxCents === null);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!noLimit && values.maxCents == null) {
      form.setError("maxCents", { type: "manual", message: "Ingresa el máximo o marca “Sin máximo”." });
      return;
    }
    const res =
      mode === "create" ? await createBudgetRangeAction(values) : await updateBudgetRangeAction({ ...values, id: budgetId! });
    if (handleActionResult(res, { form, success: mode === "create" ? "Rango creado" : "Rango guardado" })) {
      onDone();
      router.refresh();
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-lg">{mode === "create" ? "Nuevo rango de presupuesto" : "Editar rango"}</DialogTitle>
        <DialogDescription>Las clientas eligen uno de estos rangos al pedir su cotización.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mínimo" required error={errors.minCents?.message}>
          {(p) => (
            <Controller
              control={control}
              name="minCents"
              render={({ field }) => (
                <MoneyInput {...p} value={field.value} onValueChange={(v) => field.onChange(v as number)} onBlur={field.onBlur} />
              )}
            />
          )}
        </Field>
        <Field label="Máximo" error={errors.maxCents?.message}>
          {(p) => (
            <Controller
              control={control}
              name="maxCents"
              render={({ field }) => (
                <MoneyInput
                  {...p}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={noLimit}
                  placeholder="Sin límite"
                />
              )}
            />
          )}
        </Field>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={noLimitId}
          checked={noLimit}
          onCheckedChange={(v) => {
            const on = v === true;
            setNoLimit(on);
            form.setValue("maxCents", on ? null : Math.max((minCents ?? 0) + 500_000, 0), {
              shouldDirty: true,
              shouldValidate: formState.isSubmitted,
            });
          }}
        />
        <Label htmlFor={noLimitId} className="text-sm font-normal">
          Sin máximo (“Más de …”)
        </Label>
      </div>
      <Field label="Etiqueta" required error={errors.label?.message} description="Así lo verá la clienta.">
        {(p) => (
          <div className="flex gap-2">
            <Input {...p} placeholder="$15,000 – $20,000" {...register("label")} />
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => form.setValue("label", suggestBudgetLabel(minCents, maxCents), { shouldDirty: true, shouldValidate: true })}
              title="Sugerir a partir del rango"
            >
              <Wand2 aria-hidden />
              <span className="sr-only sm:not-sr-only">Sugerir</span>
            </Button>
          </div>
        )}
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <SwitchField label="Activo" description="Se muestra en formularios." checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
        <Field label="Orden" error={errors.sortOrder?.message}>
          {(p) => <Input {...p} type="number" min={0} inputMode="numeric" {...register("sortOrder", { valueAsNumber: true })} />}
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onDone}>
          Cancelar
        </Button>
        <SubmitButton size="lg" pending={formState.isSubmitting}>
          {mode === "create" ? "Crear rango" : "Guardar rango"}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
