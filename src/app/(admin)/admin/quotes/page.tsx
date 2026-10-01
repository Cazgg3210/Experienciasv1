import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, FilePlus2, FileText, Search, Send, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/data/stat-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { Pagination } from "@/components/data/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { formatDateTime, formatShortDate } from "@/lib/dates";
import { formatMXN } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getSettings } from "@/features/settings/server/settings-service";
import { getQuoteStats, listQuotes, type QuoteListRow } from "@/features/quotes/server/quote-queries";
import { quoteListFiltersSchema } from "@/features/quotes/schemas";
import { isExpiringSoon, validityLabel } from "@/features/quotes/domain/quote-lines";
import { MarginText, QuoteStatusBadge } from "@/features/quotes/components/quote-ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cotizaciones" };

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const TABS: Array<{ label: string; status?: string; expiring?: boolean }> = [
  { label: "Todas" },
  { label: "Borradores", status: "DRAFT" },
  { label: "Enviadas", status: "SENT" },
  { label: "Por vencer (48 h)", expiring: true },
  { label: "Aceptadas", status: "ACCEPTED" },
  { label: "Rechazadas", status: "REJECTED" },
  { label: "Expiradas", status: "EXPIRED" },
];

function tabHref(tab: (typeof TABS)[number], q?: string) {
  const p = new URLSearchParams();
  if (tab.status) p.set("status", tab.status);
  if (tab.expiring) p.set("expiring", "1");
  if (q) p.set("q", q);
  const s = p.toString();
  return `/admin/quotes${s ? `?${s}` : ""}`;
}

function Validity({ row, now }: { row: QuoteListRow; now: Date }) {
  if (row.status !== "SENT") {
    return <span className="text-muted-foreground">{row.validUntil ? formatShortDate(row.validUntil) : "—"}</span>;
  }
  const soon = isExpiringSoon(row.validUntil, now);
  const label = validityLabel(row.validUntil, now);
  return (
    <span
      className={cn("whitespace-nowrap", soon && "text-warning font-medium", label === "Venció" && "text-destructive")}
      title={row.validUntil ? `Vigente hasta ${formatDateTime(row.validUntil)}` : undefined}
    >
      {label}
    </span>
  );
}

export default async function QuotesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePagePermission("quotes:read");
  const sp = await searchParams;
  const filters = quoteListFiltersSchema.parse({
    status: first(sp.status),
    q: first(sp.q),
    expiring: first(sp.expiring),
    page: first(sp.page),
  });
  const now = new Date();
  const [data, stats, pricing] = await Promise.all([listQuotes(filters, now), getQuoteStats(now), getSettings("pricing")]);
  const canWrite = can(user.role, "quotes:write");
  const hasFilters = !!(filters.status || filters.q || filters.expiring);
  const activeTab = TABS.find((t) =>
    filters.expiring ? t.expiring : filters.status ? t.status === filters.status : !t.status && !t.expiring,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ventas"
        title="Cotizaciones"
        description="Propuestas para cada clienta: costos, margen y seguimiento hasta que se convierten en evento."
        actions={
          canWrite ? (
            <Button asChild size="lg">
              <Link href="/admin/quotes/new">
                <FilePlus2 aria-hidden />
                Nueva cotización
              </Link>
            </Button>
          ) : null
        }
      />

      <section aria-label="Resumen de cotizaciones" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Borradores" value={stats.draft} icon={FileText} hint="Pendientes de enviar" />
        <StatCard label="Enviadas" value={stats.sent} icon={Send} hint="Esperando respuesta" />
        <StatCard
          label="Por vencer (48 h)"
          value={stats.expiring}
          icon={CalendarClock}
          tone={stats.expiring > 0 ? "warning" : "default"}
          hint={stats.expiring > 0 ? <Link href="/admin/quotes?expiring=1" className="underline underline-offset-2">Dar seguimiento</Link> : "Todo en orden"}
        />
        <StatCard
          label="Aceptadas (30 días)"
          value={stats.acceptedLast30}
          icon={Sparkles}
          tone="success"
          hint={`${formatMXN(stats.acceptedLast30Cents)} en propuestas`}
        />
      </section>

      <div className="space-y-3">
        <nav aria-label="Filtrar por estado" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {TABS.map((tab) => {
            const active = tab === activeTab;
            return (
              <Link
                key={tab.label}
                href={tabHref(tab, filters.q)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-sm whitespace-nowrap transition-colors",
                  active ? "bg-olive border-olive text-ivory" : "hover:bg-muted bg-card",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <form method="get" action="/admin/quotes" role="search" className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
          {filters.expiring ? <input type="hidden" name="expiring" value="1" /> : null}
          <label htmlFor="quotes-q" className="sr-only">
            Buscar por código, clienta o título
          </label>
          <div className="relative w-full sm:max-w-sm">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
            <Input
              id="quotes-q"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Código, clienta, email o título"
              className="h-9 pl-8"
              maxLength={80}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" size="lg">
              Buscar
            </Button>
            {hasFilters ? (
              <Button asChild variant="ghost" size="lg">
                <Link href="/admin/quotes">Limpiar</Link>
              </Button>
            ) : null}
          </div>
        </form>
      </div>

      {data.rows.length === 0 ? (
        hasFilters || data.total > 0 ? (
          <EmptyState
            icon={Search}
            title={data.total > 0 ? "Esta página ya no tiene resultados" : "No encontramos cotizaciones con esos filtros"}
            description={
              data.total > 0
                ? `Hay ${data.total} ${data.total === 1 ? "cotización" : "cotizaciones"} en total; regresa al inicio del listado.`
                : "Prueba con otro estado o busca por el código (Q-…) o el nombre de la clienta."
            }
            action={
              <Button asChild variant="outline">
                <Link href="/admin/quotes">Ver todas</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={FileText}
            title="Aún no hay cotizaciones"
            description="Crea la primera propuesta desde un lead o desde cero; el motor calcula precio, costos y margen por ti."
            action={
              canWrite ? (
                <Button asChild>
                  <Link href="/admin/quotes/new">Nueva cotización</Link>
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          {/* Escritorio / tablet */}
          <div className="bg-card hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full min-w-[960px] text-sm">
              <caption className="sr-only">Listado de cotizaciones</caption>
              <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
                <tr>
                  <th scope="col" className="px-3 py-2.5 font-medium">Código</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Clienta</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Título / evento</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Fecha evento</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Invitadas</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Total</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Margen</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Estado</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Vigencia</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Creada</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/40 border-t align-middle">
                    <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
                      <Link href={`/admin/quotes/${row.id}`} className="text-olive font-medium hover:underline">
                        {row.code}
                      </Link>
                      {row.version > 1 ? <span className="text-muted-foreground ml-1">v{row.version}</span> : null}
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2.5">{row.customer.name}</td>
                    <td className="max-w-[260px] px-3 py-2.5">
                      <Link href={`/admin/quotes/${row.id}`} className="line-clamp-1 font-medium hover:underline">
                        {row.title}
                      </Link>
                      {row.experience ? <span className="text-muted-foreground line-clamp-1 text-xs">{row.experience.name}</span> : null}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {row.eventDate ? formatShortDate(row.eventDate) : <span className="text-muted-foreground">Sin fecha</span>}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right">{row.guestCount}</td>
                    <td className="tabular px-3 py-2.5 text-right font-medium whitespace-nowrap">{formatMXN(row.totalCents)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <MarginText marginBps={row.marginBps} marginCents={row.estimatedMarginCents} minMarginBps={pricing.minMarginBps} />
                    </td>
                    <td className="px-3 py-2.5">
                      <QuoteStatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <Validity row={row} now={now} />
                    </td>
                    <td className="text-muted-foreground px-3 py-2.5 text-xs whitespace-nowrap">{formatShortDate(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil */}
          <ul className="space-y-3 md:hidden" aria-label="Listado de cotizaciones">
            {data.rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/admin/quotes/${row.id}`}
                  className="bg-card hover:bg-muted/40 block rounded-xl border p-4 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-muted-foreground font-mono text-xs">
                        {row.code}
                        {row.version > 1 ? ` · v${row.version}` : ""}
                      </p>
                      <p className="mt-0.5 line-clamp-2 font-medium">{row.title}</p>
                      <p className="text-muted-foreground truncate text-sm">{row.customer.name}</p>
                    </div>
                    <QuoteStatusBadge status={row.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-end justify-between gap-2 text-sm">
                    <div className="text-muted-foreground">
                      {row.eventDate ? formatShortDate(row.eventDate) : "Sin fecha"} · {row.guestCount} invitadas
                      <div className="text-xs">
                        <Validity row={row} now={now} />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="tabular font-semibold">{formatMXN(row.totalCents)}</p>
                      <p className="text-xs">
                        Margen{" "}
                        <MarginText marginBps={row.marginBps} marginCents={row.estimatedMarginCents} minMarginBps={pricing.minMarginBps} />
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/admin/quotes" searchParams={sp} />
        </>
      )}
    </div>
  );
}
