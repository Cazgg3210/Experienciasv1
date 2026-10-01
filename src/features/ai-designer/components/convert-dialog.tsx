"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CircleCheck, Heart, MessageCircle, X } from "lucide-react";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  convertDesignSchema,
  todayInBusinessTz,
  type ConvertDesignFormValues,
  type ConvertDesignInput,
} from "../schemas";
import { convertDesignToLeadAction } from "../server/actions";
import type { ConvertDesignResult } from "../types";

/** "Quiero esta experiencia": datos de contacto → lead (source AI_DESIGNER). */
export function ConvertDialog({
  designId,
  designName,
  submitted,
  onSubmitted,
  trigger,
}: {
  designId: string;
  designName: string;
  submitted: ConvertDesignResult | null;
  onSubmitted: (result: ConvertDesignResult, name: string) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [firstName, setFirstName] = React.useState("");
  const minDate = React.useMemo(() => todayInBusinessTz(), []);
  const form = useForm<ConvertDesignFormValues, unknown, ConvertDesignInput>({
    resolver: zodResolver(convertDesignSchema),
    defaultValues: {
      designId,
      name: "",
      phone: "",
      email: "",
      eventDate: "",
      consent: false as unknown as true,
      marketingOptIn: false,
    },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: ConvertDesignInput) {
    let res: Awaited<ReturnType<typeof convertDesignToLeadAction>>;
    try {
      res = await convertDesignToLeadAction({ ...values, designId });
    } catch {
      toast.error("No pudimos enviar tu solicitud. Revisa tu conexión e inténtalo de nuevo.");
      return;
    }
    if (!handleActionResult(res, { form })) return;
    const name = values.name.trim().split(/\s+/)[0] ?? "";
    setFirstName(name);
    onSubmitted(res.data, name);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent showCloseButton={false} className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogClose asChild>
          <Button variant="ghost" size="icon-sm" className="absolute top-2 right-2 size-9 rounded-full">
            <X aria-hidden />
            <span className="sr-only">Cerrar</span>
          </Button>
        </DialogClose>
        {submitted ? (
          <div className="space-y-5 py-2 text-center" role="status" aria-live="polite">
            <div className="bg-sage-soft text-olive mx-auto flex size-14 items-center justify-center rounded-full">
              <CircleCheck aria-hidden className="size-7" />
            </div>
            <DialogHeader className="items-center text-center">
              <DialogTitle className="font-heading text-2xl font-semibold">
                ¡Listo{firstName ? `, ${firstName}` : ""}!
              </DialogTitle>
              <DialogDescription className="text-base">
                {submitted.alreadySubmitted
                  ? "Ya teníamos tu solicitud de esta propuesta"
                  : "Recibimos tu solicitud"}{" "}
                con el folio <strong className="text-foreground font-mono">{submitted.code}</strong>. Te
                escribimos muy pronto por WhatsApp para confirmar fecha y detalles.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="h-11 rounded-full px-5">
                <a href={submitted.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden />
                  Escribirnos ahora por WhatsApp
                </a>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-11 rounded-full px-5"
                onClick={() => setOpen(false)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        ) : (
          <form method="post" noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl font-semibold">¡Hagámosla realidad!</DialogTitle>
              <DialogDescription>
                Déjanos tus datos y te escribimos por WhatsApp para confirmar fecha y detalles de «
                {designName}». Sin compromiso.
              </DialogDescription>
            </DialogHeader>
            <input type="hidden" {...form.register("designId")} />
            <Field label="Tu nombre" required error={errors.name?.message}>
              {(p) => (
                <Input
                  {...p}
                  {...form.register("name")}
                  autoComplete="name"
                  maxLength={80}
                  className="h-11"
                />
              )}
            </Field>
            <Field
              label="WhatsApp"
              required
              error={errors.phone?.message}
              description="A 10 dígitos. Sólo lo usamos para hablar de tu evento."
            >
              {(p) => (
                <Input
                  {...p}
                  {...form.register("phone")}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="55 1234 5678"
                  maxLength={24}
                  className="h-11"
                />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email (opcional)" error={errors.email?.message}>
                {(p) => (
                  <Input
                    {...p}
                    {...form.register("email")}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    maxLength={120}
                    className="h-11"
                  />
                )}
              </Field>
              <Field label="Fecha tentativa (opcional)" error={errors.eventDate?.message}>
                {(p) => (
                  <Input {...p} {...form.register("eventDate")} type="date" min={minDate} className="h-11" />
                )}
              </Field>
            </div>
            <Controller
              control={form.control}
              name="consent"
              render={({ field }) => (
                <div className="space-y-1">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="ai-consent"
                      checked={field.value === true}
                      onCheckedChange={(v) => field.onChange(v === true)}
                      aria-invalid={errors.consent ? true : undefined}
                      aria-describedby={errors.consent ? "ai-consent-err" : undefined}
                      className="mt-0.5"
                    />
                    <label htmlFor="ai-consent" className="text-sm leading-snug">
                      Acepto que Ivonne &amp; Rosa me contacte por WhatsApp o email sobre esta propuesta y use
                      mis datos según el{" "}
                      <a
                        href="/privacidad"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-olive underline underline-offset-2"
                      >
                        aviso de privacidad
                      </a>
                      .
                      <span className="text-destructive ml-0.5" aria-hidden>
                        *
                      </span>
                    </label>
                  </div>
                  {errors.consent ? (
                    <p id="ai-consent-err" role="alert" className="text-destructive pl-7 text-xs font-medium">
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
                    id="ai-marketing"
                    checked={field.value === true}
                    onCheckedChange={(v) => field.onChange(v === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="ai-marketing" className="text-muted-foreground text-sm leading-snug">
                    Quiero recibir ideas y fechas especiales de vez en cuando (opcional).
                  </label>
                </div>
              )}
            />
            <DialogFooter className="mt-2">
              <SubmitButton
                pending={isSubmitting}
                pendingText="Enviando…"
                size="lg"
                className="h-11 w-full rounded-full px-6 sm:w-auto"
              >
                <Heart aria-hidden />
                Enviar mi solicitud
              </SubmitButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
