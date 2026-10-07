"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { portalAccessFormSchema, type PortalAccessFormValues } from "../schemas";
import { requestPortalAccessAction } from "../server/actions";

/** "Entra a tu evento": pide el enlace por email. Respuesta siempre neutral. */
export function AccessForm() {
  const [sent, setSent] = React.useState<{ email: string; message: string } | null>(null);
  const form = useForm<PortalAccessFormValues>({
    resolver: zodResolver(portalAccessFormSchema),
    // Sin defaultValues a propósito: al registrar el campo, react-hook-form toma lo que ya hay en el DOM.
    // Con "" vaciaría el correo escrito antes de que la página hidratara (celular lento).
  });
  const pending = form.formState.isSubmitting;
  const statusRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (sent) statusRef.current?.focus();
  }, [sent]);

  async function onSubmit(values: PortalAccessFormValues) {
    const res = await requestPortalAccessAction(values);
    if (handleActionResult(res, { form })) setSent({ email: values.email.trim(), message: res.data.message });
  }

  if (sent) {
    return (
      <div ref={statusRef} tabIndex={-1} role="status" className="space-y-4 text-center outline-none">
        <div className="bg-sage-soft text-olive mx-auto flex size-14 items-center justify-center rounded-full">
          <MailCheck className="size-6" aria-hidden />
        </div>
        <p className="font-heading text-2xl font-semibold">Revisa tu correo</p>
        <p className="text-muted-foreground text-sm">
          {sent.message}
          <br />
          <span className="text-foreground font-medium break-all">{sent.email}</span>
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-full px-6 text-base"
          onClick={() => {
            setSent(null);
            form.reset({ email: "" });
          }}
        >
          Usar otro correo
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Field label="Tu correo" required error={form.formState.errors.email?.message}>
        {(p) => (
          <Input
            {...p}
            {...form.register("email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="tu@correo.com"
            className="h-12 text-base"
          />
        )}
      </Field>
      <SubmitButton pending={pending} pendingText="Enviando…" size="xl" className="w-full">
        Enviarme mi enlace
      </SubmitButton>
    </form>
  );
}
