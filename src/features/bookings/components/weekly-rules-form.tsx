"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { WEEKDAY_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { weeklyRulesSchema, type WeeklyRulesInput } from "../schemas";
import { saveWeeklyRulesAction } from "../server/actions";

/** Reglas por día de la semana: abierto, máximo de eventos y horario. */
export function WeeklyRulesForm({ rules }: { rules: WeeklyRulesInput["rules"] }) {
  const form = useForm<WeeklyRulesInput>({
    resolver: zodResolver(weeklyRulesSchema),
    defaultValues: { rules },
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  const values = useWatch({ control: form.control, name: "rules" });

  async function onSubmit(input: WeeklyRulesInput) {
    const res = await saveWeeklyRulesAction(input);
    if (!handleActionResult(res, { form, success: "Horario semanal guardado" })) return;
    form.reset({ rules: res.data });
  }

  const rowError = (i: number) =>
    errors.rules?.[i]?.maxEvents?.message ??
    errors.rules?.[i]?.latestEnd?.message ??
    errors.rules?.[i]?.earliestStart?.message;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="space-y-4"
      aria-labelledby="rules-title"
    >
      <div>
        <h3 id="rules-title" className="font-heading text-xl font-semibold">
          Horario semanal
        </h3>
        <p className="text-muted-foreground text-sm">
          Días que operamos, cuántos eventos por día y en qué horario.
        </p>
      </div>

      <div className="text-muted-foreground hidden grid-cols-[minmax(5.5rem,1fr)_auto_4.5rem_minmax(8.5rem,1fr)_minmax(8.5rem,1fr)] items-center gap-x-3 px-3 text-xs font-medium sm:grid">
        <span>Día</span>
        <span>Abierto</span>
        <span>Máx. eventos</span>
        <span>Hora inicio</span>
        <span>Hora fin</span>
      </div>
      <ul className="space-y-2">
        {rules.map((r, i) => {
          const open = values?.[i]?.isOpen ?? r.isOpen;
          const err = rowError(i);
          const day = WEEKDAY_LABELS[r.weekday]!;
          return (
            <li
              key={r.weekday}
              className={cn(
                "rounded-lg border px-3 py-2.5",
                !open && "bg-muted/40",
                err && "border-destructive/40",
              )}
            >
              <div className="grid grid-cols-2 items-center gap-x-3 gap-y-2 sm:grid-cols-[minmax(5.5rem,1fr)_auto_4.5rem_minmax(8.5rem,1fr)_minmax(8.5rem,1fr)]">
                <span className="font-medium">{day}</span>
                <div className="flex items-center justify-end gap-2 sm:justify-start">
                  <span className="text-muted-foreground text-xs sm:sr-only">
                    {open ? "Abierto" : "Cerrado"}
                  </span>
                  <Switch
                    checked={open}
                    aria-label={`${day}: abierto`}
                    onCheckedChange={(v) =>
                      form.setValue(`rules.${i}.isOpen`, v, { shouldDirty: true, shouldValidate: true })
                    }
                  />
                </div>
                <label className="flex flex-col gap-1 text-xs sm:block">
                  <span className="text-muted-foreground sm:sr-only">Máx. eventos ({day})</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={20}
                    disabled={!open}
                    aria-invalid={errors.rules?.[i]?.maxEvents ? true : undefined}
                    {...form.register(`rules.${i}.maxEvents`, { valueAsNumber: true })}
                    defaultValue={r.maxEvents}
                    className="h-9"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs sm:block">
                  <span className="text-muted-foreground sm:sr-only">Hora inicio ({day})</span>
                  <Input
                    type="time"
                    step={900}
                    disabled={!open}
                    {...form.register(`rules.${i}.earliestStart`)}
                    defaultValue={r.earliestStart}
                    className="h-9"
                  />
                </label>
                <label className="col-span-2 flex flex-col gap-1 text-xs sm:col-span-1 sm:block">
                  <span className="text-muted-foreground sm:sr-only">Hora fin ({day})</span>
                  <Input
                    type="time"
                    step={900}
                    disabled={!open}
                    aria-invalid={errors.rules?.[i]?.latestEnd ? true : undefined}
                    {...form.register(`rules.${i}.latestEnd`)}
                    defaultValue={r.latestEnd}
                    className="h-9"
                  />
                </label>
              </div>
              {err ? (
                <p className="text-destructive mt-1 text-xs font-medium" role="alert">
                  {err}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {errors.rules?.root?.message || errors.rules?.message ? (
        <p className="text-destructive text-sm" role="alert">
          {errors.rules?.root?.message ?? errors.rules?.message}
        </p>
      ) : null}
      <div className="flex justify-end">
        <SubmitButton pending={isSubmitting} disabled={!isDirty} size="lg">
          <Save aria-hidden />
          Guardar horario
        </SubmitButton>
      </div>
    </form>
  );
}
