"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, Check, HeartHandshake, Music2, Pencil } from "lucide-react";
import type { DietaryRestriction, RsvpStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { DIETARY_LABELS, RSVP_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { DIETARY_VALUES, rsvpFormSchema, type RsvpFormValues } from "../schemas";
import { confirmationCopy, firstName } from "../domain/rsvp";
import { submitRsvpAction } from "../server/actions";

export type RsvpGuestPrefill = {
  name: string;
  /** Email registrado, enmascarado (el completo nunca llega al navegador) */
  emailHint: string | null;
  rsvpStatus: RsvpStatus;
  plusOne: boolean;
  plusOneName: string | null;
  dietaryRestrictions: DietaryRestriction[];
  dietaryNotes: string | null;
  comment: string | null;
  photoConsent: boolean;
  honoreeMessage: string | null;
  responded: boolean;
};

const ANSWERS: Array<{ value: "ATTENDING" | "MAYBE" | "NOT_ATTENDING"; title: string; hint: string }> = [
  { value: "ATTENDING", title: "¡Sí, ahí estaré!", hint: "Cuenta conmigo" },
  { value: "MAYBE", title: "Tal vez", hint: "Te confirmo pronto" },
  { value: "NOT_ATTENDING", title: "No podré ir", hint: "Las acompaño en espíritu" },
];

export const RSVP_STORAGE_PREFIX = "ir:rsvp:";

/**
 * Panel de RSVP del micrositio: formulario o tarjeta de confirmación (con editar respuesta,
 * agregar a calendario y playlist). Con el link genérico, al responder redirige al link personal.
 */
export function RsvpPanel({
  slug,
  token,
  guest,
  honoreeName,
  calendarPath,
  playlistUrl,
}: {
  slug: string;
  token: string;
  guest: RsvpGuestPrefill | null;
  honoreeName: string | null;
  calendarPath: string;
  playlistUrl: string | null;
}) {
  const [editing, setEditing] = React.useState(!guest?.responded);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const focusConfirmation = React.useRef(false);

  // Al guardar o cancelar la edición, mover el foco a la confirmación (lectores de pantalla/teclado).
  React.useEffect(() => {
    if (editing || !focusConfirmation.current) return;
    focusConfirmation.current = false;
    headingRef.current?.focus();
  }, [editing, guest?.responded]);

  React.useEffect(() => {
    if (!guest?.responded) return;
    try {
      window.localStorage.setItem(
        `${RSVP_STORAGE_PREFIX}${slug}`,
        JSON.stringify({ path: `/e/${slug}/${token}`, name: guest.name }),
      );
    } catch {
      // almacenamiento no disponible (modo privado): no pasa nada
    }
  }, [guest?.responded, guest?.name, slug, token]);

  if (guest?.responded && !editing) {
    const copy = confirmationCopy(guest.rsvpStatus, guest.name);
    const details = [
      RSVP_STATUS_LABELS[guest.rsvpStatus],
      guest.plusOne ? `con acompañante${guest.plusOneName ? ` (${guest.plusOneName})` : ""}` : null,
      guest.rsvpStatus !== "NOT_ATTENDING" && guest.dietaryRestrictions.length
        ? guest.dietaryRestrictions.map((d) => DIETARY_LABELS[d]).join(", ")
        : null,
    ].filter(Boolean);
    const goingish = guest.rsvpStatus === "ATTENDING" || guest.rsvpStatus === "MAYBE";
    return (
      <div className="space-y-6 text-center" role="status">
        <div className="bg-sage-soft text-olive mx-auto flex size-16 items-center justify-center rounded-full">
          {guest.rsvpStatus === "NOT_ATTENDING" ? (
            <HeartHandshake className="size-7" aria-hidden />
          ) : (
            <Check className="size-7" aria-hidden />
          )}
        </div>
        <div>
          <h2 ref={headingRef} tabIndex={-1} className="font-heading text-3xl font-semibold text-balance outline-none sm:text-4xl">
            {copy.title}
          </h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-md">{copy.body}</p>
        </div>
        <p className="bg-sand-soft/70 mx-auto w-fit max-w-full rounded-full px-4 py-2 text-sm">
          Tu respuesta: <span className="font-medium">{details.join(" · ")}</span>
        </p>
        <div className="flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
          {goingish ? (
            <Button asChild size="xl">
              <a href={calendarPath} download>
                <CalendarPlus aria-hidden /> Agregar a mi calendario
              </a>
            </Button>
          ) : null}
          {playlistUrl ? (
            <Button asChild variant="outline" className="h-12 rounded-full px-6 text-base">
              <a href={playlistUrl} target="_blank" rel="noopener noreferrer">
                <Music2 aria-hidden /> Escuchar la playlist
                <span className="sr-only">(se abre en otra pestaña)</span>
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="h-12 rounded-full px-6 text-base"
            onClick={() => setEditing(true)}
          >
            <Pencil aria-hidden /> Editar mi respuesta
          </Button>
        </div>
      </div>
    );
  }

  return (
    <RsvpForm
      slug={slug}
      token={token}
      guest={guest}
      honoreeName={honoreeName}
      onSaved={() => {
        focusConfirmation.current = true;
        setEditing(false);
      }}
      onCancel={
        guest?.responded
          ? () => {
              focusConfirmation.current = true;
              setEditing(false);
            }
          : undefined
      }
    />
  );
}

function RsvpForm({
  slug,
  token,
  guest,
  honoreeName,
  onSaved,
  onCancel,
}: {
  slug: string;
  token: string;
  guest: RsvpGuestPrefill | null;
  honoreeName: string | null;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const form = useForm<RsvpFormValues>({
    resolver: zodResolver(rsvpFormSchema),
    defaultValues: {
      name: guest?.name ?? "",
      // Vacío = conservar el email registrado (el servidor no lo borra).
      email: "",
      rsvpStatus: guest?.responded && guest.rsvpStatus !== "PENDING" ? guest.rsvpStatus : undefined,
      plusOne: guest?.plusOne ?? false,
      plusOneName: guest?.plusOneName ?? "",
      dietaryRestrictions: guest?.dietaryRestrictions ?? [],
      dietaryNotes: guest?.dietaryNotes ?? "",
      comment: guest?.comment ?? "",
      honoreeMessage: guest?.honoreeMessage ?? "",
      photoConsent: guest?.photoConsent ?? false,
    },
  });
  const pending = form.formState.isSubmitting;
  const errors = form.formState.errors;
  const status = useWatch({ control: form.control, name: "rsvpStatus" });
  const plusOne = useWatch({ control: form.control, name: "plusOne" });
  const personal = !!guest;
  const honoree = honoreeName?.trim() || null;
  const [redirecting, setRedirecting] = React.useState(false);

  async function onSubmit(values: RsvpFormValues) {
    const res = await submitRsvpAction({ slug, token, rsvp: values });
    if (!handleActionResult(res)) {
      // Los errores por campo del servidor vienen anidados como "rsvp.<campo>"
      if (!res.ok && res.fieldErrors) {
        for (const [key, messages] of Object.entries(res.fieldErrors)) {
          const field = key.replace(/^rsvp\./, "") as keyof RsvpFormValues;
          if (field in values) form.setError(field, { type: "server", message: messages[0] });
        }
      }
      return;
    }
    try {
      window.localStorage.setItem(
        `${RSVP_STORAGE_PREFIX}${slug}`,
        JSON.stringify({ path: res.data.personalPath, name: res.data.name }),
      );
    } catch {
      // sin almacenamiento local
    }
    const current = `/e/${slug}/${token}`;
    if (res.data.personalPath !== current) {
      // Navegación completa al link personal: render fresco con su respuesta y scroll a #rsvp.
      setRedirecting(true);
      window.location.replace(`${res.data.personalPath}#rsvp`);
    } else {
      // Mostrar la confirmación cuando lleguen los datos frescos (misma transición)
      React.startTransition(() => {
        onSaved();
        router.refresh();
      });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-7">
      <div className="text-center">
        <h2 className="font-heading text-3xl font-semibold sm:text-4xl">
          {personal && guest?.name ? `${firstName(guest.name)}, ¿nos acompañas?` : "¿Nos acompañas?"}
        </h2>
        <p className="text-muted-foreground mt-2">
          Confirma tu asistencia y cuéntanos lo necesario para consentirte en la mesa.
        </p>
      </div>

      <Field label="Tu nombre" required error={errors.name?.message}>
        {(p) => (
          <Input
            {...p}
            {...form.register("name")}
            autoComplete="name"
            autoCapitalize="words"
            placeholder="Nombre y apellido"
            className="h-12 text-base"
          />
        )}
      </Field>

      <Controller
        control={form.control}
        name="rsvpStatus"
        render={({ field }) => (
          <fieldset aria-describedby={errors.rsvpStatus ? "rsvp-status-err" : undefined}>
            <legend className="mb-2 text-sm font-medium">
              ¿Asistes?<span className="text-destructive ml-0.5" aria-hidden>*</span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {ANSWERS.map((a) => {
                const checked = field.value === a.value;
                return (
                  <label
                    key={a.value}
                    className={cn(
                      "has-[:focus-visible]:ring-ring flex min-h-16 cursor-pointer flex-col justify-center rounded-2xl border-2 px-4 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2",
                      checked ? "border-olive bg-sage-soft" : "border-border bg-background hover:border-sage",
                    )}
                  >
                    <input
                      type="radio"
                      name="rsvpStatus"
                      value={a.value}
                      checked={checked}
                      onChange={() => field.onChange(a.value)}
                      onBlur={field.onBlur}
                      className="sr-only"
                    />
                    <span className="flex items-center gap-2 font-medium">
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                          checked ? "border-olive bg-olive text-ivory" : "border-input",
                        )}
                      >
                        {checked ? <Check className="size-3" /> : null}
                      </span>
                      {a.title}
                    </span>
                    <span className="text-muted-foreground mt-0.5 pl-7 text-xs">{a.hint}</span>
                  </label>
                );
              })}
            </div>
            {errors.rsvpStatus ? (
              <p id="rsvp-status-err" role="alert" className="text-destructive mt-1.5 text-xs font-medium">
                {errors.rsvpStatus.message}
              </p>
            ) : null}
          </fieldset>
        )}
      />

      {status === "ATTENDING" ? (
        <div className="bg-sand-soft/50 space-y-3 rounded-2xl p-4">
          <Controller
            control={form.control}
            name="plusOne"
            render={({ field }) => (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="rsvp-plus-one"
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  className="mt-0.5 size-5"
                />
                <Label htmlFor="rsvp-plus-one" className="text-base leading-snug font-normal">
                  Voy con acompañante
                </Label>
              </div>
            )}
          />
          {plusOne ? (
            <Field label="Nombre de tu acompañante" error={errors.plusOneName?.message}>
              {(p) => <Input {...p} {...form.register("plusOneName")} autoComplete="off" className="h-12 text-base" />}
            </Field>
          ) : null}
        </div>
      ) : null}

      {status !== "NOT_ATTENDING" ? (
        <Controller
          control={form.control}
          name="dietaryRestrictions"
          render={({ field }) => (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">¿Alguna restricción alimentaria?</legend>
              <p className="text-muted-foreground text-xs">Elige todas las que apliquen. Si no tienes, déjalo así.</p>
              <div className="flex flex-wrap gap-2">
                {DIETARY_VALUES.map((d) => {
                  const checked = field.value.includes(d);
                  return (
                    <label
                      key={d}
                      className={cn(
                        "has-[:focus-visible]:ring-ring inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm transition-colors has-[:focus-visible]:ring-2",
                        checked ? "border-olive bg-olive text-ivory" : "border-border bg-background hover:bg-sage-soft",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={(e) =>
                          field.onChange(
                            e.target.checked ? [...field.value, d] : field.value.filter((x: DietaryRestriction) => x !== d),
                          )
                        }
                      />
                      {checked ? <Check className="size-3.5" aria-hidden /> : null}
                      {DIETARY_LABELS[d]}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
        />
      ) : null}

      {status !== "NOT_ATTENDING" ? (
        <Field
          label="Alergias o notas para la cocina"
          description="Ej. celiaca, sin contaminación cruzada; alergia a la nuez."
          error={errors.dietaryNotes?.message}
        >
          {(p) => <Textarea {...p} {...form.register("dietaryNotes")} rows={2} className="text-base" />}
        </Field>
      ) : null}

      <Field
        label={honoree ? `Mensaje para ${honoree}` : "Mensaje para la festejada"}
        description="Lo guardamos como sorpresa para su Memory Capsule."
        error={errors.honoreeMessage?.message}
      >
        {(p) => (
          <Textarea
            {...p}
            {...form.register("honoreeMessage")}
            rows={3}
            placeholder="Unas palabras bonitas…"
            className="text-base"
          />
        )}
      </Field>

      <Field label="Comentario (opcional)" error={errors.comment?.message}>
        {(p) => <Textarea {...p} {...form.register("comment")} rows={2} className="text-base" />}
      </Field>

      <Field
        label="Tu email (opcional)"
        description={
          guest?.emailHint
            ? `Ya tenemos tu email (${guest.emailHint}). Escríbelo sólo si quieres cambiarlo.`
            : "Sólo para enviarte recordatorios de esta celebración."
        }
        error={errors.email?.message}
      >
        {(p) => (
          <Input
            {...p}
            {...form.register("email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            className="h-12 text-base"
          />
        )}
      </Field>

      <Controller
        control={form.control}
        name="photoConsent"
        render={({ field }) => (
          <div className="flex items-start gap-3">
            <Checkbox
              id="rsvp-photo-consent"
              checked={field.value}
              onCheckedChange={(v) => field.onChange(v === true)}
              className="mt-0.5 size-5"
            />
            <Label htmlFor="rsvp-photo-consent" className="text-sm leading-snug font-normal">
              Acepto aparecer en las fotos del evento que se compartan con las invitadas y la anfitriona.
            </Label>
          </div>
        )}
      />

      <div className="flex flex-col gap-2">
        <SubmitButton
          pending={pending || redirecting}
          pendingText={redirecting ? "Abriendo tu confirmación…" : "Enviando tu respuesta…"}
          size="xl"
          className="w-full"
        >
          {guest?.responded ? "Guardar cambios" : "Enviar mi respuesta"}
        </SubmitButton>
        {onCancel ? (
          <Button type="button" variant="ghost" className="h-12 rounded-full text-base" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
