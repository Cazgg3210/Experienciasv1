import Link from "next/link";
import { CalendarHeart, Mail, Megaphone, Phone } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMXN } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { relativeTime } from "@/features/leads/domain/format";
import type { CustomerListItem } from "../server/customer-service";

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

export function CustomersTable({ customers, now = new Date() }: { customers: CustomerListItem[]; now?: Date }) {
  return (
    <>
      <ul className="grid gap-3 md:grid-cols-2 lg:hidden" aria-label="Clientas">
        {customers.map((c) => (
          <li key={c.id} className="bg-card relative rounded-xl border p-4 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/admin/customers/${c.id}`}
                className="min-w-0 truncate font-medium after:absolute after:inset-0 after:rounded-xl hover:underline"
              >
                {c.name}
              </Link>
              <span className="tabular shrink-0 text-sm font-semibold">{formatMXN(c.totalPaidCents)}</span>
            </div>
            <div className="text-muted-foreground mt-2 space-y-1 text-xs">
              {c.email ? (
                <p className="flex min-w-0 items-center gap-1.5">
                  <Mail className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{c.email}</span>
                </p>
              ) : null}
              {c.phone ? (
                <p className="flex items-center gap-1.5">
                  <Phone className="size-3.5" aria-hidden />
                  {c.phone}
                </p>
              ) : null}
            </div>
            <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1">
                <Megaphone className="size-3.5" aria-hidden />
                {c.leadsCount} {c.leadsCount === 1 ? "lead" : "leads"}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarHeart className="size-3.5" aria-hidden />
                {c.eventsCount} {c.eventsCount === 1 ? "evento" : "eventos"}
              </span>
              {c.lastActivityAt ? <span>Actividad {relativeTime(c.lastActivityAt, now)}</span> : null}
            </div>
          </li>
        ))}
      </ul>

      <div className="bg-card hidden rounded-xl border shadow-xs lg:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Eventos</TableHead>
              <TableHead className="text-right">Total pagado</TableHead>
              <TableHead className="pr-4">Última actividad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="max-w-60 pl-4">
                  <Link href={`/admin/customers/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell className="max-w-56 truncate" title={c.email ?? undefined}>
                  {c.email ?? <Dash />}
                </TableCell>
                <TableCell className="whitespace-nowrap">{c.phone ?? <Dash />}</TableCell>
                <TableCell className="tabular text-right">{c.leadsCount}</TableCell>
                <TableCell className="tabular text-right">{c.eventsCount}</TableCell>
                <TableCell className="tabular text-right font-medium">
                  {c.totalPaidCents ? formatMXN(c.totalPaidCents) : <Dash />}
                </TableCell>
                <TableCell
                  className="text-muted-foreground pr-4 whitespace-nowrap"
                  title={c.lastActivityAt ? formatDateTime(c.lastActivityAt) : undefined}
                >
                  {c.lastActivityAt ? relativeTime(c.lastActivityAt, now) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
