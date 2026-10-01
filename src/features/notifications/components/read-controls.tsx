"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, MailOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { handleActionResult } from "@/components/forms/action-result";
import { markNotificationReadAction } from "../server/actions";

/**
 * En pantallas angostas la lista se oculta al abrir un mensaje: lleva la vista y el foco
 * al encabezado del detalle (útil también para lectores de pantalla).
 */
export function FocusDetailOnMobile({ targetId, messageId }: { targetId: string; messageId: string }) {
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 1023px)").matches) return;
    const el = document.getElementById(targetId);
    if (!el) return;
    el.scrollIntoView({ block: "start" });
    el.focus({ preventScroll: true });
  }, [targetId, messageId]);
  return null;
}

/** Al abrir un mensaje no leído, lo marca como leído (una sola vez). */
export function AutoMarkRead({ id, unread }: { id: string; unread: boolean }) {
  const router = useRouter();
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (!unread || done.current === id) return;
    done.current = id;
    void markNotificationReadAction({ id, read: true }).then((res) => {
      if (res.ok) router.refresh();
    });
  }, [id, unread, router]);
  return null;
}

export function ToggleReadButton({ id, read }: { id: string; read: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await markNotificationReadAction({ id, read: !read });
          if (handleActionResult(res, { success: read ? "Marcado como no leído" : "Marcado como leído" })) router.refresh();
        })
      }
    >
      {read ? <Mail aria-hidden /> : <MailOpen aria-hidden />}
      {read ? "Marcar como no leído" : "Marcar como leído"}
    </Button>
  );
}
