"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { RotateCcw, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { DIETARY_LABELS, MENU_PRICING_LABELS, toOptions } from "@/lib/labels";
import { formatBps, formatMXN } from "@/lib/money";
import type { EngineSettings } from "@/features/quotes/domain/quote-engine";
import { addOnUnitMarginBps } from "../domain/margin-preview";
import { menuFormSchema, type MenuFormValues } from "../schemas";
import { createMenuAction, updateMenuAction } from "../server/actions";
import { ChipsInput, FieldGroup, PricingLockNote, SectionCard, SwitchField, ToggleChips } from "./form-bits";
import { DeleteCatalogButton } from "./catalog-actions";
import { SlugHint, useSlugAutofill } from "./use-slug-autofill";

const PRICING_OPTIONS = toOptions(MENU_PRICING_LABELS);
const DIETARY_OPTIONS = toOptions(DIETARY_LABELS);

const PRICING_HELP: Record<MenuFormValues["pricingType"], string> = {
  INCLUDED: "Ya está incluido en el precio base de la experiencia; sólo suma costo por persona.",
  PER_GUEST: "Upgrade que se cobra por cada persona facturable.",
  FLAT: "Upgrade con un precio fijo por evento.",
};

export function MenuEditor({
  mode,
  menuId,
  defaultValues,
  settings,
  canWrite,
  canPrice,
  deletable,
}: {
  mode: "create" | "edit";
  menuId?: string;
  defaultValues: MenuFormValues;
  settings: Pick<EngineSettings, "pricesIncludeTax" | "taxRateBps">;
  canWrite: boolean;
  canPrice: boolean;
  /** Muestra el botón Eliminar (sólo en edición y con permiso de escritura). */
  deletable?: boolean;
}) {
  const router = useRouter();
  const form = useForm<MenuFormValues>({ resolver: zodResolver(menuFormSchema), defaultValues, mode: "onTouched" });
  const { register, control, formState } = form;
  const errors = formState.errors;
  const priceLocked = !canPrice;
  const [name, slug, pricingType, priceCents, costPerGuestCents] = useWatch({
    control,
    name: ["name", "slug", "pricingType", "priceCents", "costPerGuestCents"],
  });

  const slugField = useSlugAutofill({
    entity: "menu",
    excludeId: menuId,
    name,
    slug,
    initialSlug: mode === "edit" ? defaultValues.slug : undefined,
    setSlug: (v) => form.setValue("slug", v, { shouldDirty: true }),
    onTaken: (message) => form.setError("slug", { type: "server", message }),
    onAvailable: () => {
      if (form.getFieldState("slug").error?.type === "server") form.clearErrors("slug");
    },
  });

  const onSubmit = form.handleSubmit(
    async (values) => {
      if (mode === "create") {
        const res = await createMenuAction(values);
        if (handleActionResult(res, { form, success: "Menú creado. Ahora agrega sus platillos." })) {
          router.push(`/admin/catalog/menus/${res.data.id}`);
        }
        return;
      }
      const res = await updateMenuAction({ ...values, id: menuId! });
      if (handleActionResult(res, { form, success: "Menú guardado" })) {
        form.reset({ ...values, priceCents: values.pricingType === "INCLUDED" ? 0 : values.priceCents });
        router.refresh();
      }
    },
    () => toast.error("Revisa los campos marcados antes de guardar."),
  );

  const perGuestMargin =
    pricingType === "PER_GUEST" && Number.isFinite(priceCents) && Number.isFinite(costPerGuestCents)
      ? addOnUnitMarginBps(priceCents, costPerGuestCents, settings)
      : null;

  return (
    <form onSubmit={onSubmit} noValidate aria-label={mode === "create" ? "Nuevo menú" : "Editar menú"}>
      <fieldset disabled={!canWrite} className="min-w-0 space-y-6">
        <legend className="sr-only">Datos del menú</legend>
        <SectionCard title="Datos del menú">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" required error={errors.name?.message} className="sm:col-span-2">
              {(p) => <Input {...p} autoComplete="off" placeholder="Ej. Brunch Garden" {...register("name")} />}
            </Field>
            <Field
              label="Slug"
              required
              error={errors.slug?.message}
              className="sm:col-span-2"
              description={<SlugHint status={slugField.status} path={slug || "…"} />}
            >
              {(p) => (
                <div className="flex gap-2">
                  <Input {...p} spellCheck={false} className="font-mono" {...register("slug", { onChange: () => slugField.markEdited() })} />
                  <Button type="button" variant="outline" size="lg" onClick={() => slugField.regenerate()} title="Generar desde el nombre">
                    <Wand2 aria-hidden />
                    <span className="sr-only sm:not-sr-only">Desde el nombre</span>
                  </Button>
                </div>
              )}
            </Field>
            <Field label="Descripción" error={errors.description?.message} className="sm:col-span-2">
              {(p) => <Textarea {...p} rows={3} {...register("description")} />}
            </Field>
            <Controller
              control={control}
              name="tags"
              render={({ field }) => (
                <Field
                  label="Etiquetas"
                  error={errors.tags?.message ?? (Array.isArray(errors.tags) ? errors.tags.find(Boolean)?.message : undefined)}
                  description="Palabras cortas para filtrar (ej. clásico, de temporada)."
                  className="sm:col-span-2"
                >
                  {(p) => (
                    <ChipsInput
                      {...p}
                      value={field.value}
                      onChange={field.onChange}
                      max={15}
                      normalize={(s) => s.trim().toLowerCase().slice(0, 40)}
                      chipLabel="etiqueta"
                      disabled={!canWrite}
                    />
                  )}
                </Field>
              )}
            />
            <Controller
              control={control}
              name="dietaryTags"
              render={({ field }) => (
                <FieldGroup legend="Apto para" description="Restricciones alimentarias que cubre el menú completo." className="sm:col-span-2">
                  <ToggleChips options={DIETARY_OPTIONS} value={field.value} onChange={field.onChange} disabled={!canWrite} />
                </FieldGroup>
              )}
            />
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <SwitchField
                  label="Activo"
                  description="Disponible en el configurador."
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={!canWrite}
                />
              )}
            />
            <Field label="Orden" error={errors.sortOrder?.message} description="Menor número = aparece primero.">
              {(p) => <Input {...p} type="number" min={0} inputMode="numeric" {...register("sortOrder", { valueAsNumber: true })} />}
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Precio y costo" description={PRICING_HELP[pricingType]}>
          <div className="space-y-4">
            <PricingLockNote show={priceLocked} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Tipo de precio" required error={errors.pricingType?.message}>
                {(p) => (
                  <Controller
                    control={control}
                    name="pricingType"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={!canWrite || priceLocked}>
                        <SelectTrigger {...p} className="h-9 w-full">
                          <SelectValue>{MENU_PRICING_LABELS[field.value]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {PRICING_OPTIONS.map((o) => (
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
                label={pricingType === "FLAT" ? "Precio por evento" : "Precio por persona"}
                error={errors.priceCents?.message}
                description={pricingType === "INCLUDED" ? "Incluido: no suma precio." : "IVA incluido."}
              >
                {(p) => (
                  <Controller
                    control={control}
                    name="priceCents"
                    render={({ field }) => (
                      <MoneyInput
                        {...p}
                        value={pricingType === "INCLUDED" ? 0 : field.value}
                        onValueChange={(v) => field.onChange(v as number)}
                        onBlur={field.onBlur}
                        disabled={priceLocked || pricingType === "INCLUDED"}
                      />
                    )}
                  />
                )}
              </Field>
              <Field label="Costo por persona" error={errors.costPerGuestCents?.message} description="Alimentos y bebidas.">
                {(p) => (
                  <Controller
                    control={control}
                    name="costPerGuestCents"
                    render={({ field }) => (
                      <MoneyInput
                        {...p}
                        value={field.value}
                        onValueChange={(v) => field.onChange(v as number)}
                        onBlur={field.onBlur}
                        disabled={priceLocked}
                      />
                    )}
                  />
                )}
              </Field>
            </div>
            {perGuestMargin != null ? (
              <p className={perGuestMargin < 0 ? "text-destructive text-sm" : "text-muted-foreground text-sm"}>
                Margen del upgrade por persona (sin IVA): <strong className="tabular">{formatBps(perGuestMargin)}</strong>
              </p>
            ) : pricingType === "INCLUDED" && Number.isFinite(costPerGuestCents) ? (
              <p className="text-muted-foreground text-sm">
                Por ejemplo, para 6 personas este menú cuesta <strong className="tabular">{formatMXN(costPerGuestCents * 6)}</strong> y se
                absorbe en el precio base de la experiencia.
              </p>
            ) : null}
          </div>
        </SectionCard>

        <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3 shadow-md backdrop-blur">
          <span className="text-muted-foreground text-xs" aria-live="polite">
            {formState.isDirty ? "Tienes cambios sin guardar" : mode === "edit" ? "Todo guardado" : "Completa los datos del menú"}
          </span>
          <div className="flex flex-wrap gap-2">
            {deletable && menuId ? (
                  <DeleteCatalogButton entity="menu" id={menuId} name={defaultValues.name} redirectTo="/admin/catalog/menus" />
                ) : null}
            {mode === "edit" ? (
              <Button type="button" variant="ghost" size="lg" disabled={!formState.isDirty} onClick={() => form.reset()}>
                <RotateCcw aria-hidden />
                Descartar
              </Button>
            ) : null}
            <SubmitButton size="lg" pending={formState.isSubmitting} disabled={!canWrite}>
              {mode === "create" ? "Crear menú" : "Guardar menú"}
            </SubmitButton>
          </div>
        </div>
      </fieldset>
    </form>
  );
}
