import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MessageCircle, Pencil, Phone, Plus, ReceiptText } from "lucide-react";
import { PageHeader, Section } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatCard } from "@/components/data/stat-card";
import { StatusBadge } from "@/components/data/status-badge";
import { CopyButton } from "@/components/data/copy-button";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/dates";
import { VENDOR_CATEGORY_LABELS, VENDOR_STATUS_LABELS } from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { whatsappLink } from "@/server/providers/whatsapp/links";
import { getVendorDetail } from "@/features/vendors/server/queries";
import { RatingStars, VENDOR_STATUS_TONES } from "@/features/vendors/components/vendor-ui";
import { DeleteVendorButton } from "@/features/vendors/components/delete-vendor-button";
import { PurchaseTable, VarianceText } from "@/features/purchases/components/purchase-table";

export const metadata: Metadata = { title: "Proveedor" };
export const dynamic = "force-dynamic";

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("vendors:read");
  const canWrite = can(user.role, "vendors:write");
  const canPurchase = can(user.role, "purchases:write");
  const canReadPurchases = can(user.role, "purchases:read");
  const { id } = await params;
  if (!id || id.length > 64) notFound();
  const detail = await getVendorDetail(id);
  if (!detail) notFound();
  const { vendor, purchases, totals } = detail;
  const greeting = `Hola ${vendor.contactName ?? vendor.name}, te escribimos de Ivonne & Rosa.`;
  const lastPurchase = purchases[0];

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: "/admin/vendors", label: "Proveedores" }}
        eyebrow={VENDOR_CATEGORY_LABELS[vendor.category]}
        title={vendor.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={VENDOR_STATUS_TONES[vendor.status]}>{VENDOR_STATUS_LABELS[vendor.status]}</StatusBadge>
            <RatingStars value={vendor.rating} />
            {lastPurchase ? <span>· Última compra {formatShortDate(lastPurchase.createdAt)}</span> : null}
          </span>
        }
        actions={
          <>
            {vendor.whatsapp ? (
              <Button asChild>
                <a href={whatsappLink(vendor.whatsapp, greeting)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" aria-hidden /> WhatsApp
                </a>
              </Button>
            ) : null}
            {canPurchase && vendor.status !== "BLOCKED" ? (
              <Button variant="outline" asChild>
                <Link href={`/admin/purchases/new?vendorId=${vendor.id}`}>
                  <Plus className="size-4" aria-hidden /> Nueva compra
                </Link>
              </Button>
            ) : null}
            {canWrite ? (
              <>
                <Button variant="outline" asChild>
                  <Link href={`/admin/vendors/${vendor.id}/edit`}>
                    <Pencil className="size-4" aria-hidden /> Editar
                  </Link>
                </Button>
                <DeleteVendorButton id={vendor.id} name={vendor.name} purchases={purchases.length} />
              </>
            ) : null}
          </>
        }
      />

      {vendor.status === "BLOCKED" ? (
        <div role="alert" className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border p-4 text-sm">
          Proveedor bloqueado: no aparece al registrar nuevas compras.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section aria-labelledby="contacto" className="bg-card space-y-3 rounded-xl border p-5 lg:col-span-1">
          <h2 id="contacto" className="font-heading text-xl font-semibold">
            Contacto
          </h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">Persona de contacto</dt>
              <dd>{vendor.contactName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Teléfono</dt>
              <dd className="flex items-center gap-2">
                {vendor.phone ? (
                  <a className="hover:underline" href={`tel:${vendor.phone.replace(/[^\d+]/g, "")}`}>
                    <Phone className="mr-1 inline size-3.5" aria-hidden />
                    {vendor.phone}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">WhatsApp</dt>
              <dd className="flex flex-wrap items-center gap-2">
                {vendor.whatsapp ? (
                  <>
                    <a className="hover:underline" href={whatsappLink(vendor.whatsapp, greeting)} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="mr-1 inline size-3.5" aria-hidden />
                      {vendor.whatsapp}
                    </a>
                    <CopyButton value={whatsappLink(vendor.whatsapp)} size="xs" label="Copiar enlace" toastMessage="Enlace de WhatsApp copiado" />
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Email</dt>
              <dd>
                {vendor.email ? (
                  <a className="break-all hover:underline" href={`mailto:${vendor.email}`}>
                    <Mail className="mr-1 inline size-3.5" aria-hidden />
                    {vendor.email}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </section>
        <section aria-labelledby="acuerdos" className="bg-card space-y-3 rounded-xl border p-5 lg:col-span-2">
          <h2 id="acuerdos" className="font-heading text-xl font-semibold">
            Acuerdos y notas
          </h2>
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground mb-1 text-xs">SLA / condiciones</p>
              <p className="whitespace-pre-line">{vendor.slaNotes ?? "Sin condiciones registradas."}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-xs">Notas internas</p>
              <p className="whitespace-pre-line">{vendor.notes ?? "Sin notas."}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Compras" value={totals.count} hint={`${totals.byStatus.RECEIVED} recibidas · ${totals.byStatus.CANCELLED} canceladas`} />
        <StatCard label="Esperado" value={formatMXN(totals.expectedCents)} hint="Compras no canceladas" />
        <StatCard label="Real pagado" value={formatMXN(totals.actualCents)} hint={`Pendiente por recibir ${formatMXN(totals.pendingCents)}`} />
        <StatCard
          label="Variación (recibidas)"
          value={<VarianceText cents={totals.byStatus.RECEIVED ? totals.varianceCents : null} />}
          tone={totals.varianceCents > 0 ? "danger" : "default"}
          hint={`Esperado de recibidas ${formatMXN(totals.receivedExpectedCents)}`}
        />
      </div>

      {canReadPurchases ? (
        <Section title="Historial de compras">
          {purchases.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="Aún no hay compras con este proveedor"
              description="Registra la primera compra para comparar lo esperado contra lo real."
              action={
                canPurchase && vendor.status !== "BLOCKED" ? (
                  <Button asChild>
                    <Link href={`/admin/purchases/new?vendorId=${vendor.id}`}>Registrar compra</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <PurchaseTable rows={purchases} showVendor={false} />
          )}
        </Section>
      ) : null}
    </div>
  );
}
