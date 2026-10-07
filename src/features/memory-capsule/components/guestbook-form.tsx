"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GUESTBOOK_BODY_MAX } from "../domain/capsule";
import { guestbookFormSchema, type GuestbookFormValues } from "../schemas";
import { submitGuestbookMessageAction } from "../server/actions";
import { useHydrated } from "./use-hydrated";

export function GuestbookForm({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const form = useForm<GuestbookFormValues>({
    resolver: zodResolver(guestbookFormSchema),
    // Sin defaultValues a propósito: al registrar cada campo, react-hook-form toma lo que ya hay en el
    // DOM. Con "" vaciaría lo que la invitada escribió antes de que la página hidratara (celular lento).
  });
  const body = form.watch("body") ?? "";
  const remaining = GUESTBOOK_BODY_MAX - body.length;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await submitGuestbookMessageAction({ token, ...values });
      if (handleActionResult(res, { form, success: false })) {
        toast.success("¡Gracias por tu mensaje! Ya forma parte de la cápsula ✨");
        // La acción revalida /memory/[token]: el muro se actualiza con la respuesta de la acción.
        form.reset({ name: values.name, body: "" });
      }
    }),
  );

  const { errors } = form.formState;
  return (
    <form
      onSubmit={onSubmit}
      method="post"
      className="space-y-4"
      noValidate
      aria-label="Dejar un mensaje en el libro de visitas"
    >
      <Field label="Tu nombre" required error={errors.name?.message}>
        {(p) => <Input {...p} autoComplete="name" maxLength={80} {...form.register("name")} />}
      </Field>
      <Field
        label="Tu mensaje"
        required
        error={errors.body?.message}
        description={
          <span aria-live="polite" className={remaining < 0 ? "text-destructive" : undefined}>
            {remaining >= 0 ? `Te quedan ${remaining} caracteres` : `Te pasaste por ${-remaining} caracteres`}
          </span>
        }
      >
        {(p) => (
          <Textarea
            {...p}
            rows={4}
            placeholder="Un recuerdo, una anécdota o un deseo para la homenajeada…"
            {...form.register("body")}
          />
        )}
      </Field>
      <SubmitButton
        pending={pending}
        disabled={pending || !hydrated}
        pendingText="Enviando…"
        className="w-full sm:w-auto"
        size="lg"
      >
        <Send className="size-4" aria-hidden />
        Dejar mi mensaje
      </SubmitButton>
    </form>
  );
}
