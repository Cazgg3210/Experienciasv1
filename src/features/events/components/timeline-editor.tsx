"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Clock, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { timelineItemSchema, type TimelineItemInput } from "../schemas";
import { deleteTimelineItemAction, saveTimelineItemAction } from "../server/actions";
import { inputSizeClass } from "./form-styles";
import { useReturnFocus } from "./use-return-focus";

export type TimelineItemView = {
  id: string;
  time: string;
  title: string;
  description: string | null;
  visibleToGuests: boolean;
  sortOrder: number;
};

/** Programa del evento (lo ven invitadas y clienta si es visible). */
export function TimelineEditor({
  eventId,
  items,
  canWrite,
  defaultTime,
}: {
  eventId: string;
  items: TimelineItemView[];
  canWrite: boolean;
  defaultTime: string;
}) {
  const [editing, setEditing] = React.useState<TimelineItemView | "new" | null>(null);
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.time.localeCompare(b.time));
  const nextOrder = sorted.length ? Math.min(999, Math.max(...sorted.map((i) => i.sortOrder)) + 10) : 10;

  async function remove(item: TimelineItemView) {
    const res = await deleteTimelineItemAction({ eventId, itemId: item.id });
    if (handleActionResult(res)) toast.success("Momento eliminado del programa");
  }

  return (
    <section
      aria-labelledby="timeline-title"
      className="bg-card space-y-4 rounded-xl border p-4 shadow-xs sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="timeline-title" className="font-heading text-xl font-semibold">
            Programa del evento
          </h2>
          <p className="text-muted-foreground text-sm">
            Los momentos visibles aparecen en el micrositio y el portal.
          </p>
        </div>
        {canWrite ? (
          <Button variant="outline" onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            Agregar momento
          </Button>
        ) : null}
      </div>

      {sorted.length === 0 ? (
        <p className="text-muted-foreground bg-sand-soft/50 rounded-lg border border-dashed px-4 py-6 text-center text-sm">
          Aún no hay programa. Agrega la llegada, el brunch, el pastel… para que todas sepan qué sigue.
        </p>
      ) : (
        <ol className="relative space-y-3 border-l pl-5">
          {sorted.map((item) => (
            <li key={item.id} className="relative">
              <span
                aria-hidden
                className="bg-sage border-card absolute top-1.5 -left-[27px] size-3 rounded-full border-2"
              />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="tabular text-olive inline-flex items-center gap-1 text-sm font-semibold">
                      <Clock className="size-3.5" aria-hidden />
                      {item.time}
                    </span>
                    <span className="font-medium">{item.title}</span>
                  </p>
                  {item.description ? (
                    <p className="text-muted-foreground text-sm">{item.description}</p>
                  ) : null}
                  <p className="text-muted-foreground mt-0.5 inline-flex items-center gap-1 text-xs">
                    {item.visibleToGuests ? (
                      <>
                        <Eye className="size-3.5" aria-hidden /> Visible para invitadas
                      </>
                    ) : (
                      <>
                        <EyeOff className="size-3.5" aria-hidden /> Sólo equipo
                      </>
                    )}
                  </p>
                </div>
                {canWrite ? (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditing(item)}
                      aria-label={`Editar ${item.title}`}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <ConfirmDialog
                      title="¿Eliminar este momento?"
                      description={`“${item.title}” (${item.time}) se quitará del programa.`}
                      confirmLabel="Eliminar"
                      destructive
                      onConfirm={() => remove(item)}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label={`Eliminar ${item.title}`}>
                          <Trash2 aria-hidden />
                        </Button>
                      }
                    />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}

      {canWrite ? (
        <TimelineItemDialog
          key={editing === "new" ? "new" : (editing?.id ?? "closed")}
          eventId={eventId}
          item={editing === "new" ? null : editing}
          open={editing !== null}
          onOpenChange={(o) => !o && setEditing(null)}
          defaults={{ time: defaultTime, sortOrder: nextOrder }}
        />
      ) : null}
    </section>
  );
}

function TimelineItemDialog({
  eventId,
  item,
  open,
  onOpenChange,
  defaults,
}: {
  eventId: string;
  item: TimelineItemView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults: { time: string; sortOrder: number };
}) {
  const onCloseAutoFocus = useReturnFocus(open);
  const form = useForm<TimelineItemInput>({
    resolver: zodResolver(timelineItemSchema),
    defaultValues: {
      eventId,
      itemId: item?.id ?? "",
      time: item?.time ?? defaults.time,
      title: item?.title ?? "",
      description: item?.description ?? "",
      visibleToGuests: item?.visibleToGuests ?? true,
      sortOrder: item?.sortOrder ?? defaults.sortOrder,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const visible = form.watch("visibleToGuests");

  async function onSubmit(values: TimelineItemInput) {
    const res = await saveTimelineItemAction(values);
    if (!handleActionResult(res, { form, success: item ? "Momento actualizado" : "Momento agregado" }))
      return;
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md" onCloseAutoFocus={onCloseAutoFocus}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{item ? "Editar momento" : "Nuevo momento del programa"}</DialogTitle>
            <DialogDescription>Hora local del evento (HH:mm).</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hora" required error={errors.time?.message}>
              {(p) => (
                <Input {...p} {...form.register("time")} type="time" step={300} className={inputSizeClass} />
              )}
            </Field>
            <Field label="Orden" error={errors.sortOrder?.message} description="Menor = primero.">
              {(p) => (
                <Input
                  {...p}
                  {...form.register("sortOrder", { valueAsNumber: true })}
                  type="number"
                  min={0}
                  max={999}
                  className={inputSizeClass}
                />
              )}
            </Field>
          </div>
          <Field label="Título" required error={errors.title?.message}>
            {(p) => (
              <Input
                {...p}
                {...form.register("title")}
                placeholder="Llegada y mimosas"
                className={inputSizeClass}
              />
            )}
          </Field>
          <Field label="Descripción" error={errors.description?.message}>
            {(p) => <Textarea {...p} {...form.register("description")} rows={2} />}
          </Field>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`tl-visible-${item?.id ?? "new"}`}
              checked={visible}
              onCheckedChange={(v) => form.setValue("visibleToGuests", v === true, { shouldDirty: true })}
            />
            <label htmlFor={`tl-visible-${item?.id ?? "new"}`} className="text-sm">
              Visible para invitadas
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <SubmitButton pending={isSubmitting}>{item ? "Guardar" : "Agregar"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
