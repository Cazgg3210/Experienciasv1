"use client";

import * as React from "react";
import { Eye, EyeOff, Gift } from "lucide-react";
import { toast } from "sonner";
import { handleActionResult } from "@/components/forms/action-result";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { moderateHonoreeMessageAction } from "../server/actions";

export type HonoreeMessageView = {
  id: string;
  authorName: string;
  body: string;
  hidden: boolean;
  createdAtLabel: string;
};

/** Mensajes para la homenajeada con moderación (ocultar / mostrar). */
export function HonoreeMessages({
  eventId,
  honoreeName,
  messages,
  canModerate,
}: {
  eventId: string;
  honoreeName: string | null;
  messages: HonoreeMessageView[];
  canModerate: boolean;
}) {
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const hiddenCount = messages.filter((m) => m.hidden).length;

  async function toggle(m: HonoreeMessageView) {
    setPendingId(m.id);
    try {
      const res = await moderateHonoreeMessageAction({ eventId, messageId: m.id, hidden: !m.hidden });
      if (handleActionResult(res)) toast.success(m.hidden ? "Mensaje visible de nuevo" : "Mensaje oculto");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section
      aria-labelledby="honoree-title"
      className="bg-card space-y-3 rounded-xl border p-4 shadow-xs sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="honoree-title" className="font-heading flex items-center gap-2 text-xl font-semibold">
          <Gift className="text-olive size-5" aria-hidden />
          Mensajes para {honoreeName ?? "la homenajeada"}
        </h2>
        <span className="text-muted-foreground text-sm">
          {messages.length} mensaje{messages.length === 1 ? "" : "s"}
          {hiddenCount ? ` · ${hiddenCount} oculto${hiddenCount === 1 ? "" : "s"}` : ""}
        </span>
      </div>
      {messages.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Las invitadas pueden dejar un mensaje desde el micrositio; aparecerán aquí para revisarlos.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                "flex flex-col justify-between gap-2 rounded-lg border p-3",
                m.hidden ? "bg-muted/60 border-dashed" : "bg-ivory/60",
              )}
            >
              <div>
                <p
                  className={cn(
                    "text-sm whitespace-pre-wrap",
                    m.hidden && "text-muted-foreground line-through",
                  )}
                >
                  {m.body}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  — {m.authorName} · {m.createdAtLabel}
                  {m.hidden ? " · oculto" : ""}
                </p>
              </div>
              {canModerate ? (
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pendingId === m.id}
                    onClick={() => toggle(m)}
                    aria-label={`${m.hidden ? "Mostrar" : "Ocultar"} mensaje de ${m.authorName}`}
                  >
                    {m.hidden ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
                    {m.hidden ? "Mostrar" : "Ocultar"}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
