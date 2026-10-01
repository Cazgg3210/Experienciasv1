"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { handleActionResult } from "@/components/forms/action-result";
import { markAllNotificationsReadAction, runRemindersNowAction } from "../server/actions";

export function RunRemindersButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="lg"
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={() =>
        startTransition(async () => {
          const res = await runRemindersNowAction({});
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          const { total, summary, failedRules } = res.data;
          if (failedRules.length) toast.warning("Algunas reglas fallaron; revisa los logs.", { description: summary });
          else if (total > 0) toast.success(`${total} mensaje${total === 1 ? "" : "s"} nuevo${total === 1 ? "" : "s"}`, { description: summary });
          else toast.info("Todo al día", { description: summary });
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <PlayCircle aria-hidden />}
      {pending ? "Ejecutando…" : "Ejecutar recordatorios ahora"}
    </Button>
  );
}

export function MarkAllReadButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          const res = await markAllNotificationsReadAction({});
          if (handleActionResult(res)) {
            toast.success(res.data.count ? `${res.data.count} marcados como leídos` : "No había mensajes sin leer");
            router.refresh();
          }
        })
      }
    >
      <CheckCheck aria-hidden />
      Marcar todo como leído
    </Button>
  );
}
