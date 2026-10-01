"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
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
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { COST_CATEGORY_LABELS } from "@/lib/labels";
import { COST_CATEGORIES } from "../domain/event-financials";
import { eventCostFormSchema, type EventCostFormValues } from "../schemas";
import { createEventCostAction, updateEventCostAction } from "../server/actions";

type Props =
  | { mode: "create"; eventId: string; cost?: undefined }
  | {
      mode: "edit";
      eventId: string;
      cost: {
        id: string;
        category: EventCostFormValues["category"];
        description: string;
        amountCents: number;
      };
    };

/** Alta / edición de un costo manual del evento (EventCost). */
export function EventCostDialog(props: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const defaults: EventCostFormValues =
    props.mode === "edit"
      ? {
          category: props.cost.category,
          description: props.cost.description,
          amountCents: props.cost.amountCents,
        }
      : { category: "OTHER", description: "", amountCents: undefined as unknown as number };

  const form = useForm<EventCostFormValues>({
    resolver: zodResolver(eventCostFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  React.useEffect(() => {
    if (open) form.reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: EventCostFormValues) {
    const res =
      props.mode === "edit"
        ? await updateEventCostAction({ ...values, costId: props.cost.id })
        : await createEventCostAction({ ...values, eventId: props.eventId });
    if (
      handleActionResult(res, {
        form,
        success: props.mode === "edit" ? "Costo actualizado" : "Costo registrado",
      })
    ) {
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {props.mode === "edit" ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Editar costo: ${props.cost.description}`}>
            <Pencil aria-hidden />
          </Button>
        ) : (
          <Button size="sm">
            <Plus aria-hidden /> Agregar costo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {props.mode === "edit" ? "Editar costo manual" : "Registrar costo manual"}
          </DialogTitle>
          <DialogDescription>
            Gastos reales que no entraron como compra ni como staff (propinas, estacionamiento, mermas, etc.).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Categoría" required error={errors.category?.message}>
            {(fp) => (
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...fp} className="w-full">
                      <SelectValue placeholder="Elige una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {COST_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {COST_CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </Field>
          <Field label="Descripción" required error={errors.description?.message}>
            {(fp) => (
              <Input
                {...fp}
                {...form.register("description")}
                placeholder="Ej. Estacionamiento del montaje"
                maxLength={200}
              />
            )}
          </Field>
          <Field
            label="Monto (MXN)"
            required
            error={errors.amountCents?.message}
            description="Monto real pagado, IVA incluido."
          >
            {(fp) => (
              <Controller
                control={form.control}
                name="amountCents"
                render={({ field }) => (
                  <MoneyInput
                    {...fp}
                    value={field.value}
                    onValueChange={(v) => field.onChange(v ?? undefined)}
                    placeholder="0.00"
                  />
                )}
              />
            )}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <SubmitButton pending={isSubmitting}>
              {props.mode === "edit" ? "Guardar cambios" : "Registrar costo"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
