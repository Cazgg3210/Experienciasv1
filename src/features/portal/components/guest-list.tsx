"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Link2, MessageCircle, Trash2, UserPlus, Users } from "lucide-react";
import type { DietaryRestriction, RsvpStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/data/status-badge";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { handleActionResult } from "@/components/forms/action-result";
import {
  DIETARY_LABELS,
  GUEST_POSSIBLE_DUPLICATE_LABEL,
  GUEST_POSSIBLE_DUPLICATE_TONE,
  RSVP_STATUS_LABELS,
  RSVP_STATUS_TONES,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import { removeHostGuestAction } from "@/features/guests/server/actions";
import { copyText } from "./clipboard";
import { usePortalUi } from "./portal-ui";

export type GuestRow = {
  id: string;
  name: string;
  rsvpStatus: RsvpStatus;
  plusOne: boolean;
  plusOneName: string | null;
  dietaryRestrictions: DietaryRestriction[];
  dietaryNotes: string | null;
  comment: string | null;
  sourceLabel: string | null;
  inviteUrl: string;
  whatsappUrl: string;
  canRemove: boolean;
  /** Se registró con la invitación general y coincide (nombre o email) con otra invitada */
  possibleDuplicate: boolean;
  /** Con quién coincide y qué hacer: confirmarlo con su invitada y nunca quitar el registro que ella agregó. */
  duplicateHint: string | null;
};

/** Botón que abre el diálogo "Agregar invitada" (estado compartido con la barra inferior). */
export function AddGuestButton({ className }: { className?: string }) {
  const { setAddGuestOpen } = usePortalUi();
  return (
    <Button type="button" className={cn("h-11 rounded-full px-5", className)} onClick={() => setAddGuestOpen(true)}>
      <UserPlus aria-hidden /> Agregar invitada
    </Button>
  );
}

type Filter = "ALL" | RsvpStatus;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "ALL", label: "Todas" },
  { value: "ATTENDING", label: "Confirmadas" },
  { value: "PENDING", label: "Pendientes" },
  { value: "MAYBE", label: "Tal vez" },
  { value: "NOT_ATTENDING", label: "No asisten" },
];

export function GuestList({
  token,
  guests,
  editable,
  canShare = true,
}: {
  token: string;
  guests: GuestRow[];
  editable: boolean;
  /** Mostrar "Copiar link" / WhatsApp (sólo con el micrositio activo y el evento abierto) */
  canShare?: boolean;
}) {
  const { setAddGuestOpen } = usePortalUi();
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const counts = React.useMemo(() => {
    const c: Record<Filter, number> = { ALL: guests.length, ATTENDING: 0, PENDING: 0, MAYBE: 0, NOT_ATTENDING: 0 };
    for (const g of guests) c[g.rsvpStatus] += 1;
    return c;
  }, [guests]);
  const visible = filter === "ALL" ? guests : guests.filter((g) => g.rsvpStatus === filter);

  if (guests.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Aún no hay invitadas en tu lista"
        description={
          editable
            ? "Agrega a tus amigas una por una para mandarles su link personal, o comparte la invitación general en tu grupo: quien confirme aparecerá aquí."
            : "Este evento no tuvo invitadas registradas."
        }
        action={
          editable ? (
            <Button size="xl" onClick={() => setAddGuestOpen(true)}>
              <UserPlus aria-hidden /> Agregar invitada
            </Button>
          ) : null
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Filtrar invitadas" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
              filter === f.value
                ? "border-olive bg-olive text-ivory"
                : "border-border bg-background hover:bg-sage-soft",
            )}
          >
            {f.label}
            <span className={cn("tabular text-xs", filter === f.value ? "text-ivory" : "text-muted-foreground")}>
              {counts[f.value]}
            </span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground rounded-2xl border border-dashed px-4 py-6 text-center text-sm">
          No hay invitadas en este filtro.
        </p>
      ) : (
        <ul className="divide-border/70 divide-y" aria-label="Lista de invitadas">
          {visible.map((g) => (
            <GuestItem key={g.id} guest={g} token={token} editable={editable} canShare={canShare} />
          ))}
        </ul>
      )}
    </div>
  );
}

function GuestItem({
  guest,
  token,
  editable,
  canShare,
}: {
  guest: GuestRow;
  token: string;
  editable: boolean;
  canShare: boolean;
}) {
  const router = useRouter();
  const details = [
    guest.plusOne ? `+1${guest.plusOneName ? ` ${guest.plusOneName}` : ""}` : null,
    guest.dietaryRestrictions.length ? guest.dietaryRestrictions.map((d) => DIETARY_LABELS[d]).join(", ") : null,
  ].filter(Boolean);

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium break-words">{guest.name}</p>
          <StatusBadge tone={RSVP_STATUS_TONES[guest.rsvpStatus]}>{RSVP_STATUS_LABELS[guest.rsvpStatus]}</StatusBadge>
          {guest.sourceLabel ? <span className="text-muted-foreground text-xs">{guest.sourceLabel}</span> : null}
          {guest.possibleDuplicate ? (
            <StatusBadge tone={GUEST_POSSIBLE_DUPLICATE_TONE}>{GUEST_POSSIBLE_DUPLICATE_LABEL}</StatusBadge>
          ) : null}
        </div>
        {guest.possibleDuplicate && guest.duplicateHint ? <p className="text-sm">{guest.duplicateHint}</p> : null}
        {details.length ? <p className="text-muted-foreground text-sm">{details.join(" · ")}</p> : null}
        {guest.dietaryNotes ? <p className="text-muted-foreground text-sm">Nota: {guest.dietaryNotes}</p> : null}
        {guest.comment ? <p className="text-sm italic">“{guest.comment}”</p> : null}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {canShare ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full px-3"
              onClick={() => copyText(guest.inviteUrl, `Link de ${guest.name.split(" ")[0]} copiado`)}
              aria-label={`Copiar link personal de ${guest.name}`}
            >
              <Link2 aria-hidden /> Copiar link
            </Button>
            <Button asChild variant="outline" className="h-10 rounded-full px-3">
              <a
                href={guest.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Enviar invitación a ${guest.name} por WhatsApp (se abre en otra pestaña)`}
              >
                <MessageCircle aria-hidden /> WhatsApp
              </a>
            </Button>
          </>
        ) : null}
        {editable && guest.canRemove ? (
          <ConfirmDialog
            destructive
            title={`¿Quitar a ${guest.name}?`}
            description="Su link personal dejará de funcionar. Puedes volver a agregarla cuando quieras."
            confirmLabel="Quitar de la lista"
            onConfirm={async () => {
              const res = await removeHostGuestAction({ token, guestId: guest.id });
              if (handleActionResult(res, { success: `${guest.name} ya no está en tu lista` })) router.refresh();
            }}
            trigger={
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 h-10 rounded-full px-3"
                aria-label={`Quitar a ${guest.name} de la lista`}
              >
                <Trash2 aria-hidden /> <span className="sm:sr-only">Quitar</span>
              </Button>
            }
          />
        ) : null}
      </div>
    </li>
  );
}
