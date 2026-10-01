"use client";

import * as React from "react";
import { useForm, useWatch, type RegisterOptions } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Save } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { OCCASION_LABELS, toOptions } from "@/lib/labels";
import { updateEventSchema, type UpdateEventInput } from "../schemas";
import { updateEventAction } from "../server/actions";
import type { EventFormOptions } from "../server/event-queries";
import type { AvailabilityView } from "./availability-hint";
import { fieldsetClass, inputSizeClass, legendClass, nativeSelectClass } from "./form-styles";

type RegField = Exclude<keyof UpdateEventInput, "micrositeEnabled" | "confirmUnavailable">;

const FIELD_LABELS: Record<string, string> = {
  eventDate: "fecha",
  startsAt: "hora de inicio",
  endsAt: "hora de fin",
  guestCount: "invitadas",
  experienceId: "experiencia",
  menuId: "menú",
  serviceAreaId: "zona",
};

export function EventEditForm({
  defaultValues,
  options,
  scheduleLocked,
  hasBooking = false,
}: {
  defaultValues: UpdateEventInput;
  options: EventFormOptions;
  scheduleLocked: boolean;
  hasBooking?: boolean;
}) {
  const [needsConfirm, setNeedsConfirm] = React.useState<AvailabilityView | null>(null);
  const alertRef = React.useRef<HTMLDivElement>(null);
  const form = useForm<UpdateEventInput>({ resolver: zodResolver(updateEventSchema), defaultValues });
  const { errors, isSubmitting, isDirty } = form.formState;
  const experienceId = useWatch({ control: form.control, name: "experienceId" });
  const micrositeEnabled = useWatch({ control: form.control, name: "micrositeEnabled" });

  /** register + defaultValue para que el HTML del servidor ya muestre los valores (sin "parpadeo" vacío). */
  const reg = <K extends RegField>(name: K, opts?: RegisterOptions<UpdateEventInput, K>) => ({
    ...form.register(name, opts),
    defaultValue: String(defaultValues[name] ?? ""),
  });

  // Si el formulario se reinicia con datos nuevos del servidor (revalidación), sincronizar.
  React.useEffect(() => {
    form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(defaultValues)]);

  const menus = React.useMemo(() => {
    const forExp = experienceId ? options.menus.filter((m) => m.experienceIds.includes(experienceId)) : [];
    const list = forExp.length ? forExp : options.menus;
    const current = options.menus.find((m) => m.id === defaultValues.menuId);
    return current && !list.includes(current) ? [...list, current] : list;
  }, [experienceId, options.menus, defaultValues.menuId]);

  async function submit(values: UpdateEventInput, confirmUnavailable = false) {
    const res = await updateEventAction({ ...values, confirmUnavailable });
    if (!handleActionResult(res, { form })) return;
    if (res.data.status === "needs_confirmation") {
      setNeedsConfirm(res.data.availability);
      requestAnimationFrame(() => alertRef.current?.focus());
      return;
    }
    setNeedsConfirm(null);
    if (res.data.status === "unchanged") {
      toast.info("No hubo cambios que guardar");
      return;
    }
    const sensitive = res.data.changed.filter((f) => FIELD_LABELS[f]).map((f) => FIELD_LABELS[f]);
    const { staffShifts, checklistItems } = res.data.shifted;
    const moved = [
      staffShifts ? `${staffShifts} turno${staffShifts === 1 ? "" : "s"} de staff` : null,
      checklistItems ? `${checklistItems} tarea${checklistItems === 1 ? "" : "s"} del checklist` : null,
    ].filter(Boolean);
    toast.success(
      sensitive.length
        ? `Evento actualizado (${sensitive.join(", ")} quedó registrado en bitácora)`
        : "Evento actualizado",
      moved.length
        ? { description: `También se movieron ${moved.join(" y ")} al nuevo horario.` }
        : undefined,
    );
    form.reset(values);
  }

  const text = (name: RegField, label: string, opts: { type?: string; placeholder?: string } = {}) => (
    <Field label={label} error={errors[name]?.message as string | undefined}>
      {(p) => (
        <Input
          {...p}
          {...reg(name)}
          type={opts.type ?? "text"}
          placeholder={opts.placeholder}
          className={inputSizeClass}
        />
      )}
    </Field>
  );

  return (
    <form
      onSubmit={form.handleSubmit((v) => submit(v))}
      noValidate
      className="space-y-6"
      aria-label="Detalles del evento"
    >
      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Fecha y horario</legend>
        {scheduleLocked ? (
          <p className="text-muted-foreground text-sm">Este evento ya no se puede reprogramar.</p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Al cambiar fecha u horario revisamos disponibilidad y el cambio queda en la bitácora.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Fecha" required error={errors.date?.message}>
            {(p) => (
              <Input
                {...p}
                {...reg("date")}
                type="date"
                readOnly={scheduleLocked}
                className={inputSizeClass}
              />
            )}
          </Field>
          <Field label="Hora de inicio" required error={errors.startTime?.message}>
            {(p) => (
              <Input
                {...p}
                {...reg("startTime")}
                type="time"
                step={900}
                readOnly={scheduleLocked}
                className={inputSizeClass}
              />
            )}
          </Field>
          <Field label="Hora de fin" required error={errors.endTime?.message}>
            {(p) => (
              <Input
                {...p}
                {...reg("endTime")}
                type="time"
                step={900}
                readOnly={scheduleLocked}
                className={inputSizeClass}
              />
            )}
          </Field>
        </div>
      </fieldset>

      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Celebración</legend>
        {hasBooking ? (
          <p className="text-muted-foreground text-sm">
            Este evento ya tiene reserva: cambiar invitadas, experiencia o menú no recalcula el total. Ajusta
            la cotización o registra el cargo desde Finanzas.
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Título" required error={errors.title?.message} className="sm:col-span-2">
            {(p) => <Input {...p} {...reg("title")} className={inputSizeClass} />}
          </Field>
          <Field label="Ocasión" error={errors.occasion?.message}>
            {(p) => (
              <select {...p} {...reg("occasion")} className={nativeSelectClass}>
                {toOptions(OCCASION_LABELS).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {text("honoreeName", "Homenajeada")}
          <Field label="Invitadas" required error={errors.guestCount?.message}>
            {(p) => (
              <Input
                {...p}
                {...reg("guestCount", { valueAsNumber: true })}
                type="number"
                inputMode="numeric"
                min={1}
                max={200}
                className={inputSizeClass}
              />
            )}
          </Field>
          <Field label="Experiencia" error={errors.experienceId?.message}>
            {(p) => (
              <select {...p} {...reg("experienceId")} className={nativeSelectClass}>
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
          <Field label="Menú" error={errors.menuId?.message}>
            {(p) => (
              <select {...p} {...reg("menuId")} className={nativeSelectClass}>
                <option value="">Por definir</option>
                {menus.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.active ? "" : " (inactivo)"}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Estilo" error={errors.styleId?.message}>
            {(p) => (
              <select {...p} {...reg("styleId")} className={nativeSelectClass}>
                <option value="">Por definir</option>
                {options.styles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.active ? "" : " (inactivo)"}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </fieldset>

      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Lugar</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Zona" error={errors.serviceAreaId?.message}>
            {(p) => (
              <select {...p} {...reg("serviceAreaId")} className={nativeSelectClass}>
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
          {text("addressLine", "Dirección")}
          {text("neighborhood", "Colonia")}
          <Field label="Código postal" error={errors.postalCode?.message}>
            {(p) => (
              <Input
                {...p}
                {...reg("postalCode")}
                inputMode="numeric"
                maxLength={5}
                className={inputSizeClass}
              />
            )}
          </Field>
          <div className="sm:col-span-2">
            {text("mapsUrl", "Liga de Google Maps", {
              type: "url",
              placeholder: "https://maps.app.goo.gl/…",
            })}
          </div>
          <Field
            label="Notas de acceso"
            error={errors.addressNotes?.message}
            description="Caseta, estacionamiento, piso, a quién preguntar…"
            className="sm:col-span-2"
          >
            {(p) => <Textarea {...p} {...reg("addressNotes")} rows={2} />}
          </Field>
        </div>
      </fieldset>

      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Micrositio e invitadas</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Colores" error={errors.colors?.message} description="Separados por coma.">
            {(p) => (
              <Input
                {...p}
                {...reg("colors")}
                placeholder="Rosa palo, salvia, dorado"
                className={inputSizeClass}
              />
            )}
          </Field>
          {text("dressCode", "Código de vestimenta")}
          <Field
            label="Mensaje de la anfitriona"
            error={errors.hostMessage?.message}
            className="sm:col-span-2"
          >
            {(p) => <Textarea {...p} {...reg("hostMessage")} rows={3} />}
          </Field>
          <div className="sm:col-span-2">
            {text("playlistUrl", "Playlist", { type: "url", placeholder: "https://open.spotify.com/…" })}
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5 sm:col-span-2">
            <div>
              <label htmlFor="micrositeEnabled" className="text-sm font-medium">
                Micrositio activo
              </label>
              <p className="text-muted-foreground text-xs">
                Si lo desactivas, el link de invitación deja de funcionar.
              </p>
            </div>
            <Switch
              id="micrositeEnabled"
              checked={micrositeEnabled}
              onCheckedChange={(v) => form.setValue("micrositeEnabled", v, { shouldDirty: true })}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className={fieldsetClass}>
        <legend className={legendClass}>Notas</legend>
        <div className="grid gap-4">
          <Field label="Notas de la clienta" error={errors.customerNotes?.message}>
            {(p) => <Textarea {...p} {...reg("customerNotes")} rows={3} />}
          </Field>
          <Field
            label="Notas internas"
            error={errors.internalNotes?.message}
            description="Sólo las ve el equipo."
          >
            {(p) => <Textarea {...p} {...reg("internalNotes")} rows={3} />}
          </Field>
        </div>
      </fieldset>

      {needsConfirm ? (
        <div
          ref={alertRef}
          tabIndex={-1}
          role="alert"
          className="border-warning/40 bg-warning/10 space-y-3 rounded-xl border p-4 outline-none"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="text-warning mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">El nuevo horario no está disponible: {needsConfirm.reason}</p>
              <p className="text-muted-foreground text-sm">
                {needsConfirm.capacity > 0
                  ? `Capacidad del día: ${needsConfirm.booked} de ${needsConfirm.capacity} ocupados (sin contar este evento).`
                  : "Ese día no hay capacidad configurada."}{" "}
                Puedes guardar de todos modos si ya lo acordaste con el equipo.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={isSubmitting} onClick={form.handleSubmit((v) => submit(v, true))}>
              Guardar de todos modos
            </Button>
            <Button type="button" variant="ghost" onClick={() => setNeedsConfirm(null)}>
              Revisar
            </Button>
          </div>
        </div>
      ) : null}

      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-3 border-t px-1 py-3 backdrop-blur">
        {isDirty ? (
          <p className="text-muted-foreground mr-auto text-sm" role="status">
            Tienes cambios sin guardar
          </p>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          disabled={!isDirty || isSubmitting}
          onClick={() => form.reset(defaultValues)}
        >
          Descartar
        </Button>
        <SubmitButton pending={isSubmitting} size="lg" disabled={!isDirty}>
          <Save aria-hidden />
          Guardar cambios
        </SubmitButton>
      </div>
    </form>
  );
}
