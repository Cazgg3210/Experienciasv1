"use client";

import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { CopyButton } from "@/components/data/copy-button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { handleActionResult } from "@/components/forms/action-result";
import { Button } from "@/components/ui/button";
import { rotateEventTokenAction } from "../server/actions";

/** Enlaces privados del evento + rotación de tokens (invalida el enlace anterior). */
export function TokenPanel({
  eventId,
  portalUrl,
  inviteUrl,
  micrositeEnabled,
  canWrite,
}: {
  eventId: string;
  portalUrl: string;
  inviteUrl: string;
  micrositeEnabled: boolean;
  canWrite: boolean;
}) {
  async function rotate(kind: "portal" | "invite") {
    const res = await rotateEventTokenAction({ eventId, kind });
    if (!handleActionResult(res)) return;
    try {
      await navigator.clipboard.writeText(res.data.url);
      toast.success("Nuevo enlace generado y copiado");
    } catch {
      toast.success("Nuevo enlace generado");
    }
  }

  const rows = [
    {
      kind: "portal" as const,
      title: "Portal de la clienta",
      hint: "Acceso privado de la anfitriona a su evento.",
      url: portalUrl,
    },
    {
      kind: "invite" as const,
      title: "Invitación (micrositio)",
      hint: micrositeEnabled
        ? "Link general para compartir con las invitadas."
        : "El micrositio está desactivado: el link no funcionará.",
      url: inviteUrl,
    },
  ];

  return (
    <section
      aria-labelledby="tokens-title"
      className="bg-card space-y-4 rounded-xl border p-4 shadow-xs sm:p-5"
    >
      <div>
        <h2 id="tokens-title" className="font-heading text-xl font-semibold">
          Enlaces privados
        </h2>
        <p className="text-muted-foreground text-sm">
          Si un enlace se compartió por error, genera uno nuevo.
        </p>
      </div>
      <ul className="space-y-4">
        {rows.map((r) => (
          <li key={r.kind} className="space-y-2">
            <div>
              <p className="text-sm font-medium">{r.title}</p>
              <p className="text-muted-foreground text-xs">{r.hint}</p>
            </div>
            <p className="bg-muted/60 truncate rounded-md px-2 py-1.5 font-mono text-xs" title={r.url}>
              {r.url}
            </p>
            <div className="flex flex-wrap gap-2">
              <CopyButton value={r.url} label="Copiar" size="sm" />
              {canWrite ? (
                <ConfirmDialog
                  title={`¿Generar un nuevo enlace de ${r.kind === "portal" ? "portal" : "invitación"}?`}
                  description={
                    r.kind === "portal"
                      ? "El enlace actual del portal dejará de funcionar. Tendrás que enviarle el nuevo a la clienta."
                      : "El link general de invitación dejará de funcionar. Los links personales de cada invitada siguen activos."
                  }
                  confirmLabel="Generar nuevo enlace"
                  destructive
                  onConfirm={() => rotate(r.kind)}
                  trigger={
                    <Button variant="ghost" size="sm">
                      <RefreshCw aria-hidden />
                      Rotar enlace
                    </Button>
                  }
                />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
