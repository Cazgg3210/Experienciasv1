"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/data/status-badge";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { testimonialSchema, type TestimonialValues } from "../schemas";
import {
  deleteTestimonialAction,
  moveTestimonialAction,
  saveTestimonialAction,
  setTestimonialActiveAction,
} from "../server/actions";
import { DeleteButton, OrderButtons, Stars, StarRatingInput, ToggleSwitch } from "./content-controls";

export type TestimonialItem = {
  id: string;
  authorName: string;
  occasion: string | null;
  body: string;
  rating: number;
  active: boolean;
  sortOrder: number;
};

function TestimonialDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: TestimonialValues;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<TestimonialValues>({ resolver: zodResolver(testimonialSchema), values: initial });
  const errors = form.formState.errors;
  const editing = !!initial.id;
  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await saveTestimonialAction(values);
      if (handleActionResult(res, { form, success: editing ? "Testimonio actualizado" : "Testimonio agregado" })) {
        onOpenChange(false);
        router.refresh();
      }
    }),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{editing ? "Editar testimonio" : "Nuevo testimonio"}</DialogTitle>
          <DialogDescription>Usa las palabras de la clienta y pide su autorización antes de publicarlo.</DialogDescription>
        </DialogHeader>
        <form id="testimonial-form" onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Autora" error={errors.authorName?.message} required>
              {(p) => <Input {...p} placeholder="Ej. Daniela R." {...form.register("authorName")} />}
            </Field>
            <Field label="Ocasión" description="Opcional" error={errors.occasion?.message}>
              {(p) => <Input {...p} placeholder="Ej. Cumpleaños 30" {...form.register("occasion")} />}
            </Field>
          </div>
          <Field label="Testimonio" error={errors.body?.message} required>
            {(p) => <Textarea {...p} rows={5} {...form.register("body")} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Calificación" error={errors.rating?.message} required>
              {(p) => (
                <Controller
                  control={form.control}
                  name="rating"
                  render={({ field }) => (
                    <StarRatingInput
                      name={p.id}
                      value={field.value}
                      onChange={field.onChange}
                      describedBy={p["aria-describedby"]}
                    />
                  )}
                />
              )}
            </Field>
            <Field label="Orden" description="Menor número aparece primero." error={errors.sortOrder?.message} required>
              {(p) => <Input {...p} type="number" min={0} max={9999} className="tabular" {...form.register("sortOrder", { valueAsNumber: true })} />}
            </Field>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Controller
              control={form.control}
              name="active"
              render={({ field }) => (
                <Switch id="testimonial-active" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label htmlFor="testimonial-active">Visible en el sitio</Label>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" size="lg" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <SubmitButton form="testimonial-form" size="lg" pending={pending}>
            {editing ? "Guardar cambios" : "Agregar testimonio"}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TestimonialsManager({ items }: { items: TestimonialItem[] }) {
  const [dialog, setDialog] = useState<{ open: boolean; initial: TestimonialValues }>({
    open: false,
    initial: { authorName: "", occasion: "", body: "", rating: 5, active: true, sortOrder: 0 },
  });
  const nextOrder = items.length ? Math.max(...items.map((i) => i.sortOrder)) + 1 : 1;
  const openNew = () =>
    setDialog({
      open: true,
      initial: { authorName: "", occasion: "", body: "", rating: 5, active: true, sortOrder: nextOrder },
    });
  const openEdit = (t: TestimonialItem) =>
    setDialog({
      open: true,
      initial: {
        id: t.id,
        authorName: t.authorName,
        occasion: t.occasion ?? "",
        body: t.body,
        rating: t.rating,
        active: t.active,
        sortOrder: t.sortOrder,
      },
    });
  const activeCount = items.filter((i) => i.active).length;

  return (
    <section aria-labelledby="testimonials-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="testimonials-title" className="font-heading text-2xl font-semibold">
            Testimonios
          </h2>
          <p className="text-muted-foreground text-sm">
            {activeCount} visible{activeCount === 1 ? "" : "s"} de {items.length}. Se muestran en el orden indicado.
          </p>
        </div>
        <Button size="lg" onClick={openNew}>
          <Plus aria-hidden />
          Nuevo testimonio
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Quote}
          title="Aún no hay testimonios"
          description="Agrega las palabras de tus clientas felices: son la mejor prueba social del sitio."
          action={
            <Button onClick={openNew}>
              <Plus aria-hidden />
              Agregar el primero
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {items.map((t, i) => (
            <li key={t.id} className="bg-card rounded-xl border p-4 shadow-xs sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{t.authorName}</p>
                    {t.occasion ? <span className="text-muted-foreground text-sm">· {t.occasion}</span> : null}
                    <Stars value={t.rating} />
                    {!t.active ? <StatusBadge tone="muted">Oculto</StatusBadge> : null}
                  </div>
                  <blockquote className="text-muted-foreground border-sage border-l-2 pl-3 text-sm italic">
                    “{t.body}”
                  </blockquote>
                </div>
                <OrderButtons
                  label={`testimonio de ${t.authorName}`}
                  isFirst={i === 0}
                  isLast={i === items.length - 1}
                  onMove={(direction) => moveTestimonialAction({ id: t.id, direction })}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3">
                <ToggleSwitch
                  id={`t-active-${t.id}`}
                  label="Visible"
                  checked={t.active}
                  onToggle={(active) => setTestimonialActiveAction({ id: t.id, active })}
                  successOn="Testimonio visible en el sitio"
                  successOff="Testimonio oculto"
                />
                <div className="ml-auto flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => openEdit(t)}>
                    <Pencil aria-hidden />
                    Editar
                  </Button>
                  <DeleteButton
                    title="¿Eliminar este testimonio?"
                    description={`Se eliminará el testimonio de ${t.authorName}. Si sólo quieres ocultarlo, apaga “Visible”.`}
                    onDelete={() => deleteTestimonialAction({ id: t.id })}
                    success="Testimonio eliminado"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <TestimonialDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        initial={dialog.initial}
      />
    </section>
  );
}
