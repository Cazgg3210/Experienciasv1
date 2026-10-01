"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { HEX_COLOR, MAX_COLORS, preferencesFormSchema, type PreferencesFormValues } from "../schemas";
import { updatePreferencesAction } from "../server/actions";
import { safeExternalUrl } from "../domain/portal";

const SUGGESTED = ["#E9C9BE", "#A3B18A", "#E8DCC8", "#F7F3EC", "#C6A15B", "#5C6B4E", "#F4B6A6", "#8FB3E0"];

/** Preferencias de la anfitriona: vista de lectura + edición en el mismo lugar. */
export function PreferencesPanel({
  token,
  initial,
  editable,
}: {
  token: string;
  initial: PreferencesFormValues;
  editable: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  if (editing && editable) {
    return <PreferencesForm token={token} initial={initial} onDone={() => setEditing(false)} />;
  }
  const playlistHref = safeExternalUrl(initial.playlistUrl);
  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Homenajeada", value: initial.honoreeName || null },
    { label: "Código de vestimenta", value: initial.dressCode || null },
    {
      label: "Mensaje para tus invitadas",
      value: initial.hostMessage ? <span className="whitespace-pre-line">{initial.hostMessage}</span> : null,
    },
    {
      label: "Playlist",
      value: playlistHref ? (
        <a
          href={playlistHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-olive inline-flex items-center gap-1 font-medium underline underline-offset-4"
        >
          Abrir playlist <ExternalLink className="size-3.5" aria-hidden />
          <span className="sr-only">(se abre en otra pestaña)</span>
        </a>
      ) : null,
    },
    {
      label: "Notas para el equipo",
      value: initial.customerNotes ? <span className="whitespace-pre-line">{initial.customerNotes}</span> : null,
    },
  ];
  return (
    <div className="space-y-5">
      <div>
        <p className="text-muted-foreground mb-2 text-sm">Colores</p>
        {initial.colors.length ? (
          <ul className="flex flex-wrap gap-2" aria-label="Colores elegidos">
            {initial.colors.map((c) => (
              <li key={c} className="flex items-center gap-2 rounded-full border bg-background py-1 pr-3 pl-1 text-xs">
                <span className="size-6 rounded-full border" style={{ backgroundColor: c }} aria-hidden />
                <span className="tabular uppercase">{c}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">Aún no eliges colores.</p>
        )}
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className={r.label.startsWith("Mensaje") || r.label.startsWith("Notas") ? "sm:col-span-2" : ""}>
            <dt className="text-muted-foreground text-sm">{r.label}</dt>
            <dd className="mt-0.5">{r.value ?? <span className="text-muted-foreground italic">Sin definir</span>}</dd>
          </div>
        ))}
      </dl>
      {editable ? (
        <Button type="button" variant="outline" className="h-11 rounded-full px-5" onClick={() => setEditing(true)}>
          <Pencil aria-hidden /> Editar preferencias
        </Button>
      ) : null}
    </div>
  );
}

function PreferencesForm({
  token,
  initial,
  onDone,
}: {
  token: string;
  initial: PreferencesFormValues;
  onDone: () => void;
}) {
  const router = useRouter();
  const form = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesFormSchema),
    defaultValues: initial,
  });
  const pending = form.formState.isSubmitting;
  const errors = form.formState.errors;

  async function onSubmit(values: PreferencesFormValues) {
    const res = await updatePreferencesAction({ token, ...values });
    if (
      handleActionResult(res, {
        form,
        success: res.ok && res.data.changed === 0 ? "No hubo cambios" : "Preferencias guardadas. Le avisamos al equipo.",
      })
    ) {
      onDone();
      router.refresh();
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
      <Controller
        control={form.control}
        name="colors"
        render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} error={errors.colors?.message ?? errors.colors?.[0]?.message} />}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre de la homenajeada" error={errors.honoreeName?.message}>
          {(p) => <Input {...p} {...form.register("honoreeName")} className="h-12 text-base" />}
        </Field>
        <Field label="Código de vestimenta" error={errors.dressCode?.message}>
          {(p) => (
            <Input {...p} {...form.register("dressCode")} placeholder="Ej. Casual chic en tonos pastel" className="h-12 text-base" />
          )}
        </Field>
      </div>
      <Field
        label="Mensaje para tus invitadas"
        description="Aparece en la invitación digital."
        error={errors.hostMessage?.message}
      >
        {(p) => <Textarea {...p} {...form.register("hostMessage")} rows={3} className="text-base" />}
      </Field>
      <Field label="Playlist (Spotify, Apple Music, YouTube…)" error={errors.playlistUrl?.message}>
        {(p) => (
          <Input
            {...p}
            {...form.register("playlistUrl")}
            inputMode="url"
            placeholder="https://open.spotify.com/playlist/…"
            className="h-12 text-base"
          />
        )}
      </Field>
      <Field
        label="Notas para el equipo"
        description="Alergias importantes, sorpresas, detalles que no debemos olvidar. Sólo las ve nuestro equipo."
        error={errors.customerNotes?.message}
      >
        {(p) => <Textarea {...p} {...form.register("customerNotes")} rows={4} className="text-base" />}
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" className="h-12 rounded-full px-6 text-base" onClick={onDone}>
          Cancelar
        </Button>
        <SubmitButton pending={pending} size="xl">
          Guardar preferencias
        </SubmitButton>
      </div>
    </form>
  );
}

function ColorPicker({
  value,
  onChange,
  error,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  error?: string;
}) {
  const [draft, setDraft] = React.useState("#E9C9BE");
  const labelId = React.useId();
  const full = value.length >= MAX_COLORS;
  const add = (c: string) => {
    const v = c.toUpperCase();
    if (!HEX_COLOR.test(v) || value.map((x) => x.toUpperCase()).includes(v) || full) return;
    onChange([...value, v]);
  };
  return (
    <fieldset className="space-y-3" aria-describedby={error ? `${labelId}-err` : undefined}>
      <legend id={labelId} className="text-sm font-medium">
        Colores de tu celebración <span className="text-muted-foreground font-normal">(hasta {MAX_COLORS})</span>
      </legend>
      {value.length ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((c) => (
            <li key={c}>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== c))}
                className="hover:bg-muted flex h-10 items-center gap-2 rounded-full border bg-background py-1 pr-3 pl-1 text-xs"
                aria-label={`Quitar color ${c}`}
              >
                <span className="size-7 rounded-full border" style={{ backgroundColor: c }} aria-hidden />
                <span className="tabular uppercase">{c}</span>
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">Elige los tonos que quieres en flores, mesa y detalles.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {SUGGESTED.filter((s) => !value.map((x) => x.toUpperCase()).includes(s)).map((s) => (
          <button
            key={s}
            type="button"
            disabled={full}
            onClick={() => add(s)}
            className="size-10 rounded-full border-2 border-white shadow-sm ring-1 ring-black/10 transition-transform hover:scale-105 disabled:opacity-40"
            style={{ backgroundColor: s }}
            aria-label={`Agregar color ${s}`}
          />
        ))}
        <label className="ml-1 flex items-center gap-2 text-sm">
          <span className="sr-only">Elegir otro color</span>
          <input
            type="color"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="size-10 cursor-pointer rounded-full border bg-transparent p-0.5"
          />
        </label>
        <Button type="button" variant="outline" className="h-10 rounded-full px-3" onClick={() => add(draft)} disabled={full}>
          <Plus aria-hidden /> Agregar
        </Button>
      </div>
      {error ? (
        <p id={`${labelId}-err`} role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
