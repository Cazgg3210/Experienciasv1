"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, ChevronDown, ClipboardList, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { ChecklistItemStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/data/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { MediaUploader } from "@/components/media/media-uploader";
import { handleActionResult } from "@/components/forms/action-result";
import {
  CHECKLIST_AREA_LABELS,
  CHECKLIST_PHASE_LABELS,
  CHECKLIST_STATUS_LABELS,
  CHECKLIST_STATUS_TONES,
  toOptions,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import { computeProgress, EVIDENCE_REQUIRED_MESSAGE, groupChecklist } from "../domain/checklist";
import type { ChecklistItemView } from "../server/ops-queries";
import {
  deleteChecklistItemAction,
  instantiateChecklistAction,
  updateChecklistItemAction,
} from "../server/actions";
import { NativeSelect } from "./native-select";
import { ProgressBar } from "./progress-bar";
import { AddChecklistItemDialog } from "./add-checklist-item-dialog";
import { AssigneeOptions, type AssigneeOption } from "./assignee-options";

type StaffOpt = AssigneeOption;
type Filter = "all" | "open" | "overdue" | "evidence" | "unassigned";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "Todas las tareas" },
  { value: "open", label: "Pendientes y en proceso" },
  { value: "overdue", label: "Vencidas" },
  { value: "evidence", label: "Requieren evidencia" },
  { value: "unassigned", label: "Sin responsable" },
];

function applyFilter(items: ChecklistItemView[], filter: Filter): ChecklistItemView[] {
  switch (filter) {
    case "open":
      return items.filter((i) => i.status === "PENDING" || i.status === "IN_PROGRESS");
    case "overdue":
      return items.filter((i) => i.overdue);
    case "evidence":
      return items.filter((i) => i.requiresEvidence);
    case "unassigned":
      return items.filter((i) => !i.assigneeId);
    default:
      return items;
  }
}

export function ChecklistBoard({
  eventId,
  items,
  staffOptions,
  canWrite,
  eventCancelled,
}: {
  eventId: string;
  items: ChecklistItemView[];
  staffOptions: StaffOpt[];
  canWrite: boolean;
  eventCancelled?: boolean;
}) {
  const [filter, setFilter] = React.useState<Filter>("all");
  const overall = computeProgress(items);
  const allGroups = React.useMemo(() => groupChecklist(items), [items]);
  const groups = React.useMemo(() => groupChecklist(applyFilter(items, filter)), [items, filter]);
  const overdue = items.filter((i) => i.overdue).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <ProgressBar progress={overall} label="Avance total del checklist" className="max-w-md" />
          <p className="text-muted-foreground text-xs">
            {overall.total} tareas · {overall.skipped} omitidas (no cuentan para el avance)
            {overdue > 0 ? (
              <span className="text-destructive font-medium"> · {overdue} vencidas</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <label className="sr-only" htmlFor={`filtro-${eventId}`}>
            Filtrar tareas
          </label>
          <NativeSelect
            id={`filtro-${eventId}`}
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="w-auto min-w-48"
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </NativeSelect>
          {canWrite && !eventCancelled ? (
            <>
              <AddChecklistItemDialog eventId={eventId} staffOptions={staffOptions} />
              <InstantiateButton eventId={eventId} />
            </>
          ) : null}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Aún no hay checklist para este evento"
          description="Genera las tareas desde las plantillas (T-7, T-3, montaje, evento, cierre) o agrega tareas personalizadas."
          action={canWrite && !eventCancelled ? <InstantiateButton eventId={eventId} primary /> : undefined}
        />
      ) : groups.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          Ninguna tarea coincide con el filtro.
        </p>
      ) : (
        groups.map((g) => {
          const phaseProgress = allGroups.find((x) => x.phase === g.phase)?.progress ?? g.progress;
          const headingId = `fase-${eventId}-${g.phase}`;
          return (
            <section
              key={g.phase}
              aria-labelledby={headingId}
              className="bg-card overflow-hidden rounded-xl border print:break-inside-avoid"
            >
              <header className="bg-sand-soft/50 flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 id={headingId} className="font-heading text-lg font-semibold">
                  {CHECKLIST_PHASE_LABELS[g.phase]}
                </h3>
                <ProgressBar
                  progress={phaseProgress}
                  label={`Avance de ${CHECKLIST_PHASE_LABELS[g.phase]}`}
                  className="sm:w-56"
                  size="sm"
                />
              </header>
              {g.areas.map((a) => (
                <div key={a.area} className="border-b last:border-b-0">
                  <h4 className="eyebrow px-4 pt-3">{CHECKLIST_AREA_LABELS[a.area]}</h4>
                  <ul className="divide-y">
                    {a.items.map((item) => (
                      <ChecklistItemRow key={item.id} item={item} staffOptions={staffOptions} canWrite={canWrite} />
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          );
        })
      )}
    </div>
  );
}

export function InstantiateButton({ eventId, primary = false }: { eventId: string; primary?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      type="button"
      variant={primary ? "default" : "outline"}
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={() =>
        startTransition(async () => {
          const res = await instantiateChecklistAction({ eventId });
          if (handleActionResult(res)) {
            toast.success(
              res.data.created > 0
                ? `Agregamos ${res.data.created} ${res.data.created === 1 ? "tarea" : "tareas"} desde las plantillas.`
                : "El checklist ya estaba al día con las plantillas.",
            );
            router.refresh();
          }
        })
      }
    >
      <Wand2 className="size-4" aria-hidden />
      {pending ? "Generando…" : "Generar desde plantillas"}
    </Button>
  );
}

const STATUS_OPTIONS = toOptions(CHECKLIST_STATUS_LABELS);

function ChecklistItemRow({
  item,
  staffOptions,
  canWrite,
}: {
  item: ChecklistItemView;
  staffOptions: StaffOpt[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [notes, setNotes] = React.useState(item.notes ?? "");
  const [dueAt, setDueAt] = React.useState(item.dueAtInput);
  const panelId = `tarea-${item.id}`;

  React.useEffect(() => setNotes(item.notes ?? ""), [item.notes]);
  React.useEffect(() => setDueAt(item.dueAtInput), [item.dueAtInput]);

  function update(patch: Parameters<typeof updateChecklistItemAction>[0], success?: string) {
    startTransition(async () => {
      const res = await updateChecklistItemAction(patch);
      if (handleActionResult(res, { success })) router.refresh();
    });
  }

  function onStatusChange(status: ChecklistItemStatus) {
    if (status === "DONE" && item.requiresEvidence && !item.evidence) {
      toast.error(EVIDENCE_REQUIRED_MESSAGE);
      setOpen(true);
      return;
    }
    update({ id: item.id, status }, status === "DONE" ? "Tarea completada" : "Estado actualizado");
  }

  const assigneeKnown = !item.assigneeId || staffOptions.some((s) => s.id === item.assigneeId);

  return (
    <li className={cn("px-4 py-3", item.overdue && "bg-destructive/5", pending && "opacity-70")} aria-busy={pending || undefined}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className={cn("font-medium", item.status === "DONE" && "text-muted-foreground line-through", item.status === "SKIPPED" && "text-muted-foreground")}>
              {item.title}
            </p>
            {item.requiresEvidence ? (
              <StatusBadge tone={item.evidence ? "success" : "warning"} dot={false}>
                <Camera className="size-3" aria-hidden />
                {item.evidence ? "Con evidencia" : "Requiere evidencia"}
              </StatusBadge>
            ) : null}
            {item.overdue ? (
              <StatusBadge tone="danger" dot={false}>
                <AlertTriangle className="size-3" aria-hidden />
                Vencida
              </StatusBadge>
            ) : null}
            {!item.fromTemplate ? (
              <StatusBadge tone="muted" dot={false}>
                Personalizada
              </StatusBadge>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {item.dueAtLabel ? <>Vence {item.dueAtLabel}</> : "Sin fecha límite"} · {item.assigneeName ?? "Sin responsable"}
            {item.completedLabel ? <> · Hecha {item.completedLabel}</> : null}
          </p>
          <p className="mt-1 hidden text-xs print:block">
            Estado: {CHECKLIST_STATUS_LABELS[item.status]}
            {item.notes ? ` · Notas: ${item.notes}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <span className="sr-only" id={`${panelId}-status-label`}>
            Estado de la tarea {item.title}
          </span>
          {canWrite ? (
            <NativeSelect
              aria-labelledby={`${panelId}-status-label`}
              value={item.status}
              disabled={pending}
              onChange={(e) => onStatusChange(e.target.value as ChecklistItemStatus)}
              className="w-36"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          ) : (
            <StatusBadge tone={CHECKLIST_STATUS_TONES[item.status]}>{CHECKLIST_STATUS_LABELS[item.status]}</StatusBadge>
          )}
          {canWrite ? (
            <NativeSelect
              aria-label={`Responsable de ${item.title}`}
              value={item.assigneeId ?? ""}
              disabled={pending}
              onChange={(e) => update({ id: item.id, assigneeId: e.target.value || null }, "Responsable actualizado")}
              className="w-44"
            >
              <option value="">Sin responsable</option>
              {!assigneeKnown ? <option value={item.assigneeId!}>{item.assigneeName ?? "Integrante"}</option> : null}
              <AssigneeOptions options={staffOptions} />
            </NativeSelect>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
          >
            Detalles
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
          </Button>
        </div>
      </div>

      {open ? (
        <div id={panelId} className="bg-muted/40 mt-3 grid gap-4 rounded-lg p-3 md:grid-cols-2 print:hidden">
          <div className="space-y-3">
            {item.description ? <p className="text-sm">{item.description}</p> : null}
            <div className="space-y-1.5">
              <label htmlFor={`${panelId}-notes`} className="text-sm font-medium">
                Notas
              </label>
              <Textarea
                id={`${panelId}-notes`}
                value={notes}
                maxLength={2000}
                disabled={!canWrite || pending}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalles, proveedor, a quién llamar…"
              />
              {canWrite ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending || notes === (item.notes ?? "")}
                  onClick={() => update({ id: item.id, notes }, "Notas guardadas")}
                >
                  Guardar notas
                </Button>
              ) : null}
            </div>
            {canWrite ? (
              <div className="space-y-1.5">
                <label htmlFor={`${panelId}-due`} className="text-sm font-medium">
                  Fecha límite (hora CDMX)
                </label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    id={`${panelId}-due`}
                    type="datetime-local"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className="w-auto"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending || dueAt === item.dueAtInput}
                    onClick={() => update({ id: item.id, dueAt }, "Fecha actualizada")}
                  >
                    Guardar fecha
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium">
              Evidencia {item.requiresEvidence ? <span className="text-warning">(obligatoria para marcar como hecha)</span> : "(opcional)"}
            </p>
            {item.evidence ? (
              <div className="flex items-start gap-3">
                <a href={item.evidence.url} target="_blank" rel="noreferrer" className="shrink-0">
                  <Image
                    src={item.evidence.url}
                    alt={item.evidence.alt ?? `Evidencia de ${item.title}`}
                    width={160}
                    height={120}
                    unoptimized
                    className="h-[120px] w-[160px] rounded-lg border object-cover"
                  />
                </a>
                {canWrite ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => update({ id: item.id, evidenceMediaId: null }, "Evidencia quitada")}
                  >
                    Quitar
                  </Button>
                ) : null}
              </div>
            ) : null}
            {canWrite ? (
              <MediaUploader
                fields={{ purpose: "CHECKLIST_EVIDENCE", eventId: item.eventId, alt: `Evidencia: ${item.title}`.slice(0, 200) }}
                label={item.evidence ? "Reemplazar foto" : "Subir foto de evidencia"}
                disabled={pending}
                onUploaded={(media) =>
                  update(
                    { id: item.id, evidenceMediaId: media.id },
                    item.requiresEvidence ? "Evidencia lista: ya puedes marcarla como hecha" : "Evidencia agregada",
                  )
                }
              />
            ) : null}
            {canWrite ? (
              <ConfirmDialog
                trigger={
                  <Button type="button" variant="ghost" size="sm" className="text-destructive">
                    <Trash2 className="size-3.5" aria-hidden />
                    Eliminar tarea
                  </Button>
                }
                title="¿Eliminar esta tarea?"
                description={
                  item.fromTemplate
                    ? `«${item.title}» viene de una plantilla: si vuelves a generar desde plantillas se creará de nuevo. Para descartarla sin que regrese, márcala como «Omitido».`
                    : `«${item.title}» se quitará del checklist del evento.`
                }
                confirmLabel="Eliminar"
                destructive
                onConfirm={async () => {
                  const res = await deleteChecklistItemAction({ id: item.id });
                  if (handleActionResult(res, { success: "Tarea eliminada" })) router.refresh();
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}
