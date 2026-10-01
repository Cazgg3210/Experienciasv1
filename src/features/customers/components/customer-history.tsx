import Link from "next/link";
import { Star } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/data/status-badge";
import {
  EVENT_STATUS_LABELS,
  EVENT_STATUS_TONES,
  PAYMENT_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_TONES,
} from "@/lib/labels";
import { formatDateTime, formatShortDate, localDateKey } from "@/lib/dates";
import { formatMXN } from "@/lib/money";
import { occasionText } from "@/features/leads/domain/lead-export";
import { LeadStatusBadge } from "@/features/leads/components/lead-badges";
import type { CustomerDetail } from "../server/customer-service";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm">{children}</p>;
}

function Count({ n }: { n: number }) {
  return <span className="bg-background/70 tabular ml-1 rounded-full px-1.5 text-[11px]">{n}</span>;
}

/** Historial de la clienta: leads, cotizaciones, eventos, pagos y reseñas. */
export function CustomerHistory({
  detail,
  links,
}: {
  detail: CustomerDetail;
  links: { quotes: boolean; events: boolean; payments: boolean };
}) {
  const { customer, payments } = detail;
  return (
    <Tabs defaultValue="leads" className="gap-4">
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <TabsList className="w-max">
          <TabsTrigger value="leads">
            Leads <Count n={customer.leads.length} />
          </TabsTrigger>
          <TabsTrigger value="quotes">
            Cotizaciones <Count n={customer.quotes.length} />
          </TabsTrigger>
          <TabsTrigger value="events">
            Eventos <Count n={customer.events.length} />
          </TabsTrigger>
          <TabsTrigger value="payments">
            Pagos <Count n={payments.length} />
          </TabsTrigger>
          <TabsTrigger value="reviews">
            Reseñas <Count n={customer.reviews.length} />
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="leads">
        {customer.leads.length ? (
          <ul className="divide-y rounded-xl border">
            {customer.leads.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/admin/leads/${l.id}`} className="font-mono text-sm font-medium hover:underline">
                    {l.code}
                  </Link>
                  <p className="text-muted-foreground truncate text-xs">
                    {occasionText(l.occasion, l.occasionOther)}
                    {l.experience ? ` · ${l.experience.name}` : ""}
                    {l.eventDate ? ` · ${formatShortDate(l.eventDate)}` : ""}
                    {l.guestCount ? ` · ${l.guestCount} personas` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs">{formatShortDate(localDateKey(l.createdAt))}</span>
                  <LeadStatusBadge status={l.status} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Sin leads registrados.</Empty>
        )}
      </TabsContent>

      <TabsContent value="quotes">
        {customer.quotes.length ? (
          <ul className="divide-y rounded-xl border">
            {customer.quotes.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  {links.quotes ? (
                    <Link href={`/admin/quotes/${q.id}`} className="font-mono text-sm font-medium hover:underline">
                      {q.code}
                    </Link>
                  ) : (
                    <span className="font-mono text-sm font-medium">{q.code}</span>
                  )}
                  <span className="text-muted-foreground text-xs"> · v{q.version}</span>
                  <p className="text-muted-foreground truncate text-xs">
                    {q.title}
                    {q.eventDate ? ` · ${formatShortDate(q.eventDate)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge tone={QUOTE_STATUS_TONES[q.status]}>{QUOTE_STATUS_LABELS[q.status]}</StatusBadge>
                  <span className="tabular font-medium">{formatMXN(q.totalCents)}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Sin cotizaciones.</Empty>
        )}
      </TabsContent>

      <TabsContent value="events">
        {customer.events.length ? (
          <ul className="divide-y rounded-xl border">
            {customer.events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  {links.events ? (
                    <Link href={`/admin/events/${e.id}`} className="font-medium hover:underline">
                      {e.title}
                    </Link>
                  ) : (
                    <span className="font-medium">{e.title}</span>
                  )}
                  <p className="text-muted-foreground truncate text-xs">
                    <span className="font-mono">{e.code}</span> · {formatShortDate(e.eventDate)} · {e.guestCount} personas
                    {e.experience ? ` · ${e.experience.name}` : ""}
                  </p>
                </div>
                <StatusBadge tone={EVENT_STATUS_TONES[e.status]}>{EVENT_STATUS_LABELS[e.status]}</StatusBadge>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Todavía no celebra un evento con nosotras.</Empty>
        )}
      </TabsContent>

      <TabsContent value="payments">
        {payments.length ? (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Fecha</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="pr-4 text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-4 whitespace-nowrap">{formatDateTime(p.paidAt ?? p.createdAt)}</TableCell>
                    <TableCell className="min-w-40">
                      {PAYMENT_KIND_LABELS[p.kind]}
                      <span className="text-muted-foreground block text-xs">
                        {p.booking.code}
                        {p.booking.event ? (
                          links.events ? (
                            <>
                              {" · "}
                              <Link href={`/admin/events/${p.booking.event.id}`} className="hover:underline">
                                {p.booking.event.title}
                              </Link>
                            </>
                          ) : (
                            ` · ${p.booking.event.title}`
                          )
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{PAYMENT_METHOD_LABELS[p.method]}</TableCell>
                    <TableCell>
                      <StatusBadge tone={PAYMENT_STATUS_TONES[p.status]}>{PAYMENT_STATUS_LABELS[p.status]}</StatusBadge>
                    </TableCell>
                    <TableCell className="tabular pr-4 text-right whitespace-nowrap">
                      {p.kind === "REFUND" ? "− " : ""}
                      {formatMXN(p.amountCents)}
                      {p.refundedCents > 0 ? (
                        <span className="text-muted-foreground block text-xs">Reembolsado {formatMXN(p.refundedCents)}</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty>Sin pagos registrados.</Empty>
        )}
      </TabsContent>

      <TabsContent value="reviews">
        {customer.reviews.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {customer.reviews.map((r) => (
              <li key={r.id} className="bg-ivory rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-0.5" aria-label={`${r.rating} de 5 estrellas`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={i < r.rating ? "fill-warning text-warning size-4" : "text-muted-foreground/40 size-4"}
                        aria-hidden
                      />
                    ))}
                  </span>
                  {r.npsScore != null ? <span className="text-muted-foreground text-xs">NPS {r.npsScore}/10</span> : null}
                </div>
                {r.comment ? <p className="mt-2 text-sm leading-relaxed">“{r.comment}”</p> : null}
                <p className="text-muted-foreground mt-2 text-xs">
                  {r.event.title} · {formatShortDate(localDateKey(r.createdAt))}
                  {r.publishable ? " · Publicable" : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Sin reseñas todavía.</Empty>
        )}
      </TabsContent>
    </Tabs>
  );
}
