import Link from "next/link";
import { CalendarDays, MapPin, UsersRound } from "lucide-react";
import { StatusBadge } from "@/components/data/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EVENT_STATUS_LABELS, EVENT_STATUS_TONES } from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import type { EventListRow } from "../server/event-queries";
import { formatEventDay, formatTimeRange } from "../domain/format";

function Balance({ row }: { row: EventListRow }) {
  if (row.balanceDueCents == null) return <span className="text-muted-foreground text-xs">Sin reserva</span>;
  if (row.bookingCancelled) {
    return (
      <span className="text-muted-foreground text-xs">
        Cancelada{row.paidCents > 0 ? ` · cobrado ${formatMXN(row.paidCents)}` : ""}
      </span>
    );
  }
  if (row.balanceDueCents === 0) return <span className="text-success text-sm font-medium">Liquidado</span>;
  return <span className="tabular text-warning text-sm font-semibold">{formatMXN(row.balanceDueCents)}</span>;
}

function Guests({ row }: { row: EventListRow }) {
  return (
    <span
      className="tabular"
      aria-label={`${row.confirmedGuests} confirmadas de ${row.guestCount} planeadas`}
    >
      <span className="font-medium">{row.confirmedGuests}</span>
      <span className="text-muted-foreground">/{row.guestCount}</span>
    </span>
  );
}

/** Tabla de eventos (desktop) + tarjetas (móvil). */
export function EventsTable({ rows }: { rows: EventListRow[] }) {
  return (
    <>
      <div className="bg-card hidden overflow-hidden rounded-xl border shadow-xs md:block">
        <Table>
          <caption className="sr-only">Listado de eventos</caption>
          <TableHeader>
            <TableRow className="bg-sand-soft/60 hover:bg-sand-soft/60">
              <TableHead scope="col">Fecha y hora</TableHead>
              <TableHead scope="col">Título</TableHead>
              <TableHead scope="col">Clienta</TableHead>
              <TableHead scope="col" className="hidden xl:table-cell">
                Experiencia
              </TableHead>
              <TableHead scope="col" className="hidden lg:table-cell">
                Zona
              </TableHead>
              <TableHead scope="col" className="text-right">
                <abbr title="Confirmadas / planeadas" className="no-underline">
                  Invitadas
                </abbr>
              </TableHead>
              <TableHead scope="col">Estado</TableHead>
              <TableHead scope="col" className="text-right">
                Saldo pendiente
              </TableHead>
              <TableHead scope="col" className="hidden lg:table-cell">
                Código
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="align-top">
                <TableCell className="whitespace-nowrap">
                  <div className="font-medium capitalize">{formatEventDay(row.eventDate)}</div>
                  <div className="text-muted-foreground tabular text-xs">
                    {formatTimeRange(row.startsAt, row.endsAt)}
                  </div>
                </TableCell>
                <TableCell className="max-w-64 whitespace-normal">
                  <Link
                    href={`/admin/events/${row.id}`}
                    className="text-foreground hover:text-olive font-medium underline-offset-4 hover:underline"
                  >
                    {row.title}
                  </Link>
                  <div className="text-muted-foreground text-xs lg:hidden">{row.code}</div>
                </TableCell>
                <TableCell className="max-w-48 truncate">{row.customerName}</TableCell>
                <TableCell className="hidden max-w-48 truncate xl:table-cell">
                  {row.experienceName ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {row.zoneName ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right">
                  <Guests row={row} />
                </TableCell>
                <TableCell>
                  <StatusBadge tone={EVENT_STATUS_TONES[row.status]}>
                    {EVENT_STATUS_LABELS[row.status]}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-right">
                  <Balance row={row} />
                </TableCell>
                <TableCell className="text-muted-foreground hidden font-mono text-xs lg:table-cell">
                  {row.code}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label="Listado de eventos">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/admin/events/${row.id}`}
              className="bg-card focus-visible:ring-ring/50 hover:border-olive/40 block rounded-xl border p-4 shadow-xs transition-colors outline-none focus-visible:ring-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-heading line-clamp-2 text-lg leading-snug font-semibold">{row.title}</p>
                  <p className="text-muted-foreground truncate text-sm">{row.customerName}</p>
                </div>
                <StatusBadge tone={EVENT_STATUS_TONES[row.status]}>
                  {EVENT_STATUS_LABELS[row.status]}
                </StatusBadge>
              </div>
              <dl className="text-muted-foreground mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                <div className="col-span-2 flex items-center gap-1.5">
                  <CalendarDays className="size-4 shrink-0" aria-hidden />
                  <dt className="sr-only">Fecha</dt>
                  <dd className="capitalize">
                    {formatEventDay(row.eventDate)} · {formatTimeRange(row.startsAt, row.endsAt)}
                  </dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <UsersRound className="size-4 shrink-0" aria-hidden />
                  <dt className="sr-only">Invitadas confirmadas / planeadas</dt>
                  <dd>
                    <Guests row={row} />
                  </dd>
                </div>
                <div className="flex min-w-0 items-center gap-1.5">
                  <MapPin className="size-4 shrink-0" aria-hidden />
                  <dt className="sr-only">Zona</dt>
                  <dd className="truncate">{row.zoneName ?? "Sin zona"}</dd>
                </div>
                <div className="col-span-2 border-t pt-2">
                  <dt className="sr-only">Código y saldo pendiente</dt>
                  <dd className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs">{row.code}</span>
                    <span>
                      <span className="sr-only">Saldo pendiente: </span>
                      <Balance row={row} />
                    </span>
                  </dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
