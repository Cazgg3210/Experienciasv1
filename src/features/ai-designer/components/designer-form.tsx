"use client";

import * as React from "react";
import { Controller, useForm, useWatch, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Baby,
  Briefcase,
  Cake,
  Coffee,
  Gem,
  MapPin,
  Minus,
  PartyPopper,
  Plus,
  Sparkles,
  Users,
  WandSparkles,
} from "lucide-react";
import { Field } from "@/components/forms/field";
import { NoScriptNotice } from "@/components/forms/noscript-notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DIETARY_LABELS, OCCASION_LABELS } from "@/lib/labels";
import {
  BUDGET_UNKNOWN,
  DIETARY_VALUES,
  MAX_GUESTS,
  MAX_VIBES,
  MIN_GUESTS,
  OCCASION_VALUES,
  OTHER_AREA,
  VIBE_LABELS,
  VIBE_VALUES,
  type DesignerOccasion,
} from "../constants";
import { designerInputSchema, type DesignerFormValues, type DesignerInput } from "../schemas";
import { generateDesignAction } from "../server/actions";
import type { DesignView, DesignerPageOptions } from "../types";
import { MultiChoiceChips, SingleChoiceChips, type ChipOption } from "./choice-chips";
import { ColorField } from "./color-field";

const OCCASION_ICONS: Record<DesignerOccasion, ChipOption<DesignerOccasion>["icon"]> = {
  BIRTHDAY: Cake,
  FRIENDS_BRUNCH: Coffee,
  BACHELORETTE: PartyPopper,
  BRIDAL: Gem,
  BABY_BRUNCH: Baby,
  GATHERING: Users,
  CORPORATE: Briefcase,
  OTHER: Sparkles,
};

const OCCASION_OPTIONS: ChipOption<DesignerOccasion>[] = OCCASION_VALUES.map((value) => ({
  value,
  label: OCCASION_LABELS[value],
  icon: OCCASION_ICONS[value],
}));

const VIBE_OPTIONS = VIBE_VALUES.map((value) => ({ value, label: VIBE_LABELS[value] }));
const DIETARY_OPTIONS = DIETARY_VALUES.map((value) => ({ value, label: DIETARY_LABELS[value] }));

// Perfil, edad y gustos (campos de texto visibles desde el HTML del servidor) sin default a propósito: al
// registrarlos, react-hook-form toma lo que ya hay en el DOM. Con "" vaciaría lo que la clienta escribió antes de
// que la página hidratara (celular lento). Los selectores y los campos que sólo aparecen al elegir «Otra» (ya
// hidratado) conservan su "".
const DEFAULTS: DefaultValues<DesignerFormValues> = {
  occasion: undefined as unknown as DesignerOccasion,
  occasionOther: "",
  guestCount: 8,
  budgetRangeId: "",
  colors: [],
  vibes: [],
  serviceArea: "",
  zoneText: "",
  dietary: [],
};

function FormSection({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <section
      aria-labelledby={id}
      className="border-border bg-card/80 space-y-5 rounded-3xl border p-5 shadow-xs sm:p-7"
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className="bg-sage-soft text-olive tabular flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
        >
          {step}
        </span>
        <div className="min-w-0">
          <h2 id={id} className="font-heading text-xl leading-tight font-semibold sm:text-2xl">
            {title}
          </h2>
          {description ? <p className="text-muted-foreground mt-1 text-sm">{description}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

export function DesignerForm({
  options,
  maxStandardGuests,
  onStart,
  onDone,
  onFail,
}: {
  options: DesignerPageOptions;
  maxStandardGuests: number;
  onStart: () => void;
  onDone: (design: DesignView) => void;
  onFail: () => void;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useForm<DesignerFormValues, unknown, DesignerInput>({
    resolver: zodResolver(designerInputSchema),
    defaultValues: DEFAULTS,
    // El foco lo maneja revealFirstError (en orden visual): RHF sólo conoce los campos con ref
    // y saltaría al perfil aunque el primer error sea la ocasión (chips con Controller).
    shouldFocusError: false,
  });
  const { errors, isSubmitting } = form.formState;
  const occasion = useWatch({ control: form.control, name: "occasion" });
  const serviceArea = useWatch({ control: form.control, name: "serviceArea" });
  const profile = useWatch({ control: form.control, name: "profile" }) ?? "";

  const budgetOptions = [
    ...options.budgets.map((b) => ({ value: b.id, label: b.label })),
    { value: BUDGET_UNKNOWN, label: "Aún no lo sé" },
  ];

  // Se lleva el foco al primer error DESPUÉS de que React pinta los mensajes (efecto post-commit,
  // no requestAnimationFrame: éste no corre en pestañas en segundo plano y competía con RHF).
  const [revealRequest, setRevealRequest] = React.useState(0);
  const revealFirstError = React.useCallback(() => setRevealRequest((n) => n + 1), []);
  React.useEffect(() => {
    if (!revealRequest) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reveal = (retry: boolean) => {
      const root = formRef.current;
      if (!root) return;
      const alert = root.querySelector('[role="alert"]');
      const container = alert?.closest("fieldset, [data-field]") ?? alert?.parentElement;
      if (!container) {
        // Los mensajes aún no se pintan: un reintento corto. Si no hay error de campo
        // (p. ej. límite de intentos), el foco vuelve al botón que se presionó.
        if (retry) timer = setTimeout(() => reveal(false), 60);
        else root.querySelector<HTMLElement>('button[type="submit"]')?.focus();
        return;
      }
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      container.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      container
        .querySelector<HTMLElement>(
          "input:not([type=hidden]):not(:disabled), textarea, button, [role=combobox]",
        )
        ?.focus({ preventScroll: true });
    };
    reveal(true);
    return () => clearTimeout(timer);
  }, [revealRequest]);

  async function onSubmit(values: DesignerInput) {
    onStart();
    let res: Awaited<ReturnType<typeof generateDesignAction>>;
    try {
      res = await generateDesignAction(values);
    } catch {
      // Sin conexión o despliegue nuevo: nunca dejar a la clienta atorada en "diseñando".
      onFail();
      toast.error(
        "No pudimos conectar con el diseñador. Revisa tu conexión e inténtalo de nuevo; tus respuestas siguen aquí.",
      );
      revealFirstError();
      return;
    }
    if (res.ok) {
      onDone(res.data);
      return;
    }
    onFail();
    handleActionResult(res, { form });
    revealFirstError();
  }

  return (
    <form
      ref={formRef}
      method="post"
      noValidate
      onSubmit={form.handleSubmit(onSubmit, revealFirstError)}
      className="space-y-5"
      aria-describedby="designer-form-help"
    >
      <p id="designer-form-help" className="sr-only">
        Los campos marcados con asterisco son obligatorios.
      </p>

      <FormSection step={1} title="¿Qué vamos a celebrar?">
        <Controller
          control={form.control}
          name="occasion"
          render={({ field }) => (
            <SingleChoiceChips
              name="occasion"
              legend="Ocasión"
              required
              options={OCCASION_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.occasion?.message}
              variant="card"
              listClassName="grid grid-cols-2 gap-2 sm:grid-cols-4"
            />
          )}
        />
        {occasion === "OTHER" ? (
          <Field label="¿Qué celebran?" required error={errors.occasionOther?.message}>
            {(p) => (
              <Input
                {...p}
                {...form.register("occasionOther")}
                maxLength={80}
                placeholder="Ej. graduación, aniversario, despedida de trabajo"
                className="bg-card h-11"
              />
            )}
          </Field>
        ) : null}
      </FormSection>

      <FormSection
        step={2}
        title="Cuéntanos de ella (o del grupo)"
        description="Unas líneas bastan: quién es, qué la hace feliz, qué quieren sentir ese día."
      >
        <div data-field>
          <Field
            label="Perfil de la homenajeada o del grupo"
            required
            error={errors.profile?.message}
            description={`${profile.length}/240`}
          >
            {(p) => (
              <Textarea
                {...p}
                {...form.register("profile")}
                maxLength={240}
                rows={3}
                placeholder="Ej. Mi hermana Sofi cumple 30, ama el café de especialidad, el yoga y las flores."
                className="bg-card min-h-24"
              />
            )}
          </Field>
        </div>
        <Field
          label="Edad (opcional)"
          error={errors.honoreeAge?.message}
          description="Sólo si quieres que la mencionemos en la propuesta."
          className="max-w-48"
        >
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="numeric"
              min={1}
              max={110}
              placeholder="30"
              className="bg-card h-11"
              {...form.register("honoreeAge", {
                setValueAs: (v: unknown) => (v === "" || v == null ? null : Number(v)),
              })}
            />
          )}
        </Field>
      </FormSection>

      <FormSection step={3} title="¿Cuántas serán y cuánto quieres invertir?">
        <Controller
          control={form.control}
          name="guestCount"
          render={({ field }) => (
            <div data-field>
              <Field
                label="Personas"
                required
                error={errors.guestCount?.message}
                description={
                  (field.value ?? 0) > maxStandardGuests
                    ? `Más de ${maxStandardGuests} personas es consulta especial: lo revisamos contigo con gusto.`
                    : `De ${MIN_GUESTS} a ${MAX_GUESTS} personas.`
                }
              >
                {(p) => (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-lg"
                      className="size-11 rounded-full"
                      aria-label="Una persona menos"
                      disabled={(field.value ?? MIN_GUESTS) <= MIN_GUESTS}
                      onClick={() =>
                        field.onChange(Math.max(MIN_GUESTS, (Number(field.value) || MIN_GUESTS) - 1))
                      }
                    >
                      <Minus aria-hidden />
                    </Button>
                    <Input
                      {...p}
                      type="number"
                      inputMode="numeric"
                      min={MIN_GUESTS}
                      max={MAX_GUESTS}
                      value={Number.isFinite(field.value) ? field.value : ""}
                      onChange={(e) =>
                        field.onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))
                      }
                      onBlur={field.onBlur}
                      className="bg-card tabular h-11 w-20 text-center text-lg"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-lg"
                      className="size-11 rounded-full"
                      aria-label="Una persona más"
                      disabled={(field.value ?? 0) >= MAX_GUESTS}
                      onClick={() =>
                        field.onChange(Math.min(MAX_GUESTS, (Number(field.value) || MIN_GUESTS - 1) + 1))
                      }
                    >
                      <Plus aria-hidden />
                    </Button>
                    <span className="text-muted-foreground text-sm">personas</span>
                  </div>
                )}
              </Field>
            </div>
          )}
        />
        <Controller
          control={form.control}
          name="budgetRangeId"
          render={({ field }) => (
            <SingleChoiceChips
              name="budgetRangeId"
              legend="Presupuesto total aproximado"
              description="Nos ayuda a proponerte algo que sí te funcione."
              required
              options={budgetOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.budgetRangeId?.message}
            />
          )}
        />
      </FormSection>

      <FormSection
        step={4}
        title="La vibra y los colores"
        description="Elige cómo quieren sentirse; nosotras lo traducimos a mesa, música y dinámicas."
      >
        <Controller
          control={form.control}
          name="vibes"
          render={({ field }) => (
            <MultiChoiceChips
              name="vibes"
              legend="Vibras"
              description={`Elige de 1 a ${MAX_VIBES}. La primera que elijas manda.`}
              required
              options={VIBE_OPTIONS}
              value={field.value ?? []}
              onChange={field.onChange}
              max={MAX_VIBES}
              error={errors.vibes?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="colors"
          render={({ field }) => (
            <ColorField value={field.value ?? []} onChange={field.onChange} error={errors.colors?.message} />
          )}
        />
      </FormSection>

      <FormSection
        step={5}
        title="Lo que les gusta"
        description="Comida, música, actividades… mientras más nos cuentes, más tuya será la propuesta."
      >
        <Field label="Gustos (opcional)" error={errors.tastes?.message}>
          {(p) => (
            <Textarea
              {...p}
              {...form.register("tastes")}
              maxLength={500}
              rows={3}
              placeholder="Ej. aman los chilaquiles y las mimosas, el pop de los 2000, cantar y tomarse mil fotos."
              className="bg-card min-h-24"
            />
          )}
        </Field>
        <Controller
          control={form.control}
          name="dietary"
          render={({ field }) => (
            <MultiChoiceChips
              name="dietary"
              legend="Restricciones alimentarias"
              description="Opcional · elige todas las que apliquen."
              options={DIETARY_OPTIONS}
              value={field.value ?? []}
              onChange={field.onChange}
              error={errors.dietary?.message}
            />
          )}
        />
      </FormSection>

      <FormSection step={6} title="¿Dónde será?">
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="serviceArea"
            render={({ field }) => (
              <div data-field>
                <Field
                  label="Zona"
                  required
                  error={errors.serviceArea?.message}
                  description={
                    field.value === OTHER_AREA
                      ? "Si está fuera de nuestra cobertura, igual lo revisamos contigo."
                      : "Montamos en tu casa, terraza o jardín."
                  }
                >
                  {(p) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger
                        {...p}
                        className="bg-card h-11! w-full *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:justify-start"
                        onBlur={field.onBlur}
                      >
                        <MapPin aria-hidden className="text-olive" />
                        <SelectValue placeholder="Elige la zona" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.areas.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                        <SelectItem value={OTHER_AREA}>Otra zona</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              </div>
            )}
          />
          {serviceArea === OTHER_AREA ? (
            <Field label="¿En qué colonia o alcaldía?" error={errors.zoneText?.message}>
              {(p) => (
                <Input
                  {...p}
                  {...form.register("zoneText")}
                  maxLength={120}
                  placeholder="Ej. Coyoacán"
                  className="bg-card h-11"
                />
              )}
            </Field>
          ) : null}
        </div>
      </FormSection>

      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <NoScriptNotice>Para diseñar tu experiencia activa JavaScript en tu navegador.</NoScriptNotice>
        {/* Deshabilitado hasta hidratar: evita el envío nativo (ver method="post" en el formulario). */}
        <SubmitButton
          waitForHydration
          size="xl"
          pending={isSubmitting}
          pendingText="Diseñando tu experiencia…"
          className="w-full sm:w-auto"
        >
          <WandSparkles aria-hidden />
          Diseñar mi experiencia
        </SubmitButton>
        <p className="text-muted-foreground max-w-md text-xs">
          Usamos nuestro catálogo real: experiencias, menús y extras que sí podemos llevar a tu mesa. El
          precio es un estimado sujeto a disponibilidad.
        </p>
      </div>
    </form>
  );
}
