"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MAX_COLORS } from "../../schemas";
import type { StepProps } from "./types";

const PRESET_COLORS: Array<{ name: string; hex: string }> = [
  { name: "Blanco", hex: "#FFFFFF" },
  { name: "Marfil", hex: "#F7F3EC" },
  { name: "Arena", hex: "#E8DCC8" },
  { name: "Blush", hex: "#E9C9BE" },
  { name: "Rosa palo", hex: "#F3D1D8" },
  { name: "Durazno", hex: "#F4B6A6" },
  { name: "Terracota", hex: "#C96F53" },
  { name: "Mantequilla", hex: "#F6D27A" },
  { name: "Salvia", hex: "#A3B18A" },
  { name: "Verde olivo", hex: "#5C6B4E" },
  { name: "Lavanda", hex: "#C7B8E0" },
  { name: "Azul cielo", hex: "#A9C8E8" },
  { name: "Dorado", hex: "#C6A15B" },
];

export function StepPreferences({ draft, update, catalog }: StepProps) {
  const [custom, setCustom] = React.useState("");
  const style = catalog.styles.find((s) => s.id === draft.styleId);
  const full = draft.colors.length >= MAX_COLORS;
  const has = (c: string) => draft.colors.some((x) => x.toLowerCase() === c.toLowerCase());

  const toggle = (c: string) => {
    if (has(c)) update({ colors: draft.colors.filter((x) => x.toLowerCase() !== c.toLowerCase()) });
    else if (!full) update({ colors: [...draft.colors, c] });
  };
  const addCustom = () => {
    const c = custom.trim().slice(0, 30);
    if (c.length < 2 || has(c) || full) return;
    update({ colors: [...draft.colors, c] });
    setCustom("");
  };
  const customColors = draft.colors.filter(
    (c) => !PRESET_COLORS.some((p) => p.name.toLowerCase() === c.toLowerCase()),
  );

  return (
    <div className="space-y-8">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Colores que te gustan</legend>
        <p className="text-muted-foreground text-xs">
          Elige hasta {MAX_COLORS}.
          {style
            ? ` Tu estilo ${style.name.toLowerCase()} ya trae su propia paleta; esto nos ayuda a afinarla.`
            : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => {
            const on = has(c.name);
            return (
              <button
                key={c.name}
                type="button"
                aria-pressed={on}
                disabled={!on && full}
                onClick={() => toggle(c.name)}
                className={cn(
                  "focus-visible:ring-ring/50 inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors outline-none focus-visible:ring-3 disabled:opacity-40",
                  on ? "border-olive bg-sage-soft font-medium" : "bg-card hover:bg-sand-soft",
                )}
              >
                <span
                  aria-hidden
                  className="size-4 rounded-full border border-black/10"
                  style={{ backgroundColor: c.hex }}
                />
                {c.name}
              </button>
            );
          })}
          {customColors.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed
              onClick={() => toggle(c)}
              aria-label={`Quitar ${c}`}
              className="border-olive bg-sage-soft focus-visible:ring-ring/50 inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium outline-none focus-visible:ring-3"
            >
              {c} <X className="size-3.5" aria-hidden />
            </button>
          ))}
        </div>
        <div className="flex max-w-md gap-2">
          <label htmlFor="color-personalizado" className="sr-only">
            Agregar otro color
          </label>
          <Input
            id="color-personalizado"
            value={custom}
            maxLength={30}
            disabled={full}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="Otro color (ej. verde menta)"
            className="bg-card h-10 text-base"
          />
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-full"
            onClick={addCustom}
            disabled={full || custom.trim().length < 2}
          >
            <Plus aria-hidden /> Agregar
          </Button>
        </div>
      </fieldset>

      <div className="grid gap-5 md:grid-cols-2">
        <Field
          label="¿A quién celebramos?"
          description="Nombre de la homenajeada (opcional). Lo usamos en letreros y detalles."
        >
          {(p) => (
            <Input
              {...p}
              value={draft.honoreeName}
              maxLength={80}
              onChange={(e) => update({ honoreeName: e.target.value })}
              placeholder="Ej. Sofía"
              autoComplete="off"
              className="bg-card h-11 text-base"
            />
          )}
        </Field>
        <Field
          label="Inspiración"
          description="Un link de Pinterest o Instagram, o descríbenos tu idea (opcional)."
        >
          {(p) => (
            <Input
              {...p}
              value={draft.inspiration}
              maxLength={500}
              onChange={(e) => update({ inspiration: e.target.value })}
              placeholder="https://pin.it/… o “mesa con flores silvestres”"
              className="bg-card h-11 text-base"
            />
          )}
        </Field>
      </div>

      <Field
        label="Notas o peticiones especiales"
        description={`Alergias, sorpresas, si tu fecha es flexible… lo que nos ayude a imaginarla. ${draft.notes.length}/1000`}
      >
        {(p) => (
          <Textarea
            {...p}
            value={draft.notes}
            maxLength={1000}
            rows={4}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="Ej. Una invitada es celiaca y queremos sorprender a Sofía con su canción favorita."
            className="bg-card min-h-28 text-base"
          />
        )}
      </Field>
    </div>
  );
}
