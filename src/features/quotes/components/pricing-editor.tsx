"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Plus, RotateCcw, Save, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MoneyInput } from "@/components/forms/money-input";
import { Field } from "@/components/forms/field";
import { handleActionResult } from "@/components/forms/action-result";
import { COST_CATEGORY_LABELS, QUOTE_ITEM_TYPE_LABELS, toOptions } from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CostCategory } from "../domain/quote-engine";
import type { EditorLine, QuotePricingInput } from "../schemas";
import { COST_CATEGORIES } from "../schemas";
import { buildCatalogLineAction, previewQuotePricingAction, saveQuotePricingAction } from "../server/actions";
import type { PricingPreview } from "../server/quote-service";
import { NativeSelect, PercentInput, QuantityInput } from "./form-controls";
import { discountLabelFor, EngineWarnings, MarginAlert, TotalsSummary, type TotalsView } from "./quote-ui";

type DraftLine = EditorLine & {
  key: string;
  originalPriceCents: number | null;
  saved: { totalPriceCents: number; totalCostCents: number } | null;
};

export type PricingEditorProps = {
  quoteId: string;
  items: Array<Omit<EditorLine, "itemId"> & { id: string; totalPriceCents: number; totalCostCents: number }>;
  discount: { type: "PERCENT" | "AMOUNT" | null; value: number | null; reason: string | null };
  depositBps: number;
  savedTotals: TotalsView;
  minMarginBps: number;
  canEditPrices: boolean;
  canDiscount: boolean;
  addOns: Array<{ id: string; name: string; priceCents: number; pricingType: "FLAT" | "PER_GUEST"; maxQuantity: number; active: boolean }>;
};

const FIXED_QTY = new Set(["BASE_EXPERIENCE", "MENU", "LOGISTICS"]);
let keySeq = 0;
const nextKey = () => `n${++keySeq}`;

function payloadOf(quoteId: string, lines: DraftLine[], discount: QuotePricingInput["discount"], depositBps: number): QuotePricingInput {
  return {
    quoteId,
    lines: lines.map((l) => ({
      itemId: l.itemId ?? null,
      type: l.type,
      refId: l.refId ?? null,
      description: l.description,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      unitCostCents: l.unitCostCents,
      costCategory: l.costCategory,
    })),
    discount: { type: discount.type, value: discount.value, reason: discount.reason || undefined },
    depositBps,
  };
}

export function PricingEditor(props: PricingEditorProps) {
  const router = useRouter();
  const initialLines = React.useMemo<DraftLine[]>(
    () =>
      props.items.map(({ totalPriceCents, totalCostCents, ...i }) => ({
        ...i,
        itemId: i.id,
        key: i.id,
        originalPriceCents: i.type === "CUSTOM" ? null : i.unitPriceCents,
        saved: { totalPriceCents, totalCostCents },
      })),
    [props.items],
  );
  const initialDiscount = React.useMemo<QuotePricingInput["discount"]>(
    () => ({
      type: props.discount.type ?? "NONE",
      value: props.discount.value ?? 0,
      reason: props.discount.reason ?? "",
    }),
    [props.discount],
  );
  const [lines, setLines] = React.useState<DraftLine[]>(initialLines);
  const [discount, setDiscount] = React.useState(initialDiscount);
  const [depositBps, setDepositBps] = React.useState(props.depositBps);
  const [preview, setPreview] = React.useState<{ key: string; data: PricingPreview } | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const reqId = React.useRef(0);

  const payload = payloadOf(props.quoteId, lines, discount, depositBps);
  const payloadKey = JSON.stringify(payload);
  const initialKey = React.useMemo(
    () => JSON.stringify(payloadOf(props.quoteId, initialLines, initialDiscount, props.depositBps)),
    [props.quoteId, initialLines, initialDiscount, props.depositBps],
  );
  const dirty = payloadKey !== initialKey;

  React.useEffect(() => {
    if (!dirty) {
      reqId.current++;
      setPreview(null);
      setPreviewError(null);
      setPreviewing(false);
      return;
    }
    const id = ++reqId.current;
    setPreviewing(true);
    const t = setTimeout(async () => {
      const res = await previewQuotePricingAction(JSON.parse(payloadKey) as QuotePricingInput);
      if (id !== reqId.current) return;
      setPreviewing(false);
      if (res.ok) {
        setPreview({ key: payloadKey, data: res.data });
        setPreviewError(null);
      } else {
        setPreviewError(
          res.fieldErrors ? `${res.error} ${Object.values(res.fieldErrors).flat()[0] ?? ""}`.trim() : res.error,
        );
      }
    }, 400);
    return () => clearTimeout(t);
  }, [payloadKey, dirty]);

  // Aviso al salir con cambios sin guardar
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const fresh = preview && preview.key === payloadKey ? preview.data : null;
  const totals: TotalsView = fresh ? fresh.result : props.savedTotals;
  const stale = dirty && !fresh;
  const lineTotals = fresh ? fresh.result.lines : null;

  const update = (key: string, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key));

  async function addCatalog(kind: "ADDON" | "EXTRA_GUEST", addOnId: string | null, units: number) {
    if (kind === "ADDON" && lines.some((l) => l.type === "ADDON" && l.refId === addOnId)) {
      toast.error("Ese add-on ya está en la cotización; ajusta su cantidad.");
      return false;
    }
    const res = await buildCatalogLineAction({ quoteId: props.quoteId, kind, addOnId, units });
    if (!handleActionResult(res)) return false;
    const line = res.data;
    setLines((ls) => {
      const next: DraftLine = { ...line, key: nextKey(), originalPriceCents: line.unitPriceCents, saved: null };
      if (line.type === "EXTRA_GUEST") {
        const idx = ls.findIndex((l) => l.type === "BASE_EXPERIENCE");
        const copy = [...ls];
        copy.splice(idx >= 0 ? idx + 1 : copy.length, 0, next);
        return copy;
      }
      const logisticsIdx = ls.findIndex((l) => l.type === "LOGISTICS" || l.type === "CUSTOM");
      if (logisticsIdx >= 0) {
        const copy = [...ls];
        copy.splice(logisticsIdx, 0, next);
        return copy;
      }
      return [...ls, next];
    });
    return true;
  }

  async function save() {
    setSaving(true);
    const res = await saveQuotePricingAction(payload);
    setSaving(false);
    if (handleActionResult(res, { success: "Conceptos y totales guardados" })) {
      router.refresh();
    }
  }

  function reset() {
    setLines(initialLines);
    setDiscount(initialDiscount);
    setDepositBps(props.depositBps);
  }

  const hasExtraGuests = lines.some((l) => l.type === "EXTRA_GUEST");

  return (
    <section aria-labelledby="pricing-editor-title" className="bg-card rounded-2xl border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div>
          <h2 id="pricing-editor-title" className="font-heading text-xl font-semibold">
            Conceptos y precio
          </h2>
          <p className="text-muted-foreground text-xs">
            Los totales se recalculan en servidor con el motor de cotización. {props.canEditPrices ? "" : "Los precios de catálogo están bloqueados para tu rol."}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs" aria-live="polite">
          {previewing ? (
            <span className="text-muted-foreground inline-flex items-center gap-1">
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> Recalculando…
            </span>
          ) : dirty ? (
            <span className="text-warning font-medium">Cambios sin guardar</span>
          ) : (
            <span className="text-muted-foreground">Guardado</span>
          )}
        </div>
      </div>

      {/* Líneas */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-sm">
          <caption className="sr-only">Conceptos de la cotización</caption>
          <thead className="text-muted-foreground bg-muted/40 text-left text-xs">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Concepto</th>
              <th scope="col" className="px-3 py-2 font-medium">Cant.</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">P. unitario</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Costo unit.</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Total</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Costo</th>
              <th scope="col" className="px-2 py-2"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <LineRow
                key={l.key}
                line={l}
                totals={lineTotals?.[i] ?? (dirty ? null : l.saved)}
                stale={stale}
                canEditPrices={props.canEditPrices}
                onChange={(patch) => update(l.key, patch)}
                onRemove={() => remove(l.key)}
                layout="table"
              />
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y md:hidden">
        {lines.map((l, i) => (
          <LineRow
            key={l.key}
            line={l}
            totals={lineTotals?.[i] ?? (dirty ? null : l.saved)}
            stale={stale}
            canEditPrices={props.canEditPrices}
            onChange={(patch) => update(l.key, patch)}
            onRemove={() => remove(l.key)}
            layout="card"
          />
        ))}
      </ul>

      {/* Agregar */}
      <div className="flex flex-col gap-3 border-t px-4 py-4 sm:px-5 lg:flex-row lg:flex-wrap lg:items-end">
        <AddAddOn addOns={props.addOns} onAdd={(id, units) => addCatalog("ADDON", id, units)} />
        <div className="flex flex-wrap gap-2">
          {!hasExtraGuests ? (
            <Button type="button" variant="outline" size="lg" onClick={() => addCatalog("EXTRA_GUEST", null, 1)}>
              <UserPlus aria-hidden /> Invitadas adicionales
            </Button>
          ) : null}
          <CustomLineDialog onAdd={(line) => setLines((ls) => [...ls, { ...line, key: nextKey(), originalPriceCents: null, saved: null }])} />
        </div>
      </div>

      {/* Descuento y anticipo */}
      <div className="grid gap-4 border-t px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
        {props.canDiscount ? (
          <>
            <Field label="Descuento">
              {(p) => (
                <NativeSelect
                  {...p}
                  value={discount.type}
                  onChange={(e) =>
                    setDiscount((d) => ({ ...d, type: e.target.value as "NONE" | "PERCENT" | "AMOUNT", value: 0 }))
                  }
                >
                  <option value="NONE">Sin descuento</option>
                  <option value="PERCENT">Porcentaje</option>
                  <option value="AMOUNT">Monto fijo</option>
                </NativeSelect>
              )}
            </Field>
            {discount.type !== "NONE" ? (
              <>
                <Field label={discount.type === "PERCENT" ? "Porcentaje" : "Monto"} required>
                  {(p) =>
                    discount.type === "PERCENT" ? (
                      <PercentInput {...p} value={discount.value} onValueChange={(v) => setDiscount((d) => ({ ...d, value: v }))} />
                    ) : (
                      <MoneyInput {...p} value={discount.value} onValueChange={(v) => setDiscount((d) => ({ ...d, value: v ?? 0 }))} />
                    )
                  }
                </Field>
                <Field label="Motivo del descuento" required className="sm:col-span-2 lg:col-span-1">
                  {(p) => (
                    <Input
                      {...p}
                      className="h-9"
                      maxLength={300}
                      value={discount.reason ?? ""}
                      placeholder="Ej. clienta frecuente"
                      onChange={(e) => setDiscount((d) => ({ ...d, reason: e.target.value }))}
                    />
                  )}
                </Field>
              </>
            ) : null}
          </>
        ) : (
          <div className="text-muted-foreground flex items-start gap-2 text-sm sm:col-span-2 lg:col-span-3">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {props.discount.type
                ? `${discountLabelFor(props.discount.type, props.discount.value)} aplicado. `
                : "Sin descuento. "}
              Aplicar descuentos requiere permiso de descuentos.
            </span>
          </div>
        )}
        <Field label="Anticipo" description="Porcentaje del total.">
          {(p) => <PercentInput {...p} value={depositBps} onValueChange={setDepositBps} />}
        </Field>
      </div>

      {/* Totales */}
      <div className="space-y-3 border-t px-4 py-4 sm:px-5">
        {previewError ? (
          <p role="alert" className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm">
            {previewError}
          </p>
        ) : null}
        {fresh?.needsPricingPermission ? (
          <p role="alert" className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm">
            Cambiaste precios de catálogo; guardar requiere permiso de precios.
          </p>
        ) : null}
        {fresh?.needsDiscountPermission ? (
          <p role="alert" className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm">
            Cambiar el descuento requiere permiso de descuentos.
          </p>
        ) : null}
        <MarginAlert marginBps={totals.marginBps} marginCents={totals.estimatedMarginCents} minMarginBps={props.minMarginBps} />
        {fresh ? <EngineWarnings warnings={fresh.result.warnings} /> : null}
        <div className={cn("transition-opacity", stale && "opacity-50")}>
          <TotalsSummary
            totals={totals}
            minMarginBps={props.minMarginBps}
            discountLabel={discountLabelFor(
              discount.type === "NONE" ? null : discount.type,
              discount.type === "PERCENT" ? discount.value : null,
            )}
          />
        </div>
      </div>

      <div
        className={cn(
          "bg-card/95 sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t px-4 py-3 backdrop-blur sm:px-5",
          !dirty && "hidden",
        )}
      >
        <Button type="button" variant="ghost" size="lg" onClick={reset} disabled={saving}>
          <RotateCcw aria-hidden /> Descartar
        </Button>
        <Button type="button" size="lg" onClick={save} disabled={saving || !!previewError || previewing}>
          {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </section>
  );
}

function LineRow({
  line,
  totals,
  stale,
  canEditPrices,
  onChange,
  onRemove,
  layout,
}: {
  line: DraftLine;
  totals: { totalPriceCents: number; totalCostCents: number } | null;
  stale: boolean;
  canEditPrices: boolean;
  onChange: (patch: Partial<DraftLine>) => void;
  onRemove: () => void;
  layout: "table" | "card";
}) {
  const custom = line.type === "CUSTOM";
  const priceEditable = custom || canEditPrices;
  const modified = line.originalPriceCents != null && line.originalPriceCents !== line.unitPriceCents;
  const fixedQty = FIXED_QTY.has(line.type);
  const removable = line.type !== "BASE_EXPERIENCE";
  const total = totals ? formatMXN(totals.totalPriceCents) : "…";
  const totalCost = totals ? formatMXN(totals.totalCostCents) : "…";

  const description = custom ? (
    <Input
      aria-label="Descripción del concepto"
      className="h-9"
      value={line.description}
      maxLength={200}
      onChange={(e) => onChange({ description: e.target.value })}
    />
  ) : (
    <div>
      <p className="font-medium">{line.description}</p>
      <p className="text-muted-foreground text-xs">{QUOTE_ITEM_TYPE_LABELS[line.type]}</p>
    </div>
  );
  const qty = fixedQty ? (
    <span className="tabular" title="Se ajusta con el número de invitadas o la experiencia">
      {line.quantity}
    </span>
  ) : (
    <QuantityInput label={`Cantidad de ${line.description}`} value={line.quantity} min={1} max={10_000} onValueChange={(q) => onChange({ quantity: q })} />
  );
  const price = priceEditable ? (
    <div className="space-y-0.5">
      <MoneyInput
        aria-label={`Precio unitario de ${line.description}`}
        className="w-32"
        value={line.unitPriceCents}
        onValueChange={(v) => onChange({ unitPriceCents: v ?? 0 })}
      />
      {modified ? (
        <p className="text-warning text-[11px] font-medium">
          Antes {formatMXN(line.originalPriceCents)}
          <button type="button" className="ml-1 underline" onClick={() => onChange({ unitPriceCents: line.originalPriceCents! })}>
            restaurar
          </button>
        </p>
      ) : null}
    </div>
  ) : (
    <span className="tabular">{formatMXN(line.unitPriceCents)}</span>
  );
  const cost = custom ? (
    <MoneyInput
      aria-label={`Costo unitario de ${line.description}`}
      className="w-28"
      value={line.unitCostCents}
      onValueChange={(v) => onChange({ unitCostCents: v ?? 0 })}
    />
  ) : (
    <span className="tabular text-muted-foreground">{formatMXN(line.unitCostCents)}</span>
  );
  const category = custom ? (
    <NativeSelect
      aria-label="Categoría de costo"
      className="h-8 text-xs"
      value={line.costCategory}
      onChange={(e) => onChange({ costCategory: e.target.value as CostCategory })}
    >
      {COST_CATEGORIES.filter((c) => c !== "PAYMENT_FEE").map((c) => (
        <option key={c} value={c}>
          {COST_CATEGORY_LABELS[c]}
        </option>
      ))}
    </NativeSelect>
  ) : null;
  const removeBtn = removable ? (
    <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={`Quitar ${line.description}`}>
      <Trash2 className="text-destructive" aria-hidden />
    </Button>
  ) : null;

  if (layout === "table") {
    return (
      <tr className="border-t align-top">
        <td className="max-w-[280px] px-3 py-2.5">
          <div className="space-y-1.5">
            {description}
            {category}
          </div>
        </td>
        <td className="px-3 py-2.5">{qty}</td>
        <td className="px-3 py-2.5 text-right">{price}</td>
        <td className="px-3 py-2.5 text-right">{cost}</td>
        <td className={cn("tabular px-3 py-2.5 text-right font-medium", stale && "opacity-50")}>{total}</td>
        <td className={cn("tabular text-muted-foreground px-3 py-2.5 text-right", stale && "opacity-50")}>{totalCost}</td>
        <td className="px-2 py-1.5 text-right">{removeBtn}</td>
      </tr>
    );
  }
  return (
    <li className="space-y-3 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          {description}
          {category}
        </div>
        {removeBtn}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground mb-1 text-xs">Cantidad</p>
          {qty}
        </div>
        <div>
          <p className="text-muted-foreground mb-1 text-xs">Precio unitario</p>
          {price}
        </div>
        <div>
          <p className="text-muted-foreground mb-1 text-xs">Costo unitario</p>
          {cost}
        </div>
        <div className={cn("text-right", stale && "opacity-50")}>
          <p className="text-muted-foreground mb-1 text-xs">Total · costo</p>
          <p className="tabular font-medium">{total}</p>
          <p className="tabular text-muted-foreground text-xs">{totalCost}</p>
        </div>
      </div>
    </li>
  );
}

function AddAddOn({
  addOns,
  onAdd,
}: {
  addOns: PricingEditorProps["addOns"];
  onAdd: (addOnId: string, units: number) => Promise<boolean>;
}) {
  const [addOnId, setAddOnId] = React.useState("");
  const [units, setUnits] = React.useState(1);
  const [pending, setPending] = React.useState(false);
  const selected = addOns.find((a) => a.id === addOnId);
  return (
    <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
      <Field label="Agregar add-on del catálogo" className="min-w-0 flex-1">
        {(p) => (
          <NativeSelect {...p} value={addOnId} onChange={(e) => { setAddOnId(e.target.value); setUnits(1); }}>
            <option value="">Elige un add-on…</option>
            {addOns.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {formatMXN(a.priceCents)}
                {a.pricingType === "PER_GUEST" ? " por persona" : ""}
                {a.active ? "" : " (inactivo)"}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      {selected && selected.maxQuantity > 1 ? (
        <div>
          <p className="mb-1.5 text-sm font-medium">Unidades</p>
          <QuantityInput label="Unidades del add-on" value={units} min={1} max={selected.maxQuantity} onValueChange={setUnits} />
        </div>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={!addOnId || pending}
        onClick={async () => {
          setPending(true);
          const ok = await onAdd(addOnId, units);
          setPending(false);
          if (ok) {
            setAddOnId("");
            setUnits(1);
          }
        }}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />} Agregar
      </Button>
    </div>
  );
}

function CustomLineDialog({ onAdd }: { onAdd: (line: EditorLine) => void }) {
  const [open, setOpen] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const [price, setPrice] = React.useState<number | null>(null);
  const [cost, setCost] = React.useState<number | null>(0);
  const [category, setCategory] = React.useState<CostCategory>("OTHER");
  const [error, setError] = React.useState<string | null>(null);
  const categories = toOptions(COST_CATEGORY_LABELS).filter((c) => c.value !== "PAYMENT_FEE");

  function submit() {
    if (description.trim().length < 2) return setError("Describe el concepto.");
    if (price == null || price < 0) return setError("Indica el precio unitario.");
    onAdd({
      itemId: null,
      type: "CUSTOM",
      refId: null,
      description: description.trim(),
      quantity,
      unitPriceCents: price,
      unitCostCents: cost ?? 0,
      costCategory: category,
    });
    setOpen(false);
    setDescription("");
    setQuantity(1);
    setPrice(null);
    setCost(0);
    setCategory("OTHER");
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="lg">
          <Plus aria-hidden /> Concepto personalizado
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Concepto personalizado</DialogTitle>
          <DialogDescription>Para pedidos especiales fuera del catálogo. El costo sólo lo ve el equipo.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Descripción" required className="sm:col-span-2" error={error ?? undefined}>
            {(p) => <Input {...p} className="h-9" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
          <Field label="Cantidad" required>
            {() => <QuantityInput label="Cantidad" value={quantity} min={1} max={10_000} onValueChange={setQuantity} />}
          </Field>
          <Field label="Categoría de costo">
            {(p) => (
              <NativeSelect {...p} value={category} onChange={(e) => setCategory(e.target.value as CostCategory)}>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label="Precio unitario" required>
            {(p) => <MoneyInput {...p} value={price} onValueChange={setPrice} />}
          </Field>
          <Field label="Costo unitario">
            {(p) => <MoneyInput {...p} value={cost} onValueChange={setCost} />}
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit}>
            Agregar concepto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
