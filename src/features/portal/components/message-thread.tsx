"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MessageSquareHeart, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { cn } from "@/lib/utils";
import { hostMessageFormSchema, type HostMessageFormValues } from "../schemas";
import { sendHostMessageAction } from "../server/actions";

export type ThreadMessage = {
  id: string;
  authorType: "CUSTOMER" | "GUEST" | "ADMIN" | "SYSTEM";
  authorName: string;
  body: string;
  timeLabel: string;
};

/** Conversación anfitriona ↔ equipo (HOST_THREAD). */
export function MessageThread({
  token,
  messages,
  canSend,
}: {
  token: string;
  messages: ThreadMessage[];
  canSend: boolean;
}) {
  const router = useRouter();
  const listRef = React.useRef<HTMLOListElement>(null);
  const [refreshing, startRefresh] = React.useTransition();
  const form = useForm<HostMessageFormValues>({
    resolver: zodResolver(hostMessageFormSchema),
    defaultValues: { body: "" },
  });
  const pending = form.formState.isSubmitting;
  const textareaId = React.useId();

  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function onSubmit(values: HostMessageFormValues) {
    const res = await sendHostMessageAction({ token, ...values });
    if (handleActionResult(res, { form, success: "Mensaje enviado. Te respondemos muy pronto." })) {
      form.reset({ body: "" });
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <div className="bg-sand-soft/60 flex flex-col items-center rounded-2xl px-6 py-8 text-center">
          <MessageSquareHeart className="text-olive mb-2 size-6" aria-hidden />
          <p className="font-medium">Aquí platicamos contigo</p>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            Escríbenos cualquier duda o idea para tu celebración. Te respondemos por aquí.
          </p>
        </div>
      ) : (
        <ol
          ref={listRef}
          aria-label="Mensajes con el equipo"
          className="bg-sand-soft/40 max-h-[26rem] space-y-3 overflow-y-auto rounded-2xl p-3 sm:p-4"
          tabIndex={0}
        >
          {messages.map((m) =>
            m.authorType === "SYSTEM" ? (
              <li key={m.id} className="flex justify-center">
                <p className="text-muted-foreground bg-background/80 rounded-full px-3 py-1 text-center text-xs">
                  {m.body} · {m.timeLabel}
                </p>
              </li>
            ) : (
              <li key={m.id} className={cn("flex", m.authorType === "CUSTOMER" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-xs",
                    m.authorType === "CUSTOMER"
                      ? "bg-olive text-ivory rounded-br-md"
                      : "bg-card text-card-foreground rounded-bl-md border",
                  )}
                >
                  <p className={cn("mb-0.5 text-xs font-medium", m.authorType === "CUSTOMER" ? "text-ivory" : "text-olive")}>
                    {m.authorType === "CUSTOMER" ? "Tú" : m.authorName}
                  </p>
                  <p className="whitespace-pre-line break-words">{m.body}</p>
                  <p
                    className={cn(
                      "mt-1 text-right text-[11px]",
                      m.authorType === "CUSTOMER" ? "text-ivory" : "text-muted-foreground",
                    )}
                  >
                    {m.timeLabel}
                  </p>
                </div>
              </li>
            ),
          )}
        </ol>
      )}

      {canSend ? (
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-2">
          <label htmlFor={textareaId} className="sr-only">
            Escribe tu mensaje
          </label>
          <Textarea
            id={textareaId}
            {...form.register("body")}
            rows={3}
            placeholder="Escribe tu mensaje para el equipo…"
            aria-invalid={form.formState.errors.body ? true : undefined}
            aria-describedby={form.formState.errors.body ? `${textareaId}-err` : undefined}
            className="text-base"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void form.handleSubmit(onSubmit)();
              }
            }}
          />
          {form.formState.errors.body ? (
            <p id={`${textareaId}-err`} role="alert" className="text-destructive text-xs font-medium">
              {form.formState.errors.body.message}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-11 rounded-full px-4"
              onClick={() => startRefresh(() => router.refresh())}
              disabled={refreshing}
            >
              <RefreshCw className={cn(refreshing && "animate-spin")} aria-hidden /> Actualizar
            </Button>
            <SubmitButton pending={pending} pendingText="Enviando…" size="xl">
              <Send aria-hidden /> Enviar
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
