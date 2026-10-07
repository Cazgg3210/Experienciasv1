"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Star } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/forms/field";
import { NoScriptNotice } from "@/components/forms/noscript-notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { usePaintedId } from "@/components/forms/use-painted-id";
import { cn } from "@/lib/utils";
import { reviewFormSchema, type ReviewFormValues } from "../schemas";
import { submitReviewAction } from "../server/actions";

const RATING_LABELS = ["", "No me gustó", "Regular", "Bien", "Muy bien", "¡Me encantó!"];

/** Opinión posterior al evento: estrellas 1–5 (radio group accesible), NPS 0–10, comentario. */
export function ReviewForm({ token }: { token: string }) {
  const router = useRouter();
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    // Consentimiento explícito: la casilla para publicar la opinión empieza desmarcada.
    // `comment` sin default a propósito: al registrarlo, react-hook-form toma lo que ya hay en el DOM. Con ""
    // vaciaría lo escrito antes de que la página hidratara (celular lento).
    defaultValues: { rating: 0, npsScore: null, publishable: false },
  });
  const pending = form.formState.isSubmitting;
  const errors = form.formState.errors;

  async function onSubmit(values: ReviewFormValues) {
    const res = await submitReviewAction({ token, ...values });
    if (handleActionResult(res, { form, success: "¡Gracias por tu opinión!" })) router.refresh();
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      // POST (no GET) y botón deshabilitado hasta hidratar: si alguien envía antes de que cargue el JS, el
      // comentario nunca termina en la URL (historial, logs, Referer).
      method="post"
      noValidate
      className="space-y-6"
    >
      <Controller
        control={form.control}
        name="rating"
        render={({ field }) => (
          <StarRating value={field.value} onChange={field.onChange} error={errors.rating?.message} />
        )}
      />
      <Controller
        control={form.control}
        name="npsScore"
        render={({ field }) => <NpsScale value={field.value} onChange={field.onChange} error={errors.npsScore?.message} />}
      />
      <Field label="Cuéntanos más (opcional)" error={errors.comment?.message}>
        {(p) => (
          <Textarea
            {...p}
            {...form.register("comment")}
            rows={4}
            placeholder="¿Qué fue lo que más disfrutaron? ¿Qué podemos mejorar?"
            className="text-base"
          />
        )}
      </Field>
      <Controller
        control={form.control}
        name="publishable"
        render={({ field }) => (
          <div className="flex items-start gap-3">
            <Checkbox
              id="review-publishable"
              checked={field.value}
              onCheckedChange={(v) => field.onChange(v === true)}
              className="mt-0.5 size-5"
            />
            <Label htmlFor="review-publishable" className="text-sm leading-snug font-normal">
              Pueden publicar mi opinión (con mi nombre de pila) en su sitio y redes.
            </Label>
          </div>
        )}
      />
      <NoScriptNotice />
      <SubmitButton waitForHydration pending={pending} pendingText="Enviando…" size="xl" className="w-full sm:w-auto">
        Enviar mi opinión
      </SubmitButton>
    </form>
  );
}

function StarRating({ value, onChange, error }: { value: number; onChange: (v: number) => void; error?: string }) {
  const name = React.useId();
  const [hover, setHover] = React.useState(0);
  const shown = hover || value;
  return (
    <fieldset aria-describedby={error ? `${name}-err` : undefined}>
      <legend className="mb-2 text-sm font-medium">
        ¿Cómo calificarías tu experiencia?<span className="text-destructive ml-0.5" aria-hidden>*</span>
      </legend>
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="has-[:focus-visible]:ring-ring relative flex size-12 cursor-pointer items-center justify-center rounded-full has-[:focus-visible]:ring-2"
            onMouseEnter={() => setHover(n)}
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
              aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}: ${RATING_LABELS[n]}`}
            />
            <Star
              aria-hidden
              className={cn(
                "size-8 transition-colors",
                n <= shown ? "fill-[#C6A15B] text-[#C6A15B]" : "text-muted-foreground/50",
              )}
            />
          </label>
        ))}
        <span className="text-muted-foreground ml-2 text-sm" aria-live="polite">
          {shown ? RATING_LABELS[shown] : ""}
        </span>
      </div>
      {error ? (
        <p id={`${name}-err`} role="alert" className="text-destructive mt-1 text-xs font-medium">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function NpsScale({
  value,
  onChange,
  error,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  error?: string;
}) {
  const hintRef = React.useRef<HTMLParagraphElement>(null);
  // Adopta el id con que el servidor pintó la pista (ver usePaintedId, EVT-005): al quitarse el error, el
  // aria-describedby vuelve a la pista y debe apuntar a ella.
  const name = usePaintedId(React.useId(), hintRef, { suffix: "-hint" });
  return (
    <fieldset aria-describedby={error ? `${name}-err` : `${name}-hint`}>
      <legend className="mb-2 text-sm font-medium">
        Del 0 al 10, ¿qué tan probable es que nos recomiendes con una amiga?
      </legend>
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-11">
        {Array.from({ length: 11 }, (_, n) => (
          <label
            key={n}
            className={cn(
              "has-[:focus-visible]:ring-ring flex h-11 cursor-pointer items-center justify-center rounded-xl border text-sm font-medium tabular transition-colors has-[:focus-visible]:ring-2",
              value === n ? "border-olive bg-olive text-ivory" : "bg-background hover:bg-sage-soft",
            )}
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
            />
            {n}
          </label>
        ))}
      </div>
      <p ref={hintRef} id={`${name}-hint`} className="text-muted-foreground mt-1.5 flex justify-between text-xs">
        <span>0 = nada probable</span>
        <span>10 = muy probable</span>
      </p>
      {error ? (
        <p id={`${name}-err`} role="alert" className="text-destructive mt-1 text-xs font-medium">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
