"use client";

import * as React from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, MessageCircle, Phone, StickyNote } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { cn } from "@/lib/utils";
import { LOGGABLE_ACTIVITY_LABELS, LOGGABLE_ACTIVITY_TYPES, type LoggableActivityType } from "../domain/lead-workflow";
import { logLeadActivitySchema } from "../schemas";
import { logLeadActivityAction } from "../server/actions";

type Values = { leadId: string; type: LoggableActivityType; message: string };

const ICONS = { NOTE: StickyNote, CALL: Phone, WHATSAPP: MessageCircle, EMAIL: Mail } as const;

const PLACEHOLDERS: Record<LoggableActivityType, string> = {
  NOTE: "Algo que el equipo deba saber…",
  CALL: "¿Qué platicaron? Siguiente paso…",
  WHATSAPP: "Resumen de la conversación…",
  EMAIL: "Qué se envió o respondió…",
};

/** Registrar contacto o nota. Un contacto sobre un lead nuevo lo mueve a "Contactado". */
export function LeadActivityForm({ leadId, isNew }: { leadId: string; isNew: boolean }) {
  const form = useForm<Values>({
    resolver: zodResolver(logLeadActivitySchema) as unknown as Resolver<Values>,
    defaultValues: { leadId, type: "WHATSAPP", message: "" },
  });
  const {
    register,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = form;
  const type = watch("type");

  async function onSubmit(values: Values) {
    const res = await logLeadActivityAction(values);
    if (
      handleActionResult(res, {
        form,
        success:
          res.ok && res.data.autoContacted
            ? "Contacto registrado. El lead pasó a “Contactado”."
            : values.type === "NOTE"
              ? "Nota guardada"
              : "Contacto registrado",
      })
    ) {
      // La acción revalida la ruta: el timeline se actualiza sin router.refresh()
      reset({ leadId, type: values.type, message: "" });
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Tipo</legend>
        <div className="grid grid-cols-4 gap-1.5">
          {LOGGABLE_ACTIVITY_TYPES.map((t) => {
            const Icon = ICONS[t];
            return (
              <label
                key={t}
                className={cn(
                  "text-muted-foreground hover:bg-muted flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-medium transition-colors sm:text-xs",
                  "has-[:checked]:border-olive has-[:checked]:bg-sage-soft has-[:checked]:text-olive",
                  "has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-3",
                )}
              >
                <input type="radio" value={t} className="sr-only" {...register("type")} />
                <Icon className="size-4" aria-hidden />
                {LOGGABLE_ACTIVITY_LABELS[t].replace(" interna", "")}
              </label>
            );
          })}
        </div>
      </fieldset>
      <Field
        label={type === "NOTE" ? "Nota" : "Resumen del contacto"}
        required
        error={errors.message?.message}
        description={
          type !== "NOTE" && isNew ? "Al guardar, el lead pasará automáticamente a “Contactado”." : undefined
        }
      >
        {(p) => <Textarea {...p} rows={3} maxLength={2000} placeholder={PLACEHOLDERS[type]} {...register("message")} />}
      </Field>
      <SubmitButton pending={isSubmitting} className="w-full" variant="secondary">
        {type === "NOTE" ? "Guardar nota" : "Registrar contacto"}
      </SubmitButton>
    </form>
  );
}
