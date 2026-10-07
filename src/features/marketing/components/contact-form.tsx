"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { handleActionResult } from "@/components/forms/action-result";
import { SubmitButton } from "@/components/forms/submit-button";
import { WhatsAppIcon } from "@/components/site/brand-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OCCASION_LABELS, toOptions } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { getAnonymousSessionId } from "../client/track";
import { contactFormSchema, type ContactFormInput, type ContactFormValues } from "../schemas";
import { submitContactForm } from "../server/actions";

const inputClass = "bg-card h-11 rounded-xl px-3.5";
const selectClass =
  "border-input bg-card text-foreground h-11 w-full appearance-none rounded-xl border px-3.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm";

const OCCASION_OPTIONS = toOptions(OCCASION_LABELS);

/** Mensaje de WhatsApp con el folio, para dar seguimiento inmediato. */
function followUpLink(whatsappNumber: string, code: string, name: string) {
  const digits = whatsappNumber.replace(/\D/g, "");
  const text = `Hola Ivonne & Rosa, soy ${name}. Acabo de enviar el formulario de contacto (folio ${code}).`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function ContactForm({ minDate, waNumber }: { minDate: string; waNumber: string }) {
  const [success, setSuccess] = useState<{ code: string; name: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const successRef = useRef<HTMLHeadingElement>(null);
  // Hasta hidratar, el envío nativo no debe ocurrir (perdería lo escrito); ver method="post" abajo.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const form = useForm<ContactFormValues, unknown, ContactFormInput>({
    resolver: zodResolver(contactFormSchema),
    // Sin textos vacíos a propósito: al registrar cada campo, react-hook-form toma lo que ya hay en el DOM.
    // Con "" vaciaría lo que la persona escribió antes de que la página hidratara (celular lento).
    defaultValues: { consent: false },
    mode: "onTouched",
  });
  const { register, handleSubmit, control, formState } = form;
  const errors = formState.errors;

  useEffect(() => {
    if (success) successRef.current?.focus();
  }, [success]);

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      let sessionId: string | undefined;
      try {
        sessionId = getAnonymousSessionId();
      } catch {
        sessionId = undefined;
      }
      try {
        const result = await submitContactForm({ ...values, sessionId });
        if (handleActionResult(result, { form })) {
          setSuccess({ code: result.data.code, name: values.name.split(" ")[0] ?? values.name });
          form.reset();
        }
      } catch {
        // Sin conexión o el servidor no respondió: no perder lo escrito ni romper la página.
        toast.error("No pudimos enviar tu mensaje. Revisa tu conexión e inténtalo de nuevo, o escríbenos por WhatsApp.");
      }
    });
  });

  if (success) {
    return (
      <div className="bg-card border-border/70 rounded-[1.75rem] border p-8 text-center sm:p-10" role="status" aria-live="polite">
        <span className="bg-sage-soft text-olive mx-auto flex size-14 items-center justify-center rounded-full">
          <CircleCheck className="size-7" aria-hidden />
        </span>
        <h2 ref={successRef} tabIndex={-1} className="font-heading text-charcoal mt-6 text-3xl font-medium outline-none sm:text-4xl">
          ¡Gracias, {success.name}!
        </h2>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md leading-relaxed">
          Recibimos tu mensaje. Te escribiremos por WhatsApp o correo en menos de 24 horas hábiles.
        </p>
        <p className="mt-6 text-sm">
          Tu folio es{" "}
          <span className="bg-sand-soft text-charcoal rounded-md px-2 py-1 font-mono text-base font-semibold tracking-wider">
            {success.code}
          </span>
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="xl">
            <a href={followUpLink(waNumber, success.code, success.name)} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon className="size-5" />
              Continuar por WhatsApp
            </a>
          </Button>
          <Button asChild size="xl" variant="ghost" className="rounded-full">
            <Link href="/experiencias">Ver experiencias</Link>
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setSuccess(null)}
          className="text-muted-foreground hover:text-foreground mt-6 text-sm underline underline-offset-4"
        >
          Enviar otro mensaje
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      // POST (no GET): si alguien envía antes de que cargue el JS, sus datos personales
      // nunca terminan en la URL (historial, logs, Referer).
      method="post"
      noValidate
      aria-labelledby="contacto-form-title"
      className="bg-card border-border/70 relative rounded-[1.75rem] border p-6 sm:p-8"
    >
      <h2 id="contacto-form-title" className="font-heading text-charcoal text-2xl font-medium sm:text-3xl">
        Escríbenos
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">Los campos marcados con * son obligatorios.</p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Nombre" required error={errors.name?.message} className="sm:col-span-2">
          {(p) => <Input {...p} {...register("name")} autoComplete="name" className={inputClass} />}
        </Field>
        <Field label="WhatsApp o teléfono" required error={errors.phone?.message} description="10 dígitos, con lada.">
          {(p) => (
            <Input {...p} {...register("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="55 1234 5678" className={inputClass} />
          )}
        </Field>
        <Field label="Correo electrónico" required error={errors.email?.message}>
          {(p) => (
            <Input {...p} {...register("email")} type="email" inputMode="email" autoComplete="email" placeholder="tu@correo.com" className={inputClass} />
          )}
        </Field>
        <Field label="¿Qué quieres celebrar?" required error={errors.occasion?.message}>
          {(p) => (
            <select {...p} {...register("occasion")} defaultValue="" className={selectClass}>
              <option value="" disabled>
                Elige una ocasión
              </option>
              {OCCASION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Fecha tentativa" error={errors.eventDate?.message} description="Opcional.">
          {(p) => <Input {...p} {...register("eventDate")} type="date" min={minDate} className={inputClass} />}
        </Field>
        <Field label="Mensaje" required error={errors.message?.message} className="sm:col-span-2">
          {(p) => (
            <Textarea
              {...p}
              {...register("message")}
              rows={5}
              placeholder="Cuéntanos cuántas son, la zona y qué tienes en mente."
              className="bg-card min-h-32 rounded-xl px-3.5 py-3"
            />
          )}
        </Field>

        {/* Honeypot: invisible para personas, tentador para bots. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="contact-website">No llenes este campo</label>
          <input id="contact-website" type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
        </div>

        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="consent"
            render={({ field }) => (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="contact-consent"
                  checked={field.value === true}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  aria-required
                  aria-invalid={errors.consent ? true : undefined}
                  aria-describedby={errors.consent ? "contact-consent-err" : undefined}
                  className="mt-0.5 size-5"
                />
                <label htmlFor="contact-consent" className="text-muted-foreground text-sm leading-relaxed">
                  Acepto el{" "}
                  <Link
                    href="/privacidad"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-olive font-medium underline underline-offset-4"
                  >
                    aviso de privacidad<span className="sr-only"> (se abre en una pestaña nueva)</span>
                  </Link>{" "}
                  y autorizo que me contacten por WhatsApp, teléfono o correo para dar seguimiento a mi solicitud.
                  <span className="text-destructive ml-0.5" aria-hidden>
                    *
                  </span>
                </label>
              </div>
            )}
          />
          {errors.consent?.message ? (
            <p id="contact-consent-err" role="alert" className={cn("text-destructive mt-1.5 text-xs font-medium")}>
              {errors.consent.message}
            </p>
          ) : null}
        </div>
      </div>

      <noscript>
        <p className="text-muted-foreground mt-6 text-sm">
          Para enviar este formulario activa JavaScript en tu navegador, o escríbenos directo por WhatsApp o correo.
        </p>
      </noscript>
      <SubmitButton
        pending={pending}
        disabled={!hydrated || pending}
        pendingText="Enviando…"
        size="xl"
        className="mt-8 w-full sm:w-auto"
      >
        Enviar mensaje
      </SubmitButton>
    </form>
  );
}
