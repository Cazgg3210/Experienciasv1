"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { CHECKLIST_AREA_LABELS, CHECKLIST_PHASE_LABELS, CHECKLIST_PHASE_ORDER, toOptions } from "@/lib/labels";
import { createChecklistItemSchema } from "../schemas";
import { createChecklistItemAction } from "../server/actions";
import { NativeSelect } from "./native-select";
import { AssigneeOptions, type AssigneeOption } from "./assignee-options";

const formSchema = createChecklistItemSchema.omit({ eventId: true });
type FormIn = z.input<typeof formSchema>;
type FormOut = z.output<typeof formSchema>;

export function AddChecklistItemDialog({
  eventId,
  staffOptions,
}: {
  eventId: string;
  staffOptions: AssigneeOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      phase: "T_MINUS_3",
      area: "GENERAL",
      dueAt: "",
      assigneeId: "",
      requiresEvidence: false,
      description: "",
    },
  });
  const errors = form.formState.errors;

  async function onSubmit(values: FormOut) {
    const res = await createChecklistItemAction({ ...values, eventId });
    if (handleActionResult(res, { form, success: "Tarea agregada" })) {
      form.reset();
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Plus className="size-4" aria-hidden />
          Agregar tarea
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva tarea personalizada</DialogTitle>
          <DialogDescription>Para pendientes específicos de este evento que no están en las plantillas.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Título" error={errors.title?.message} required>
            {(p) => <Input {...p} {...form.register("title")} placeholder="Ej. Recoger globos con el proveedor" />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fase" error={errors.phase?.message} required>
              {(p) => (
                <NativeSelect {...p} {...form.register("phase")}>
                  {CHECKLIST_PHASE_ORDER.map((ph) => (
                    <option key={ph} value={ph}>
                      {CHECKLIST_PHASE_LABELS[ph]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
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
            <Field label="Fecha límite" description="Hora de CDMX" error={errors.dueAt?.message}>
              {(p) => <Input {...p} type="datetime-local" {...form.register("dueAt")} />}
            </Field>
            <Field label="Responsable" error={errors.assigneeId?.message}>
              {(p) => (
                <NativeSelect {...p} {...form.register("assigneeId")}>
                  <option value="">Sin responsable</option>
                  <AssigneeOptions options={staffOptions} />
                </NativeSelect>
              )}
            </Field>
          </div>
          <Field label="Descripción" error={errors.description?.message}>
            {(p) => <Textarea {...p} {...form.register("description")} rows={3} />}
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              aria-label="Requiere foto de evidencia"
              checked={!!form.watch("requiresEvidence")}
              onCheckedChange={(v) => form.setValue("requiresEvidence", v === true)}
            />
            Requiere foto de evidencia para marcarla como hecha
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={form.formState.isSubmitting}>Agregar tarea</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
