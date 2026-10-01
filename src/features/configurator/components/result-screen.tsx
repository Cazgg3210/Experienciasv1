"use client";

import * as React from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, ShieldCheck, TriangleAlert } from "lucide-react";
import { Field } from "@/components/forms/field";
import { handleActionResult } from "@/components/forms/action-result";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { contactSchema, type ContactInput } from "../schemas";
import {
  STEPS,
  stepForField,
  toSubmitSelections,
  type ConfiguratorDraft,
  type StepId,
} from "../domain/wizard";
import { summaryRows } from "../domain/summary";
import { submitConfiguratorAction } from "../server/actions";
import type { ConfiguratorCatalog, SubmitConfiguratorPublicResult } from "../types";
import { EstimateBreakdown, type EstimateState } from "./estimate-summary";
import { newSubmissionId } from "./storage";

const CONTACT_FIELDS = new Set(["name", "phone", "email", "consent", "marketingOptIn"]);

export function ResultScreen({
  draft,
  catalog,
  estimate,
  headingRef,
  headingId,
  sessionId,
  attribution,
  onEdit,
  onSubmitted,
}: {
  draft: ConfiguratorDraft;
  catalog: ConfiguratorCatalog;
  estimate: EstimateState;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  headingId: string;
  sessionId: string | null;
  attribution: { utmSource: string | null; referredByCode: string | null };
  onEdit: (step: StepId) => void;
  onSubmitted: (result: SubmitConfiguratorPublicResult) => void;
}) {
  const rows = summaryRows(draft, catalog).filter((r) => r.value);
  const [serverIssue, setServerIssue] = React.useState<{ message: string; step: StepId | null } | null>(null);
  // Un id por visita al resumen: si la respuesta se pierde y la clienta reintenta, no se duplica el lead
  const [submissionId] = React.useState(newSubmissionId);
  const form = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", phone: "", email: "", consent: false, marketingOptIn: false },
    mode: "onTouched",
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: ContactInput) {
    setServerIssue(null);
    try {
      const res = await submitConfiguratorAction({
        ...toSubmitSelections(draft),
        ...values,
        submissionId,
        sessionId,
        utmSource: attribution.utmSource,
        referredByCode: attribution.referredByCode,
      });
      if (res.ok) {
        onSubmitted(res.data);
        return;
      }
      const fieldErrors = res.fieldErrors ?? {};
      const contactErrors = Object.fromEntries(
        Object.entries(fieldErrors).filter(([k]) => CONTACT_FIELDS.has(k)),
      );
      handleActionResult({ ...res, fieldErrors: contactErrors }, { form });
      const step = Object.keys(fieldErrors)
        .map(stepForField)
        .find((s): s is StepId => s != null);
      if (step || res.code === "RATE_LIMITED" || res.code === "INTERNAL_ERROR") {
        setServerIssue({ message: res.error, step: step ?? null });
      }
    } catch {
      toast.error("No pudimos enviar tu solicitud. Revisa tu conexión e intenta de nuevo.");
    }
  }

  return (
    <section aria-labelledby={headingId} className="space-y-8">
      <div className="max-w-2xl">
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="font-heading text-4xl leading-tight font-semibold text-balance outline-none sm:text-5xl"
        >
          Así se ve tu experiencia
        </h2>
        <p className="text-muted-foreground mt-3 text-base sm:text-lg">
          Revisa tus elecciones, déjanos tus datos y confirmamos disponibilidad contigo. Sin compromiso.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-12">
        <div className="space-y-8">
          <div className="bg-card rounded-3xl border p-5 sm:p-7">
            <h3 className="font-heading text-2xl font-semibold">Tus elecciones</h3>
            <dl className="divide-border/70 mt-4 divide-y">
              {rows.map((r) => (
                <div
                  key={r.label}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 py-3 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:gap-x-6"
                >
                  <dt className="text-muted-foreground text-xs sm:pt-0.5 sm:text-sm">{r.label}</dt>
                  <dd className="col-start-1 row-start-2 mt-0.5 text-sm font-medium break-words sm:col-start-2 sm:row-start-1 sm:mt-0 sm:text-base">
                    {r.value}
                  </dd>
                  <dd className="col-start-2 row-span-2 row-start-1 self-center sm:col-start-3 sm:row-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-olive rounded-full"
                      onClick={() => onEdit(r.step)}
                      aria-label={`Editar ${r.label.toLowerCase()} (paso ${r.step}: ${STEPS[r.step - 1]!.short})`}
                    >
                      <Pencil aria-hidden /> Editar
                    </Button>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-card rounded-3xl border p-5 sm:p-7" aria-live="polite">
            <h3 className="font-heading text-2xl font-semibold">Tu estimado</h3>
            <div className="mt-4">
              {estimate.status === "error" ? (
                <p role="alert" className="text-destructive text-sm">
                  {estimate.error} Aún así puedes enviar tu solicitud: calculamos el precio final al
                  revisarla.
                </p>
              ) : estimate.data ? (
                <EstimateBreakdown
                  estimate={estimate.data}
                  settings={catalog.settings}
                  outOfArea={draft.zoneOther}
                />
              ) : (
                <div className="space-y-2" aria-busy="true">
                  <span className="sr-only">Calculando tu estimado…</span>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-10 w-1/2" />
                </div>
              )}
            </div>
            <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
              Precio estimado sujeto a disponibilidad y confirmación. Te enviamos tu cotización formal después
              de revisar tu fecha.
            </p>
          </div>
        </div>

        <div className="bg-card rounded-3xl border p-5 shadow-[0_10px_40px_-24px_rgba(47,44,42,0.35)] sm:p-7 lg:sticky lg:top-24">
          <h3 className="font-heading text-2xl font-semibold">¿A quién le escribimos?</h3>
          <p className="text-muted-foreground mt-1 text-sm">Te respondemos en menos de 24 horas hábiles.</p>

          {serverIssue ? (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive/5 mt-4 flex gap-3 rounded-2xl border p-3 text-sm"
            >
              <TriangleAlert className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="space-y-2">
                <p>{serverIssue.message}</p>
                {serverIssue.step ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => onEdit(serverIssue.step!)}
                  >
                    Corregir {STEPS[serverIssue.step - 1]!.short.toLowerCase()}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="mt-5 space-y-4">
            <Field label="Tu nombre" error={errors.name?.message} required>
              {(p) => (
                <Input
                  {...p}
                  {...form.register("name")}
                  autoComplete="name"
                  placeholder="Nombre y apellido"
                  className="h-11 text-base"
                />
              )}
            </Field>
            <Field
              label="WhatsApp o teléfono"
              description="10 dígitos. Te escribimos por WhatsApp para confirmar."
              error={errors.phone?.message}
              required
            >
              {(p) => (
                <Input
                  {...p}
                  {...form.register("phone")}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="55 1234 5678"
                  className="h-11 text-base"
                />
              )}
            </Field>
            <Field
              label="Correo electrónico"
              description="Opcional, pero recomendado para enviarte tu cotización."
              error={errors.email?.message}
            >
              {(p) => (
                <Input
                  {...p}
                  {...form.register("email")}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  className="h-11 text-base"
                />
              )}
            </Field>

            <Controller
              control={form.control}
              name="consent"
              render={({ field }) => (
                <div className="space-y-1">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="consent"
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      aria-invalid={errors.consent ? true : undefined}
                      aria-describedby={errors.consent ? "consent-err" : undefined}
                      aria-required
                      className="mt-0.5 size-5"
                    />
                    <label htmlFor="consent" className="text-sm leading-snug">
                      Acepto el{" "}
                      <Link
                        href="/privacidad"
                        target="_blank"
                        className="text-olive font-medium underline underline-offset-2"
                      >
                        aviso de privacidad
                      </Link>{" "}
                      y que me contacten para dar seguimiento a mi solicitud.
                      <span className="text-destructive ml-0.5" aria-hidden>
                        *
                      </span>
                    </label>
                  </div>
                  {errors.consent ? (
                    <p id="consent-err" role="alert" className="text-destructive pl-8 text-xs font-medium">
                      {errors.consent.message}
                    </p>
                  ) : null}
                </div>
              )}
            />
            <Controller
              control={form.control}
              name="marketingOptIn"
              render={({ field }) => (
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="marketingOptIn"
                    checked={field.value}
                    onCheckedChange={(v) => field.onChange(v === true)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className="mt-0.5 size-5"
                  />
                  <label htmlFor="marketingOptIn" className="text-muted-foreground text-sm leading-snug">
                    Quiero recibir ideas, fechas especiales y novedades de Ivonne &amp; Rosa (opcional).
                  </label>
                </div>
              )}
            />

            <SubmitButton size="xl" className="mt-2 w-full" pending={isSubmitting} pendingText="Enviando…">
              Consultar disponibilidad
            </SubmitButton>
            <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-center text-xs">
              <ShieldCheck className="size-3.5" aria-hidden /> Tus datos sólo se usan para atender tu
              solicitud.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
