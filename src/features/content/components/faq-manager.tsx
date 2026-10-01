"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HelpCircle, Pencil, Plus } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { NativeSelect } from "@/features/settings/components/native-select";
import { FAQ_CATEGORIES, FAQ_CATEGORY_LABELS, faqCategoryLabel, faqSchema, type FaqCategory, type FaqValues } from "../schemas";
import { deleteFaqAction, moveFaqAction, saveFaqAction, setFaqActiveAction } from "../server/actions";
import { DeleteButton, OrderButtons, ToggleSwitch } from "./content-controls";

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  category: string;
  experience: { id: string; name: string } | null;
  active: boolean;
  sortOrder: number;
};

const EMPTY: FaqValues = { question: "", answer: "", category: "general", experienceId: "", active: true, sortOrder: 0 };

function FaqDialog({
  open,
  onOpenChange,
  initial,
  experiences,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: FaqValues;
  experiences: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<FaqValues>({ resolver: zodResolver(faqSchema), values: initial });
  const errors = form.formState.errors;
  const editing = !!initial.id;
  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await saveFaqAction(values);
      if (handleActionResult(res, { form, success: editing ? "Pregunta actualizada" : "Pregunta agregada" })) {
        onOpenChange(false);
        router.refresh();
      }
    }),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{editing ? "Editar pregunta" : "Nueva pregunta frecuente"}</DialogTitle>
          <DialogDescription>Respuestas claras y cálidas reducen las dudas antes de reservar.</DialogDescription>
        </DialogHeader>
        <form id="faq-form" onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Pregunta" error={errors.question?.message} required>
            {(p) => <Input {...p} {...form.register("question")} />}
          </Field>
          <Field label="Respuesta" error={errors.answer?.message} required>
            {(p) => <Textarea {...p} rows={5} {...form.register("answer")} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoría" error={errors.category?.message} required>
              {(p) => (
                <NativeSelect {...p} {...form.register("category")}>
                  {FAQ_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {FAQ_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="Experiencia" description="Opcional: sólo para una experiencia." error={errors.experienceId?.message}>
              {(p) => (
                <NativeSelect {...p} {...form.register("experienceId")}>
                  <option value="">Todas (general)</option>
                  {experiences.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="Orden" description="Menor número aparece primero." error={errors.sortOrder?.message} required>
              {(p) => <Input {...p} type="number" min={0} max={9999} className="tabular" {...form.register("sortOrder", { valueAsNumber: true })} />}
            </Field>
            <div className="flex items-center gap-3 self-end rounded-lg border p-3">
              <Controller
                control={form.control}
                name="active"
                render={({ field }) => <Switch id="faq-active" checked={field.value} onCheckedChange={field.onChange} />}
              />
              <Label htmlFor="faq-active">Visible en el sitio</Label>
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" size="lg" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <SubmitButton form="faq-form" size="lg" pending={pending}>
            {editing ? "Guardar cambios" : "Agregar pregunta"}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FaqManager({ items, experiences }: { items: FaqItem[]; experiences: Array<{ id: string; name: string }> }) {
  const [category, setCategory] = useState<FaqCategory | "all">("all");
  const [dialog, setDialog] = useState<{ open: boolean; initial: FaqValues }>({ open: false, initial: EMPTY });
  const nextOrder = items.length ? Math.max(...items.map((i) => i.sortOrder)) + 1 : 1;
  const visible = category === "all" ? items : items.filter((i) => i.category === category);
  const counts = Object.fromEntries(FAQ_CATEGORIES.map((c) => [c, items.filter((i) => i.category === c).length]));

  const openNew = () =>
    setDialog({ open: true, initial: { ...EMPTY, category: category === "all" ? "general" : category, sortOrder: nextOrder } });
  const openEdit = (f: FaqItem) =>
    setDialog({
      open: true,
      initial: {
        id: f.id,
        question: f.question,
        answer: f.answer,
        category: (FAQ_CATEGORIES as readonly string[]).includes(f.category) ? (f.category as FaqCategory) : "general",
        experienceId: f.experience?.id ?? "",
        active: f.active,
        sortOrder: f.sortOrder,
      },
    });

  return (
    <section aria-labelledby="faq-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="faq-title" className="font-heading text-2xl font-semibold">
            Preguntas frecuentes
          </h2>
          <p className="text-muted-foreground text-sm">
            {items.length} pregunta{items.length === 1 ? "" : "s"}. Las generales aparecen en el sitio; las ligadas a una
            experiencia, en su página.
          </p>
        </div>
        <Button size="lg" onClick={openNew}>
          <Plus aria-hidden />
          Nueva pregunta
        </Button>
      </div>

      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
          {(["all", ...FAQ_CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={cn(
                "focus-visible:ring-ring/50 rounded-full border px-3 py-1 text-sm outline-none focus-visible:ring-3",
                category === c ? "bg-sage-soft text-olive border-sage/40 font-medium" : "bg-card hover:bg-muted text-muted-foreground",
              )}
            >
              {c === "all" ? `Todas (${items.length})` : `${FAQ_CATEGORY_LABELS[c]} (${counts[c] ?? 0})`}
            </button>
          ))}
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title="Aún no hay preguntas frecuentes"
          description="Responde aquí lo que más te preguntan por WhatsApp: anticipo, horarios, alergias, montaje."
          action={
            <Button onClick={openNew}>
              <Plus aria-hidden />
              Agregar la primera
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState icon={HelpCircle} title="Sin preguntas en esta categoría" description="Elige otra categoría o agrega una nueva." />
      ) : (
        <ul className="space-y-3">
          {visible.map((f) => {
            const globalIndex = items.findIndex((x) => x.id === f.id);
            return (
              <li key={f.id} className="bg-card rounded-xl border p-4 shadow-xs sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone="brand" dot={false}>
                        {faqCategoryLabel(f.category)}
                      </StatusBadge>
                      {f.experience ? (
                        <StatusBadge tone="neutral" dot={false}>
                          {f.experience.name}
                        </StatusBadge>
                      ) : null}
                      {!f.active ? <StatusBadge tone="muted">Oculta</StatusBadge> : null}
                    </div>
                    <p className="font-medium">{f.question}</p>
                    <p className="text-muted-foreground line-clamp-3 text-sm whitespace-pre-line">{f.answer}</p>
                  </div>
                  <OrderButtons
                    label={`pregunta “${f.question}”`}
                    isFirst={globalIndex === 0}
                    isLast={globalIndex === items.length - 1}
                    disabled={category !== "all"}
                    onMove={(direction) => moveFaqAction({ id: f.id, direction })}
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3">
                  <ToggleSwitch
                    id={`faq-active-${f.id}`}
                    label="Visible"
                    checked={f.active}
                    onToggle={(active) => setFaqActiveAction({ id: f.id, active })}
                    successOn="Pregunta visible en el sitio"
                    successOff="Pregunta oculta"
                  />
                  <div className="ml-auto flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => openEdit(f)}>
                      <Pencil aria-hidden />
                      Editar
                    </Button>
                    <DeleteButton
                      title="¿Eliminar esta pregunta?"
                      description="Dejará de mostrarse en el sitio. Si sólo quieres ocultarla, apaga “Visible”."
                      onDelete={() => deleteFaqAction({ id: f.id })}
                      success="Pregunta eliminada"
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {category !== "all" && visible.length > 1 ? (
        <p className="text-muted-foreground text-xs">Para reordenar, vuelve a “Todas”.</p>
      ) : null}

      <FaqDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        initial={dialog.initial}
        experiences={experiences}
      />
    </section>
  );
}
