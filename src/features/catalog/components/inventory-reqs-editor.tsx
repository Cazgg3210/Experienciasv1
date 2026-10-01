"use client";

import * as React from "react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { Boxes, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INVENTORY_CATEGORY_LABELS } from "@/lib/labels";
import type { InventoryCategory } from "@prisma/client";
import type { InventoryOption } from "../server/queries";

type InvReq = { inventoryItemId: string; quantity: number; perGuest: boolean };
type FormWithInventory = { inventoryReqs: InvReq[] };

/**
 * Lista de artículos de inventario requeridos (cantidad fija o por persona).
 * Debe usarse dentro de un <FormProvider> cuyo formulario tenga `inventoryReqs`.
 */
export function InventoryReqsEditor({
  options,
  disabled,
  guestsHint,
}: {
  options: InventoryOption[];
  disabled?: boolean;
  guestsHint?: number;
}) {
  const form = useFormContext<FormWithInventory>();
  const baseId = React.useId();
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "inventoryReqs" });
  const errors = form.formState.errors.inventoryReqs;
  const watched = form.watch("inventoryReqs");

  const grouped = React.useMemo(() => {
    const map = new Map<string, InventoryOption[]>();
    for (const o of options) {
      const list = map.get(o.category) ?? [];
      list.push(o);
      map.set(o.category, list);
    }
    return [...map.entries()];
  }, [options]);
  const byId = React.useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const used = new Set(watched?.map((r) => r.inventoryItemId));
  const firstFree = options.find((o) => o.active && !used.has(o.id));

  if (!options.length) {
    return (
      <p className="text-muted-foreground text-sm">
        No hay artículos de inventario activos. Agrégalos primero en Inventario.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {fields.length ? (
        <ul className="space-y-2">
          {fields.map((field, i) => {
            const rowErr = errors?.[i];
            const current = watched?.[i];
            const item = current ? byId.get(current.inventoryItemId) : undefined;
            const total =
              current && item && guestsHint && Number.isFinite(current.quantity)
                ? current.perGuest
                  ? current.quantity * guestsHint
                  : current.quantity
                : null;
            return (
              <li key={field.id} className="bg-background grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_7rem_auto_auto] sm:items-end">
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor={`${baseId}-inv-${i}`} className="text-xs">
                    Artículo
                  </Label>
                  <Controller
                    control={form.control}
                    name={`inventoryReqs.${i}.inventoryItemId`}
                    render={({ field: f }) => (
                      <Select value={f.value} onValueChange={f.onChange} disabled={disabled}>
                        <SelectTrigger
                          id={`${baseId}-inv-${i}`}
                          className="h-9 w-full"
                          aria-invalid={rowErr?.inventoryItemId ? true : undefined}
                        >
                          <SelectValue placeholder="Elige un artículo" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="max-h-80">
                          {grouped.map(([category, list]) => (
                            <SelectGroup key={category}>
                              <SelectLabel>{INVENTORY_CATEGORY_LABELS[category as InventoryCategory] ?? category}</SelectLabel>
                              {list.map((o) => (
                                <SelectItem
                                  key={o.id}
                                  value={o.id}
                                  disabled={o.id !== f.value && used.has(o.id)}
                                >
                                  {o.name}
                                  {o.active ? "" : " (inactivo)"}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {rowErr?.inventoryItemId?.message ? (
                    <p role="alert" className="text-destructive text-xs font-medium">
                      {rowErr.inventoryItemId.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${baseId}-inv-q-${i}`} className="text-xs">
                    Cantidad
                  </Label>
                  <Input
                    id={`${baseId}-inv-q-${i}`}
                    type="number"
                    min={1}
                    inputMode="numeric"
                    className="h-9"
                    disabled={disabled}
                    aria-invalid={rowErr?.quantity ? true : undefined}
                    {...form.register(`inventoryReqs.${i}.quantity`, { valueAsNumber: true })}
                  />
                  {rowErr?.quantity?.message ? (
                    <p role="alert" className="text-destructive text-xs font-medium">
                      {rowErr.quantity.message}
                    </p>
                  ) : null}
                </div>
                <Controller
                  control={form.control}
                  name={`inventoryReqs.${i}.perGuest`}
                  render={({ field: f }) => (
                    <div className="flex h-9 items-center gap-2">
                      <Checkbox
                        id={`${baseId}-inv-pg-${i}`}
                        checked={f.value}
                        disabled={disabled}
                        onCheckedChange={(v) => f.onChange(v === true)}
                      />
                      <Label htmlFor={`${baseId}-inv-pg-${i}`} className="text-sm font-normal">
                        Por persona
                      </Label>
                    </div>
                  )}
                />
                <div className="flex h-9 items-center justify-between gap-2 sm:justify-end">
                  {total != null ? (
                    <span className="text-muted-foreground text-xs whitespace-nowrap">
                      = {total} {item?.unit ?? "pz"}
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled}
                    onClick={() => remove(i)}
                    aria-label={`Quitar ${item?.name ?? "artículo"}`}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="text-muted-foreground flex items-center gap-2 rounded-xl border border-dashed px-4 py-5 text-sm">
          <Boxes className="size-4" aria-hidden />
          Sin artículos requeridos todavía.
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={disabled || !firstFree}
        onClick={() => firstFree && append({ inventoryItemId: firstFree.id, quantity: 1, perGuest: true })}
      >
        <Plus aria-hidden />
        Agregar artículo
      </Button>
      {guestsHint ? (
        <p className="text-muted-foreground text-xs">Totales calculados para {guestsHint} personas (base).</p>
      ) : null}
    </div>
  );
}
