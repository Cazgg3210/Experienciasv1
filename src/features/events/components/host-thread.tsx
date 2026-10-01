"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { adminMessageSchema, type AdminMessageInput } from "../schemas";
import { addAdminMessageAction } from "../server/actions";

export type ThreadMessage = {
  id: string;
  authorType: "CUSTOMER" | "GUEST" | "ADMIN" | "SYSTEM";
  authorName: string;
  body: string;
  createdAtLabel: string;
  createdAtIso: string;
};

/** Conversación con la clienta (EventMessage HOST_THREAD). */
export function HostThread({
  eventId,
  messages,
  canWrite,
  customerName,
}: {
  eventId: string;
  messages: ThreadMessage[];
  canWrite: boolean;
  customerName: string;
}) {
  const listRef = React.useRef<HTMLOListElement>(null);
  const form = useForm<AdminMessageInput>({
    resolver: zodResolver(adminMessageSchema),
    defaultValues: { eventId, body: "", notifyCustomer: true },
  });
  const { errors, isSubmitting } = form.formState;
  const notify = form.watch("notifyCustomer");

  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function onSubmit(values: AdminMessageInput) {
    const res = await addAdminMessageAction(values);
    if (
      !handleActionResult(res, {
        form,
        success: res.ok && res.data.notified ? "Mensaje enviado y clienta notificada" : "Mensaje enviado",
      })
    )
      return;
    form.reset({ eventId, body: "", notifyCustomer: values.notifyCustomer });
  }

  return (
    <section
      aria-labelledby="thread-title"
      className="bg-card space-y-4 rounded-xl border p-4 shadow-xs sm:p-5"
    >
      <div>
        <h2 id="thread-title" className="font-heading text-xl font-semibold">
          Conversación con {customerName.split(" ")[0]}
        </h2>
        <p className="text-muted-foreground text-sm">
          Mensajes del portal de la clienta y respuestas del equipo.
        </p>
      </div>

      {messages.length === 0 ? (
        <p className="text-muted-foreground bg-sand-soft/50 rounded-lg border border-dashed px-4 py-6 text-center text-sm">
          Aún no hay mensajes. Cuando la clienta escriba desde su portal aparecerá aquí.
        </p>
      ) : (
        <ol
          ref={listRef}
          className="bg-ivory/60 max-h-[28rem] space-y-3 overflow-y-auto rounded-lg border p-3"
          aria-label="Mensajes"
          tabIndex={0}
        >
          {messages.map((m) => {
            const mine = m.authorType === "ADMIN" || m.authorType === "SYSTEM";
            return (
              <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-xs",
                    mine ? "bg-sage-soft text-foreground rounded-br-sm" : "bg-card rounded-bl-sm border",
                  )}
                >
                  <p className="text-muted-foreground mb-0.5 text-xs font-medium">
                    {m.authorName} · <time dateTime={m.createdAtIso}>{m.createdAtLabel}</time>
                  </p>
                  <p className="break-words whitespace-pre-wrap">{m.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {canWrite ? (
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-3">
          <Field label="Responder como el equipo" error={errors.body?.message}>
            {(p) => (
              <Textarea
                {...p}
                {...form.register("body")}
                rows={3}
                placeholder="Escribe tu respuesta…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void form.handleSubmit(onSubmit)();
                  }
                }}
              />
            )}
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="thread-notify"
                checked={notify}
                onCheckedChange={(v) => form.setValue("notifyCustomer", v === true)}
              />
              <label htmlFor="thread-notify" className="text-sm">
                Avisar a la clienta (correo y WhatsApp)
              </label>
            </div>
            <SubmitButton pending={isSubmitting} pendingText="Enviando…">
              <Send aria-hidden />
              Enviar
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </section>
  );
}
