"use client";

import * as React from "react";
import { MessageCircle, Pencil, Search, Trash2, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import type { DietaryRestriction, GuestSource, RsvpStatus } from "@prisma/client";
import { CopyButton } from "@/components/data/copy-button";
import { StatusBadge } from "@/components/data/status-badge";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { handleActionResult } from "@/components/forms/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DIETARY_LABELS, RSVP_STATUS_LABELS, RSVP_STATUS_TONES } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { deleteGuestAction } from "../server/actions";
import { GUEST_SOURCE_LABELS } from "../domain/guest-summary";
import { GuestFormDialog, type GuestFormValues } from "./guest-form-dialog";
import { inputSizeClass } from "./form-styles";

export type GuestRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  rsvpStatus: RsvpStatus;
  plusOne: boolean;
  plusOneName: string | null;
  dietaryRestrictions: DietaryRestriction[];
  dietaryNotes: string | null;
  comment: string | null;
  source: GuestSource;
  /** Auto-registro con el link general que coincide (nombre o email) con otra invitada */
  possibleDuplicate: boolean;
  respondedAtLabel: string | null;
  rsvpUrl: string;
  whatsappUrl: string | null;
};

type FilterKey = "ALL" | RsvpStatus;
const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "ALL", label: "Todas" },
  { key: "PENDING", label: "Pendientes" },
  { key: "ATTENDING", label: "Asisten" },
  { key: "MAYBE", label: "Tal vez" },
  { key: "NOT_ATTENDING", label: "No asisten" },
];

function DuplicateBadge({ className }: { className?: string }) {
  return (
    <StatusBadge tone="neutral" className={className}>
      Posible duplicado
    </StatusBadge>
  );
}

function toFormValues(g: GuestRow): GuestFormValues & { guestId: string } {
  return {
    guestId: g.id,
    name: g.name,
    email: g.email ?? "",
    phone: g.phone ?? "",
    rsvpStatus: g.rsvpStatus,
    plusOne: g.plusOne,
    plusOneName: g.plusOneName ?? "",
    dietaryRestrictions: g.dietaryRestrictions,
    dietaryNotes: g.dietaryNotes ?? "",
    comment: g.comment ?? "",
  };
}

export function GuestsTable({
  eventId,
  guests,
  canWrite,
}: {
  eventId: string;
  guests: GuestRow[];
  canWrite: boolean;
}) {
  const [filter, setFilter] = React.useState<FilterKey>("ALL");
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<GuestRow | "new" | null>(null);

  const counts = React.useMemo(() => {
    const c: Record<FilterKey, number> = {
      ALL: guests.length,
      PENDING: 0,
      ATTENDING: 0,
      MAYBE: 0,
      NOT_ATTENDING: 0,
    };
    for (const g of guests) c[g.rsvpStatus] += 1;
    return c;
  }, [guests]);

  const duplicates = guests.filter((g) => g.possibleDuplicate).length;

  const visible = guests.filter((g) => {
    if (filter !== "ALL" && g.rsvpStatus !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [g.name, g.email, g.phone, g.plusOneName].some((v) => v?.toLowerCase().includes(q));
  });

  async function remove(g: GuestRow) {
    const res = await deleteGuestAction({ eventId, guestId: g.id });
    if (handleActionResult(res)) toast.success(`${g.name} se quitó de la lista`);
  }

  const actions = (g: GuestRow) => (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <CopyButton
        value={g.rsvpUrl}
        label="Link RSVP"
        copiedLabel="Copiado"
        size="sm"
        variant="ghost"
        toastMessage={`Link personal de ${g.name} copiado`}
      />
      {g.whatsappUrl ? (
        <Button asChild variant="ghost" size="icon-sm">
          <a
            href={g.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Enviar recordatorio por WhatsApp a ${g.name} (se abre en otra pestaña)`}
            title="Recordatorio por WhatsApp"
          >
            <MessageCircle aria-hidden />
          </a>
        </Button>
      ) : null}
      {canWrite ? (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setEditing(g)}
            aria-label={`Editar a ${g.name}`}
          >
            <Pencil aria-hidden />
          </Button>
          <ConfirmDialog
            title={`¿Quitar a ${g.name}?`}
            description="Se elimina de la lista de invitadas y su link personal deja de funcionar."
            confirmLabel="Quitar invitada"
            destructive
            onConfirm={() => remove(g)}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Eliminar a ${g.name}`}>
                <Trash2 aria-hidden />
              </Button>
            }
          />
        </>
      ) : null}
    </div>
  );

  return (
    <section aria-labelledby="guests-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="guests-title" className="font-heading text-2xl font-semibold">
            Lista de invitadas
          </h2>
          <p className="text-muted-foreground text-sm">
            Cada invitada tiene su link personal para confirmar.
          </p>
        </div>
        {canWrite ? (
          <Button onClick={() => setEditing("new")} size="lg">
            <UserPlus aria-hidden />
            Agregar invitada
          </Button>
        ) : null}
      </div>

      {guests.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="Aún no hay invitadas"
          description="La anfitriona puede agregarlas desde su portal, o comparte el link de invitación para que se registren solas."
          action={
            canWrite ? (
              <Button onClick={() => setEditing("new")}>
                <UserPlus aria-hidden />
                Agregar la primera
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {duplicates > 0 ? (
            <p className="bg-sand-soft/60 rounded-lg border px-4 py-3 text-sm">
              {duplicates === 1
                ? "1 invitada que se registró con el link general coincide con otra de la lista (mismo nombre o email) y está marcada"
                : `${duplicates} invitadas que se registraron con el link general coinciden con otras de la lista (mismo nombre o email) y están marcadas`}{" "}
              como «Posible duplicado». Revisa si es la misma persona y quita el registro que sobre.
            </p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div role="group" aria-label="Filtrar por asistencia" className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "focus-visible:ring-ring/50 inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-3",
                    filter === f.key
                      ? "border-olive/50 bg-sage-soft text-olive font-medium"
                      : "hover:bg-muted",
                  )}
                >
                  {f.label}
                  <span className="tabular text-xs opacity-70">{counts[f.key]}</span>
                </button>
              ))}
            </div>
            <div className="relative sm:w-64">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar invitada"
                aria-label="Buscar invitada"
                className={`${inputSizeClass} pl-8`}
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <p
              className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm"
              role="status"
            >
              Ninguna invitada coincide con el filtro.
            </p>
          ) : (
            <>
              <div className="bg-card hidden overflow-hidden rounded-xl border shadow-xs lg:block">
                <Table>
                  <caption className="sr-only">Invitadas del evento</caption>
                  <TableHeader>
                    <TableRow className="bg-sand-soft/60 hover:bg-sand-soft/60">
                      <TableHead scope="col">Nombre</TableHead>
                      <TableHead scope="col">Contacto</TableHead>
                      <TableHead scope="col">Estado</TableHead>
                      <TableHead scope="col">Acompañante</TableHead>
                      <TableHead scope="col">Restricciones</TableHead>
                      <TableHead scope="col">Comentario</TableHead>
                      <TableHead scope="col">Respondió</TableHead>
                      <TableHead scope="col">Origen</TableHead>
                      <TableHead scope="col" className="text-right">
                        <span className="sr-only">Acciones</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((g) => (
                      <TableRow key={g.id} className="align-top">
                        <TableCell className="font-medium whitespace-normal">
                          {g.name}
                          {g.possibleDuplicate ? <DuplicateBadge className="mt-1 flex w-fit" /> : null}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-normal">
                          {g.phone ? <div>{g.phone}</div> : null}
                          {g.email ? <div className="max-w-44 truncate">{g.email}</div> : null}
                          {!g.phone && !g.email ? "—" : null}
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={RSVP_STATUS_TONES[g.rsvpStatus]}>
                            {RSVP_STATUS_LABELS[g.rsvpStatus]}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-sm whitespace-normal">
                          {g.plusOne ? (g.plusOneName ? `Sí · ${g.plusOneName}` : "Sí") : "No"}
                        </TableCell>
                        <TableCell className="max-w-48 text-xs whitespace-normal">
                          {g.dietaryRestrictions.length
                            ? g.dietaryRestrictions.map((d) => DIETARY_LABELS[d]).join(", ")
                            : "—"}
                          {g.dietaryNotes ? (
                            <div className="text-muted-foreground">{g.dietaryNotes}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-56 text-xs whitespace-normal">
                          {g.comment ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {g.respondedAtLabel ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {GUEST_SOURCE_LABELS[g.source]}
                        </TableCell>
                        <TableCell>{actions(g)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <ul className="space-y-3 lg:hidden" aria-label="Invitadas del evento">
                {visible.map((g) => (
                  <li key={g.id} className="bg-card rounded-xl border p-4 shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{g.name}</p>
                        {g.possibleDuplicate ? <DuplicateBadge className="my-1 flex w-fit" /> : null}
                        <p className="text-muted-foreground truncate text-xs">
                          {[g.phone, g.email].filter(Boolean).join(" · ") || "Sin contacto"}
                        </p>
                      </div>
                      <StatusBadge tone={RSVP_STATUS_TONES[g.rsvpStatus]}>
                        {RSVP_STATUS_LABELS[g.rsvpStatus]}
                      </StatusBadge>
                    </div>
                    <dl className="mt-2 space-y-1 text-sm">
                      {g.plusOne ? (
                        <div className="flex gap-1">
                          <dt className="text-muted-foreground">Acompañante:</dt>
                          <dd>{g.plusOneName ?? "Sí"}</dd>
                        </div>
                      ) : null}
                      {g.dietaryRestrictions.length || g.dietaryNotes ? (
                        <div className="flex gap-1">
                          <dt className="text-muted-foreground">Restricciones:</dt>
                          <dd>
                            {[g.dietaryRestrictions.map((d) => DIETARY_LABELS[d]).join(", "), g.dietaryNotes]
                              .filter(Boolean)
                              .join(" · ")}
                          </dd>
                        </div>
                      ) : null}
                      {g.comment ? (
                        <div className="flex gap-1">
                          <dt className="text-muted-foreground">Comentario:</dt>
                          <dd>{g.comment}</dd>
                        </div>
                      ) : null}
                      <div className="text-muted-foreground flex gap-1 text-xs">
                        <dt className="sr-only">Origen y respuesta</dt>
                        <dd>
                          {GUEST_SOURCE_LABELS[g.source]}
                          {g.respondedAtLabel ? ` · respondió ${g.respondedAtLabel}` : ""}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-2 border-t pt-2">{actions(g)}</div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {canWrite ? (
        <GuestFormDialog
          key={editing === "new" ? "new" : (editing?.id ?? "closed")}
          eventId={eventId}
          guest={editing && editing !== "new" ? toFormValues(editing) : null}
          open={editing !== null}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      ) : null}
    </section>
  );
}
