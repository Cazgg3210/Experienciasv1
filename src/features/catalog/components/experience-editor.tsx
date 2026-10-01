"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FormProvider, useFieldArray, useForm, useWatch, type Control } from "react-hook-form";
import { Plus, RotateCcw, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import {
  COST_CATEGORY_LABELS,
  EXPERIENCE_TYPE_LABELS,
  MENU_PRICING_LABELS,
  OCCASION_LABELS,
  toOptions,
} from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { EngineSettings } from "@/features/quotes/domain/quote-engine";
import { pickReferenceMenu, previewExperienceMargin } from "../domain/margin-preview";
import {
  COST_CATEGORIES,
  experienceFormSchema,
  type ExperienceFormValues,
} from "../schemas";
import type { ExperienceImageItem, ExperienceOptions, MenuOption } from "../server/queries";
import { createExperienceAction, updateExperienceAction } from "../server/actions";
import { CatalogImage } from "./catalog-image";
import { ExperienceImages } from "./experience-images";
import { FieldGroup, ListEditor, OrderButtons, PricingLockNote, SectionCard, SwitchField, ToggleChips } from "./form-bits";
import { InventoryReqsEditor } from "./inventory-reqs-editor";
import { MarginChip, MarginPreviewPanel } from "./margin-preview-panel";
import { DeleteCatalogButton } from "./catalog-actions";
import { SlugHint, useSlugAutofill } from "./use-slug-autofill";

const SECTIONS = [
  { id: "basicos", label: "Básicos" },
  { id: "precio", label: "Personas y precio" },
  { id: "costos", label: "Costos y margen" },
  { id: "incluye", label: "Incluye" },
  { id: "imagenes", label: "Imágenes" },
  { id: "relaciones", label: "Relaciones" },
  { id: "inventario", label: "Inventario" },
  { id: "faqs", label: "Preguntas frecuentes" },
] as const;

const TYPE_OPTIONS = toOptions(EXPERIENCE_TYPE_LABELS);
const OCCASION_OPTIONS = toOptions(OCCASION_LABELS);

type PreviewMenuChoice = "auto" | "none" | string;

export function ExperienceEditor({
  mode,
  experienceId,
  version,
  defaultValues,
  options,
  settings,
  images = [],
  placeholders = [],
  canWrite,
  canPrice,
  deletable,
}: {
  mode: "create" | "edit";
  experienceId?: string;
  /**
   * Versión de los datos del servidor (updatedAt). Cuando cambia y el formulario no tiene cambios
   * sin guardar, se recargan los valores; si los tiene, se conservan (no se pierde lo escrito).
   */
  version?: string;
  defaultValues: ExperienceFormValues;
  options: ExperienceOptions;
  settings: EngineSettings;
  images?: ExperienceImageItem[];
  placeholders?: string[];
  canWrite: boolean;
  canPrice: boolean;
  /** Muestra el botón Eliminar (sólo en edición y con permiso de escritura). */
  deletable?: boolean;
}) {
  const router = useRouter();
  const form = useForm<ExperienceFormValues>({
    resolver: zodResolver(experienceFormSchema),
    defaultValues,
    mode: "onTouched",
  });
  const { register, control, formState } = form;
  const errors = formState.errors;
  const [previewMenu, setPreviewMenu] = React.useState<PreviewMenuChoice>("auto");
  const baseId = React.useId();
  const priceLocked = !canPrice;

  // Datos nuevos del servidor (guardado, cambio de portada, otra pestaña): recarga sólo si no hay cambios pendientes.
  const lastVersion = React.useRef(version);
  React.useEffect(() => {
    if (version === lastVersion.current) return;
    lastVersion.current = version;
    if (!form.formState.isDirty) form.reset(defaultValues);
  }, [version, defaultValues, form]);

  function handleImageRemoved(url: string, coverCleared: boolean) {
    const current = form.getValues("coverImageUrl");
    if (coverCleared) {
      // El servidor ya limpió la portada guardada: actualiza el valor base sin marcar cambios.
      form.resetField("coverImageUrl", { defaultValue: "" });
      if (current !== url) form.setValue("coverImageUrl", current, { shouldDirty: true });
    } else if (current === url) {
      form.setValue("coverImageUrl", "", { shouldDirty: true, shouldValidate: true });
    }
  }

  const name = useWatch({ control, name: "name" });
  const slug = useWatch({ control, name: "slug" });
  const coverImageUrl = useWatch({ control, name: "coverImageUrl" });
  const baseGuests = useWatch({ control, name: "baseGuests" });
  const slugField = useSlugAutofill({
    entity: "experience",
    excludeId: experienceId,
    name,
    slug,
    initialSlug: mode === "edit" ? defaultValues.slug : undefined,
    setSlug: (v) => form.setValue("slug", v, { shouldDirty: true, shouldValidate: formState.isSubmitted }),
    onTaken: (message) => form.setError("slug", { type: "server", message }),
    onAvailable: () => {
      if (form.getFieldState("slug").error?.type === "server") form.clearErrors("slug");
    },
  });

  const costs = useFieldArray({ control, name: "costComponents" });
  const faqs = useFieldArray({ control, name: "faqs", keyName: "key" });

  const onSubmit = form.handleSubmit(
    async (values) => {
      if (mode === "create") {
        const res = await createExperienceAction(values);
        if (handleActionResult(res, { form, success: "Experiencia creada. Ahora puedes subir sus fotos." })) {
          router.push(`/admin/catalog/experiences/${res.data.id}`);
        }
        return;
      }
      const res = await updateExperienceAction({ ...values, id: experienceId! });
      if (handleActionResult(res, { form, success: "Cambios guardados" })) {
        form.reset(values);
        router.refresh();
      }
    },
    () => toast.error("Revisa los campos marcados antes de guardar."),
  );

  const typeLabel = (v: string) => EXPERIENCE_TYPE_LABELS[v as keyof typeof EXPERIENCE_TYPE_LABELS] ?? v;
  const hours = Number.isFinite(form.watch("durationMinutes")) ? form.watch("durationMinutes") / 60 : null;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate aria-label={mode === "create" ? "Nueva experiencia" : "Editar experiencia"}>
        <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <nav aria-label="Secciones del editor" className="hidden lg:block">
            <ul className="sticky top-24 space-y-0.5 text-sm">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="text-foreground/75 hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 block rounded-lg px-3 py-1.5 outline-none focus-visible:ring-3"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <fieldset disabled={!canWrite} className="min-w-0 space-y-6">
            <legend className="sr-only">Datos de la experiencia</legend>
            {!canWrite ? (
              <p className="bg-sand-soft rounded-xl px-4 py-3 text-sm">
                Estás en modo lectura: no tienes permiso para editar el catálogo.
              </p>
            ) : null}

            {/* 1. Básicos ------------------------------------------------------------------ */}
            <SectionCard id="basicos" title="Básicos" description="Cómo se presenta la experiencia en el sitio.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre" required error={errors.name?.message} className="sm:col-span-2">
                  {(p) => <Input {...p} autoComplete="off" placeholder="Ej. Brunch Floral" {...register("name")} />}
                </Field>
                <Field
                  label="Slug (URL)"
                  required
                  error={errors.slug?.message}
                  className="sm:col-span-2"
                  description={
                    <SlugHint
                      status={slugField.status}
                      path={`/experiencias/${slug || "…"}`}
                      changedWarning={
                        mode === "edit" && defaultValues.active && slug !== defaultValues.slug
                          ? `Cambiará la URL pública: los enlaces a /experiencias/${defaultValues.slug} dejarán de funcionar.`
                          : null
                      }
                    />
                  }
                >
                  {(p) => (
                    <div className="flex gap-2">
                      <Input
                        {...p}
                        autoComplete="off"
                        spellCheck={false}
                        className="font-mono"
                        {...register("slug", { onChange: () => slugField.markEdited() })}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={() => slugField.regenerate()}
                        title="Generar desde el nombre"
                      >
                        <Wand2 aria-hidden />
                        <span className="sr-only sm:not-sr-only">Desde el nombre</span>
                      </Button>
                    </div>
                  )}
                </Field>
                <Field
                  label="Frase corta"
                  error={errors.tagline?.message}
                  className="sm:col-span-2"
                  description="Aparece debajo del nombre (máx. 160 caracteres)."
                >
                  {(p) => <Input {...p} placeholder="Ej. Flores, mimosas y tus personas favoritas" {...register("tagline")} />}
                </Field>
                <Field label="Descripción" required error={errors.description?.message} className="sm:col-span-2">
                  {(p) => <Textarea {...p} rows={6} className="min-h-32" {...register("description")} />}
                </Field>
                <Field label="Tipo" required error={errors.type?.message}>
                  {(p) => (
                    <Controller
                      control={control}
                      name="type"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange} disabled={!canWrite}>
                          <SelectTrigger {...p} className="h-9 w-full">
                            <SelectValue>{typeLabel(field.value)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent position="popper">
                            {TYPE_OPTIONS.map((o) => (
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
                  label="Duración (minutos)"
                  required
                  error={errors.durationMinutes?.message}
                  description={hours ? `≈ ${hours.toLocaleString("es-MX", { maximumFractionDigits: 1 })} horas` : undefined}
                >
                  {(p) => (
                    <Input {...p} type="number" min={30} step={15} inputMode="numeric" {...register("durationMinutes", { valueAsNumber: true })} />
                  )}
                </Field>
                <Controller
                  control={control}
                  name="occasions"
                  render={({ field }) => (
                    <FieldGroup legend="Ocasiones" description="¿Para qué celebraciones la recomendamos?" className="sm:col-span-2">
                      <ToggleChips options={OCCASION_OPTIONS} value={field.value} onChange={field.onChange} disabled={!canWrite} />
                    </FieldGroup>
                  )}
                />
                <Controller
                  control={control}
                  name="active"
                  render={({ field }) => (
                    <SwitchField
                      label="Activa"
                      description="Visible y cotizable en el sitio."
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={!canWrite}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="featured"
                  render={({ field }) => (
                    <SwitchField
                      label="Destacada"
                      description="Se muestra primero en la home."
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

            {/* 2. Personas y precio ------------------------------------------------------ */}
            <SectionCard
              id="precio"
              title="Personas y precio"
              description="El precio base incluye las personas base; cada persona extra suma su precio."
            >
              <div className="space-y-4">
                <PricingLockNote show={priceLocked} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Personas base" required error={errors.baseGuests?.message}>
                    {(p) => <Input {...p} type="number" min={1} inputMode="numeric" {...register("baseGuests", { valueAsNumber: true })} />}
                  </Field>
                  <Field label="Mínimo" required error={errors.minGuests?.message}>
                    {(p) => <Input {...p} type="number" min={1} inputMode="numeric" {...register("minGuests", { valueAsNumber: true })} />}
                  </Field>
                  <Field label="Máximo" required error={errors.maxGuests?.message}>
                    {(p) => <Input {...p} type="number" min={1} inputMode="numeric" {...register("maxGuests", { valueAsNumber: true })} />}
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <MoneyField control={control} name="basePriceCents" label="Precio base (IVA incl.)" required disabled={priceLocked} error={errors.basePriceCents?.message} />
                  <MoneyField control={control} name="extraGuestPriceCents" label="Precio por invitada extra" disabled={priceLocked} error={errors.extraGuestPriceCents?.message} />
                  <MoneyField control={control} name="extraGuestCostCents" label="Costo por invitada extra" disabled={priceLocked} error={errors.extraGuestCostCents?.message} />
                </div>
              </div>
            </SectionCard>

            {/* 3. Costos base + margen -------------------------------------------------- */}
            <SectionCard
              id="costos"
              title="Costos base y margen"
              description={`Costos para las personas base. "Por persona" se multiplica por ${Number.isFinite(baseGuests) ? baseGuests : "las personas base"}.`}
            >
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="space-y-3">
                  <PricingLockNote show={priceLocked} />
                  {costs.fields.length ? (
                    <ul className="space-y-2">
                      {costs.fields.map((field, i) => {
                        const rowErr = errors.costComponents?.[i];
                        return (
                          <li key={field.id} className="bg-background grid grid-cols-2 gap-3 rounded-xl border p-3">
                            <div className="col-span-2 space-y-1.5">
                              <Label htmlFor={`${baseId}-cc-desc-${i}`} className="text-xs">
                                Descripción
                              </Label>
                              <Input
                                id={`${baseId}-cc-desc-${i}`}
                                className="h-9"
                                placeholder="Ej. Flores de temporada"
                                disabled={priceLocked}
                                aria-invalid={rowErr?.description ? true : undefined}
                                {...register(`costComponents.${i}.description`)}
                              />
                              {rowErr?.description?.message ? (
                                <p role="alert" className="text-destructive text-xs font-medium">
                                  {rowErr.description.message}
                                </p>
                              ) : null}
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor={`${baseId}-cc-cat-${i}`} className="text-xs">
                                Categoría
                              </Label>
                              <Controller
                                control={control}
                                name={`costComponents.${i}.category`}
                                render={({ field: f }) => (
                                  <Select value={f.value} onValueChange={f.onChange} disabled={!canWrite || priceLocked}>
                                    <SelectTrigger id={`${baseId}-cc-cat-${i}`} className="h-9 w-full">
                                      <SelectValue>{COST_CATEGORY_LABELS[f.value]}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent position="popper">
                                      {COST_CATEGORIES.map((c) => (
                                        <SelectItem key={c} value={c}>
                                          {COST_CATEGORY_LABELS[c]}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor={`${baseId}-cc-amt-${i}`} className="text-xs">
                                Monto
                              </Label>
                              <Controller
                                control={control}
                                name={`costComponents.${i}.amountCents`}
                                render={({ field: f }) => (
                                  <MoneyInput
                                    id={`${baseId}-cc-amt-${i}`}
                                    className="[&_input]:h-9"
                                    value={f.value}
                                    onValueChange={(v) => f.onChange(v as number)}
                                    onBlur={f.onBlur}
                                    disabled={priceLocked}
                                    aria-invalid={rowErr?.amountCents ? true : undefined}
                                  />
                                )}
                              />
                              {rowErr?.amountCents?.message ? (
                                <p role="alert" className="text-destructive text-xs font-medium">
                                  {rowErr.amountCents.message}
                                </p>
                              ) : null}
                            </div>
                            <div className="col-span-2 flex flex-wrap items-center justify-between gap-2">
                              <Controller
                                control={control}
                                name={`costComponents.${i}.perGuest`}
                                render={({ field: f }) => (
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      id={`${baseId}-cc-pg-${i}`}
                                      checked={f.value}
                                      disabled={!canWrite || priceLocked}
                                      onCheckedChange={(v) => f.onChange(v === true)}
                                    />
                                    <Label htmlFor={`${baseId}-cc-pg-${i}`} className="text-sm font-normal">
                                      Por persona
                                    </Label>
                                  </div>
                                )}
                              />
                              <div className="flex items-center gap-1">
                                <OrderButtons
                                  index={i}
                                  count={costs.fields.length}
                                  label={`costo ${i + 1}`}
                                  disabled={priceLocked}
                                  onMove={(d) => costs.move(i, i + d)}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled={priceLocked}
                                  onClick={() => costs.remove(i)}
                                  aria-label={`Quitar costo ${i + 1}`}
                                >
                                  <Trash2 aria-hidden />
                                </Button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-5 text-sm">
                      Sin componentes de costo. Agrega flores, staff, transporte, consumibles… para estimar el margen real.
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      disabled={priceLocked}
                      onClick={() => costs.append({ category: "FOOD", description: "", amountCents: 0, perGuest: false })}
                    >
                      <Plus aria-hidden />
                      Agregar costo
                    </Button>
                    <CostTotal control={control} />
                  </div>
                </div>
                <div className="space-y-3">
                  <PreviewMenuPicker control={control} menus={options.menus} value={previewMenu} onChange={setPreviewMenu} />
                  <LiveMarginPanel control={control} menus={options.menus} settings={settings} previewMenu={previewMenu} />
                </div>
              </div>
            </SectionCard>

            {/* 4. Incluye -------------------------------------------------------------------- */}
            <SectionCard id="incluye" title="Incluye" description="Lista ordenada de lo que incluye la experiencia.">
              <Controller
                control={control}
                name="includes"
                render={({ field }) => (
                  <ListEditor
                    value={field.value}
                    onChange={field.onChange}
                    disabled={!canWrite}
                    itemLabel="elemento incluido"
                    errors={Array.isArray(errors.includes) ? errors.includes.map((e) => e?.message) : undefined}
                  />
                )}
              />
              {errors.includes?.message ? (
                <p role="alert" className="text-destructive mt-2 text-xs font-medium">
                  {errors.includes.message}
                </p>
              ) : null}
            </SectionCard>

            {/* 5. Imágenes ------------------------------------------------------------------- */}
            <SectionCard id="imagenes" title="Imágenes" description="Portada y galería pública de la experiencia.">
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-start">
                  <div className="space-y-3">
                    <Field
                      label="URL de portada"
                      error={errors.coverImageUrl?.message}
                      description="Ruta local (/images/placeholders/...) o URL https. Si la dejas vacía se usa la primera foto de la galería."
                    >
                      {(p) => <Input {...p} spellCheck={false} placeholder="/images/placeholders/brunch-table.svg" {...register("coverImageUrl")} />}
                    </Field>
                    {placeholders.length ? (
                      <div className="space-y-1.5">
                        <p className="text-muted-foreground text-xs">O elige una ilustración de muestra:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {placeholders.map((ph) => (
                            <button
                              key={ph}
                              type="button"
                              onClick={() => form.setValue("coverImageUrl", ph, { shouldDirty: true, shouldValidate: true })}
                              className={cn(
                                "focus-visible:ring-ring/50 relative size-12 overflow-hidden rounded-lg border outline-none focus-visible:ring-3",
                                coverImageUrl === ph && "ring-olive ring-2",
                              )}
                              aria-label={`Usar ${ph.split("/").pop()} como portada`}
                              aria-pressed={coverImageUrl === ph}
                            >
                              <CatalogImage src={ph} alt="" sizes="48px" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <figure className="space-y-1.5">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-xl border">
                      <CatalogImage
                        src={coverImageUrl || images[0]?.url || null}
                        alt={`Portada de ${name || "la experiencia"}`}
                        sizes="192px"
                      />
                    </div>
                    <figcaption className="text-muted-foreground text-xs">
                      {coverImageUrl ? "Portada" : images[0] ? "Portada: primera foto de la galería" : "Sin portada"}
                    </figcaption>
                  </figure>
                </div>
                {mode === "edit" && experienceId ? (
                  <ExperienceImages
                    experienceId={experienceId}
                    experienceName={name || defaultValues.name}
                    images={images}
                    coverUrl={coverImageUrl}
                    disabled={!canWrite}
                    onUseAsCover={(url) => form.setValue("coverImageUrl", url, { shouldDirty: true, shouldValidate: true })}
                    onRemoved={handleImageRemoved}
                  />
                ) : (
                  <p className="bg-sand-soft rounded-xl px-4 py-3 text-sm">
                    Guarda la experiencia para poder subir fotos a su galería.
                  </p>
                )}
              </div>
            </SectionCard>

            {/* 6. Relaciones ---------------------------------------------------------------- */}
            <SectionCard id="relaciones" title="Relaciones" description="Qué puede combinar la clienta con esta experiencia en el configurador.">
              <div className="space-y-6">
                <RelationChips control={control} name="styleIds" legend="Estilos" options={options.styles} disabled={!canWrite} emptyText="No hay estilos activos." />
                <RelationChips control={control} name="serviceAreaIds" legend="Zonas de servicio" options={options.areas} disabled={!canWrite} emptyText="No hay zonas activas." />
                <RelationChips
                  control={control}
                  name="menuIds"
                  legend="Menús"
                  options={options.menus.map((m) => ({ ...m, hint: MENU_PRICING_LABELS[m.pricingType] }))}
                  disabled={!canWrite}
                  emptyText="No hay menús activos."
                />
                <RelationChips control={control} name="addOnIds" legend="Add-ons" options={options.addOns} disabled={!canWrite} emptyText="No hay add-ons activos." />
              </div>
            </SectionCard>

            {/* 7. Inventario --------------------------------------------------------------- */}
            <SectionCard
              id="inventario"
              title="Inventario requerido"
              description="Artículos que se reservan para cada evento de esta experiencia."
            >
              <InventoryReqsEditor
                options={options.inventory}
                disabled={!canWrite}
                guestsHint={Number.isFinite(baseGuests) && baseGuests > 0 ? baseGuests : undefined}
              />
            </SectionCard>

            {/* 8. FAQs ---------------------------------------------------------------------- */}
            <SectionCard id="faqs" title="Preguntas frecuentes" description="Se muestran en la página de la experiencia.">
              <div className="space-y-3">
                {faqs.fields.length ? (
                  <ol className="space-y-3">
                    {faqs.fields.map((field, i) => {
                      const rowErr = errors.faqs?.[i];
                      return (
                        <li key={field.key} className="bg-background space-y-3 rounded-xl border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-muted-foreground text-xs font-medium">Pregunta {i + 1}</span>
                            <div className="flex items-center gap-1">
                              <Controller
                                control={control}
                                name={`faqs.${i}.active`}
                                render={({ field: f }) => (
                                  <div className="mr-2 flex items-center gap-2">
                                    <Switch
                                      id={`${baseId}-faq-active-${i}`}
                                      checked={f.value}
                                      onCheckedChange={f.onChange}
                                      disabled={!canWrite}
                                    />
                                    <Label htmlFor={`${baseId}-faq-active-${i}`} className="text-xs font-normal">
                                      Visible
                                    </Label>
                                  </div>
                                )}
                              />
                              <OrderButtons index={i} count={faqs.fields.length} label={`pregunta ${i + 1}`} onMove={(d) => faqs.move(i, i + d)} />
                              <Button type="button" variant="ghost" size="icon-sm" onClick={() => faqs.remove(i)} aria-label={`Quitar pregunta ${i + 1}`}>
                                <Trash2 aria-hidden />
                              </Button>
                            </div>
                          </div>
                          <Field label="Pregunta" required error={rowErr?.question?.message}>
                            {(p) => <Input {...p} {...register(`faqs.${i}.question`)} />}
                          </Field>
                          <Field label="Respuesta" required error={rowErr?.answer?.message}>
                            {(p) => <Textarea {...p} rows={3} {...register(`faqs.${i}.answer`)} />}
                          </Field>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-5 text-sm">
                    Sin preguntas todavía. Agrega las dudas más comunes (¿qué incluye?, ¿hay opción vegana?, ¿cuánto dura?).
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => faqs.append({ question: "", answer: "", active: true })}
                >
                  <Plus aria-hidden />
                  Agregar pregunta
                </Button>
              </div>
            </SectionCard>

            {/* Barra de guardado ---------------------------------------------------------- */}
            <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3 shadow-md backdrop-blur">
              <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <LiveMarginChip control={control} menus={options.menus} settings={settings} previewMenu={previewMenu} />
                <span className="text-muted-foreground text-xs" aria-live="polite">
                  {formState.isDirty ? "Tienes cambios sin guardar" : mode === "edit" ? "Todo guardado" : "Completa los datos básicos y el precio"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {deletable && experienceId ? (
                  <DeleteCatalogButton entity="experience" id={experienceId} name={defaultValues.name} redirectTo="/admin/catalog" />
                ) : null}
                {mode === "edit" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    disabled={!formState.isDirty || formState.isSubmitting}
                    onClick={() => form.reset()}
                  >
                    <RotateCcw aria-hidden />
                    Descartar
                  </Button>
                ) : null}
                <SubmitButton size="lg" pending={formState.isSubmitting} disabled={!canWrite}>
                  {mode === "create" ? "Crear experiencia" : "Guardar cambios"}
                </SubmitButton>
              </div>
            </div>
          </fieldset>
        </div>
      </form>
    </FormProvider>
  );
}

// -----------------------------------------------------------------------------
// Subcomponentes
// -----------------------------------------------------------------------------

type MoneyName = "basePriceCents" | "extraGuestPriceCents" | "extraGuestCostCents";

function MoneyField({
  control,
  name,
  label,
  required,
  disabled,
  error,
}: {
  control: Control<ExperienceFormValues>;
  name: MoneyName;
  label: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <Field label={label} required={required} error={error}>
      {(p) => (
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <MoneyInput
              {...p}
              value={field.value}
              onValueChange={(v) => field.onChange(v as number)}
              onBlur={field.onBlur}
              disabled={disabled}
            />
          )}
        />
      )}
    </Field>
  );
}

function RelationChips({
  control,
  name,
  legend,
  options,
  disabled,
  emptyText,
}: {
  control: Control<ExperienceFormValues>;
  name: "styleIds" | "serviceAreaIds" | "menuIds" | "addOnIds";
  legend: string;
  options: Array<{ id: string; name: string; active: boolean; hint?: string }>;
  disabled?: boolean;
  emptyText: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <FieldGroup legend={`${legend} (${field.value.length})`}>
          <ToggleChips
            options={options.map((o) => ({ value: o.id, label: o.name, inactive: !o.active, hint: o.hint }))}
            value={field.value}
            onChange={field.onChange}
            disabled={disabled}
            emptyText={emptyText}
          />
        </FieldGroup>
      )}
    />
  );
}

function CostTotal({ control }: { control: Control<ExperienceFormValues> }) {
  const [components, baseGuests] = useWatch({ control, name: ["costComponents", "baseGuests"] });
  const guests = Number.isFinite(baseGuests) && baseGuests > 0 ? baseGuests : 0;
  const total = (components ?? []).reduce((sum, c) => {
    const amount = Number.isFinite(c?.amountCents) ? c.amountCents : 0;
    return sum + (c?.perGuest ? amount * guests : amount);
  }, 0);
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">Costo base para {guests || "—"} personas: </span>
      <span className="tabular font-semibold">{formatMXN(total)}</span>
    </p>
  );
}

function useLivePreview(control: Control<ExperienceFormValues>, menus: MenuOption[], settings: EngineSettings, previewMenu: PreviewMenuChoice) {
  const [name, basePriceCents, baseGuests, minGuests, maxGuests, extraGuestPriceCents, extraGuestCostCents, costComponents, menuIds] =
    useWatch({
      control,
      name: [
        "name",
        "basePriceCents",
        "baseGuests",
        "minGuests",
        "maxGuests",
        "extraGuestPriceCents",
        "extraGuestCostCents",
        "costComponents",
        "menuIds",
      ],
    });
  return React.useMemo(() => {
    const selectedMenus = menus.filter((m) => (menuIds ?? []).includes(m.id));
    // Igual que el selector: si el menú elegido ya no está ligado, se vuelve a "Automático".
    const chosen = selectedMenus.find((m) => m.id === previewMenu);
    const menu = previewMenu === "none" ? null : (chosen ?? pickReferenceMenu(selectedMenus));
    return previewExperienceMargin(
      {
        name,
        basePriceCents,
        baseGuests,
        minGuests,
        maxGuests,
        extraGuestPriceCents,
        extraGuestCostCents,
        costComponents: (costComponents ?? []).map((c) => ({
          category: c.category,
          description: c.description,
          amountCents: c.amountCents,
          perGuest: c.perGuest,
        })),
      },
      settings,
      menu
        ? {
            id: menu.id,
            name: menu.name,
            pricingType: menu.pricingType,
            priceCents: menu.priceCents,
            costPerGuestCents: menu.costPerGuestCents,
          }
        : null,
    );
  }, [
    menus,
    menuIds,
    previewMenu,
    name,
    basePriceCents,
    baseGuests,
    minGuests,
    maxGuests,
    extraGuestPriceCents,
    extraGuestCostCents,
    costComponents,
    settings,
  ]);
}

function LiveMarginPanel(props: {
  control: Control<ExperienceFormValues>;
  menus: MenuOption[];
  settings: EngineSettings;
  previewMenu: PreviewMenuChoice;
}) {
  const preview = useLivePreview(props.control, props.menus, props.settings, props.previewMenu);
  return <MarginPreviewPanel preview={preview} />;
}

function LiveMarginChip(props: {
  control: Control<ExperienceFormValues>;
  menus: MenuOption[];
  settings: EngineSettings;
  previewMenu: PreviewMenuChoice;
}) {
  const preview = useLivePreview(props.control, props.menus, props.settings, props.previewMenu);
  return <MarginChip preview={preview} />;
}

function PreviewMenuPicker({
  control,
  menus,
  value,
  onChange,
}: {
  control: Control<ExperienceFormValues>;
  menus: MenuOption[];
  value: PreviewMenuChoice;
  onChange: (v: PreviewMenuChoice) => void;
}) {
  const menuIds = useWatch({ control, name: "menuIds" });
  const selected = menus.filter((m) => (menuIds ?? []).includes(m.id));
  const auto = pickReferenceMenu(selected);
  const id = React.useId();
  const current = value !== "auto" && value !== "none" && !selected.some((m) => m.id === value) ? "auto" : value;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        Simular con menú
      </Label>
      <Select value={current} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value="auto">Automático{auto ? ` (${auto.name})` : " (sin menú incluido)"}</SelectItem>
          <SelectItem value="none">Sin menú</SelectItem>
          {selected.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name} · {MENU_PRICING_LABELS[m.pricingType]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
