import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeDollarSign,
  CircleCheck,
  Lock,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Section } from "@/components/layout/page-header";
import { StatCard } from "@/components/data/stat-card";
import { StatusBadge } from "@/components/data/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { formatDateTime, formatShortDate } from "@/lib/dates";
import { formatMXN } from "@/lib/money";
import {
  COST_CATEGORY_LABELS,
  PAYMENT_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
  PURCHASE_STATUS_LABELS,
  PURCHASE_STATUS_TONES,
  STAFF_FUNCTION_LABELS,
} from "@/lib/labels";
import { closeWarnings, getEventFinancialsPage } from "@/features/financials/server/event-financials-service";
import { CostVariance, formatMarginLine, MarginPct, Money } from "@/features/financials/components/figures";
import { EventCostDialog } from "@/features/financials/components/event-cost-dialog";
import { DeleteCostButton } from "@/features/financials/components/delete-cost-button";
import { CloseEventButton } from "@/features/financials/components/close-event-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Rentabilidad del evento" };

const INFO_WARNINGS = new Set(["NO_ACTUALS", "PURCHASES_PENDING", "NO_ESTIMATE"]);
/** Alertas graves (rojo); el resto de alertas son avisos (ámbar). */
const DANGER_WARNINGS = new Set(["NEGATIVE_ESTIMATED_MARGIN", "NEGATIVE_ACTUAL_MARGIN", "COST_OVERRUN"]);

export default async function EventFinancialsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("financials:read");
  const { id } = await params;
  const data = await getEventFinancialsPage(id);
  if (!data) notFound();

  const { event, financials: fin, collection, closing, pendingPurchases, canClose } = data;
  const canWriteCosts = can(user.role, "costs:write") && !event.closedAt;
  const canCloseNow = canClose && can(user.role, "events:close");
  const payments = event.booking?.payments ?? [];
  const warnings = fin.warnings;
  const alerts = warnings.filter((w) => !INFO_WARNINGS.has(w.code));
  const infos = warnings.filter((w) => INFO_WARNINGS.has(w.code));
  const estimatedTotal = fin.byCategory.reduce((s, r) => s + r.estimated, 0);
  const cancelled = event.status === "CANCELLED";
  // Con categorías estimadas sin costo real o compras sin recibir, el margen real está inflado:
  // no se pinta como "éxito" y se marca como parcial.
  const actualsIncomplete = warnings.some(
    (w) => w.code === "MISSING_ACTUALS" || w.code === "PURCHASES_PENDING",
  );

  return (
    <div className="space-y-10">
      {/* El layout del evento ya muestra el h1, estado y pestañas: aquí sólo el título de la sección. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="eyebrow">Finanzas</p>
          <h2 className="font-heading text-2xl font-semibold sm:text-3xl">Rentabilidad del evento</h2>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Venta, costos estimados vs reales y margen de {event.title} ({formatShortDate(event.eventDate)}).
            Los márgenes se calculan sobre el ingreso neto de IVA.
          </p>
        </div>
        {/* La insignia «Cerrado» vive en el encabezado del evento (visible en todas las pestañas). */}
      </div>

      {event.closedAt ? (
        <section
          aria-labelledby="closing-title"
          className="border-sage/50 bg-sage-soft/60 space-y-4 rounded-2xl border p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                id="closing-title"
                className="font-heading text-olive flex items-center gap-2 text-2xl font-semibold"
              >
                <Lock className="size-5" aria-hidden /> Evento cerrado el {formatDateTime(event.closedAt)}
              </h2>
              <p className="text-muted-foreground text-sm">
                {event.closedBy?.name ? `Cerrado por ${event.closedBy.name}. ` : ""}
                Números congelados al momento del cierre.
              </p>
            </div>
          </div>
          {closing ? (
            <>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <SnapshotFigure label="Venta" value={formatMXN(closing.saleCents)} />
                <SnapshotFigure
                  label="Cobrado al cierre"
                  value={closing.paidCents != null ? formatMXN(closing.paidCents) : "—"}
                />
                <SnapshotFigure label="Costo estimado" value={formatMXN(closing.estimatedCostCents)} />
                <SnapshotFigure label="Costo real" value={formatMXN(closing.actualCostCents)} />
                <SnapshotFigure
                  label="Margen estimado"
                  value={formatMarginLine(closing.estimatedMarginCents, closing.estimatedMarginBps)}
                  danger={closing.estimatedMarginCents < 0}
                />
                <SnapshotFigure
                  label="Margen real"
                  value={formatMarginLine(closing.actualMarginCents, closing.actualMarginBps)}
                  danger={closing.actualMarginCents < 0}
                />
              </dl>
              {closing.notes ? <p className="text-sm italic">“{closing.notes}”</p> : null}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              El snapshot de cierre no tiene un formato legible.
            </p>
          )}
        </section>
      ) : null}

      <section aria-labelledby="kpis-title" className="space-y-4">
        {event.closedAt ? (
          <div>
            <h2 id="kpis-title" className="font-heading text-xl font-semibold">
              Cálculo actual
            </h2>
            <p className="text-muted-foreground text-sm">
              Con los datos registrados hoy. Puede diferir del cierre si hubo ajustes posteriores o conceptos
              incluidos sólo en el cierre (p. ej. mermas de inventario).
            </p>
          </div>
        ) : (
          <h2 id="kpis-title" className="sr-only">
            Indicadores
          </h2>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Venta"
            icon={BadgeDollarSign}
            value={formatMXN(fin.sale)}
            hint={
              <>
                Neto sin IVA: {formatMXN(fin.netRevenue)}
                {fin.refunds > 0 ? ` · reembolsos ${formatMXN(fin.refunds)}` : ""}
              </>
            }
          />
          <StatCard
            label="Costo estimado"
            icon={Receipt}
            value={
              cancelled ? (
                <span className="text-muted-foreground text-xl">No aplica</span>
              ) : (
                formatMXN(fin.estimatedCost)
              )
            }
            hint={cancelled ? "El evento se canceló" : "Según la cotización"}
          />
          <StatCard
            label="Costo real"
            icon={Wallet}
            value={
              fin.anyActuals ? (
                formatMXN(fin.actualCost)
              ) : (
                <span className="text-muted-foreground text-xl">Sin registrar</span>
              )
            }
            hint={
              fin.anyActuals ? (
                <>
                  Variación: <CostVariance cents={fin.costVariance} />
                </>
              ) : (
                "Aún no hay compras recibidas ni costos"
              )
            }
          />
          <StatCard
            label="Margen estimado"
            icon={TrendingUp}
            value={
              cancelled ? (
                <span className="text-muted-foreground text-xl">—</span>
              ) : (
                <Money cents={fin.estimatedMargin} />
              )
            }
            tone={!cancelled && fin.estimatedMargin < 0 ? "danger" : "default"}
            hint={
              cancelled ? (
                "No aplica en eventos cancelados"
              ) : (
                <>
                  <MarginPct bps={fin.estimatedMarginBps} /> sobre ingreso neto
                </>
              )
            }
          />
          <StatCard
            label="Margen real"
            icon={fin.actualMargin < 0 ? TrendingDown : TrendingUp}
            value={
              fin.anyActuals ? (
                <Money cents={fin.actualMargin} />
              ) : (
                <span className="text-muted-foreground text-xl">—</span>
              )
            }
            tone={
              fin.anyActuals && fin.actualMargin < 0
                ? "danger"
                : fin.anyActuals && !actualsIncomplete
                  ? "success"
                  : "default"
            }
            hint={
              fin.anyActuals ? (
                <>
                  <MarginPct bps={fin.actualMarginBps} /> sobre ingreso neto
                  {actualsIncomplete ? " · parcial, faltan costos" : ""}
                </>
              ) : (
                "Se calcula con costos reales"
              )
            }
          />
        </div>

        {alerts.length > 0 ? (
          <ul className="space-y-2" aria-label="Alertas de rentabilidad">
            {alerts.map((w) => (
              <li
                key={w.code}
                className={
                  DANGER_WARNINGS.has(w.code)
                    ? "border-destructive/25 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
                    : "border-warning/25 bg-warning/5 text-warning flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
                }
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {w.message}
              </li>
            ))}
          </ul>
        ) : null}
        {infos.length > 0 ? (
          <ul className="text-muted-foreground space-y-1 text-sm" aria-label="Notas">
            {infos.map((w) => (
              <li key={w.code}>· {w.message}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <Section
        title="Estimado vs real por categoría"
        description="La variación positiva indica que gastamos más de lo estimado."
      >
        <div className="bg-card rounded-xl border">
          <Table className="text-xs sm:text-sm">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Categoría</TableHead>
                <TableHead scope="col" className="text-right">
                  Estimado
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Real
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Variación
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fin.byCategory
                .filter((r) => r.estimated > 0 || r.hasActuals)
                .map((r) => (
                  <TableRow key={r.category}>
                    <TableCell className="font-medium whitespace-normal">
                      {COST_CATEGORY_LABELS[r.category]}
                    </TableCell>
                    <TableCell className="tabular text-right">{formatMXN(r.estimated)}</TableCell>
                    <TableCell className="text-right">
                      {r.hasActuals ? (
                        <span className="tabular">{formatMXN(r.actual)}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">sin registrar</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <CostVariance cents={r.variance} />
                    </TableCell>
                  </TableRow>
                ))}
              {fin.byCategory.every((r) => r.estimated === 0 && !r.hasActuals) ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-6 text-center">
                    Sin costos estimados ni reales todavía.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell className="tabular text-right font-semibold">
                  {formatMXN(estimatedTotal)}
                </TableCell>
                <TableCell className="tabular text-right font-semibold">
                  {fin.anyActuals ? formatMXN(fin.actualCost) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <CostVariance cents={fin.anyActuals ? fin.costVariance : null} />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-2">
        <Section
          title="Compras"
          description="Sólo las compras recibidas cuentan como costo real."
          actions={
            <Link
              href={`/admin/purchases?eventId=${event.id}`}
              className="text-olive inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              Ver en compras <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          }
        >
          {event.purchases.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Sin compras"
              description="Aún no hay compras ligadas a este evento."
            />
          ) : (
            <ul className="bg-card divide-y rounded-xl border">
              {event.purchases.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.concept}</p>
                    <p className="text-muted-foreground text-xs">
                      {COST_CATEGORY_LABELS[p.category]}
                      {p.vendor ? ` · ${p.vendor.name}` : ""}
                      {p.receivedAt ? ` · recibida ${formatShortDate(p.receivedAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    <div className="text-right text-sm">
                      <p className="tabular font-medium">
                        {p.actualAmountCents != null
                          ? formatMXN(p.actualAmountCents)
                          : formatMXN(p.expectedAmountCents)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {p.actualAmountCents != null
                          ? `esperado ${formatMXN(p.expectedAmountCents)}`
                          : "monto esperado"}
                      </p>
                    </div>
                    <StatusBadge tone={PURCHASE_STATUS_TONES[p.status]}>
                      {PURCHASE_STATUS_LABELS[p.status]}
                    </StatusBadge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Staff" description="Montos acordados por asignación.">
          {event.staffAssignments.length === 0 ? (
            <EmptyState
              icon={CircleCheck}
              title="Sin staff asignado"
              description="Asigna equipo desde la pestaña de operación del evento."
            />
          ) : (
            <ul className="bg-card divide-y rounded-xl border">
              {event.staffAssignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.staffMember.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {STAFF_FUNCTION_LABELS[a.function]} · {a.confirmed ? "confirmada" : "por confirmar"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    <span className="tabular text-sm font-medium">{formatMXN(a.amountCents)}</span>
                    <StatusBadge tone={a.paid ? "success" : "warning"}>
                      {a.paid ? "Pagado" : "Por pagar"}
                    </StatusBadge>
                  </div>
                </li>
              ))}
              <li className="flex justify-between px-4 py-3 text-sm font-semibold">
                <span>Total staff</span>
                <span className="tabular">{formatMXN(fin.sources.staffCents)}</span>
              </li>
            </ul>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-2">
        <Section
          title="Cobranza y comisiones de pago"
          description="Las comisiones de pagos cobrados son costo real."
        >
          <dl className="grid grid-cols-3 gap-3">
            <SnapshotFigure label="Total" value={formatMXN(collection.total)} />
            <SnapshotFigure label="Cobrado" value={formatMXN(collection.paid)} />
            <SnapshotFigure
              label="Saldo"
              value={formatMXN(collection.balance)}
              warning={collection.balance > 0}
            />
          </dl>
          {payments.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Sin pagos"
              description="Todavía no hay pagos registrados para este evento."
            />
          ) : (
            <div className="bg-card rounded-xl border">
              <Table className="text-xs sm:text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Pago</TableHead>
                    <TableHead scope="col">Estado</TableHead>
                    <TableHead scope="col" className="text-right">
                      Monto
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Comisión
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="min-w-28 whitespace-normal">
                        <span className="font-medium">{PAYMENT_KIND_LABELS[p.kind]}</span>
                        <span className="text-muted-foreground block text-xs">
                          {PAYMENT_METHOD_LABELS[p.method]}
                          {p.paidAt ? ` · ${formatShortDate(p.paidAt)}` : ""}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={PAYMENT_STATUS_TONES[p.status]}>
                          {PAYMENT_STATUS_LABELS[p.status]}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatMXN(p.amountCents)}
                        {p.refundedCents > 0 ? (
                          <span className="text-muted-foreground block text-xs">
                            reemb. {formatMXN(p.refundedCents)}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="tabular text-right">{formatMXN(p.feeCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">
                      Comisiones de pago
                    </TableCell>
                    <TableCell className="tabular text-right font-semibold">
                      {formatMXN(fin.sources.paymentFeesCents)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </Section>

        <Section
          title="Costos manuales"
          description="Gastos reales fuera de compras y staff."
          actions={canWriteCosts ? <EventCostDialog mode="create" eventId={event.id} /> : null}
        >
          {event.costs.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Sin costos manuales"
              description={
                canWriteCosts
                  ? "Registra propinas, estacionamiento, mermas u otros gastos para que el margen real sea exacto."
                  : "No se registraron costos manuales."
              }
            />
          ) : (
            <ul className="bg-card divide-y rounded-xl border">
              {event.costs.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.description}</p>
                    <p className="text-muted-foreground text-xs">
                      {COST_CATEGORY_LABELS[c.category]} · {formatShortDate(c.createdAt)}
                      {c.createdBy ? ` · ${c.createdBy.name}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="tabular mr-2 text-sm font-medium">{formatMXN(c.amountCents)}</span>
                    {canWriteCosts ? (
                      <>
                        <EventCostDialog
                          mode="edit"
                          eventId={event.id}
                          cost={{
                            id: c.id,
                            category: c.category,
                            description: c.description,
                            amountCents: c.amountCents,
                          }}
                        />
                        <DeleteCostButton
                          costId={c.id}
                          description={c.description}
                          amount={formatMXN(c.amountCents)}
                        />
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
              <li className="flex justify-between px-4 py-3 text-sm font-semibold">
                <span>Total manual</span>
                <span className="tabular">{formatMXN(fin.sources.manualCents)}</span>
              </li>
            </ul>
          )}
        </Section>
      </div>

      {!event.closedAt ? (
        <section aria-labelledby="close-title" className="bg-sand-soft/70 rounded-2xl border p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl space-y-1">
              <h2 id="close-title" className="font-heading text-2xl font-semibold">
                Cierre del evento
              </h2>
              <p className="text-muted-foreground text-sm">
                {canClose
                  ? "Al cerrar se congela la rentabilidad y se envía a la clienta el agradecimiento (con su Memory Capsule si ya está publicada) y la solicitud de reseña."
                  : event.status === "CANCELLED"
                    ? "Los eventos cancelados no se cierran."
                    : "Podrás cerrar el evento cuando esté marcado como completado."}
              </p>
            </div>
            {canCloseNow ? (
              <CloseEventButton
                eventId={event.id}
                warnings={closeWarnings({ balanceCents: collection.balance, pendingPurchases })}
              />
            ) : canClose ? (
              <p className="text-muted-foreground text-sm">No tienes permiso para cerrar eventos.</p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SnapshotFigure({
  label,
  value,
  danger,
  warning,
}: {
  label: string;
  value: React.ReactNode;
  danger?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="bg-card rounded-xl border px-4 py-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd
        className={
          danger
            ? "tabular text-destructive mt-1 text-lg font-semibold"
            : warning
              ? "tabular text-warning mt-1 text-lg font-semibold"
              : "tabular mt-1 text-lg font-semibold"
        }
      >
        {value}
      </dd>
    </div>
  );
}
