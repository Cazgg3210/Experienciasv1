"use client";

import { useTransition } from "react";
import { Eye, EyeOff, MessageSquareHeart } from "lucide-react";
import { StatusBadge } from "@/components/data/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { handleActionResult } from "@/components/forms/action-result";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setMessageHiddenAction } from "../server/actions";

export type ModerationMessage = {
  id: string;
  kind: "HONOREE" | "GUESTBOOK" | "HOST_THREAD";
  authorName: string;
  authorLabel: string;
  body: string;
  hidden: boolean;
  createdAtLabel: string;
};

const KIND_LABELS: Record<ModerationMessage["kind"], string> = {
  HONOREE: "Para la homenajeada",
  GUESTBOOK: "Libro de visitas",
  HOST_THREAD: "Conversación",
};

export function MessagesModeration({ eventId, messages }: { eventId: string; messages: ModerationMessage[] }) {
  if (!messages.length) {
    return (
      <EmptyState
        icon={MessageSquareHeart}
        title="Todavía no hay mensajes"
        description="Los mensajes para la homenajeada (del micrositio) y los del libro de visitas de la cápsula aparecerán aquí."
      />
    );
  }
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {messages.map((m) => (
        <MessageRow key={m.id} eventId={eventId} message={m} />
      ))}
    </ul>
  );
}

function MessageRow({ eventId, message }: { eventId: string; message: ModerationMessage }) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const res = await setMessageHiddenAction({ eventId, messageId: message.id, hidden: !message.hidden });
      handleActionResult(res, { success: message.hidden ? "Mensaje visible de nuevo" : "Mensaje oculto" });
    });
  }

  return (
    <li className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-start", pending && "opacity-70")} aria-busy={pending || undefined}>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{message.authorName}</p>
          <span className="text-muted-foreground text-xs">
            {message.authorLabel} · {message.createdAtLabel}
          </span>
        </div>
        <p className={cn("text-sm whitespace-pre-line", message.hidden && "text-muted-foreground line-through decoration-1")}>
          {message.body}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge tone="neutral" dot={false}>
            {KIND_LABELS[message.kind]}
          </StatusBadge>
          {message.hidden ? <StatusBadge tone="warning">Oculto</StatusBadge> : <StatusBadge tone="success">Visible</StatusBadge>}
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        disabled={pending}
        onClick={toggle}
        aria-label={message.hidden ? `Mostrar mensaje de ${message.authorName}` : `Ocultar mensaje de ${message.authorName}`}
      >
        {message.hidden ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
        {message.hidden ? "Mostrar" : "Ocultar"}
      </Button>
    </li>
  );
}
