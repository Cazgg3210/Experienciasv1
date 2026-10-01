"use client";

import { CalendarDays, Clock, Info } from "lucide-react";
import { Field } from "@/components/forms/field";
import { cn } from "@/lib/utils";
import { START_TIME_MAX, START_TIME_MIN } from "../../schemas";
import { dayView, longDateLabel } from "../../domain/calendar";
import { startTimeOptions } from "../../domain/wizard";
import type { CalendarDay } from "../../types";
import { AvailabilityCalendar } from "../availability-calendar";
import type { StepProps } from "./types";

const TIMES = startTimeOptions(START_TIME_MIN, START_TIME_MAX, 30);

export function StepDate({
  draft,
  update,
  catalog,
  errorId,
  invalid,
  todayKey,
  dayStatus,
  onDaysLoaded,
}: StepProps & {
  todayKey: string;
  dayStatus: Record<string, CalendarDay>;
  onDaysLoaded: (days: CalendarDay[]) => void;
}) {
  const selected = draft.eventDate ? dayStatus[draft.eventDate] : undefined;
  const view = selected ? dayView(selected.status) : null;

  return (
    <div className="space-y-5">
      <AvailabilityCalendar
        value={draft.eventDate}
        onSelect={(k) => update({ eventDate: k })}
        todayKey={todayKey}
        maxAdvanceDays={catalog.settings.maxAdvanceDays}
        serviceAreaId={draft.zoneOther ? null : draft.serviceAreaId}
        onDaysLoaded={onDaysLoaded}
        invalid={invalid}
        describedBy={invalid ? errorId : undefined}
      />

      <div className="grid gap-5 md:grid-cols-2">
        <div
          className={cn(
            "rounded-2xl border p-4",
            draft.eventDate ? "bg-sage-soft/50 border-sage/50" : "bg-card",
          )}
        >
          <p className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
            <CalendarDays className="size-4" aria-hidden /> Tu fecha
          </p>
          {draft.eventDate ? (
            <>
              <p className="font-heading mt-1 text-xl leading-snug font-semibold first-letter:uppercase">
                {longDateLabel(draft.eventDate)}
              </p>
              {view ? <p className="text-muted-foreground mt-1 text-sm">{view.label}</p> : null}
              {view?.note ? (
                <p className="text-info mt-2 flex gap-2 text-sm">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{view.note}</span>
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground mt-1 text-sm">Elige un día en el calendario.</p>
          )}
        </div>

        <Field
          label="Hora de inicio preferida"
          description={`Podemos empezar entre ${START_TIME_MIN} y ${START_TIME_MAX} h.`}
        >
          {(p) => (
            <div className="relative">
              <Clock
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden
              />
              <select
                {...p}
                value={draft.startTime}
                onChange={(e) => update({ startTime: e.target.value })}
                className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full appearance-none rounded-lg border pr-3 pl-9 text-base outline-none focus-visible:ring-3"
              >
                {TIMES.map((t) => (
                  <option key={t} value={t}>
                    {t} h
                  </option>
                ))}
              </select>
            </div>
          )}
        </Field>

        <div className="bg-sand-soft/70 rounded-2xl p-4 text-sm md:col-span-2">
          <p className="font-medium">¿Fecha flexible?</p>
          <p className="text-muted-foreground mt-1 leading-relaxed">
            Si el día que querías aparece lleno o cerrado, elige otra fecha cercana o cuéntanos en las notas:
            te proponemos alternativas con gusto.
          </p>
        </div>
      </div>
    </div>
  );
}
