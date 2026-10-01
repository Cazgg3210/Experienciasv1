"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calculator, Loader2, UserPlus, Users } from "lucide-react";
import { Field, FormError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ADDON_CATEGORY_LABELS, ADDON_PRICING_LABELS, MENU_PRICING_LABELS, OCCASION_LABELS } from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { QuoteResult } from "../domain/quote-engine";
import { defaultQuoteTitle } from "../domain/quote-lines";
import { createQuoteSchema, OCCASIONS, type CreateQuoteData, type CreateQuoteInput } from "../schemas";
import { createQuoteAction, previewQuoteAction } from "../server/actions";
import type { LeadPrefill, QuoteFormOptions } from "../server/quote-queries";
import { CustomerPicker, type PickedCustomer } from "./customer-picker";
import { NativeSelect, PercentInput, QuantityInput } from "./form-controls";
import { EngineWarnings, MarginAlert, TotalsSummary } from "./quote-ui";

type Props = { options: QuoteFormOptions; prefill: LeadPrefill | null };

function Card({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("bg-card space-y-4 rounded-2xl border p-4 sm:p-6", className)} aria-label={title}>
      <div>
        <h2 className="font-heading text-xl font-semibold">{title}</h2>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function QuoteForm({ options, prefill }: Props) {
  const router = useRouter();
  const [picked, setPicked] = React.useState<PickedCustomer | null>(prefill?.customer ?? null);
  const [titleTouched, setTitleTouched] = React.useState(false);
  const [preview, setPreview] = React.useState<QuoteResult | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [showAllAddOns, setShowAllAddOns] = React.useState(false);
  const previewReq = React.useRef(0);

  const firstExperience = options.experiences.find((e) => e.active) ?? options.experiences[0];
  const defaultExperienceId = prefill?.experienceId ?? firstExperience?.id ?? "";
  const defaultMenuId =
    prefill?.menuId ?? options.experiences.find((e) => e.id === defaultExperienceId)?.menuIds[0] ?? "";

  const form = useForm<CreateQuoteInput, unknown, CreateQuoteData>({
    resolver: zodResolver(createQuoteSchema),
    defaultValues: {
      leadId: prefill?.leadId ?? null,
      customerMode: prefill && !prefill.customer ? "new" : "existing",
      customerId: prefill?.customer?.id ?? null,
      newCustomer:
        prefill && !prefill.customer
          ? { name: prefill.contact.name, email: prefill.contact.email ?? "", phone: prefill.contact.phone ?? "" }
          : null,
      title: "",
      occasion: prefill?.occasion ?? "BIRTHDAY",
      eventDate: prefill?.eventDate ?? "",
      startTime: prefill?.startTime ?? "",
      guestCount: prefill?.guestCount ?? firstExperience?.baseGuests ?? 8,
      serviceAreaId: prefill?.serviceAreaId ?? "",
      experienceId: defaultExperienceId,
      styleId: prefill?.styleId ?? "",
      menuId: defaultMenuId,
      addOns: prefill?.addOns ?? [],
      depositBps: options.pricing.depositBps,
      notesForCustomer: "",
      internalNotes: prefill?.notes ? `Notas del lead: ${prefill.notes}` : "",
    },
  });
  const { register, control, setValue, formState } = form;
  const errors = formState.errors;

  const [customerMode, occasion, experienceId, guestCount, menuId, serviceAreaId, addOns, depositBps, newName] = useWatch({
    control,
    name: ["customerMode", "occasion", "experienceId", "guestCount", "menuId", "serviceAreaId", "addOns", "depositBps", "newCustomer.name"],
  });
  const experience = options.experiences.find((e) => e.id === experienceId);

  // Título por defecto: "<Ocasión> de <homenajeada/nombre>" mientras no se edite a mano
  const who = prefill?.honoreeName || (customerMode === "existing" ? picked?.name : newName) || "";
  React.useEffect(() => {
    if (titleTouched) return;
    setValue("title", defaultQuoteTitle(OCCASION_LABELS[occasion], who));
  }, [occasion, who, titleTouched, setValue]);

  // Recalcular en vivo (servidor)
  const selectionKey = JSON.stringify({ experienceId, guestCount, menuId, serviceAreaId, addOns, depositBps });
  React.useEffect(() => {
    const sel = JSON.parse(selectionKey) as {
      experienceId: string;
      guestCount: number;
      menuId?: string | null;
      serviceAreaId?: string | null;
      addOns?: Array<{ addOnId: string; quantity: number }>;
      depositBps: number;
    };
    if (!sel.experienceId || !Number.isInteger(sel.guestCount) || sel.guestCount < 1) {
      previewReq.current++;
      setPreview(null);
      setPreviewing(false);
      return;
    }
    const id = ++previewReq.current;
    setPreviewing(true);
    const t = setTimeout(async () => {
      const res = await previewQuoteAction({
        experienceId: sel.experienceId,
        guestCount: sel.guestCount,
        menuId: sel.menuId || null,
        serviceAreaId: sel.serviceAreaId || null,
        addOns: sel.addOns ?? [],
        depositBps: sel.depositBps,
      });
      if (id !== previewReq.current) return;
      setPreviewing(false);
      if (res.ok) {
        setPreview(res.data);
        setPreviewError(null);
      } else {
        setPreviewError(res.error);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [selectionKey]);

  const compatibleMenus = options.menus.filter((m) => experience?.menuIds.includes(m.id));
  const otherMenus = options.menus.filter((m) => !experience?.menuIds.includes(m.id));
  const compatibleAddOns = options.addOns.filter((a) => experience?.addOnIds.includes(a.id));
  const otherAddOns = options.addOns.filter((a) => !experience?.addOnIds.includes(a.id));
  const selectedOther = otherAddOns.some((a) => (addOns ?? []).some((x) => x.addOnId === a.id));
  const visibleAddOns = showAllAddOns || selectedOther ? [...compatibleAddOns, ...otherAddOns] : compatibleAddOns;

  async function onSubmit(values: CreateQuoteData) {
    const payload: CreateQuoteData =
      values.customerMode === "existing"
        ? { ...values, newCustomer: null }
        : { ...values, customerId: null };
    const res = await createQuoteAction(payload);
    if (handleActionResult(res, { form, success: `Cotización ${res.ok ? res.data.code : ""} creada` })) {
      router.push(`/admin/quotes/${res.data.id}`);
    }
  }

  const rootError = errors.root?.message;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-6">
        <FormError message={rootError} />
        {prefill ? (
          <p className="bg-sage-soft/60 text-olive rounded-xl border px-4 py-2.5 text-sm">
            Datos precargados del lead <span className="font-mono font-medium">{prefill.leadCode}</span>. Revisa y ajusta antes de crear.
          </p>
        ) : null}

        <Card title="Clienta" description="Elige una clienta existente o regístrala en un momento.">
          <div className="bg-muted inline-flex rounded-full p-1" role="group" aria-label="Tipo de clienta">
            {(
              [
                { v: "existing", label: "Clienta existente", icon: Users },
                { v: "new", label: "Clienta nueva", icon: UserPlus },
              ] as const
            ).map((opt) => (
              <button
                key={opt.v}
                type="button"
                aria-pressed={customerMode === opt.v}
                onClick={() => setValue("customerMode", opt.v, { shouldValidate: formState.isSubmitted })}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm transition-colors",
                  customerMode === opt.v ? "bg-card font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <opt.icon className="size-4" aria-hidden />
                {opt.label}
              </button>
            ))}
          </div>
          {customerMode === "existing" ? (
            <Field label="Buscar clienta" required error={errors.customerId?.message}>
              {(p) => (
                <CustomerPicker
                  inputId={p.id}
                  value={picked}
                  invalid={p["aria-invalid"]}
                  describedBy={p["aria-describedby"]}
                  onChange={(c) => {
                    setPicked(c);
                    setValue("customerId", c?.id ?? null, { shouldValidate: formState.isSubmitted });
                  }}
                />
              )}
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Nombre completo" required error={errors.newCustomer?.name?.message} className="sm:col-span-3">
                {(p) => <Input {...p} autoComplete="off" {...register("newCustomer.name")} />}
              </Field>
              <Field label="Email" error={errors.newCustomer?.email?.message} className="sm:col-span-2">
                {(p) => <Input {...p} type="email" autoComplete="off" {...register("newCustomer.email")} />}
              </Field>
              <Field label="Teléfono / WhatsApp" error={errors.newCustomer?.phone?.message}>
                {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="off" {...register("newCustomer.phone")} />}
              </Field>
            </div>
          )}
        </Card>

        <Card title="Celebración">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ocasión" required error={errors.occasion?.message}>
              {(p) => (
                <NativeSelect {...p} {...register("occasion")}>
                  {OCCASIONS.map((o) => (
                    <option key={o} value={o}>
                      {OCCASION_LABELS[o]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="Título de la propuesta" error={errors.title?.message} description="Se genera solo; puedes cambiarlo.">
              {(p) => (
                <Input
                  {...p}
                  {...register("title", { onChange: () => setTitleTouched(true) })}
                  maxLength={140}
                />
              )}
            </Field>
            <Field label="Fecha del evento" error={errors.eventDate?.message} description="Necesaria para enviar la propuesta.">
              {(p) => <Input {...p} type="date" className="h-9" {...register("eventDate")} />}
            </Field>
            <Field label="Hora de inicio" error={errors.startTime?.message}>
              {(p) => <Input {...p} type="time" step={900} className="h-9" {...register("startTime")} />}
            </Field>
            <Field
              label="Invitadas"
              required
              error={errors.guestCount?.message}
              description={
                experience
                  ? `Incluye ${experience.baseGuests}; recomendado ${experience.minGuests}–${experience.maxGuests}.`
                  : undefined
              }
            >
              {(p) => (
                <Input {...p} type="number" min={1} max={200} inputMode="numeric" className="h-9" {...register("guestCount", { valueAsNumber: true })} />
              )}
            </Field>
            <Field label="Zona" error={errors.serviceAreaId?.message}>
              {(p) => (
                <NativeSelect {...p} {...register("serviceAreaId")}>
                  <option value="">Sin zona (sin logística)</option>
                  {options.serviceAreas.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                      {z.logisticsFeeCents ? ` · ${formatMXN(z.logisticsFeeCents)}` : ""}
                      {z.active ? "" : " (inactiva)"}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          </div>
        </Card>

        <Card title="Experiencia" description="Los precios se calculan en servidor con el catálogo vigente.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Experiencia" required error={errors.experienceId?.message} className="sm:col-span-2">
              {(p) => (
                <NativeSelect
                  {...p}
                  {...register("experienceId", {
                    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
                      const exp = options.experiences.find((x) => x.id === e.target.value);
                      if (exp && menuId && !exp.menuIds.includes(menuId)) setValue("menuId", exp.menuIds[0] ?? "");
                      if (exp && !menuId) setValue("menuId", exp.menuIds[0] ?? "");
                    },
                  })}
                >
                  {options.experiences.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} · {formatMXN(e.basePriceCents)} ({e.baseGuests} personas){e.active ? "" : " — inactiva"}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="Estilo" error={errors.styleId?.message}>
              {(p) => (
                <NativeSelect {...p} {...register("styleId")}>
                  <option value="">Sin estilo definido</option>
                  {options.styles.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.active ? "" : " (inactivo)"}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="Menú" error={errors.menuId?.message}>
              {(p) => (
                <NativeSelect {...p} {...register("menuId")}>
                  <option value="">Sin menú</option>
                  {compatibleMenus.length ? (
                    <optgroup label="De esta experiencia">
                      {compatibleMenus.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} · {MENU_PRICING_LABELS[m.pricingType]}
                          {m.pricingType !== "INCLUDED" ? ` ${formatMXN(m.priceCents)}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {otherMenus.length ? (
                    <optgroup label="Otros menús">
                      {otherMenus.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} · {MENU_PRICING_LABELS[m.pricingType]}
                          {m.pricingType !== "INCLUDED" ? ` ${formatMXN(m.priceCents)}` : ""}
                          {m.active ? "" : " (inactivo)"}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </NativeSelect>
              )}
            </Field>
          </div>

          <Controller
            control={control}
            name="addOns"
            render={({ field }) => {
              const list = field.value ?? [];
              const toggle = (id: string, on: boolean) =>
                field.onChange(on ? [...list, { addOnId: id, quantity: 1 }] : list.filter((x) => x.addOnId !== id));
              const setQty = (id: string, q: number) =>
                field.onChange(list.map((x) => (x.addOnId === id ? { ...x, quantity: q } : x)));
              return (
                <fieldset className="space-y-2">
                  <legend className="mb-2 text-sm font-medium">Add-ons</legend>
                  {visibleAddOns.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Esta experiencia no tiene add-ons asociados.</p>
                  ) : (
                    <ul className="divide-y rounded-xl border">
                      {visibleAddOns.map((a) => {
                        const sel = list.find((x) => x.addOnId === a.id);
                        const cbId = `addon-${a.id}`;
                        const compatible = experience?.addOnIds.includes(a.id);
                        return (
                          <li key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                            <Checkbox id={cbId} checked={!!sel} onCheckedChange={(v) => toggle(a.id, v === true)} />
                            <label htmlFor={cbId} className="min-w-0 flex-1 cursor-pointer text-sm">
                              <span className="font-medium">{a.name}</span>
                              <span className="text-muted-foreground block text-xs">
                                {ADDON_CATEGORY_LABELS[a.category]} · {ADDON_PRICING_LABELS[a.pricingType]} {formatMXN(a.priceCents)}
                                {!compatible ? " · fuera de la experiencia" : ""}
                                {!a.active ? " · inactivo" : ""}
                              </span>
                            </label>
                            {sel && a.maxQuantity > 1 ? (
                              <QuantityInput
                                label={`Cantidad de ${a.name}`}
                                value={sel.quantity}
                                min={1}
                                max={a.maxQuantity}
                                onValueChange={(q) => setQty(a.id, q)}
                              />
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {otherAddOns.length && !selectedOther ? (
                    <button
                      type="button"
                      className="text-olive text-sm underline underline-offset-2"
                      onClick={() => setShowAllAddOns((v) => !v)}
                      aria-expanded={showAllAddOns}
                    >
                      {showAllAddOns ? "Mostrar sólo los de esta experiencia" : `Ver otros add-ons (${otherAddOns.length})`}
                    </button>
                  ) : null}
                  {errors.addOns ? <p className="text-destructive text-xs" role="alert">Revisa las cantidades de los add-ons.</p> : null}
                </fieldset>
              );
            }}
          />
        </Card>

        <Card title="Condiciones y notas">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Anticipo" required error={errors.depositBps?.message} description="Porcentaje para apartar la fecha.">
              {(p) => (
                <Controller
                  control={control}
                  name="depositBps"
                  render={({ field }) => <PercentInput {...p} value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} />}
                />
              )}
            </Field>
            <p className="text-muted-foreground text-sm sm:col-span-2 sm:self-center">
              La vigencia será de {options.pricing.quoteValidityDays} días a partir de hoy; podrás ajustarla antes de enviar.
            </p>
            <Field label="Notas para la clienta" error={errors.notesForCustomer?.message} className="sm:col-span-3" description="Aparecen en la propuesta pública.">
              {(p) => <Textarea {...p} rows={3} maxLength={2000} {...register("notesForCustomer")} />}
            </Field>
            <Field label="Notas internas" error={errors.internalNotes?.message} className="sm:col-span-3" description="Sólo las ve el equipo.">
              {(p) => <Textarea {...p} rows={3} maxLength={2000} {...register("internalNotes")} />}
            </Field>
          </div>
        </Card>
      </div>

      <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start" aria-label="Cálculo en vivo">
        <div className="bg-card space-y-4 rounded-2xl border p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading flex items-center gap-2 text-xl font-semibold">
              <Calculator className="text-olive size-5" aria-hidden /> Cálculo en vivo
            </h2>
            {previewing ? <Loader2 className="text-muted-foreground size-4 animate-spin" aria-label="Recalculando" /> : null}
          </div>
          <div aria-live="polite" className="space-y-4">
            {previewError ? (
              <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm">{previewError}</p>
            ) : null}
            {preview ? (
              <>
                <ul className="divide-y text-sm">
                  {preview.lines.map((l, i) => (
                    <li key={`${l.type}-${l.refId ?? i}-${i}`} className="flex items-start justify-between gap-3 py-1.5">
                      <span className="min-w-0">
                        {l.description}
                        {l.quantity > 1 ? <span className="text-muted-foreground"> × {l.quantity}</span> : null}
                      </span>
                      <span className="tabular shrink-0">{formatMXN(l.totalPriceCents)}</span>
                    </li>
                  ))}
                </ul>
                <TotalsSummary
                  totals={preview}
                  minMarginBps={options.pricing.minMarginBps}
                />
                <MarginAlert
                  marginBps={preview.marginBps}
                  marginCents={preview.estimatedMarginCents}
                  minMarginBps={options.pricing.minMarginBps}
                />
                <EngineWarnings warnings={preview.warnings} />
              </>
            ) : !previewError ? (
              <p className="text-muted-foreground text-sm">Elige experiencia e invitadas para ver el cálculo.</p>
            ) : null}
          </div>
          <SubmitButton pending={formState.isSubmitting} pendingText="Creando…" size="xl" className="w-full">
            Crear cotización
          </SubmitButton>
          <p className="text-muted-foreground text-center text-xs">Se guarda como borrador; podrás editar conceptos antes de enviarla.</p>
        </div>
      </aside>
    </form>
  );
}
