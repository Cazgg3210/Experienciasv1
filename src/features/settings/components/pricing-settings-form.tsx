"use client";

import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { handleActionResult } from "@/components/forms/action-result";
import { pricingFormSchema, type PricingFormInput } from "../schemas";
import { updatePricingSettingsAction } from "../server/actions";
import { FormCard } from "./settings-section";
import { FormFooter } from "./form-footer";

function Suffix({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
      {children}
    </span>
  );
}

export function PricingSettingsForm({ defaults, canEdit }: { defaults: PricingFormInput; canEdit: boolean }) {
  const form = useForm<PricingFormInput>({ resolver: zodResolver(pricingFormSchema), defaultValues: defaults });
  const [pending, startTransition] = useTransition();
  const errors = form.formState.errors;
  const num = { valueAsNumber: true } as const;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await updatePricingSettingsAction(values);
      if (handleActionResult(res, { form, success: false })) {
        const changes = res.data.changes;
        toast.success(changes.length ? "Precios y márgenes actualizados" : "Guardado (sin cambios en los valores)", {
          description: changes.length ? changes.join(" · ") : undefined,
        });
        form.reset(values);
      }
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <fieldset disabled={!canEdit || pending} className="space-y-5">
        <legend className="sr-only">Precios y márgenes</legend>
        <FormCard title="Impuestos" description="Cómo se calcula y muestra el IVA en las propuestas.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="IVA" error={errors.taxRatePercent?.message} required>
              {(p) => (
                <div className="relative">
                  <Input {...p} type="number" inputMode="decimal" step="0.01" min={0} max={50} className="tabular pr-8" {...form.register("taxRatePercent", num)} defaultValue={defaults.taxRatePercent} />
                  <Suffix>%</Suffix>
                </div>
              )}
            </Field>
            <div className="flex items-start gap-3 rounded-lg border p-3 sm:mt-6">
              <Controller
                control={form.control}
                name="pricesIncludeTax"
                render={({ field }) => (
                  <Switch
                    id="pricesIncludeTax"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-describedby="pricesIncludeTax-desc"
                    className="mt-0.5"
                  />
                )}
              />
              <div className="space-y-0.5">
                <Label htmlFor="pricesIncludeTax">Los precios incluyen IVA</Label>
                <p id="pricesIncludeTax-desc" className="text-muted-foreground text-xs">
                  Si está apagado, el IVA se suma al total de la propuesta.
                </p>
              </div>
            </div>
          </div>
        </FormCard>

        <FormCard title="Cotizaciones y anticipo" description="Reglas que aplica el motor de cotización a cada propuesta.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Anticipo para confirmar" error={errors.depositPercent?.message} required>
              {(p) => (
                <div className="relative">
                  <Input {...p} type="number" inputMode="decimal" step="0.01" min={0} max={100} className="tabular pr-8" {...form.register("depositPercent", num)} defaultValue={defaults.depositPercent} />
                  <Suffix>%</Suffix>
                </div>
              )}
            </Field>
            <Field label="Vigencia de la cotización" error={errors.quoteValidityDays?.message} required>
              {(p) => (
                <div className="relative">
                  <Input {...p} type="number" inputMode="numeric" step="1" min={1} max={60} className="tabular pr-12" {...form.register("quoteValidityDays", num)} defaultValue={defaults.quoteValidityDays} />
                  <Suffix>días</Suffix>
                </div>
              )}
            </Field>
            <Field
              label="Saldo antes del evento"
              description="Días antes del evento en que vence el saldo."
              error={errors.balanceDueDaysBefore?.message}
              required
            >
              {(p) => (
                <div className="relative">
                  <Input {...p} type="number" inputMode="numeric" step="1" min={0} max={60} className="tabular pr-12" {...form.register("balanceDueDaysBefore", num)} defaultValue={defaults.balanceDueDaysBefore} />
                  <Suffix>días</Suffix>
                </div>
              )}
            </Field>
            <Field
              label="Margen mínimo"
              description="Debajo de este margen la propuesta se marca en alerta."
              error={errors.minMarginPercent?.message}
              required
            >
              {(p) => (
                <div className="relative">
                  <Input {...p} type="number" inputMode="decimal" step="0.01" min={0} max={100} className="tabular pr-8" {...form.register("minMarginPercent", num)} defaultValue={defaults.minMarginPercent} />
                  <Suffix>%</Suffix>
                </div>
              )}
            </Field>
          </div>
        </FormCard>

        <FormCard title="Pasarela de pago" description="Comisión estimada para calcular el costo de cobrar en línea.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Comisión porcentual" error={errors.paymentFeePercent?.message} required>
              {(p) => (
                <div className="relative">
                  <Input {...p} type="number" inputMode="decimal" step="0.01" min={0} max={20} className="tabular pr-8" {...form.register("paymentFeePercent", num)} defaultValue={defaults.paymentFeePercent} />
                  <Suffix>%</Suffix>
                </div>
              )}
            </Field>
            <Field label="Cargo fijo por cobro" description="En pesos, por transacción." error={errors.paymentFeeFixedCents?.message} required>
              {(p) => (
                <Controller
                  control={form.control}
                  name="paymentFeeFixedCents"
                  render={({ field }) => (
                    <MoneyInput
                      {...p}
                      value={field.value}
                      onValueChange={(v) => field.onChange(v ?? Number.NaN)}
                      onBlur={field.onBlur}
                      disabled={!canEdit || pending}
                    />
                  )}
                />
              )}
            </Field>
          </div>
        </FormCard>

        <FormCard title="Tamaño estándar del grupo" description="Rango de invitadas para el que están diseñadas las experiencias.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mínimo de invitadas" error={errors.minStandardGuests?.message} required>
              {(p) => <Input {...p} type="number" inputMode="numeric" step="1" min={1} className="tabular" {...form.register("minStandardGuests", num)} defaultValue={defaults.minStandardGuests} />}
            </Field>
            <Field label="Máximo de invitadas" error={errors.maxStandardGuests?.message} required>
              {(p) => <Input {...p} type="number" inputMode="numeric" step="1" min={1} className="tabular" {...form.register("maxStandardGuests", num)} defaultValue={defaults.maxStandardGuests} />}
            </Field>
          </div>
        </FormCard>
      </fieldset>
      <p className="text-muted-foreground text-xs">
        Los cambios aplican a las cotizaciones nuevas o recalculadas; las ya enviadas conservan sus condiciones. Cada cambio
        queda registrado en Auditoría.
      </p>
      <FormFooter pending={pending} dirty={form.formState.isDirty} disabled={!canEdit} onReset={() => form.reset()} />
    </form>
  );
}
