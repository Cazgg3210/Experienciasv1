"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NOTIFICATION_STATUS_LABELS } from "@/lib/labels";
import type { NotificationStatus } from "@prisma/client";
import { sendTestEmailAction, sendTestWhatsAppAction } from "../server/actions";

export function IntegrationTestButtons({ canEdit, email }: { canEdit: boolean; email: string }) {
  const router = useRouter();
  const [pendingEmail, startEmail] = useTransition();
  const [pendingWa, startWa] = useTransition();

  function report(res: Awaited<ReturnType<typeof sendTestEmailAction>>, label: string) {
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const status = NOTIFICATION_STATUS_LABELS[res.data.status as NotificationStatus] ?? res.data.status;
    toast.success(`${label} registrado (${status.toLowerCase()})`, {
      description: `Para: ${res.data.to}`,
      action: {
        label: "Ver en bandeja",
        onClick: () => router.push(`/admin/notifications?id=${encodeURIComponent(res.data.id)}`),
      },
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={!canEdit || pendingEmail}
        onClick={() => startEmail(async () => report(await sendTestEmailAction({}), "Email de prueba"))}
      >
        <Mail aria-hidden />
        {pendingEmail ? "Enviando…" : "Enviar email de prueba"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={!canEdit || pendingWa}
        onClick={() => startWa(async () => report(await sendTestWhatsAppAction({}), "WhatsApp de prueba"))}
      >
        <MessageCircle aria-hidden />
        {pendingWa ? "Enviando…" : "Enviar WhatsApp de prueba"}
      </Button>
      <p className="text-muted-foreground text-xs sm:ml-2">
        El email llega a <span className="font-medium">{email}</span>; el WhatsApp, al número del negocio. Ambos quedan en la{" "}
        <Link href="/admin/notifications" className="text-olive underline underline-offset-4">
          Bandeja
        </Link>
        .
      </p>
    </div>
  );
}
