"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { handleActionResult } from "@/components/forms/action-result";
import { addOnNotesSchema } from "../schemas";
import { updateAddOnNotesAction } from "../server/actions";

type In = z.input<typeof addOnNotesSchema>;
type Out = z.output<typeof addOnNotesSchema>;

/** Notas operativas editables de un add-on del evento. */
export function AddOnNotesForm({ id, name, notes, canWrite }: { id: string; name: string; notes: string | null; canWrite: boolean }) {
  const router = useRouter();
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(addOnNotesSchema),
    defaultValues: { id, notes: notes ?? "" },
  });
  const fieldId = `addon-notes-${id}`;
  const error = form.formState.errors.notes?.message;

  if (!canWrite) {
    return notes ? <p className="text-sm">{notes}</p> : <p className="text-muted-foreground text-sm">Sin notas operativas.</p>;
  }

  async function onSubmit(values: Out) {
    const res = await updateAddOnNotesAction(values);
    if (handleActionResult(res, { form, success: "Notas guardadas" })) {
      form.reset({ id, notes: values.notes ?? "" });
      router.refresh();
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2" noValidate>
      <label htmlFor={fieldId} className="sr-only">
        Notas operativas de {name}
      </label>
      <Textarea
        id={fieldId}
        rows={2}
        placeholder="Proveedor, horario de entrega, detalles de montaje…"
        className="print:hidden"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-err` : undefined}
        {...form.register("notes")}
      />
      <p className="hidden text-sm print:block">{notes}</p>
      {error ? (
        <p id={`${fieldId}-err`} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        size="sm"
        variant="outline"
        className="print:hidden"
        disabled={form.formState.isSubmitting || !form.formState.isDirty}
      >
        {form.formState.isSubmitting ? "Guardando…" : "Guardar notas"}
      </Button>
    </form>
  );
}
