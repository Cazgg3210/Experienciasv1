"use client";

import * as React from "react";
import { ArrowRight, ChevronLeft, History, ListChecks, TriangleAlert } from "lucide-react";
import { Progress as ProgressPrimitive } from "radix-ui";
import { NoScriptNotice } from "@/components/forms/noscript-notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  GUESTS_DEFAULT,
  GUESTS_MAX,
  GUESTS_MIN,
  START_TIME_MAX,
  START_TIME_MIN,
  type ConfiguratorOccasion,
} from "../schemas";
import {
  STEPS,
  TOTAL_STEPS,
  emptyDraft,
  firstInvalidStep,
  reconcileWithExperience,
  sanitizeDraft,
  toEstimateSelection,
  validateStep,
  type ConfiguratorDraft,
  type StepContext,
  type StepId,
} from "../domain/wizard";
import { longDateLabel } from "../domain/calendar";
import { estimateAction, trackConfiguratorAction } from "../server/actions";
import type { CalendarDay, ConfiguratorCatalog, SubmitConfiguratorPublicResult } from "../types";
import { EstimateMobileBar, EstimateSideCard, type EstimateState } from "./estimate-summary";
import { ResultScreen } from "./result-screen";
import { SuccessView } from "./success-view";
import {
  COMPLETED_FLAG_KEY,
  DRAFT_STORAGE_KEY,
  STARTED_FLAG_KEY,
  getSessionId,
  readStorage,
  removeStorage,
  writeStorage,
} from "./storage";
import { StepAddOns } from "./steps/step-addons";
import { StepBudget } from "./steps/step-budget";
import { StepDate } from "./steps/step-date";
import { StepExperience } from "./steps/step-experience";
import { StepGuests } from "./steps/step-guests";
import { StepMenu } from "./steps/step-menu";
import { StepOccasion } from "./steps/step-occasion";
import { StepPreferences } from "./steps/step-preferences";
import { StepStyle } from "./steps/step-style";
import { StepZone } from "./steps/step-zone";

type Screen = StepId | "result" | "success";

const STEP_DESCRIPTIONS: Record<StepId, string> = {
  1: "Cuéntanos el motivo y diseñamos todo alrededor de él.",
  2: "Elige el día y la hora. Te mostramos la disponibilidad en tiempo real.",
  3: "Llegamos a tu casa, terraza o jardín con todo listo.",
  4: "Incluyéndote a ti. Puedes ajustarlo después.",
  5: "La atmósfera de tu mesa: colores, flores y detalles.",
  6: "Te mostramos primero las que mejor van con lo que nos contaste.",
  7: "Todos se preparan en sitio con ingredientes frescos.",
  8: "Pequeños detalles que hacen la diferencia.",
  9: "Los detalles que la hacen única. Todo es opcional.",
  10: "Sin compromiso: nos ayuda a proponerte la mejor opción.",
};

const HEADING_ID = "configurador-paso-titulo";
const ERROR_ID = "configurador-paso-error";

function clampTime(t: string): string {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t) && t >= START_TIME_MIN && t <= START_TIME_MAX ? t : "11:00";
}

/** Registra un evento del embudo una sola vez por sesión del navegador (nunca rompe el flujo). */
function trackOnce(flag: string, type: "START_CONFIGURATOR" | "COMPLETE_CONFIGURATOR") {
  if (readStorage("session", flag)) return;
  writeStorage("session", flag, "1");
  void trackConfiguratorAction({ type, sessionId: getSessionId() }).catch(() => undefined);
}

export function ConfiguratorWizard({
  catalog,
  preselect,
  todayKey,
  attribution,
}: {
  catalog: ConfiguratorCatalog;
  preselect: { occasion: ConfiguratorOccasion | null; experienceId: string | null };
  todayKey: string;
  attribution: { utmSource: string | null; referredByCode: string | null };
}) {
  const defaults = React.useMemo(
    () => ({
      guestCount: GUESTS_DEFAULT,
      startTime: clampTime(catalog.settings.defaultStartTime),
      guestsMin: GUESTS_MIN,
      guestsMax: GUESTS_MAX,
    }),
    [catalog.settings.defaultStartTime],
  );

  const freshDraft = React.useCallback((): ConfiguratorDraft => {
    let d = emptyDraft(defaults);
    if (preselect.occasion) d.occasion = preselect.occasion;
    if (preselect.experienceId) {
      const exp = catalog.experiences.find((e) => e.id === preselect.experienceId) ?? null;
      if (exp) d = reconcileWithExperience({ ...d, experienceId: exp.id }, exp, catalog);
    }
    return d;
  }, [catalog, defaults, preselect.experienceId, preselect.occasion]);

  const [draft, setDraft] = React.useState<ConfiguratorDraft>(freshDraft);
  const [screen, setScreen] = React.useState<Screen>(1);
  const [resume, setResume] = React.useState<{ draft: ConfiguratorDraft; screen: StepId | "result" } | null>(
    null,
  );
  const [stepError, setStepError] = React.useState<string | null>(null);
  const [dayStatus, setDayStatus] = React.useState<Record<string, CalendarDay>>({});
  const [estimate, setEstimate] = React.useState<EstimateState>({ status: "idle", data: null, error: null });
  const [success, setSuccess] = React.useState<SubmitConfiguratorPublicResult | null>(null);
  const [announcement, setAnnouncement] = React.useState("");
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  /** La clienta llegó a este paso con "Editar" desde el resumen */
  const [returnToResult, setReturnToResult] = React.useState(false);

  const dirty = React.useRef(false);
  const focusOnChange = React.useRef(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const topRef = React.useRef<HTMLDivElement>(null);
  const estimateSeq = React.useRef(0);

  const ids = React.useMemo(
    () => ({
      styles: new Set(catalog.styles.map((s) => s.id)),
      experiences: new Set(catalog.experiences.map((e) => e.id)),
      menus: new Set(catalog.menus.map((m) => m.id)),
      addOns: new Set(catalog.addOns.map((a) => a.id)),
      areas: new Set(catalog.areas.filter((a) => a.active).map((a) => a.id)),
      budgets: new Set(catalog.budgetRanges.map((b) => b.id)),
    }),
    [catalog],
  );

  // Restaurar borrador ("Continuar donde lo dejaste") y preparar sesión de analítica
  React.useEffect(() => {
    setSessionId(getSessionId());
    const raw = readStorage("local", DRAFT_STORAGE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as { draft?: unknown; screen?: unknown };
      const d = sanitizeDraft(saved.draft, ids, { ...defaults, todayKey });
      const s = saved.screen;
      const savedScreen: StepId | "result" =
        s === "result" ? "result" : typeof s === "number" && s >= 1 && s <= TOTAL_STEPS ? (s as StepId) : 1;
      if (d && (d.occasion || savedScreen !== 1)) {
        const exp = catalog.experiences.find((e) => e.id === d.experienceId) ?? null;
        setResume({ draft: exp ? reconcileWithExperience(d, exp, catalog) : d, screen: savedScreen });
      }
    } catch {
      removeStorage("local", DRAFT_STORAGE_KEY);
    }
    // sólo al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guardado progresivo
  React.useEffect(() => {
    if (!dirty.current || screen === "success") return;
    writeStorage("local", DRAFT_STORAGE_KEY, JSON.stringify({ v: 1, draft, screen, savedAt: Date.now() }));
  }, [draft, screen]);

  // Estimado en servidor (debounce 300 ms; ignora respuestas viejas)
  const selection = toEstimateSelection(draft);
  const selectionKey = selection ? JSON.stringify(selection) : null;
  React.useEffect(() => {
    if (!selectionKey) {
      estimateSeq.current++;
      setEstimate({ status: "idle", data: null, error: null });
      return;
    }
    const seq = ++estimateSeq.current;
    setEstimate((s) => ({ ...s, status: "loading", error: null }));
    const timer = window.setTimeout(async () => {
      try {
        const res = await estimateAction(JSON.parse(selectionKey));
        if (seq !== estimateSeq.current) return;
        if (res.ok) setEstimate({ status: "ready", data: res.data, error: null });
        else setEstimate((s) => ({ status: "error", data: s.data, error: res.error }));
      } catch {
        if (seq === estimateSeq.current)
          setEstimate((s) => ({
            status: "error",
            data: s.data,
            error: "No pudimos calcular tu estimado. Revisa tu conexión.",
          }));
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [selectionKey]);

  // Llegada al resumen (por "Ver mi resumen", "Guardar y volver" o al continuar un borrador)
  React.useEffect(() => {
    if (screen === "result") trackOnce(COMPLETED_FLAG_KEY, "COMPLETE_CONFIGURATOR");
  }, [screen]);

  // Foco y anuncio al cambiar de pantalla
  React.useEffect(() => {
    if (!focusOnChange.current) return;
    focusOnChange.current = false;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    topRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    headingRef.current?.focus({ preventScroll: true });
    setAnnouncement(
      typeof screen === "number"
        ? `Paso ${screen} de ${TOTAL_STEPS}: ${STEPS[screen - 1]!.title}`
        : screen === "result"
          ? "Resumen de tu experiencia"
          : "Solicitud enviada",
    );
  }, [screen]);

  const experience = catalog.experiences.find((e) => e.id === draft.experienceId) ?? null;
  const unavailableDates = React.useMemo(
    () =>
      new Set(
        Object.values(dayStatus)
          .filter((d) => !d.acceptsRequests || d.status === "FULL")
          .map((d) => d.date),
      ),
    [dayStatus],
  );
  const stepCtx: StepContext = {
    guestsMin: GUESTS_MIN,
    guestsMax: GUESTS_MAX,
    compatibleMenuIds: experience ? experience.menuIds.filter((id) => ids.menus.has(id)) : [],
    unavailableDates,
    hasStyles: catalog.styles.length > 0,
  };
  const furthest = firstInvalidStep(draft, stepCtx) ?? TOTAL_STEPS;

  function markDirty() {
    dirty.current = true;
    if (resume) setResume(null);
  }

  function update(patch: Partial<ConfiguratorDraft>) {
    markDirty();
    setStepError(null);
    setDraft((d) => ({ ...d, ...patch }));
  }

  function selectExperience(id: string) {
    markDirty();
    setStepError(null);
    const exp = catalog.experiences.find((e) => e.id === id) ?? null;
    setDraft((d) => reconcileWithExperience({ ...d, experienceId: id }, exp, catalog));
  }

  function goTo(next: Screen) {
    focusOnChange.current = true;
    setStepError(null);
    if (next === "result" || next === "success") setReturnToResult(false);
    setScreen(next);
  }

  function editFromResult(step: StepId) {
    setReturnToResult(true);
    goTo(step);
  }

  /** Guarda el paso actual y regresa directo al resumen (si todo sigue completo). */
  function backToResult() {
    if (typeof screen !== "number") return;
    const err = validateStep(screen, draft, stepCtx);
    if (err) {
      setStepError(err);
      return;
    }
    markDirty();
    const pending = firstInvalidStep(draft, stepCtx);
    if (pending) {
      goTo(pending);
      setStepError(validateStep(pending, draft, stepCtx));
      return;
    }
    goTo("result");
  }

  function onNext() {
    if (typeof screen !== "number") return;
    const err = validateStep(screen, draft, stepCtx);
    if (err) {
      setStepError(err);
      return;
    }
    markDirty();
    if (screen === 1) trackOnce(STARTED_FLAG_KEY, "START_CONFIGURATOR");
    if (screen === TOTAL_STEPS) {
      const pending = firstInvalidStep(draft, stepCtx);
      if (pending) {
        goTo(pending);
        setStepError(validateStep(pending, draft, stepCtx));
        return;
      }
      goTo("result");
      return;
    }
    goTo((screen + 1) as StepId);
  }

  function onBack() {
    markDirty();
    if (screen === "result") goTo(TOTAL_STEPS as StepId);
    else if (typeof screen === "number" && screen > 1) goTo((screen - 1) as StepId);
  }

  function continueDraft() {
    if (!resume) return;
    dirty.current = true;
    setDraft(resume.draft);
    setResume(null);
    goTo(resume.screen);
  }

  function discardDraft() {
    removeStorage("local", DRAFT_STORAGE_KEY);
    setResume(null);
  }

  function onSubmitted(result: SubmitConfiguratorPublicResult) {
    removeStorage("local", DRAFT_STORAGE_KEY);
    dirty.current = false;
    setSuccess(result);
    goTo("success");
  }

  function restart() {
    removeStorage("local", DRAFT_STORAGE_KEY);
    removeStorage("session", COMPLETED_FLAG_KEY);
    dirty.current = false;
    setSuccess(null);
    setDraft(emptyDraft(defaults));
    goTo(1);
  }

  const onDaysLoaded = React.useCallback((days: CalendarDay[]) => {
    setDayStatus((prev) => {
      const next = { ...prev };
      for (const d of days) next[d.date] = d;
      return next;
    });
  }, []);

  const isStep = typeof screen === "number";
  const progress = isStep ? (screen / TOTAL_STEPS) * 100 : 100;
  const stepProps = {
    draft,
    update,
    catalog,
    labelledBy: HEADING_ID,
    errorId: ERROR_ID,
    invalid: !!stepError,
  };

  return (
    <div ref={topRef} className="scroll-mt-24">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      {screen !== "success" ? (
        <div className="mb-8 sm:mb-10">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{isStep ? `Paso ${screen} de ${TOTAL_STEPS}` : "Resumen"}</span>
            <span className="text-muted-foreground">
              {isStep ? STEPS[screen - 1]!.short : "Listo para enviar"}
            </span>
          </div>
          {/* Primitive directo: el Progress compartido no reenvía `value` (sin aria-valuenow) */}
          <ProgressPrimitive.Root
            value={progress}
            max={100}
            aria-label="Progreso del configurador"
            getValueLabel={() => (isStep ? `Paso ${screen} de ${TOTAL_STEPS}` : "Resumen: listo para enviar")}
            className="bg-sand relative mt-2 h-1.5 w-full overflow-hidden rounded-full"
          >
            <ProgressPrimitive.Indicator
              className="bg-primary size-full transition-transform duration-300 motion-reduce:transition-none"
              style={{ transform: `translateX(-${100 - progress}%)` }}
            />
          </ProgressPrimitive.Root>
          <nav aria-label="Pasos del configurador" className="mt-3 hidden md:block">
            <ol className="flex flex-wrap gap-1.5">
              {STEPS.map((s) => {
                const current = screen === s.id;
                const reachable = s.id <= furthest || s.id <= (isStep ? screen : TOTAL_STEPS);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={!reachable || current}
                      aria-current={current ? "step" : undefined}
                      onClick={() => goTo(s.id)}
                      className={cn(
                        "focus-visible:ring-ring/50 rounded-full px-2.5 py-1 text-xs transition-colors outline-none focus-visible:ring-3",
                        current
                          ? "bg-olive text-ivory font-medium"
                          : reachable
                            ? "text-charcoal hover:bg-sand-soft"
                            : "text-muted-foreground/60 cursor-not-allowed",
                      )}
                    >
                      {s.id}. {s.short}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>
      ) : null}

      {resume && screen === 1 ? (
        <div
          role="region"
          aria-label="Experiencia guardada"
          className="border-sage/50 bg-sage-soft/60 mb-8 flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
        >
          <div className="flex gap-3">
            <History className="text-olive mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Tienes una experiencia a medio armar</p>
              <p className="text-muted-foreground text-sm">
                {resume.screen === "result"
                  ? "Ibas en el resumen"
                  : `Ibas en el paso ${resume.screen} de ${TOTAL_STEPS}`}
                {resume.draft.eventDate ? ` · ${longDateLabel(resume.draft.eventDate)}` : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="rounded-full" onClick={discardDraft}>
              Empezar de nuevo
            </Button>
            <Button type="button" className="h-10 rounded-full px-5" onClick={continueDraft}>
              Continuar donde lo dejaste
            </Button>
          </div>
        </div>
      ) : null}

      {screen === "success" && success ? (
        <SuccessView result={success} headingRef={headingRef} headingId={HEADING_ID} onRestart={restart} />
      ) : screen === "result" ? (
        <div className="pb-8">
          <ResultScreen
            draft={draft}
            catalog={catalog}
            estimate={estimate}
            headingRef={headingRef}
            headingId={HEADING_ID}
            sessionId={sessionId}
            attribution={attribution}
            onEdit={editFromResult}
            onSubmitted={onSubmitted}
          />
          <div className="mt-8">
            <Button type="button" variant="ghost" size="lg" className="rounded-full" onClick={onBack}>
              <ChevronLeft aria-hidden /> Atrás
            </Button>
          </div>
        </div>
      ) : isStep ? (
        <div>
          <div className="grid gap-8 pb-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12 lg:pb-12 xl:grid-cols-[minmax(0,1fr)_380px]">
            <form
              // POST (no GET) y «Siguiente» deshabilitado hasta hidratar: antes de que cargue el JS el navegador
              // enviaría el paso de forma nativa (recarga y se pierde lo elegido).
              method="post"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                onNext();
              }}
              aria-labelledby={HEADING_ID}
              className="min-w-0"
            >
              <div className="mb-6 max-w-2xl sm:mb-8">
                <h2
                  id={HEADING_ID}
                  ref={headingRef}
                  tabIndex={-1}
                  className="font-heading text-3xl leading-tight font-semibold text-balance outline-none sm:text-4xl lg:text-5xl"
                >
                  {STEPS[screen - 1]!.title}
                </h2>
                <p className="text-muted-foreground mt-2 text-base sm:text-lg">{STEP_DESCRIPTIONS[screen]}</p>
              </div>

              {screen === 1 ? <StepOccasion {...stepProps} /> : null}
              {screen === 2 ? (
                <StepDate
                  {...stepProps}
                  todayKey={todayKey}
                  dayStatus={dayStatus}
                  onDaysLoaded={onDaysLoaded}
                />
              ) : null}
              {screen === 3 ? <StepZone {...stepProps} /> : null}
              {screen === 4 ? <StepGuests {...stepProps} /> : null}
              {screen === 5 ? <StepStyle {...stepProps} /> : null}
              {screen === 6 ? <StepExperience {...stepProps} onSelectExperience={selectExperience} /> : null}
              {screen === 7 ? <StepMenu {...stepProps} onGoToStep={(s) => goTo(s)} /> : null}
              {screen === 8 ? <StepAddOns {...stepProps} todayKey={todayKey} /> : null}
              {screen === 9 ? <StepPreferences {...stepProps} /> : null}
              {screen === 10 ? <StepBudget {...stepProps} estimate={estimate.data} /> : null}

              {stepError ? (
                <p
                  id={ERROR_ID}
                  role="alert"
                  className="border-destructive/30 bg-destructive/5 text-destructive mt-6 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm"
                >
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {stepError}
                </p>
              ) : null}

              {returnToResult ? (
                <div className="mt-8 flex justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11 rounded-full px-5"
                    onClick={backToResult}
                  >
                    <ListChecks aria-hidden /> Guardar y volver al resumen
                  </Button>
                </div>
              ) : null}

              <NoScriptNotice className="mt-6">
                Para armar tu experiencia activa JavaScript en tu navegador.
              </NoScriptNotice>
              <div
                className={cn(
                  "flex items-center justify-between gap-3 border-t pt-6",
                  returnToResult ? "mt-4" : "mt-8",
                )}
              >
                {screen > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    className="h-11 rounded-full px-4"
                    onClick={onBack}
                  >
                    <ChevronLeft aria-hidden /> Atrás
                  </Button>
                ) : (
                  <span />
                )}
                <SubmitButton waitForHydration size="xl">
                  {screen === TOTAL_STEPS ? "Ver mi resumen" : "Siguiente"} <ArrowRight aria-hidden />
                </SubmitButton>
              </div>
            </form>

            <div className="hidden lg:block">
              <EstimateSideCard draft={draft} catalog={catalog} estimate={estimate} currentStep={screen} />
            </div>
          </div>
          {/* Fuera del grid: "sticky" usa todo el wizard como contenedor y no tapa el footer al final */}
          <EstimateMobileBar draft={draft} catalog={catalog} estimate={estimate} currentStep={screen} />
        </div>
      ) : null}
    </div>
  );
}
