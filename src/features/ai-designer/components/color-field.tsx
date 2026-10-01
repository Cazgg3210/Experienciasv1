"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COLOR_PRESETS, MAX_COLORS } from "../constants";
import { colorName } from "../domain/palette";
import { MultiChoiceChips, type ChipOption } from "./choice-chips";

/** Colores favoritos: chips sugeridos + color personalizado (máx. MAX_COLORS). */
export function ColorField({
  value,
  onChange,
  error,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
}) {
  const [custom, setCustom] = React.useState("#C98F7E");
  const presetHexes = React.useMemo(() => new Set(COLOR_PRESETS.map((p) => p.hex)), []);
  const atMax = value.length >= MAX_COLORS;

  const options: ChipOption<string>[] = [
    ...COLOR_PRESETS.map((p) => ({ value: p.hex, label: p.name, swatch: p.hex })),
    ...value
      .filter((hex) => !presetHexes.has(hex))
      .map((hex) => ({ value: hex, label: `${colorName(hex)} (tuyo)`, swatch: hex })),
  ];

  function addCustom() {
    const hex = custom.toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(hex) || value.includes(hex) || atMax) return;
    onChange([...value, hex]);
  }

  return (
    <MultiChoiceChips
      name="colors"
      legend="Colores que le encantan"
      description={`Opcional · elige hasta ${MAX_COLORS}. Los usamos como base de la paleta.`}
      options={options}
      value={value}
      onChange={onChange}
      max={MAX_COLORS}
      error={error}
    >
      <div className="border-border bg-card flex min-h-11 items-center gap-1 rounded-full border border-dashed py-0.5 pr-0.5 pl-1.5">
        <input
          type="color"
          value={custom}
          onChange={(e) => setCustom(e.target.value.toUpperCase())}
          aria-label="Elegir un color personalizado"
          className="size-9 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0"
        />
        <Button
          type="button"
          variant="ghost"
          className="h-10 rounded-full px-3"
          onClick={addCustom}
          disabled={atMax}
        >
          <Plus aria-hidden />
          Agregar color
        </Button>
      </div>
    </MultiChoiceChips>
  );
}
