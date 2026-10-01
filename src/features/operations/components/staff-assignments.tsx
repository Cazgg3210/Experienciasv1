"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Pencil, Phone, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import type { StaffFunction } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/forms/money-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { handleActionResult } from "@/components/forms/action-result";
import { StatusBadge } from "@/components/data/status-badge";
import { STAFF_FUNCTION_LABELS, STAFF_RATE_LABELS, toOptions } from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  defaultAssignmentAmount,
  parseLocalDateTime,
  suggestedWindow,
  toLocalInputValue,
} from "../domain/assignment";
import { assignmentFormSchema, type AssignmentFormValues } from "../schemas";
import type { z } from "zod";
import type { AssignmentView, StaffOption } from "../server/ops-queries";
import {
  createAssignmentAction,
  deleteAssignmentAction,
  setAssignmentFlagsAction,
  updateAssignmentAction,
} from "../server/actions";
import { NativeSelect } from "./native-select";

type AssignmentFormOutput = z.output<typeof assignmentFormSchema>;

type Props = {
  eventId: string;
  eventStartsAt: string;
  eventEndsAt: string;
  assignments: AssignmentView[];
  staffOptions: StaffOption[];
  canWrite: boolean;
  eventCancelled?: boolean;
};

export function StaffAssignments({ eventId, eventStartsAt, eventEndsAt, assignments, staffOptions, canWrite, eventCancelled }: Props) {
  const [dialog, setDialog] = React.useState<{ mode: "create" } | { mode: "edit"; assignment: AssignmentView } | null>(null);
  const total = assignments.reduce((s, a) => s + a.amountCents, 0);
  const hasCoordinator = assignments.some((a) => a.function === "COORDINATOR");
  const people = new Set(assignments.map((a) => a.staffMemberId)).size;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {people} {people === 1 ? "persona asignada" : "personas asignadas"} · Costo staff{" "}
            <span className="text-foreground font-medium tabular-nums">{formatMXN(total)}</span>
          </span>
          {!hasCoordinator ? (
            <StatusBadge tone="warning" dot={false}>
              <AlertTriangle className="size-3" aria-hidden />
              Falta coordinación
            </StatusBadge>
          ) : null}
        </div>
        {canWrite && !eventCancelled ? (
          <Button type="button" onClick={() => setDialog({ mode: "create" })} className="print:hidden">
            <UserPlus className="size-4" aria-hidden />
            Asignar staff
          </Button>
        ) : null}
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nadie asignado todavía"
          description="Asigna coordinación, cocina y servicio. Les avisaremos por correo y WhatsApp."
        />
      ) : (
        <ul className="divide-y rounded-xl border">
          {assignments.map((a) => (
            <AssignmentRow key={a.id} a={a} canWrite={canWrite} onEdit={() => setDialog({ mode: "edit", assignment: a })} />
          ))}
        </ul>
      )}

      {dialog ? (
        <AssignmentDialog
          key={dialog.mode === "edit" ? dialog.assignment.id : "new"}
          open
          onOpenChange={(o) => !o && setDialog(null)}
          eventId={eventId}
          eventStartsAt={eventStartsAt}
          eventEndsAt={eventEndsAt}
          staffOptions={staffOptions}
          assignment={dialog.mode === "edit" ? dialog.assignment : null}
        />
      ) : null}
    </div>
  );
}

function AssignmentRow({ a, canWrite, onEdit }: { a: AssignmentView; canWrite: boolean; onEdit: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function setFlag(patch: { confirmed?: boolean; paid?: boolean }) {
    startTransition(async () => {
      const res = await setAssignmentFlagsAction({ id: a.id, ...patch });
      if (handleActionResult(res, { success: "Actualizado" })) router.refresh();
    });
  }

  return (
    <li className={cn("space-y-2 p-4 print:break-inside-avoid", pending && "opacity-70")}>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto_auto] md:items-center">
        <div className="min-w-0">
          <Link href={`/admin/staff/${a.staffMemberId}`} className="font-medium hover:underline">
            {a.staffName}
          </Link>
          <p className="text-muted-foreground text-sm">
            {STAFF_FUNCTION_LABELS[a.function]} · {a.scheduleLabel}
          </p>
          {a.staffPhone ? (
            <a href={`tel:${a.staffPhone}`} className="text-muted-foreground inline-flex items-center gap-1 text-xs hover:underline">
              <Phone className="size-3" aria-hidden />
              {a.staffPhone}
            </a>
          ) : null}
          {a.notes ? <p className="text-muted-foreground mt-1 text-xs italic">{a.notes}</p> : null}
        </div>
        <p className="text-sm tabular-nums">
          <span className="text-muted-foreground mr-1 md:hidden">Monto:</span>
          {formatMXN(a.amountCents)}
        </p>
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <Switch
              checked={a.confirmed}
              disabled={!canWrite || pending}
              onCheckedChange={(v) => setFlag({ confirmed: v })}
              aria-label={`Confirmado: ${a.staffName}`}
            />
            Confirmada
          </label>
          <label className="flex items-center gap-2">
            <Switch
              checked={a.paid}
              disabled={!canWrite || pending}
              onCheckedChange={(v) => setFlag({ paid: v })}
              aria-label={`Pagado: ${a.staffName}`}
            />
            Pagada
          </label>
        </div>
        {canWrite ? (
          <div className="flex items-center gap-1 print:hidden">
            <Button type="button" variant="ghost" size="icon" onClick={onEdit} aria-label={`Editar asignación de ${a.staffName}`}>
              <Pencil className="size-4" />
            </Button>
            <ConfirmDialog
              trigger={
                <Button type="button" variant="ghost" size="icon" aria-label={`Quitar a ${a.staffName}`} className="text-destructive">
                  <Trash2 className="size-4" />
                </Button>
              }
              title="¿Quitar esta asignación?"
              description={`${a.staffName} dejará de ver este evento en su portal y sus tareas abiertas quedarán sin responsable.`}
              confirmLabel="Quitar"
              destructive
              onConfirm={async () => {
                const res = await deleteAssignmentAction({ id: a.id });
                if (handleActionResult(res, { success: "Asignación eliminada" })) router.refresh();
              }}
            />
          </div>
        ) : null}
      </div>
      {a.warnings.length ? (
        <ul className="space-y-1" aria-label={`Avisos de ${a.staffName}`}>
          {a.warnings.map((w, i) => (
            <li key={i} className="text-warning flex items-start gap-1.5 text-xs font-medium">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {w.message}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

const FUNCTION_OPTIONS = toOptions(STAFF_FUNCTION_LABELS);

function AssignmentDialog({
  open,
  onOpenChange,
  eventId,
  eventStartsAt,
  eventEndsAt,
  staffOptions,
  assignment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventStartsAt: string;
  eventEndsAt: string;
  staffOptions: StaffOption[];
  assignment: AssignmentView | null;
}) {
  const router = useRouter();
  const evStart = React.useMemo(() => new Date(eventStartsAt), [eventStartsAt]);
  const evEnd = React.useMemo(() => new Date(eventEndsAt), [eventEndsAt]);

  const initialWindow = suggestedWindow("SERVER", evStart, evEnd);
  const form = useForm<AssignmentFormValues, unknown, AssignmentFormOutput>({
    resolver: zodResolver(assignmentFormSchema),
    defaultValues: assignment
      ? {
          staffMemberId: assignment.staffMemberId,
          function: assignment.function,
          startsAt: assignment.startsAtInput,
          endsAt: assignment.endsAtInput,
          amountCents: assignment.amountCents,
          confirmed: assignment.confirmed,
          paid: assignment.paid,
          notes: assignment.notes ?? "",
        }
      : {
          staffMemberId: "",
          function: "SERVER",
          startsAt: toLocalInputValue(initialWindow.startsAt),
          endsAt: toLocalInputValue(initialWindow.endsAt),
          amountCents: null,
          confirmed: false,
          paid: false,
          notes: "",
        },
  });
  const errors = form.formState.errors;
  const [autoAmount, setAutoAmount] = React.useState(!assignment);

  const staffId = form.watch("staffMemberId");
  const fn = form.watch("function");
  const startsAt = form.watch("startsAt");
  const endsAt = form.watch("endsAt");
  const member = staffOptions.find((s) => s.id === staffId);

  // Al elegir integrante (alta): función principal + horario sugerido si no se ha editado.
  function onStaffChange(id: string) {
    form.setValue("staffMemberId", id, { shouldValidate: true });
    const m = staffOptions.find((s) => s.id === id);
    if (!assignment && m) {
      form.setValue("function", m.primaryFunction);
      applySuggestedWindow(m.primaryFunction);
    }
  }
  function applySuggestedWindow(f: StaffFunction) {
    if (form.getFieldState("startsAt").isDirty || form.getFieldState("endsAt").isDirty) return;
    const w = suggestedWindow(f, evStart, evEnd);
    form.setValue("startsAt", toLocalInputValue(w.startsAt));
    form.setValue("endsAt", toLocalInputValue(w.endsAt));
  }

  const s = parseLocalDateTime(startsAt ?? "");
  const e = parseLocalDateTime(endsAt ?? "");
  const suggested = member && s && e && e > s ? defaultAssignmentAmount(member, s, e) : null;

  async function onSubmit(values: AssignmentFormOutput) {
    const payload = { ...values, amountCents: autoAmount ? null : (values.amountCents ?? 0) };
    const res = assignment
      ? await updateAssignmentAction({ ...payload, id: assignment.id })
      : await createAssignmentAction({ ...payload, eventId });
    if (handleActionResult(res, { form, success: assignment ? "Asignación actualizada" : "Staff asignado y notificado" })) {
      for (const w of res.data.warnings) toast.warning(w);
      onOpenChange(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{assignment ? "Editar asignación" : "Asignar staff"}</DialogTitle>
          <DialogDescription>Horarios en hora de CDMX. Si no capturas monto, se calcula con su tarifa.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Integrante" error={errors.staffMemberId?.message} required>
            {(p) => (
              <NativeSelect {...p} value={staffId} onChange={(ev) => onStaffChange(ev.target.value)}>
                <option value="">Elige a alguien del equipo…</option>
                {staffOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} — {STAFF_FUNCTION_LABELS[o.primaryFunction]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label="Función en este evento" error={errors.function?.message} required>
            {(p) => (
              <NativeSelect
                {...p}
                value={fn}
                onChange={(ev) => {
                  const f = ev.target.value as StaffFunction;
                  form.setValue("function", f, { shouldValidate: true });
                  if (!assignment) applySuggestedWindow(f);
                }}
              >
                {FUNCTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Entrada" error={errors.startsAt?.message} required>
              {(p) => <Input {...p} type="datetime-local" {...form.register("startsAt")} />}
            </Field>
            <Field label="Salida" error={errors.endsAt?.message} required>
              {(p) => <Input {...p} type="datetime-local" {...form.register("endsAt")} />}
            </Field>
          </div>
          <div className="space-y-2 rounded-lg border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox aria-label="Calcular monto con su tarifa" checked={autoAmount} onCheckedChange={(v) => setAutoAmount(v === true)} />
              Calcular monto con su tarifa
            </label>
            {member ? (
              <p className="text-muted-foreground text-xs">
                Tarifa: {formatMXN(member.rateCents)} {STAFF_RATE_LABELS[member.rateType].toLowerCase()}
                {suggested !== null ? <> · Sugerido para este horario: <strong>{formatMXN(suggested)}</strong></> : null}
              </p>
            ) : null}
            {!autoAmount ? (
              <Field label="Monto acordado" error={errors.amountCents?.message}>
                {(p) => (
                  <Controller
                    control={form.control}
                    name="amountCents"
                    render={({ field }) => <MoneyInput {...p} value={field.value} onValueChange={field.onChange} />}
                  />
                )}
              </Field>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox aria-label="Confirmó asistencia" checked={!!form.watch("confirmed")} onCheckedChange={(v) => form.setValue("confirmed", v === true)} />
              Confirmó asistencia
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox aria-label="Pagada" checked={!!form.watch("paid")} onCheckedChange={(v) => form.setValue("paid", v === true)} />
              Pagada
            </label>
          </div>
          <Field label="Notas" error={errors.notes?.message}>
            {(p) => <Textarea {...p} {...form.register("notes")} rows={2} placeholder="Ej. Lleva uniforme negro, recoge flores en Jamaica" />}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <SubmitButton pending={form.formState.isSubmitting}>{assignment ? "Guardar cambios" : "Asignar"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
