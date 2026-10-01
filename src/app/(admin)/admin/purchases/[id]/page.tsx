import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, History, Store } from "lucide-react";
import { PageHeader, Section } from "@/components/layout/page-header";
import { StatCard } from "@/components/data/stat-card";
import { StatusBadge } from "@/components/data/status-badge";
import { formatDateTime, formatShortDate, localDateKey } from "@/lib/dates";
import {
  COST_CATEGORY_LABELS,
  EVENT_STATUS_LABELS,
  EVENT_STATUS_TONES,
  PURCHASE_STATUS_LABELS,
  PURCHASE_STATUS_TONES,
  VENDOR_STATUS_LABELS,
} from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { whatsappLink } from "@/server/providers/whatsapp/links";
import { purchaseVariance } from "@/features/purchases/domain/purchase-rules";
import { getPurchaseDetail, getPurchaseFormOptions } from "@/features/purchases/server/queries";
import { PurchaseForm } from "@/features/purchases/components/purchase-form";
import { PurchaseStatusPanel } from "@/features/purchases/components/purchase-status-panel";
import { VarianceText } from "@/features/purchases/components/purchase-table";

export const metadata: Metadata = { title: "Compra" };
export const dynamic = "force-dynamic";

const AUDIT_LABELS: Record<string, string> = {
  "purchase.created": "Compra registrada",
  "purchase.updated": "Datos actualizados",
  "purchase.status_changed": "Cambio de estado",
  "purchase.cancelled": "Compra cancelada",
  "purchase.amount_changed": "Monto real corregido",
  "purchase.receipt_attached": "Comprobante adjunto",
  "purchase.receipt_removed": "Comprobante quitado",
};

function describeChange(action: string, after: unknown): string | null {
  if (!after || typeof after !== "object") return null;
  const a = after as Record<string, unknown>;
  if (action === "purchase.status_changed" || action === "purchase.cancelled") {
    const status = a.status as keyof typeof PURCHASE_STATUS_LABELS | undefined;
    const parts = [status ? `→ ${PURCHASE_STATUS_LABELS[status] ?? status}` : null];
    if (typeof a.actualAmountCents === "number" && status === "RECEIVED") parts.push(`real ${formatMXN(a.actualAmountCents)}`);
    if (typeof a.reason === "string") parts.push(`motivo: ${a.reason}`);
    return parts.filter(Boolean).join(" · ");
  }
  if (action === "purchase.amount_changed") {
    return [
      typeof a.actualAmountCents === "number" ? `nuevo real ${formatMXN(a.actualAmountCents)}` : null,
      typeof a.reason === "string" ? `motivo: ${a.reason}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (action === "purchase.updated") {
    const labels: Record<string, string> = {
      concept: "concepto",
      category: "categoría",
      expectedAmountCents: "monto esperado",
      neededBy: "fecha necesaria",
      notes: "notas",
      vendorId: "proveedor",
      eventId: "evento",
    };
    return `Cambió: ${Object.keys(a)
      .map((k) => labels[k] ?? k)
      .join(", ")}`;
  }
  return null;
}

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("purchases:read");
  const canWrite = can(user.role, "purchases:write");
  const { id } = await params;
  if (!id || id.length > 64) notFound();
  const detail = await getPurchaseDetail(id);
  if (!detail) notFound();
  const { purchase, receipt, history } = detail;
  const options = canWrite
    ? await getPurchaseFormOptions({ includeEventId: purchase.eventId, includeVendorId: purchase.vendorId })
    : null;
  const variance = purchaseVariance(purchase);

  return (
    <div className="space-y-8">
      <PageHeader
        back={
          purchase.event
            ? { href: `/admin/purchases?event=${purchase.event.id}`, label: `Compras de ${purchase.event.title}` }
            : { href: "/admin/purchases", label: "Compras" }
        }
        eyebrow={COST_CATEGORY_LABELS[purchase.category]}
        title={purchase.concept}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={PURCHASE_STATUS_TONES[purchase.status]}>{PURCHASE_STATUS_LABELS[purchase.status]}</StatusBadge>
            <span>
              Registrada {formatShortDate(purchase.createdAt)}
              {purchase.createdBy ? ` por ${purchase.createdBy.name}` : ""}
            </span>
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Esperado" value={formatMXN(purchase.expectedAmountCents)} />
        <StatCard
          label="Real"
          value={formatMXN(purchase.actualAmountCents)}
          hint={purchase.status === "RECEIVED" ? "Cuenta en el costo real del evento" : "Se captura al recibir"}
        />
        <StatCard
          label="Variación"
          value={<VarianceText cents={variance} />}
          tone={variance != null && variance > 0 ? "danger" : "default"}
        />
        <StatCard
          label="Necesario para"
          value={<span className="text-xl">{purchase.neededBy ? formatShortDate(purchase.neededBy) : "—"}</span>}
          icon={CalendarClock}
          hint={
            purchase.neededBy && purchase.status !== "RECEIVED" && purchase.status !== "CANCELLED" && localDateKey(purchase.neededBy) < localDateKey()
              ? "Fecha vencida"
              : undefined
          }
          tone={
            purchase.neededBy && purchase.status !== "RECEIVED" && purchase.status !== "CANCELLED" && localDateKey(purchase.neededBy) < localDateKey()
              ? "warning"
              : "default"
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          {canWrite ? (
            <section aria-labelledby="estado" className="bg-card space-y-4 rounded-xl border p-4 sm:p-5">
              <h2 id="estado" className="font-heading text-xl font-semibold">
                Estado
              </h2>
              <ol className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <li>Solicitada {formatDateTime(purchase.createdAt)}</li>
                {purchase.orderedAt ? <li>Ordenada {formatDateTime(purchase.orderedAt)}</li> : null}
                {purchase.receivedAt ? <li>Recibida {formatDateTime(purchase.receivedAt)}</li> : null}
                {purchase.cancelledAt ? <li className="text-destructive">Cancelada {formatDateTime(purchase.cancelledAt)}</li> : null}
              </ol>
              <PurchaseStatusPanel
                canWrite={canWrite}
                eventClosed={Boolean(purchase.event?.closedAt)}
                purchase={{
                  id: purchase.id,
                  status: purchase.status,
                  expectedAmountCents: purchase.expectedAmountCents,
                  actualAmountCents: purchase.actualAmountCents,
                  eventId: purchase.eventId,
                }}
                receipt={receipt}
              />
            </section>
          ) : receipt ? (
            <a href={receipt.url} target="_blank" rel="noopener noreferrer" className="text-sm underline">
              Ver comprobante
            </a>
          ) : null}

          {canWrite && options ? (
            <section aria-labelledby="detalles" className="bg-card space-y-4 rounded-xl border p-4 sm:p-5">
              <h2 id="detalles" className="font-heading text-xl font-semibold">
                Detalles
              </h2>
              <PurchaseForm
                compact
                purchaseId={purchase.id}
                options={options}
                initial={{
                  eventId: purchase.eventId,
                  vendorId: purchase.vendorId,
                  concept: purchase.concept,
                  category: purchase.category,
                  expectedAmountCents: purchase.expectedAmountCents,
                  neededBy: purchase.neededBy ? localDateKey(purchase.neededBy) : "",
                  notes: purchase.notes ?? "",
                }}
              />
            </section>
          ) : (
            <section className="bg-card space-y-2 rounded-xl border p-4 text-sm sm:p-5">
              <h2 className="font-heading text-xl font-semibold">Notas</h2>
              <p className="whitespace-pre-line">{purchase.notes ?? "Sin notas."}</p>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section aria-labelledby="evento" className="bg-card space-y-2 rounded-xl border p-4">
            <h2 id="evento" className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Evento
            </h2>
            {purchase.event ? (
              <>
                <Link href={`/admin/events/${purchase.event.id}`} className="font-medium hover:underline">
                  {purchase.event.title}
                </Link>
                <p className="text-muted-foreground text-xs">
                  <span className="font-mono">{purchase.event.code}</span> · {formatShortDate(purchase.event.eventDate)}
                </p>
                <StatusBadge tone={EVENT_STATUS_TONES[purchase.event.status]}>{EVENT_STATUS_LABELS[purchase.event.status]}</StatusBadge>
                <p className="pt-1 text-sm">
                  <Link href={`/admin/purchases?event=${purchase.event.id}`} className="underline underline-offset-2">
                    Ver todas las compras del evento
                  </Link>
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Compra general (no ligada a un evento).</p>
            )}
          </section>
          <section aria-labelledby="proveedor" className="bg-card space-y-2 rounded-xl border p-4">
            <h2 id="proveedor" className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Proveedor
            </h2>
            {purchase.vendor ? (
              <>
                <Link href={`/admin/vendors/${purchase.vendor.id}`} className="inline-flex items-center gap-2 font-medium hover:underline">
                  <Store className="size-4" aria-hidden /> {purchase.vendor.name}
                </Link>
                {purchase.vendor.status !== "ACTIVE" ? (
                  <p className="text-warning text-xs">{VENDOR_STATUS_LABELS[purchase.vendor.status]}</p>
                ) : null}
                {purchase.vendor.contactName ? <p className="text-sm">{purchase.vendor.contactName}</p> : null}
                {purchase.vendor.whatsapp ? (
                  <a
                    href={whatsappLink(
                      purchase.vendor.whatsapp,
                      `Hola ${purchase.vendor.contactName ?? purchase.vendor.name}, sobre el pedido: ${purchase.concept}${
                        purchase.neededBy ? ` (para el ${formatShortDate(purchase.neededBy)})` : ""
                      }.`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-olive text-sm underline underline-offset-2"
                  >
                    Escribir por WhatsApp
                  </a>
                ) : null}
                {purchase.vendor.slaNotes ? (
                  <p className="text-muted-foreground border-t pt-2 text-xs whitespace-pre-line">{purchase.vendor.slaNotes}</p>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Sin proveedor asignado.</p>
            )}
          </section>
        </aside>
      </div>

      <Section title="Historial" description="Cambios auditados de esta compra.">
        {history.length === 0 ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <History className="size-4" aria-hidden /> Sin cambios registrados todavía.
          </p>
        ) : (
          <ol className="bg-card divide-y rounded-xl border">
            {history.map((h) => (
              <li key={h.id} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                <span className="text-muted-foreground w-40 shrink-0 text-xs">{formatDateTime(h.createdAt)}</span>
                <span className="text-sm">
                  <strong className="font-medium">{AUDIT_LABELS[h.action] ?? h.action}</strong>
                  {describeChange(h.action, h.after) ? <span className="text-muted-foreground"> · {describeChange(h.action, h.after)}</span> : null}
                </span>
                <span className="text-muted-foreground text-xs sm:ml-auto">{h.actor?.name ?? h.actorEmail ?? "Sistema"}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
