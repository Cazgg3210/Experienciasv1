"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  addDaysKey,
  addMonths,
  compareYearMonth,
  dateKeyOf,
  dayView,
  daysInMonth,
  longDateLabel,
  monthGrid,
  monthLabel,
  mondayIndex,
  yearMonthOf,
  type YearMonth,
} from "../domain/calendar";
import { getAvailabilityAction } from "../server/actions";
import type { CalendarDay } from "../types";

type Props = {
  value: string | null;
  onSelect: (dateKey: string) => void;
  todayKey: string;
  maxAdvanceDays: number;
  serviceAreaId: string | null;
  /** Avisa al padre los estados cargados (para validar el paso). */
  onDaysLoaded?: (days: CalendarDay[]) => void;
  invalid?: boolean;
  describedBy?: string;
};

const TONE_CLASSES: Record<string, string> = {
  available: "after:bg-success",
  limited: "after:bg-warning",
  review: "after:bg-info",
  full: "text-muted-foreground/70 line-through decoration-1",
  closed: "text-muted-foreground/60 line-through decoration-1",
  past: "text-muted-foreground/40",
};

export function AvailabilityCalendar({
  value,
  onSelect,
  todayKey,
  maxAdvanceDays,
  serviceAreaId,
  onDaysLoaded,
  invalid,
  describedBy,
}: Props) {
  const todayYm = yearMonthOf(todayKey);
  const maxYm = yearMonthOf(addDaysKey(todayKey, Math.max(31, maxAdvanceDays)));
  const [ym, setYm] = React.useState<YearMonth>(() => {
    const initial = value ? yearMonthOf(value) : todayYm;
    return compareYearMonth(initial, todayYm) < 0 ? todayYm : initial;
  });
  const [days, setDays] = React.useState<Record<string, CalendarDay>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reload, setReload] = React.useState(0);
  const cache = React.useRef(new Map<string, CalendarDay[]>());
  const [focusKey, setFocusKey] = React.useState<string>(() => value ?? todayKey);
  const shouldFocus = React.useRef(false);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const onDaysLoadedRef = React.useRef(onDaysLoaded);
  React.useEffect(() => {
    onDaysLoadedRef.current = onDaysLoaded;
  });

  // Cargar disponibilidad del mes visible
  React.useEffect(() => {
    let cancelled = false;
    const cacheKey = `${ym.year}-${ym.month}|${serviceAreaId ?? ""}`;
    const apply = (list: CalendarDay[]) => {
      setDays(Object.fromEntries(list.map((d) => [d.date, d])));
      onDaysLoadedRef.current?.(list);
    };
    const cached = cache.current.get(cacheKey);
    if (cached) {
      apply(cached);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    getAvailabilityAction({ from: dateKeyOf(ym.year, ym.month, 1), days: daysInMonth(ym), serviceAreaId })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          cache.current.set(cacheKey, res.data);
          apply(res.data);
        } else {
          setError(res.error);
        }
      })
      .catch(() => {
        if (!cancelled) setError("No pudimos consultar la disponibilidad. Revisa tu conexión.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ym, serviceAreaId, reload]);

  // Mantener el foco itinerante dentro del mes visible
  const monthPrefix = `${ym.year}-${String(ym.month + 1).padStart(2, "0")}`;
  const effectiveFocus = focusKey.startsWith(monthPrefix)
    ? focusKey
    : value?.startsWith(monthPrefix)
      ? value
      : todayKey.startsWith(monthPrefix)
        ? todayKey
        : `${monthPrefix}-01`;

  React.useEffect(() => {
    if (!shouldFocus.current) return;
    const btn = gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${effectiveFocus}"]`);
    if (!btn) return;
    shouldFocus.current = false;
    btn.focus();
  }, [effectiveFocus, ym]);

  const canPrev = compareYearMonth(ym, todayYm) > 0;
  const canNext = compareYearMonth(ym, maxYm) < 0;

  function moveMonth(delta: number, focus?: string) {
    const target = addMonths(ym, delta);
    if (compareYearMonth(target, todayYm) < 0 || compareYearMonth(target, maxYm) > 0) return;
    setYm(target);
    if (focus) setFocusKey(focus);
  }

  function moveFocus(to: string) {
    const target = yearMonthOf(to);
    shouldFocus.current = true;
    if (compareYearMonth(target, ym) !== 0) {
      if (compareYearMonth(target, todayYm) < 0 || compareYearMonth(target, maxYm) > 0) return;
      setYm(target);
    }
    setFocusKey(to);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, key: string) {
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in map) {
      e.preventDefault();
      moveFocus(addDaysKey(key, map[e.key]!));
    } else if (e.key === "Home") {
      e.preventDefault();
      moveFocus(addDaysKey(key, -mondayIndex(key)));
    } else if (e.key === "End") {
      e.preventDefault();
      moveFocus(addDaysKey(key, 6 - mondayIndex(key)));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const delta = e.key === "PageUp" ? -1 : 1;
      const t = addMonths(ym, delta);
      const day = Math.min(Number(key.slice(8, 10)), daysInMonth(t));
      shouldFocus.current = true;
      moveMonth(delta, dateKeyOf(t.year, t.month, day));
    }
  }

  const weeks = monthGrid(ym);

  return (
    <div className={cn("bg-card rounded-2xl border p-4 sm:p-6", invalid && "border-destructive/50")}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="rounded-full"
          onClick={() => moveMonth(-1)}
          disabled={!canPrev}
          aria-label="Mes anterior"
        >
          <ChevronLeft aria-hidden />
        </Button>
        <h3 id={titleId} className="font-heading text-2xl font-semibold capitalize" aria-live="polite">
          {monthLabel(ym)}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="rounded-full"
          onClick={() => moveMonth(1)}
          disabled={!canNext}
          aria-label="Mes siguiente"
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>

      {error ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => setReload((n) => n + 1)}
          >
            <RotateCcw aria-hidden /> Reintentar
          </Button>
        </div>
      ) : (
        <div
          ref={gridRef}
          role="grid"
          aria-labelledby={titleId}
          aria-describedby={describedBy}
          aria-busy={loading || undefined}
          className="w-full"
        >
          <div role="row" className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAY_SHORT.map((d, i) => (
              <span
                key={d}
                role="columnheader"
                aria-label={WEEKDAY_LONG[i]}
                className="text-muted-foreground py-1 text-center text-xs font-medium tracking-wide uppercase"
              >
                {d}
              </span>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div role="row" key={wi} className="grid grid-cols-7 gap-1">
              {week.map((key, di) => {
                if (!key)
                  return <span key={`e-${di}`} role="gridcell" aria-hidden className="aspect-square" />;
                const info = loading ? undefined : days[key];
                const isToday = key === todayKey;
                const selected = key === value;
                const view = info ? dayView(info.status) : null;
                const tabbable = key === effectiveFocus;
                return (
                  <span
                    key={key}
                    role="gridcell"
                    aria-selected={selected}
                    className="relative aspect-square p-0.5"
                  >
                    {!view ? <Skeleton aria-hidden className="absolute inset-0.5 rounded-xl" /> : null}
                    <button
                      type="button"
                      data-date={key}
                      tabIndex={tabbable ? 0 : -1}
                      aria-disabled={!view?.selectable || undefined}
                      aria-label={`${longDateLabel(key)}: ${view ? view.label : "consultando disponibilidad"}${isToday ? " (hoy)" : ""}`}
                      aria-pressed={selected}
                      onFocus={() => setFocusKey(key)}
                      onClick={() => {
                        if (view?.selectable) onSelect(key);
                      }}
                      onKeyDown={(e) => onKeyDown(e, key)}
                      className={cn(
                        "relative flex size-full flex-col items-center justify-center rounded-xl pb-2 text-sm font-medium transition-colors outline-none sm:pb-2.5 sm:text-base",
                        "focus-visible:ring-ring/60 focus-visible:ring-3",
                        "after:absolute after:bottom-1 after:size-1.5 after:rounded-full after:content-[''] sm:after:bottom-1.5",
                        !view
                          ? "text-muted-foreground/50 cursor-wait after:hidden"
                          : view.selectable
                            ? "hover:bg-sand-soft cursor-pointer"
                            : "cursor-not-allowed after:hidden",
                        view && TONE_CLASSES[view.tone],
                        isToday && !selected && "ring-taupe/50 ring-1",
                        selected && "bg-olive text-ivory hover:bg-olive after:bg-ivory no-underline",
                      )}
                    >
                      <span className="tabular">{Number(key.slice(8, 10))}</span>
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <ul
        className="text-muted-foreground mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs"
        aria-label="Simbología"
      >
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="bg-success size-2 rounded-full" /> Disponible
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="bg-warning size-2 rounded-full" /> Último lugar
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="bg-info size-2 rounded-full" /> Sujeto a confirmación
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="line-through">
            18
          </span>{" "}
          Lleno o cerrado
        </li>
      </ul>
    </div>
  );
}
