"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { formatMXN } from "@/lib/money";
import { POSTAL_CODE_RE } from "../domain/catalog-rules";
import { areaFormSchema, type AreaFormValues } from "../schemas";
import { createServiceAreaAction, updateServiceAreaAction } from "../server/actions";
import { ChipsInput, PricingLockNote, SwitchField } from "./form-bits";
import { SlugHint, useSlugAutofill } from "./use-slug-autofill";

/** Alta/edición de zonas de servicio (códigos postales + tarifa y costo de logística). */
export function AreaDialog({
  mode,
  areaId,
  defaultValues,
  trigger,
  canPrice,
}: {
  mode: "create" | "edit";
  areaId?: string;
  defaultValues: AreaFormValues;
  trigger: React.ReactNode;
  canPrice: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent showCloseButton={false} className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        {open ? (
          <AreaForm mode={mode} areaId={areaId} defaultValues={defaultValues} canPrice={canPrice} onDone={() => setOpen(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AreaForm({
  mode,
  areaId,
  defaultValues,
  canPrice,
  onDone,
}: {
  mode: "create" | "edit";
  areaId?: string;
  defaultValues: AreaFormValues;
  canPrice: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const form = useForm<AreaFormValues>({ resolver: zodResolver(areaFormSchema), defaultValues });
  const { register, control, formState } = form;
  const errors = formState.errors;
  const [name, slug, fee, cost] = useWatch({ control, name: ["name", "slug", "logisticsFeeCents", "logisticsCostCents"] });
  const slugField = useSlugAutofill({
    entity: "serviceArea",
    excludeId: areaId,
    name,
    slug,
    initialSlug: mode === "edit" ? defaultValues.slug : undefined,
    setSlug: (v) => form.setValue("slug", v, { shouldDirty: true }),
    onTaken: (message) => form.setError("slug", { type: "server", message }),
    onAvailable: () => {
      if (form.getFieldState("slug").error?.type === "server") form.clearErrors("slug");
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const res =
      mode === "create" ? await createServiceAreaAction(values) : await updateServiceAreaAction({ ...values, id: areaId! });
    if (handleActionResult(res, { form, success: mode === "create" ? "Zona creada" : "Zona guardada" })) {
      if (res.data.overlaps.length) {
        const detail = res.data.overlaps.map((o) => `${o.name} (${o.codes.slice(0, 5).join(", ")}${o.codes.length > 5 ? "…" : ""})`);
        toast.warning(`Algunos códigos postales también están en: ${detail.join("; ")}.`, { duration: 9000 });
      }
      onDone();
      router.refresh();
    }
  });

  const codeErrors = Array.isArray(errors.postalCodes) ? errors.postalCodes.find(Boolean)?.message : errors.postalCodes?.message;
  const margin = Number.isFinite(fee) && Number.isFinite(cost) ? fee - cost : null;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-lg">{mode === "create" ? "Nueva zona" : "Editar zona"}</DialogTitle>
        <DialogDescription>Define a qué colonias llegamos y cuánto cuesta el traslado.</DialogDescription>
      </DialogHeader>
      <Field label="Nombre" required error={errors.name?.message}>
        {(p) => <Input {...p} autoFocus placeholder="Ej. Roma · Condesa" {...register("name")} />}
      </Field>
      <Field label="Slug" required error={errors.slug?.message} description={<SlugHint status={slugField.status} path={slug || "…"} />}>
        {(p) => (
          <div className="flex gap-2">
            <Input {...p} spellCheck={false} className="font-mono" {...register("slug", { onChange: () => slugField.markEdited() })} />
            <Button type="button" variant="outline" size="lg" onClick={() => slugField.regenerate()} title="Generar desde el nombre">
              <Wand2 aria-hidden />
              <span className="sr-only">Generar desde el nombre</span>
            </Button>
          </div>
        )}
      </Field>
      <Field label="Descripción" error={errors.description?.message}>
        {(p) => <Textarea {...p} rows={2} {...register("description")} />}
      </Field>
      <Controller
        control={control}
        name="postalCodes"
        render={({ field }) => (
          <Field
            label={`Códigos postales (${field.value.length})`}
            error={codeErrors}
            description="Escribe o pega varios separados por comas o espacios. 5 dígitos cada uno."
          >
            {(p) => (
              <ChipsInput
                {...p}
                value={field.value}
                onChange={(next) => field.onChange([...next].sort())}
                inputMode="numeric"
                placeholder="06700, 06140…"
                max={800}
                chipLabel="código postal"
                splitOnSpaces
                normalize={(s) => s.trim()}
                validate={(s) => (POSTAL_CODE_RE.test(s) ? null : `"${s}" no es un código postal de 5 dígitos.`)}
              />
            )}
          </Field>
        )}
      />
      <PricingLockNote show={!canPrice} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tarifa de logística (precio)" error={errors.logisticsFeeCents?.message} description="Se suma a la cotización.">
          {(p) => (
            <Controller
              control={control}
              name="logisticsFeeCents"
              render={({ field }) => (
                <MoneyInput {...p} value={field.value} onValueChange={(v) => field.onChange(v as number)} onBlur={field.onBlur} disabled={!canPrice} />
              )}
            />
          )}
        </Field>
        <Field label="Costo de logística" error={errors.logisticsCostCents?.message} description="Gasolina, casetas, chofer.">
          {(p) => (
            <Controller
              control={control}
              name="logisticsCostCents"
              render={({ field }) => (
                <MoneyInput {...p} value={field.value} onValueChange={(v) => field.onChange(v as number)} onBlur={field.onBlur} disabled={!canPrice} />
              )}
            />
          )}
        </Field>
      </div>
      {margin != null && (fee > 0 || cost > 0) ? (
        <p className={margin < 0 ? "text-destructive text-sm font-medium" : "text-muted-foreground text-sm"}>
          {margin < 0
            ? `La logística en esta zona pierde ${formatMXN(-margin)} por evento.`
            : `La logística deja ${formatMXN(margin)} por evento (antes de IVA).`}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <SwitchField label="Activa" description="Aceptamos eventos en esta zona." checked={field.value} onCheckedChange={field.onChange} />
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
          {mode === "create" ? "Crear zona" : "Guardar zona"}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
