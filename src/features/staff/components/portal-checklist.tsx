"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, Check, ClipboardList, Lock, Play, RotateCcw, StickyNote } from "lucide-react";
import { toast } from "sonner";
import type { ChecklistItemStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/data/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { MediaUploader } from "@/components/media/media-uploader";
import { handleActionResult } from "@/components/forms/action-result";
import {
  CHECKLIST_AREA_LABELS,
  CHECKLIST_PHASE_LABELS,
  CHECKLIST_STATUS_LABELS,
  CHECKLIST_STATUS_TONES,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import { EVIDENCE_REQUIRED_MESSAGE, groupChecklist } from "@/features/operations/domain/checklist";
import { ProgressBar } from "@/features/operations/components/progress-bar";
import type { StaffChecklistItem } from "../server/portal-queries";
import { staffUpdateChecklistItemAction } from "../server/actions";

type View = "mine" | "all";

export function PortalChecklist({
  items,
  hasStaffProfile,
  viewerIsBackoffice = false,
}: {
  items: StaffChecklistItem[];
  hasStaffProfile: boolean;
  viewerIsBackoffice?: boolean;
}) {
  const isMineView = (i: StaffChecklistItem) => i.mine || (i.canEdit && !i.assigneeId);
  const mineCount = items.filter(isMineView).length;
  const [view, setView] = React.useState<View>(hasStaffProfile && mineCount > 0 ? "mine" : "all");
  const visible = view === "mine" ? items.filter(isMineView) : items;
  const groups = groupChecklist(visible);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="El checklist aún no está listo"
        description="Coordinación lo genera al confirmar el evento. Vuelve a revisar más tarde."
      />
    );
  }

  return (
    <div className="space-y-5">
      {hasStaffProfile ? (
        <div className="bg-muted inline-flex rounded-full p-1" role="group" aria-label="Qué tareas ver">
          {(
            [
              ["mine", `Mis tareas (${mineCount})`],
              ["all", `Todas (${items.length})`],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                "focus-visible:ring-ring/50 h-10 rounded-full px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3",
                view === v ? "bg-background text-foreground shadow-xs" : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {groups.length === 0 ? (
        <p className="text-muted-foreground rounded-2xl border border-dashed p-6 text-center text-sm">
          No tienes tareas asignadas en este evento. Revisa «Todas» para ver el plan completo.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.phase} aria-labelledby={`p-${g.phase}`} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 id={`p-${g.phase}`} className="font-heading text-xl font-semibold">
                {CHECKLIST_PHASE_LABELS[g.phase]}
              </h3>
              <ProgressBar progress={g.progress} label={`Avance de ${CHECKLIST_PHASE_LABELS[g.phase]}`} className="w-32" size="sm" />
            </div>
            <ul className="space-y-3">
              {g.areas.flatMap((a) => a.items).map((item) => (
                <PortalItem key={item.id} item={item} viewerIsBackoffice={viewerIsBackoffice} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function PortalItem({ item, viewerIsBackoffice }: { item: StaffChecklistItem; viewerIsBackoffice: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [notesOpen, setNotesOpen] = React.useState(false);
  const [notes, setNotes] = React.useState(item.notes ?? "");
  React.useEffect(() => setNotes(item.notes ?? ""), [item.notes]);
  const notesId = `notas-${item.id}`;

  function update(patch: Omit<Parameters<typeof staffUpdateChecklistItemAction>[0], "id">, success: string) {
    startTransition(async () => {
      const res = await staffUpdateChecklistItemAction({ id: item.id, ...patch });
      if (handleActionResult(res, { success })) router.refresh();
    });
  }

  function setStatus(status: ChecklistItemStatus) {
    if (status === "DONE" && item.requiresEvidence && !item.evidence) {
      toast.error(EVIDENCE_REQUIRED_MESSAGE);
      return;
    }
    update({ status }, status === "DONE" ? "¡Tarea hecha!" : status === "IN_PROGRESS" ? "Tarea en proceso" : "Tarea reabierta");
  }

  const done = item.status === "DONE";
  const assigneeLabel = item.mine ? "Tú" : item.assigneeName ?? "Sin asignar";

  return (
    <li
      className={cn(
        "bg-card space-y-3 rounded-2xl border p-4 shadow-xs",
        item.overdue && "border-destructive/40",
        done && "bg-sage-soft/30",
        pending && "opacity-70",
      )}
      aria-busy={pending || undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className={cn("text-base leading-snug font-medium", done && "text-muted-foreground line-through")}>{item.title}</p>
          <p className="text-muted-foreground text-xs">
            {CHECKLIST_AREA_LABELS[item.area]}
            {item.dueAtLabel ? ` · ${item.dueAtLabel}` : ""} · {assigneeLabel}
          </p>
          {item.description ? <p className="text-muted-foreground text-sm">{item.description}</p> : null}
        </div>
        <StatusBadge tone={CHECKLIST_STATUS_TONES[item.status]}>{CHECKLIST_STATUS_LABELS[item.status]}</StatusBadge>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {item.overdue ? (
          <StatusBadge tone="danger" dot={false}>
            <AlertTriangle className="size-3" aria-hidden />
            Vencida
          </StatusBadge>
        ) : null}
        {item.requiresEvidence ? (
          <StatusBadge tone={item.evidence ? "success" : "warning"} dot={false}>
            <Camera className="size-3" aria-hidden />
            {item.evidence ? "Foto lista" : "Requiere foto"}
          </StatusBadge>
        ) : null}
      </div>

      {item.evidence ? (
        <a href={item.evidence.url} target="_blank" rel="noreferrer" className="block w-fit">
          <Image
            src={item.evidence.url}
            alt={item.evidence.alt ?? `Evidencia de ${item.title}`}
            width={200}
            height={150}
            unoptimized
            className="h-[150px] w-[200px] rounded-xl border object-cover"
          />
        </a>
      ) : null}

      {item.notes && !notesOpen ? (
        <p className="bg-muted/50 rounded-lg px-3 py-2 text-sm">
          <span className="text-muted-foreground text-xs">Nota: </span>
          {item.notes}
        </p>
      ) : null}

      {item.canEdit ? (
        <div className="space-y-3">
          {item.status === "SKIPPED" && !viewerIsBackoffice ? (
            <p className="text-muted-foreground text-sm">Coordinación marcó esta tarea como omitida.</p>
          ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {item.status === "PENDING" ? (
              <Button type="button" variant="outline" className="h-11 rounded-full text-base" disabled={pending} onClick={() => setStatus("IN_PROGRESS")}>
                <Play className="size-4" aria-hidden />
                Empezar
              </Button>
            ) : null}
            {item.status !== "DONE" && item.status !== "SKIPPED" ? (
              <Button type="button" className="h-11 rounded-full text-base" disabled={pending} onClick={() => setStatus("DONE")}>
                <Check className="size-4" aria-hidden />
                Marcar como hecha
              </Button>
            ) : (
              <Button type="button" variant="outline" className="h-11 rounded-full text-base" disabled={pending} onClick={() => setStatus("PENDING")}>
                <RotateCcw className="size-4" aria-hidden />
                Reabrir
              </Button>
            )}
            {item.status === "IN_PROGRESS" ? (
              <Button type="button" variant="ghost" className="h-11 rounded-full" disabled={pending} onClick={() => setStatus("PENDING")}>
                Volver a pendiente
              </Button>
            ) : null}
          </div>
          )}

          {!done && item.status !== "SKIPPED" ? (
            <MediaUploader
              fields={{ purpose: "CHECKLIST_EVIDENCE", eventId: item.eventId, alt: `Evidencia: ${item.title}`.slice(0, 200) }}
              label={item.evidence ? "Cambiar foto" : item.requiresEvidence ? "Tomar o subir foto (obligatoria)" : "Agregar foto (opcional)"}
              disabled={pending}
              onUploaded={(media) =>
                update({ evidenceMediaId: media.id }, item.requiresEvidence ? "Foto lista: ya puedes marcarla como hecha" : "Foto agregada")
              }
            />
          ) : null}

          {notesOpen ? (
            <div className="space-y-2">
              <label htmlFor={notesId} className="text-sm font-medium">
                Nota para coordinación
              </label>
              <Textarea
                id={notesId}
                value={notes}
                maxLength={2000}
                rows={3}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Faltaron 2 copas, el proveedor llegó tarde…"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="h-10 rounded-full"
                  disabled={pending || notes === (item.notes ?? "")}
                  onClick={() => {
                    update({ notes }, "Nota guardada");
                    setNotesOpen(false);
                  }}
                >
                  Guardar nota
                </Button>
                <Button type="button" variant="ghost" className="h-10 rounded-full" onClick={() => setNotesOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setNotesOpen(true)} aria-controls={notesId}>
              <StickyNote className="size-4" aria-hidden />
              {item.notes ? "Editar nota" : "Agregar nota"}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Lock className="size-3.5" aria-hidden />
          Asignada a {item.assigneeName ?? "otra persona"}: sólo lectura.
        </p>
      )}
    </li>
  );
}
