import Link from "next/link";
import { CalendarDays, Mail, Phone, UserCheck, UsersRound, Wallet } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LEAD_SOURCE_LABELS } from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import { formatDateTime, formatShortDate } from "@/lib/dates";
import { occasionText } from "../domain/lead-export";
import { relativeTime } from "../domain/format";
import type { LeadListItem } from "../server/lead-service";
import { LeadFlagBadges, LeadStatusBadge } from "./lead-badges";

function budgetOf(lead: LeadListItem): string {
  if (lead.budgetRange) return lead.budgetRange.label;
  if (lead.estimatedTotalCents != null) return `≈ ${formatMXN(lead.estimatedTotalCents)}`;
  return "—";
}

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

/** Tabla de leads (escritorio) + tarjetas apiladas (móvil/tablet). */
export function LeadsTable({ leads, now = new Date() }: { leads: LeadListItem[]; now?: Date }) {
  return (
    <>
      {/* Móvil / tablet */}
      <ul className="grid gap-3 md:grid-cols-2 xl:hidden" aria-label="Leads">
        {leads.map((l) => (
          <li key={l.id} className="bg-card relative rounded-xl border p-4 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/admin/leads/${l.id}`}
                  className="font-medium after:absolute after:inset-0 after:rounded-xl hover:underline"
                >
                  {l.name}
                </Link>
                <p className="text-muted-foreground font-mono text-xs">{l.code}</p>
              </div>
              <LeadStatusBadge status={l.status} />
            </div>
            <p className="mt-2 text-sm">
              {occasionText(l.occasion, l.occasionOther)}
              {l.experience ? <span className="text-muted-foreground"> · {l.experience.name}</span> : null}
            </p>
            <dl className="text-muted-foreground mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Fecha</dt>
                <CalendarDays className="size-3.5" aria-hidden />
                <dd>{l.eventDate ? formatShortDate(l.eventDate) : "Sin fecha"}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Invitadas</dt>
                <UsersRound className="size-3.5" aria-hidden />
                <dd>{l.guestCount ?? "—"} personas</dd>
              </div>
              {l.phone ? (
                <div className="flex items-center gap-1.5">
                  <dt className="sr-only">Teléfono</dt>
                  <Phone className="size-3.5" aria-hidden />
                  <dd className="truncate">{l.phone}</dd>
                </div>
              ) : null}
              {l.email ? (
                <div className="flex min-w-0 items-center gap-1.5">
                  <dt className="sr-only">Email</dt>
                  <Mail className="size-3.5 shrink-0" aria-hidden />
                  <dd className="truncate">{l.email}</dd>
                </div>
              ) : null}
              <div className="flex min-w-0 items-center gap-1.5">
                <dt className="sr-only">Presupuesto</dt>
                <Wallet className="size-3.5 shrink-0" aria-hidden />
                <dd className="truncate">{budgetOf(l)}</dd>
              </div>
              <div className="flex min-w-0 items-center gap-1.5">
                <dt className="sr-only">Asignada a</dt>
                <UserCheck className="size-3.5 shrink-0" aria-hidden />
                <dd className="truncate">{l.assignedTo?.name ?? "Sin asignar"}</dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <LeadFlagBadges outOfArea={l.outOfArea} specialRequest={l.specialRequest} />
              <span className="text-muted-foreground">
                {LEAD_SOURCE_LABELS[l.source]} · {relativeTime(l.createdAt, now)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {/* Escritorio */}
      <div className="bg-card hidden rounded-xl border shadow-xs xl:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Nombre</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Invitadas</TableHead>
              <TableHead>Presupuesto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Asignada a</TableHead>
              <TableHead className="pr-4">Creado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((l) => (
              <TableRow key={l.id} className="align-top">
                <TableCell className="max-w-56 pl-4">
                  <Link href={`/admin/leads/${l.id}`} className="font-medium hover:underline">
                    {l.name}
                  </Link>
                  <div className="text-muted-foreground font-mono text-xs">{l.code}</div>
                  <div className="mt-1">
                    <LeadFlagBadges outOfArea={l.outOfArea} specialRequest={l.specialRequest} />
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">{l.phone ?? <Dash />}</TableCell>
                <TableCell className="max-w-48 truncate" title={l.email ?? undefined}>
                  {l.email ?? <Dash />}
                </TableCell>
                <TableCell className="max-w-52">
                  <div className="truncate">{occasionText(l.occasion, l.occasionOther)}</div>
                  <div className="text-muted-foreground truncate text-xs">{l.experience?.name ?? "Sin experiencia"}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap">{l.eventDate ? formatShortDate(l.eventDate) : <Dash />}</TableCell>
                <TableCell className="tabular text-right">{l.guestCount ?? <Dash />}</TableCell>
                <TableCell className="whitespace-nowrap">{budgetOf(l)}</TableCell>
                <TableCell>
                  <LeadStatusBadge status={l.status} />
                </TableCell>
                <TableCell className="whitespace-nowrap">{LEAD_SOURCE_LABELS[l.source]}</TableCell>
                <TableCell className="whitespace-nowrap">{l.assignedTo?.name ?? <span className="text-muted-foreground">Sin asignar</span>}</TableCell>
                <TableCell className="text-muted-foreground pr-4 whitespace-nowrap" title={formatDateTime(l.createdAt)}>
                  {relativeTime(l.createdAt, now)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
