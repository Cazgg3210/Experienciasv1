"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { RotateCcw, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { MediaUploader } from "@/components/media/media-uploader";
import { ADDON_CATEGORY_LABELS, ADDON_PRICING_LABELS, COST_CATEGORY_LABELS, toOptions } from "@/lib/labels";
import { formatBps } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { EngineSettings } from "@/features/quotes/domain/quote-engine";
import { publicMediaPath } from "../domain/catalog-rules";
import { addOnUnitMarginBps } from "../domain/margin-preview";
import { addOnFormSchema, type AddOnFormValues } from "../schemas";
import type { InventoryOption } from "../server/queries";
import { createAddOnAction, updateAddOnAction } from "../server/actions";
import { CatalogImage } from "./catalog-image";
import { PricingLockNote, SectionCard, SwitchField } from "./form-bits";
import { InventoryReqsEditor } from "./inventory-reqs-editor";
import { DeleteCatalogButton } from "./catalog-actions";
import { SlugHint, useSlugAutofill } from "./use-slug-autofill";

const CATEGORY_OPTIONS = toOptions(ADDON_CATEGORY_LABELS);
const PRICING_OPTIONS = toOptions(ADDON_PRICING_LABELS);
const COST_OPTIONS = toOptions(COST_CATEGORY_LABELS);

export function AddOnEditor({
  mode,
  addOnId,
  defaultValues,
  inventory,
  settings,
  canWrite,
  canPrice,
  canUpload,
  deletable,
}: {
  mode: "create" | "edit";
  addOnId?: string;
  defaultValues: AddOnFormValues;
  inventory: InventoryOption[];
  settings: Pick<EngineSettings, "pricesIncludeTax" | "taxRateBps" | "minMarginBps">;
  canWrite: boolean;
  canPrice: boolean;
  canUpload: boolean;
  /** Muestra el botón Eliminar (sólo en edición y con permiso de escritura). */
  deletable?: boolean;
}) {
  const router = useRouter();
  const form = useForm<AddOnFormValues>({ resolver: zodResolver(addOnFormSchema), defaultValues, mode: "onTouched" });
  const { register, control, formState } = form;
  const errors = formState.errors;
  const priceLocked = !canPrice;
  const [name, slug, imageUrl, priceCents, costCents, pricingType] = useWatch({
    control,
    name: ["name", "slug", "imageUrl", "priceCents", "costCents", "pricingType"],
  });

  const slugField = useSlugAutofill({
    entity: "addOn",
    excludeId: addOnId,
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
        const res = await createAddOnAction(values);
        if (handleActionResult(res, { form, success: "Add-on creado" })) router.push(`/admin/catalog/addons/${res.data.id}`);
        return;
      }
      const res = await updateAddOnAction({ ...values, id: addOnId! });
      if (handleActionResult(res, { form, success: "Add-on guardado" })) {
        form.reset(values);
        router.refresh();
      }
    },
    () => toast.error("Revisa los campos marcados antes de guardar."),
  );

  const margin =
    Number.isFinite(priceCents) && Number.isFinite(costCents) ? addOnUnitMarginBps(priceCents, costCents, settings) : null;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate aria-label={mode === "create" ? "Nuevo add-on" : "Editar add-on"}>
        <fieldset disabled={!canWrite} className="min-w-0 space-y-6">
          <legend className="sr-only">Datos del add-on</legend>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <SectionCard title="Datos del add-on">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre" required error={errors.name?.message} className="sm:col-span-2">
                  {(p) => <Input {...p} autoComplete="off" placeholder="Ej. Karaoke con micrófonos" {...register("name")} />}
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
                <Field label="Categoría" required error={errors.category?.message}>
                  {(p) => (
                    <Controller
                      control={control}
                      name="category"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange} disabled={!canWrite}>
                          <SelectTrigger {...p} className="h-9 w-full">
                            <SelectValue>{ADDON_CATEGORY_LABELS[field.value]}</SelectValue>
                          </SelectTrigger>
                          <SelectContent position="popper">
                            {CATEGORY_OPTIONS.map((o) => (
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
                <Field label="Orden" error={errors.sortOrder?.message} description="Menor número = aparece primero.">
                  {(p) => <Input {...p} type="number" min={0} inputMode="numeric" {...register("sortOrder", { valueAsNumber: true })} />}
                </Field>
                <Field label="Cantidad máxima" required error={errors.maxQuantity?.message} description="Por evento.">
                  {(p) => <Input {...p} type="number" min={1} inputMode="numeric" {...register("maxQuantity", { valueAsNumber: true })} />}
                </Field>
                <Field label="Días de anticipación" required error={errors.leadTimeDays?.message} description="Mínimo para poder ofrecerlo.">
                  {(p) => <Input {...p} type="number" min={0} inputMode="numeric" {...register("leadTimeDays", { valueAsNumber: true })} />}
                </Field>
                <Controller
                  control={control}
                  name="active"
                  render={({ field }) => (
                    <SwitchField
                      label="Disponible"
                      description="Se ofrece en el configurador y cotizaciones."
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={!canWrite}
                    />
                  )}
                />
              </div>
            </SectionCard>

            <SectionCard title="Imagen">
              <div className="space-y-3">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl border">
                  <CatalogImage src={imageUrl || null} alt={name ? `Imagen de ${name}` : "Imagen del add-on"} sizes="320px" />
                </div>
                <Field label="URL de imagen" error={errors.imageUrl?.message} description="Ruta local o URL https, o sube una foto.">
                  {(p) => (
                    <div className="flex gap-2">
                      <Input {...p} spellCheck={false} placeholder="/images/placeholders/karaoke.svg" {...register("imageUrl")} />
                      {imageUrl ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-lg"
                          onClick={() => form.setValue("imageUrl", "", { shouldDirty: true })}
                          aria-label="Quitar imagen"
                        >
                          <X aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  )}
                </Field>
                {canUpload ? (
                  <MediaUploader
                    disabled={!canWrite}
                    fields={{ purpose: "ADDON", visibility: "PUBLIC", alt: name?.slice(0, 200) || undefined }}
                    label="Subir foto"
                    hint="JPG, PNG o WEBP · máx. 8 MB"
                    onUploaded={(media) => {
                      form.setValue("imageUrl", publicMediaPath(media.id), { shouldDirty: true, shouldValidate: true });
                      toast.info("Foto lista. Guarda el add-on para publicarla.");
                    }}
                  />
                ) : null}
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Precio y costo" description="Precios con IVA incluido; el costo alimenta el margen de cada evento.">
            <div className="space-y-4">
              <PricingLockNote show={priceLocked} />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Tipo de precio" required error={errors.pricingType?.message}>
                  {(p) => (
                    <Controller
                      control={control}
                      name="pricingType"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange} disabled={!canWrite || priceLocked}>
                          <SelectTrigger {...p} className="h-9 w-full">
                            <SelectValue>{ADDON_PRICING_LABELS[field.value]}</SelectValue>
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
                  label={pricingType === "PER_GUEST" ? "Precio por persona" : "Precio"}
                  required
                  error={errors.priceCents?.message}
                >
                  {(p) => (
                    <Controller
                      control={control}
                      name="priceCents"
                      render={({ field }) => (
                        <MoneyInput {...p} value={field.value} onValueChange={(v) => field.onChange(v as number)} onBlur={field.onBlur} disabled={priceLocked} />
                      )}
                    />
                  )}
                </Field>
                <Field label={pricingType === "PER_GUEST" ? "Costo por persona" : "Costo"} error={errors.costCents?.message}>
                  {(p) => (
                    <Controller
                      control={control}
                      name="costCents"
                      render={({ field }) => (
                        <MoneyInput {...p} value={field.value} onValueChange={(v) => field.onChange(v as number)} onBlur={field.onBlur} disabled={priceLocked} />
                      )}
                    />
                  )}
                </Field>
                <Field label="Categoría de costo" required error={errors.costCategory?.message}>
                  {(p) => (
                    <Controller
                      control={control}
                      name="costCategory"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange} disabled={!canWrite}>
                          <SelectTrigger {...p} className="h-9 w-full">
                            <SelectValue>{COST_CATEGORY_LABELS[field.value]}</SelectValue>
                          </SelectTrigger>
                          <SelectContent position="popper">
                            {COST_OPTIONS.map((o) => (
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
              {margin != null ? (
                <p
                  className={cn(
                    "text-sm",
                    margin < 0 ? "text-destructive font-medium" : margin < settings.minMarginBps ? "text-warning" : "text-muted-foreground",
                  )}
                >
                  Margen unitario (sin IVA ni comisiones): <strong className="tabular">{formatBps(margin)}</strong>
                  {margin < 0 ? " · el costo supera al precio." : null}
                </p>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard title="Inventario relacionado" description="Artículos que se apartan cuando se contrata este add-on.">
            <InventoryReqsEditor options={inventory} disabled={!canWrite} />
          </SectionCard>

          <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3 shadow-md backdrop-blur">
            <span className="text-muted-foreground text-xs" aria-live="polite">
              {formState.isDirty ? "Tienes cambios sin guardar" : mode === "edit" ? "Todo guardado" : "Completa los datos del add-on"}
            </span>
            <div className="flex flex-wrap gap-2">
              {deletable && addOnId ? (
                  <DeleteCatalogButton entity="addOn" id={addOnId} name={defaultValues.name} redirectTo="/admin/catalog/addons" />
                ) : null}
              {mode === "edit" ? (
                <Button type="button" variant="ghost" size="lg" disabled={!formState.isDirty} onClick={() => form.reset()}>
                  <RotateCcw aria-hidden />
                  Descartar
                </Button>
              ) : null}
              <SubmitButton size="lg" pending={formState.isSubmitting} disabled={!canWrite}>
                {mode === "create" ? "Crear add-on" : "Guardar add-on"}
              </SubmitButton>
            </div>
          </div>
        </fieldset>
      </form>
    </FormProvider>
  );
}
