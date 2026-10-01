"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { CHECKLIST_PHASE_LABELS, CHECKLIST_PHASE_ORDER } from "@/lib/labels";
import { templateSchema, type TemplateFormValues } from "../schemas";
import { createTemplateAction, deleteTemplateAction, updateTemplateAction } from "../server/actions";
import { NativeSelect } from "./native-select";

type Out = z.output<typeof templateSchema>;
type ExperienceOpt = { id: string; name: string; active: boolean };

function TemplateFields({
  form,
  experiences,
  disabled,
}: {
  form: UseFormReturn<TemplateFormValues, unknown, Out>;
  experiences: ExperienceOpt[];
  disabled?: boolean;
}) {
  const errors = form.formState.errors;
  return (
    <div className="space-y-4">
      <Field label="Nombre" error={errors.name?.message} required>
        {(p) => <Input {...p} disabled={disabled} {...form.register("name")} placeholder="Ej. T-3 · Saldo, proveedores y RSVP" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fase" error={errors.phase?.message} required>
          {(p) => (
            <NativeSelect {...p} disabled={disabled} {...form.register("phase")}>
              {CHECKLIST_PHASE_ORDER.map((ph) => (
                <option key={ph} value={ph}>
                  {CHECKLIST_PHASE_LABELS[ph]}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Experiencia" description="Vacío = aplica a todas" error={errors.experienceId?.message}>
          {(p) => (
            <NativeSelect {...p} disabled={disabled} {...form.register("experienceId")}>
              <option value="">Todas las experiencias</option>
              {experiences.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.active ? "" : " (inactiva)"}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Orden" description="Menor primero dentro de la fase" error={errors.sortOrder?.message}>
          {(p) => (
            <Input {...p} type="number" min={0} max={9999} inputMode="numeric" disabled={disabled} {...form.register("sortOrder", { valueAsNumber: true })} />
          )}
        </Field>
        <div className="flex items-end pb-1.5">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch
              aria-label="Plantilla activa"
              checked={!!form.watch("active")}
              disabled={disabled}
              onCheckedChange={(v) => form.setValue("active", v, { shouldDirty: true })}
            />
            Activa (se usa al generar checklists)
          </label>
        </div>
      </div>
      <Field label="Descripción" error={errors.description?.message}>
        {(p) => <Textarea {...p} rows={2} disabled={disabled} {...form.register("description")} />}
      </Field>
    </div>
  );
}

export function NewTemplateDialog({ experiences }: { experiences: ExperienceOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const form = useForm<TemplateFormValues, unknown, Out>({
    resolver: zodResolver(templateSchema),
    defaultValues: { name: "", phase: "T_MINUS_7", description: "", experienceId: "", active: true, sortOrder: 0 },
  });

  async function onSubmit(values: Out) {
    const res = await createTemplateAction(values);
    if (handleActionResult(res, { form, success: "Plantilla creada" })) {
      setOpen(false);
      router.push(`/admin/operations/templates/${res.data.id}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden />
          Nueva plantilla
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva plantilla de checklist</DialogTitle>
          <DialogDescription>Después podrás agregarle tareas con su desfase respecto al inicio del evento.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <TemplateFields form={form} experiences={experiences} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={form.formState.isSubmitting}>Crear plantilla</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditTemplateForm({
  template,
  experiences,
  canWrite,
}: {
  template: { id: string; name: string; phase: TemplateFormValues["phase"]; description: string | null; experienceId: string | null; active: boolean; sortOrder: number };
  experiences: ExperienceOpt[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const form = useForm<TemplateFormValues, unknown, Out>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: template.name,
      phase: template.phase,
      description: template.description ?? "",
      experienceId: template.experienceId ?? "",
      active: template.active,
      sortOrder: template.sortOrder,
    },
  });

  async function onSubmit(values: Out) {
    const res = await updateTemplateAction({ ...values, id: template.id });
    if (handleActionResult(res, { form, success: "Plantilla guardada" })) {
      form.reset({ ...values, description: values.description ?? "", experienceId: values.experienceId ?? "" });
      router.refresh();
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <TemplateFields form={form} experiences={experiences} disabled={!canWrite} />
      {canWrite ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ConfirmDialog
            trigger={
              <Button type="button" variant="ghost" className="text-destructive">
                <Trash2 className="size-4" aria-hidden />
                Eliminar plantilla
              </Button>
            }
            title="¿Eliminar esta plantilla?"
            description="Se borran sus tareas modelo. Los checklists ya generados en eventos no se modifican."
            confirmLabel="Eliminar"
            destructive
            onConfirm={async () => {
              const res = await deleteTemplateAction({ id: template.id });
              if (handleActionResult(res, { success: "Plantilla eliminada" })) router.push("/admin/operations/templates");
            }}
          />
          <SubmitButton pending={form.formState.isSubmitting} disabled={!form.formState.isDirty}>
            Guardar cambios
          </SubmitButton>
        </div>
      ) : null}
    </form>
  );
}
