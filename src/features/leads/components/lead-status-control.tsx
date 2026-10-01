"use client";

import * as React from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { LeadStatus } from "@prisma/client";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { LEAD_STATUS_LABELS } from "@/lib/labels";
import { nextLeadStatuses } from "../domain/lead-workflow";
import { changeLeadStatusSchema } from "../schemas";
import { changeLeadStatusAction } from "../server/actions";
import { NativeSelect } from "./native-select";
import { LOST_REASON_SUGGESTIONS } from "./lost-reason-dialog";

type Values = { leadId: string; toStatus: LeadStatus | ""; lostReason?: string; note?: string };

/** Cambio de estado en el detalle: sólo estados válidos según leadStatusMachine. */
export function LeadStatusControl({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const options = nextLeadStatuses(status);
  const form = useForm<Values>({
    resolver: zodResolver(changeLeadStatusSchema) as unknown as Resolver<Values>,
    defaultValues: { leadId, toStatus: "", lostReason: "", note: "" },
  });
  const {
    register,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = form;
  const toStatus = watch("toStatus");

  React.useEffect(() => {
    reset({ leadId, toStatus: "", lostReason: "", note: "" });
  }, [status, leadId, reset]);

  if (!options.length) {
    return (
      <p className="text-muted-foreground text-sm">
        Este lead está en “{LEAD_STATUS_LABELS[status]}”, un estado final. Ya no admite cambios.
      </p>
    );
  }

  async function onSubmit(values: Values) {
    const res = await changeLeadStatusAction(values as Parameters<typeof changeLeadStatusAction>[0]);
    // La acción revalida la ruta (sin router.refresh() para no abortar la respuesta RSC)
    handleActionResult(res, { form, success: `Estado actualizado a “${LEAD_STATUS_LABELS[values.toStatus as LeadStatus]}”` });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <input type="hidden" {...register("leadId")} />
      <Field label="Mover a" error={errors.toStatus ? "Elige el nuevo estado" : undefined}>
        {(p) => (
          <NativeSelect {...p} {...register("toStatus")}>
            <option value="">Elige un estado…</option>
            {options.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      {toStatus === "LOST" ? (
        <>
          <Field label="Motivo de pérdida" required error={errors.lostReason?.message}>
            {(p) => <Input {...p} maxLength={500} list={`lost-reasons-${leadId}`} {...register("lostReason")} />}
          </Field>
          <datalist id={`lost-reasons-${leadId}`}>
            {LOST_REASON_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <div className="flex flex-wrap gap-1.5">
            {LOST_REASON_SUGGESTIONS.slice(0, 4).map((s) => (
              <button
                key={s}
                type="button"
                className="bg-sand-soft hover:bg-sand rounded-full border px-2.5 py-1 text-xs transition-colors"
                onClick={() => setValue("lostReason", s, { shouldValidate: true })}
              >
                {s}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {toStatus ? (
        <Field label="Nota (opcional)" error={errors.note?.message}>
          {(p) => <Textarea {...p} rows={2} maxLength={1000} {...register("note")} />}
        </Field>
      ) : null}
      <SubmitButton pending={isSubmitting} className="w-full" disabled={!toStatus}>
        Actualizar estado
      </SubmitButton>
    </form>
  );
}
