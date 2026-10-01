"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles } from "lucide-react";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CAPSULE_MESSAGE_MAX, CAPSULE_TITLE_MAX } from "../domain/capsule";
import { createCapsuleSchema, type CreateCapsuleInput } from "../schemas";
import { createCapsuleAction } from "../server/actions";

export function CreateCapsuleForm({
  eventId,
  defaultTitle,
  defaultMessage,
}: {
  eventId: string;
  defaultTitle: string;
  defaultMessage: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<CreateCapsuleInput>({
    resolver: zodResolver(createCapsuleSchema),
    defaultValues: { eventId, title: defaultTitle, message: defaultMessage },
  });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const res = await createCapsuleAction(values);
      if (handleActionResult(res, { form, success: "Memory Capsule creada" })) {
        // La acción revalida la ruta; el refresh garantiza pasar a la vista de administración
        // aunque el payload de la acción llegue tarde o se descarte (p. ej. Fast Refresh en dev).
        router.refresh();
      } else if (res.code === "CONFLICT") {
        // Otra persona ya la creó: mostrar la cápsula existente.
        router.refresh();
      }
    }),
  );

  const { errors } = form.formState;
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <input type="hidden" {...form.register("eventId")} />
      <Field label="Título" required error={errors.title?.message}>
        {/* defaultValue: el HTML del servidor ya trae el texto (register() sólo lo pone al hidratar). */}
        {(p) => <Input {...p} maxLength={CAPSULE_TITLE_MAX} defaultValue={defaultTitle} {...form.register("title")} />}
      </Field>
      <Field
        label="Mensaje de bienvenida"
        description="Aparece en la portada de la cápsula. Puedes editarlo después."
        error={errors.message?.message}
      >
        {(p) => (
          <Textarea
            {...p}
            rows={4}
            maxLength={CAPSULE_MESSAGE_MAX}
            defaultValue={defaultMessage}
            {...form.register("message")}
          />
        )}
      </Field>
      {/* disabled explícito: SubmitButton deja que props.disabled sobrescriba el estado pending. */}
      <SubmitButton pending={pending} disabled={pending} pendingText="Creando…" size="lg">
        <Sparkles className="size-4" aria-hidden />
        Crear Memory Capsule
      </SubmitButton>
    </form>
  );
}
