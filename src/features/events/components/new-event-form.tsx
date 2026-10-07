"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Check, Search, UserPlus, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OCCASION_LABELS, toOptions } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { createEventSchema, type CreateEventInput } from "../schemas";
import { checkEventAvailabilityAction, createEventAction, searchCustomersAction } from "../server/actions";
import type { CustomerSearchResult, EventFormOptions } from "../server/event-queries";
import { formatDuration } from "../domain/format";
import { AvailabilityHint, type AvailabilityView } from "./availability-hint";
import { fieldsetClass, inputSizeClass, legendClass, nativeSelectClass } from "./form-styles";

const DURATIONS = Array.from({ length: 15 }, (_, i) => 60 + i * 30); // 1 h … 8 h

type Customer = Pick<CustomerSearchResult, "id" | "name" | "email" | "phone" | "whatsapp">;

export function NewEventForm({
  options,
  defaultStartTime,
  minDate,
  initialCustomer,
  initialDate = "",
}: {
  options: Pick<EventFormOptions, "experiences" | "serviceAreas">;
  defaultStartTime: string;
  minDate: string;
  initialCustomer?: Customer | null;
  /** YYYY-MM-DD precargada (p. ej. desde el calendario) */
  initialDate?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Customer | null>(initialCustomer ?? null);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Customer[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [availability, setAvailability] = React.useState<AvailabilityView | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [needsConfirm, setNeedsConfirm] = React.useState<AvailabilityView | null>(null);
  const confirmRef = React.useRef<HTMLDivElement>(null);
  const [created, setCreated] = React.useState(false);

  const form = useForm<CreateEventInput>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      customerMode: "existing",
      customerId: initialCustomer?.id ?? "",
      newCustomer: { name: "", email: "", phone: "" },
      title: "",
      occasion: "BIRTHDAY",
      honoreeName: "",
      date: initialDate,
      startTime: defaultStartTime,
      durationMinutes: 180,
      experienceId: "",
      guestCount: 8,
      serviceAreaId: "",
      addressLine: "",
      neighborhood: "",
      postalCode: "",
      internalNotes: "",
      confirmUnavailable: false,
    },
  });
  const { errors, isSubmitting, dirtyFields } = form.formState;
  const mode = useWatch({ control: form.control, name: "customerMode" });
  const [date, startTime, durationMinutes, serviceAreaId, experienceId] = useWatch({
    control: form.control,
    name: ["date", "startTime", "durationMinutes", "serviceAreaId", "experienceId"],
  });

  // Búsqueda de clientas (debounce)
  React.useEffect(() => {
    if (mode !== "existing" || selected) return;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchCustomersAction({ q: term });
        if (!cancelled && res.ok) setResults(res.data);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, mode, selected]);

  // Disponibilidad en vivo
  React.useEffect(() => {
    setNeedsConfirm(null);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime ?? "")) {
      setAvailability(null);
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const res = await checkEventAvailabilityAction({
          date,
          startTime,
          durationMinutes: Number(durationMinutes) || 180,
          serviceAreaId: serviceAreaId ?? "",
          excludeEventId: "",
        });
        if (!cancelled) setAvailability(res.ok ? res.data : null);
      } catch {
        if (!cancelled) setAvailability(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [date, startTime, durationMinutes, serviceAreaId]);

  // Defaults según la experiencia elegida (sólo si no se han tocado)
  React.useEffect(() => {
    const exp = options.experiences.find((e) => e.id === experienceId);
    if (!exp) return;
    if (!dirtyFields.durationMinutes) {
      const rounded = Math.min(480, Math.max(60, Math.round(exp.durationMinutes / 30) * 30));
      form.setValue("durationMinutes", rounded);
    }
    if (!dirtyFields.guestCount) form.setValue("guestCount", exp.baseGuests);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experienceId]);

  function pickCustomer(c: Customer) {
    setSelected(c);
    setResults([]);
    setQuery("");
    form.setValue("customerId", c.id, { shouldValidate: true });
  }

  function clearCustomer() {
    setSelected(null);
    form.setValue("customerId", "");
  }

  function setMode(next: "existing" | "new") {
    form.setValue("customerMode", next, { shouldValidate: false });
    form.clearErrors(["customerId", "newCustomer"]);
  }

  async function submit(values: CreateEventInput, confirmUnavailable = false) {
    const res = await createEventAction({ ...values, confirmUnavailable });
    if (!handleActionResult(res, { form })) return;
    if (res.data.status === "needs_confirmation") {
      setNeedsConfirm(res.data.availability);
      requestAnimationFrame(() => confirmRef.current?.focus());
      return;
    }
    setCreated(true);
    toast.success(`Evento ${res.data.code} creado`);
    router.push(`/admin/events/${res.data.id}`);
  }

  const durationOptions = DURATIONS.includes(Number(durationMinutes))
    ? DURATIONS
    : [...DURATIONS, Number(durationMinutes)].sort((a, b) => a - b);

  return (
    <form onSubmit={form.handleSubmit((v) => submit(v))} noValidate className="space-y-6">
      {/* Clienta */}
      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Clienta</legend>
        <div role="group" aria-label="Tipo de clienta" className="flex flex-wrap gap-2">
          {(
            [
              { value: "existing", label: "Clienta existente", icon: UserRound },
              { value: "new", label: "Nueva clienta", icon: UserPlus },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={mode === opt.value}
              onClick={() => setMode(opt.value)}
              className={cn(
                "focus-visible:ring-ring/50 inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm transition-colors outline-none focus-visible:ring-3",
                mode === opt.value ? "border-olive/50 bg-sage-soft text-olive font-medium" : "hover:bg-muted",
              )}
            >
              <opt.icon className="size-4" aria-hidden />
              {opt.label}
            </button>
          ))}
        </div>

        {/*
          Cada variante lleva su `key`: al cambiar de modo se montan campos nuevos en lugar de reutilizar el
          <Field> de «Buscar clienta» para «Nombre». Reutilizado, el <label> conservaba el `for` del HTML del
          servidor mientras el <input> nuevo tomaba el id de useId del cliente; cuando ambos difieren (Firefox,
          hidratación en varias pasadas) «Nombre» quedaba sin etiqueta asociada (EVT-005).
        */}
        {mode === "existing" ? (
          selected ? (
            <div key="selected" className="bg-sand-soft/60 flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{selected.name}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {[selected.whatsapp ?? selected.phone, selected.email].filter(Boolean).join(" · ") ||
                    "Sin contacto"}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={clearCustomer}>
                <X aria-hidden />
                Cambiar
              </Button>
            </div>
          ) : (
            <div key="search" className="space-y-2">
              <Field
                label="Buscar clienta"
                required
                description="Por nombre, correo o teléfono."
                error={errors.customerId?.message}
              >
                {(p) => (
                  <div className="relative">
                    <Search
                      className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
                      aria-hidden
                    />
                    <Input
                      {...p}
                      type="search"
                      autoComplete="off"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Ej. Sofía, sofia@correo.com, 5512…"
                      className={`${inputSizeClass} pl-8`}
                      aria-controls="customer-results"
                    />
                  </div>
                )}
              </Field>
              <div id="customer-results" aria-live="polite">
                {searching ? <p className="text-muted-foreground text-sm">Buscando…</p> : null}
                {!searching && query.trim().length >= 2 && results.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No encontramos clientas con “{query.trim()}”.{" "}
                    <button
                      type="button"
                      className="text-olive font-medium underline"
                      onClick={() => setMode("new")}
                    >
                      Registrar nueva clienta
                    </button>
                  </p>
                ) : null}
                {results.length > 0 ? (
                  <ul className="divide-y rounded-lg border" aria-label="Resultados de búsqueda">
                    {results.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => pickCustomer(c)}
                          className="hover:bg-muted focus-visible:bg-muted flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left outline-none"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{c.name}</span>
                            <span className="text-muted-foreground block truncate text-xs">
                              {[c.whatsapp ?? c.phone, c.email].filter(Boolean).join(" · ") || "Sin contacto"}
                            </span>
                          </span>
                          <Check className="text-muted-foreground size-4 shrink-0" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          )
        ) : (
          <div key="new" className="grid gap-4 sm:grid-cols-3">
            <Field label="Nombre" required error={errors.newCustomer?.name?.message}>
              {(p) => (
                <Input
                  {...p}
                  {...form.register("newCustomer.name")}
                  autoComplete="name"
                  className={inputSizeClass}
                />
              )}
            </Field>
            <Field label="WhatsApp" error={errors.newCustomer?.phone?.message} description="10 dígitos.">
              {(p) => (
                <Input
                  {...p}
                  {...form.register("newCustomer.phone")}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className={inputSizeClass}
                />
              )}
            </Field>
            <Field label="Correo" error={errors.newCustomer?.email?.message}>
              {(p) => (
                <Input
                  {...p}
                  {...form.register("newCustomer.email")}
                  type="email"
                  autoComplete="email"
                  className={inputSizeClass}
                />
              )}
            </Field>
          </div>
        )}
      </fieldset>

      {/* Celebración */}
      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Celebración</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Título del evento" required error={errors.title?.message} className="sm:col-span-2">
            {(p) => (
              <Input
                {...p}
                {...form.register("title")}
                placeholder="Ej. Cumpleaños de Sofía"
                className={inputSizeClass}
              />
            )}
          </Field>
          <Field label="Ocasión" required error={errors.occasion?.message}>
            {(p) => (
              <select
                {...p}
                {...form.register("occasion")}
                defaultValue="BIRTHDAY"
                className={nativeSelectClass}
              >
                {toOptions(OCCASION_LABELS).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Homenajeada" error={errors.honoreeName?.message}>
            {(p) => <Input {...p} {...form.register("honoreeName")} className={inputSizeClass} />}
          </Field>
          <Field label="Experiencia" error={errors.experienceId?.message}>
            {(p) => (
              <select {...p} {...form.register("experienceId")} className={nativeSelectClass}>
                <option value="">Por definir</option>
                {options.experiences.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.active ? "" : " (inactiva)"}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Invitadas" required error={errors.guestCount?.message}>
            {(p) => (
              <Input
                {...p}
                {...form.register("guestCount", { valueAsNumber: true })}
                defaultValue={8}
                type="number"
                inputMode="numeric"
                min={1}
                max={200}
                className={inputSizeClass}
              />
            )}
          </Field>
        </div>
      </fieldset>

      {/* Fecha y lugar */}
      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Fecha y lugar</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Fecha" required error={errors.date?.message}>
            {(p) => (
              <Input
                {...p}
                {...form.register("date")}
                defaultValue={initialDate}
                type="date"
                min={minDate}
                className={inputSizeClass}
              />
            )}
          </Field>
          <Field label="Hora de inicio" required error={errors.startTime?.message}>
            {(p) => (
              <Input
                {...p}
                {...form.register("startTime")}
                defaultValue={defaultStartTime}
                type="time"
                step={900}
                className={inputSizeClass}
              />
            )}
          </Field>
          <Field label="Duración" required error={errors.durationMinutes?.message}>
            {(p) => (
              <select
                {...p}
                {...form.register("durationMinutes", { setValueAs: (v) => Number(v) })}
                defaultValue={180}
                className={nativeSelectClass}
              >
                {durationOptions.map((d) => (
                  <option key={d} value={d}>
                    {formatDuration(d)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <AvailabilityHint result={availability} loading={checking} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Zona" error={errors.serviceAreaId?.message}>
            {(p) => (
              <select {...p} {...form.register("serviceAreaId")} className={nativeSelectClass}>
                <option value="">Por definir</option>
                {options.serviceAreas.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                    {z.active ? "" : " (inactiva)"}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Dirección" error={errors.addressLine?.message}>
            {(p) => (
              <Input
                {...p}
                {...form.register("addressLine")}
                autoComplete="street-address"
                className={inputSizeClass}
              />
            )}
          </Field>
          <Field label="Colonia" error={errors.neighborhood?.message}>
            {(p) => <Input {...p} {...form.register("neighborhood")} className={inputSizeClass} />}
          </Field>
          <Field label="Código postal" error={errors.postalCode?.message}>
            {(p) => (
              <Input
                {...p}
                {...form.register("postalCode")}
                inputMode="numeric"
                maxLength={5}
                autoComplete="postal-code"
                className={inputSizeClass}
              />
            )}
          </Field>
        </div>
      </fieldset>

      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Notas internas</legend>
        <Field
          label="Notas para el equipo"
          error={errors.internalNotes?.message}
          description="No las ve la clienta."
        >
          {(p) => <Textarea {...p} {...form.register("internalNotes")} rows={3} />}
        </Field>
      </fieldset>

      {needsConfirm ? (
        <div
          ref={confirmRef}
          tabIndex={-1}
          role="alert"
          className="border-warning/40 bg-warning/10 space-y-3 rounded-xl border p-4 outline-none"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="text-warning mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">La fecha no está disponible: {needsConfirm.reason}</p>
              <p className="text-muted-foreground text-sm">
                Puedes registrar el evento de todos modos (queda como consulta y no ocupa capacidad hasta
                confirmarse).
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={isSubmitting || created}
              onClick={form.handleSubmit((v) => submit(v, true))}
            >
              Crear de todos modos
            </Button>
            <Button type="button" variant="ghost" onClick={() => setNeedsConfirm(null)}>
              Elegir otra fecha
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="lg" onClick={() => router.push("/admin/events")}>
          Cancelar
        </Button>
        <SubmitButton size="xl" pending={isSubmitting || created} pendingText="Creando…">
          Crear evento
        </SubmitButton>
      </div>
    </form>
  );
}
