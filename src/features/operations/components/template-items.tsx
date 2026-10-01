"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import type { ChecklistArea, StaffFunction } from "@prisma/client";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { StatusBadge } from "@/components/data/status-badge";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { CHECKLIST_AREA_LABELS, STAFF_FUNCTION_LABELS, toOptions } from "@/lib/labels";
import {
  describeOffset,
  OFFSET_DIRECTION_LABELS,
  OFFSET_UNIT_LABELS,
  offsetToParts,
  partsToOffset,
  type OffsetDirection,
  type OffsetUnit,
} from "../domain/checklist";
import { templateItemSchema, type TemplateItemFormValues } from "../schemas";
import { createTemplateItemAction, deleteTemplateItemAction, updateTemplateItemAction } from "../server/actions";
import { NativeSelect } from "./native-select";

type Out = z.output<typeof templateItemSchema>;

export type TemplateItemRow = {
  id: string;
  title: string;
  description: string | null;
  area: ChecklistArea;
  offsetMinutes: number;
  defaultFunction: StaffFunction | null;
  requiresEvidence: boolean;
  sortOrder: number;
};

export function TemplateItems({
  templateId,
  items,
  canWrite,
}: {
  templateId: string;
  items: TemplateItemRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<{ item: TemplateItemRow | null } | null>(null);
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.offsetMinutes - b.offsetMinutes);

  return (
    <div className="space-y-4">
      {canWrite ? (
        <div className="flex justify-end">
          <Button type="button" onClick={() => setDialog({ item: null })}>
            <Plus className="size-4" aria-hidden />
            Agregar tarea
          </Button>
        </div>
      ) : null}
      {sorted.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Esta plantilla aún no tiene tareas"
          description="Agrega tareas con su área, responsable sugerido y cuándo deben estar listas."
        />
      ) : (
        <ol className="divide-y rounded-xl border">
          {sorted.map((item, idx) => (
            <li key={item.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <span className="bg-sage-soft text-olive flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums" aria-hidden>
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.title}</p>
                <p className="text-muted-foreground text-xs">
                  {CHECKLIST_AREA_LABELS[item.area]} · {describeOffset(item.offsetMinutes)} ·{" "}
                  {item.defaultFunction ? STAFF_FUNCTION_LABELS[item.defaultFunction] : "Sin función por defecto"}
                </p>
                {item.description ? <p className="text-muted-foreground mt-1 text-xs">{item.description}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                {item.requiresEvidence ? (
                  <StatusBadge tone="warning" dot={false}>
                    <Camera className="size-3" aria-hidden />
                    Evidencia
                  </StatusBadge>
                ) : null}
                {canWrite ? (
                  <>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Editar ${item.title}`} onClick={() => setDialog({ item })}>
                      <Pencil className="size-4" />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button type="button" variant="ghost" size="icon" aria-label={`Eliminar ${item.title}`} className="text-destructive">
                          <Trash2 className="size-4" />
                        </Button>
                      }
                      title="¿Eliminar esta tarea de la plantilla?"
                      description="Los eventos que ya la tienen conservan su copia."
                      confirmLabel="Eliminar"
                      destructive
                      onConfirm={async () => {
                        const res = await deleteTemplateItemAction({ id: item.id });
                        if (handleActionResult(res, { success: "Tarea eliminada" })) router.refresh();
                      }}
                    />
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
      {dialog ? (
        <TemplateItemDialog
          key={dialog.item?.id ?? "new"}
          templateId={templateId}
          item={dialog.item}
          nextSortOrder={(sorted.at(-1)?.sortOrder ?? 0) + 1}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

const UNIT_OPTIONS = Object.entries(OFFSET_UNIT_LABELS) as Array<[OffsetUnit, string]>;
const DIRECTION_OPTIONS = Object.entries(OFFSET_DIRECTION_LABELS) as Array<[OffsetDirection, string]>;

function TemplateItemDialog({
  templateId,
  item,
  nextSortOrder,
  onClose,
}: {
  templateId: string;
  item: TemplateItemRow | null;
  nextSortOrder: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const parts = offsetToParts(item?.offsetMinutes ?? -1440);
  const form = useForm<TemplateItemFormValues, unknown, Out>({
    resolver: zodResolver(templateItemSchema),
    defaultValues: {
      title: item?.title ?? "",
      description: item?.description ?? "",
      area: item?.area ?? "GENERAL",
      offsetAmount: parts.amount,
      offsetUnit: parts.unit,
      offsetDirection: parts.direction,
      defaultFunction: item?.defaultFunction ?? "",
      requiresEvidence: item?.requiresEvidence ?? false,
      sortOrder: item?.sortOrder ?? nextSortOrder,
    },
  });
  const errors = form.formState.errors;
  const amount = form.watch("offsetAmount");
  const unit = form.watch("offsetUnit");
  const direction = form.watch("offsetDirection");
  const preview =
    typeof amount === "number" && Number.isFinite(amount) && amount >= 0
      ? describeOffset(partsToOffset({ amount, unit, direction }))
      : "—";

  async function onSubmit(values: Out) {
    const res = item
      ? await updateTemplateItemAction({ ...values, id: item.id })
      : await createTemplateItemAction({ ...values, templateId });
    if (handleActionResult(res, { form, success: item ? "Tarea actualizada" : "Tarea agregada" })) {
      onClose();
      router.refresh();
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Editar tarea de plantilla" : "Nueva tarea de plantilla"}</DialogTitle>
          <DialogDescription>El desfase se calcula respecto a la hora de inicio de cada evento.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Título" error={errors.title?.message} required>
            {(p) => <Input {...p} {...form.register("title")} placeholder="Ej. Confirmar menú y alergias" />}
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Cuándo debe estar lista</legend>
            <div className="grid grid-cols-[5rem_1fr] gap-2 sm:grid-cols-[5rem_1fr_1.4fr]">
              <Field label="Cantidad" error={errors.offsetAmount?.message}>
                {(p) => <Input {...p} type="number" min={0} inputMode="numeric" {...form.register("offsetAmount", { valueAsNumber: true })} />}
              </Field>
              <Field label="Unidad">
                {(p) => (
                  <NativeSelect {...p} {...form.register("offsetUnit")}>
                    {UNIT_OPTIONS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              <Field label="Referencia" className="col-span-2 sm:col-span-1">
                {(p) => (
                  <NativeSelect {...p} {...form.register("offsetDirection")}>
                    {DIRECTION_OPTIONS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
            </div>
            <p className="text-muted-foreground text-xs" aria-live="polite">
              Vence: <span className="text-foreground font-medium">{preview}</span>
            </p>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Área" error={errors.area?.message} required>
              {(p) => (
                <NativeSelect {...p} {...form.register("area")}>
                  {toOptions(CHECKLIST_AREA_LABELS).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="Función por defecto" description="Se asigna a quien tenga esa función en el evento" error={errors.defaultFunction?.message}>
              {(p) => (
                <NativeSelect {...p} {...form.register("defaultFunction")}>
                  <option value="">Sin función</option>
                  {toOptions(STAFF_FUNCTION_LABELS).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="Orden" error={errors.sortOrder?.message}>
              {(p) => <Input {...p} type="number" min={0} inputMode="numeric" {...form.register("sortOrder", { valueAsNumber: true })} />}
            </Field>
            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  aria-label="Requiere foto de evidencia"
                  checked={!!form.watch("requiresEvidence")}
                  onCheckedChange={(v) => form.setValue("requiresEvidence", v === true, { shouldDirty: true })}
                />
                Requiere foto de evidencia
              </label>
            </div>
          </div>
          <Field label="Descripción" error={errors.description?.message}>
            {(p) => <Textarea {...p} rows={2} {...form.register("description")} />}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <SubmitButton pending={form.formState.isSubmitting}>{item ? "Guardar" : "Agregar"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
