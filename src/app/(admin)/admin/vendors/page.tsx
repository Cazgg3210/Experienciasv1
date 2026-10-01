import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, Phone, Plus, SearchX, Store } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/data/status-badge";
import { Pagination, parsePage } from "@/components/data/pagination";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VENDOR_CATEGORY_LABELS, VENDOR_STATUS_LABELS, toOptions } from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { whatsappLink } from "@/server/providers/whatsapp/links";
import { vendorFiltersSchema } from "@/features/vendors/schemas";
import { listVendors } from "@/features/vendors/server/queries";
import { RatingStars, VENDOR_STATUS_TONES } from "@/features/vendors/components/vendor-ui";
import { ListFilters } from "@/features/inventory/components/list-filters";

export const metadata: Metadata = { title: "Proveedores" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePagePermission("vendors:read");
  const canWrite = can(user.role, "vendors:write");
  const sp = await searchParams;
  const filters = vendorFiltersSchema.parse({
    q: typeof sp.q === "string" ? sp.q : undefined,
    category: sp.category,
    status: sp.status,
  });
  const page = parsePage(sp.page);
  const { rows, total, counts } = await listVendors(filters, { page, pageSize: PAGE_SIZE });
  const hasFilters = Boolean(filters.q || filters.category || filters.status);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operación"
        title="Proveedores"
        description={`Florerías, pastelerías, transporte y aliados. ${plural(counts.ACTIVE, "activo", "activos")} · ${plural(
          counts.INACTIVE,
          "inactivo",
          "inactivos",
        )} · ${plural(counts.BLOCKED, "bloqueado", "bloqueados")}.`}
        actions={
          canWrite ? (
            <Button asChild>
              <Link href="/admin/vendors/new">
                <Plus className="size-4" aria-hidden /> Nuevo proveedor
              </Link>
            </Button>
          ) : null
        }
      />

      <ListFilters
        fields={[
          { type: "search", name: "q", label: "Buscar", placeholder: "Nombre, contacto, email o teléfono" },
          { type: "select", name: "category", label: "Categoría", options: toOptions(VENDOR_CATEGORY_LABELS) },
          { type: "select", name: "status", label: "Estado", allLabel: "Todos", options: toOptions(VENDOR_STATUS_LABELS) },
        ]}
      />

      {rows.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={SearchX}
            title="Ningún proveedor coincide"
            description="Ajusta la búsqueda o limpia los filtros."
            action={
              <Button variant="outline" asChild>
                <Link href="/admin/vendors">Limpiar filtros</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Store}
            title="Aún no hay proveedores"
            description="Registra a tus aliados para ligar compras, comparar costos y contactarlos por WhatsApp."
            action={
              canWrite ? (
                <Button asChild>
                  <Link href="/admin/vendors/new">Agregar proveedor</Link>
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <div className="bg-card hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Calificación</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead className="text-right">Compras</TableHead>
                  <TableHead className="text-right">Real pagado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="min-w-52 whitespace-normal">
                      <Link href={`/admin/vendors/${v.id}`} className="font-medium hover:underline">
                        {v.name}
                      </Link>
                      {v.contactName ? <span className="text-muted-foreground block text-xs">{v.contactName}</span> : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{VENDOR_CATEGORY_LABELS[v.category]}</TableCell>
                    <TableCell>
                      <StatusBadge tone={VENDOR_STATUS_TONES[v.status]}>{VENDOR_STATUS_LABELS[v.status]}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <RatingStars value={v.rating} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {v.whatsapp ? (
                          <Button variant="ghost" size="icon-sm" asChild>
                            <a
                              href={whatsappLink(v.whatsapp, `Hola ${v.contactName ?? v.name}, te escribimos de Ivonne & Rosa.`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`WhatsApp a ${v.name}`}
                            >
                              <MessageCircle className="size-4" aria-hidden />
                            </a>
                          </Button>
                        ) : null}
                        {v.phone ? (
                          <Button variant="ghost" size="icon-sm" asChild>
                            <a href={`tel:${v.phone.replace(/[^\d+]/g, "")}`} aria-label={`Llamar a ${v.name}`}>
                              <Phone className="size-4" aria-hidden />
                            </a>
                          </Button>
                        ) : null}
                        {!v.whatsapp && !v.phone ? <span className="text-muted-foreground text-xs">—</span> : null}
                      </div>
                    </TableCell>
                    <TableCell className="tabular text-right">{v.totals.count}</TableCell>
                    <TableCell className="tabular text-right">{formatMXN(v.totals.actualCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="space-y-3 md:hidden" aria-label="Proveedores">
            {rows.map((v) => (
              <li key={v.id} className="bg-card rounded-xl border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/admin/vendors/${v.id}`} className="font-medium hover:underline">
                      {v.name}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {VENDOR_CATEGORY_LABELS[v.category]}
                      {v.contactName ? ` · ${v.contactName}` : ""}
                    </p>
                  </div>
                  <StatusBadge tone={VENDOR_STATUS_TONES[v.status]}>{VENDOR_STATUS_LABELS[v.status]}</StatusBadge>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <RatingStars value={v.rating} />
                  <span className="text-muted-foreground tabular text-xs">
                    {plural(v.totals.count, "compra", "compras")} · {formatMXN(v.totals.actualCents)}
                  </span>
                </div>
                {v.whatsapp ? (
                  <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
                    <a href={whatsappLink(v.whatsapp)} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="size-4" aria-hidden /> WhatsApp
                    </a>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/vendors" searchParams={sp} />
        </>
      )}
    </div>
  );
}
