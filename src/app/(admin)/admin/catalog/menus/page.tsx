import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/data/status-badge";
import { DIETARY_LABELS, MENU_PRICING_LABELS } from "@/lib/labels";
import { formatMXN } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { listMenusForAdmin } from "@/features/catalog/server/queries";
import { ActiveToggle } from "@/features/catalog/components/catalog-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Menús" };

export default async function CatalogMenusPage() {
  const user = await requirePagePermission("catalog:read", "/admin/catalog/menus");
  const canWrite = can(user.role, "catalog:write");
  const menus = await listMenusForAdmin();

  const newButton = canWrite ? (
    <Button asChild size="lg">
      <Link href="/admin/catalog/menus/new">
        <Plus aria-hidden />
        Nuevo menú
      </Link>
    </Button>
  ) : null;

  return (
    <>
      <PageHeader
        title="Menús"
        description="Menús incluidos y upgrades: precio, costo por persona, platillos y restricciones que cubren."
        actions={newButton}
      />
      {menus.length ? (
        <ul className="space-y-3">
          {menus.map((m) => (
            <li key={m.id} className="bg-card rounded-2xl border p-4 shadow-xs">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-heading text-lg font-semibold">
                      <Link
                        href={`/admin/catalog/menus/${m.id}`}
                        className="focus-visible:ring-ring/50 rounded outline-none hover:underline focus-visible:ring-3"
                      >
                        {m.name}
                      </Link>
                    </h2>
                    <StatusBadge tone={m.pricingType === "INCLUDED" ? "neutral" : "brand"}>
                      {MENU_PRICING_LABELS[m.pricingType]}
                    </StatusBadge>
                    {!m.active ? <StatusBadge tone="muted">Inactivo</StatusBadge> : null}
                  </div>
                  {m.description ? <p className="text-muted-foreground line-clamp-2 text-sm">{m.description}</p> : null}
                  <p className="text-muted-foreground text-xs">
                    {m._count.items} {m._count.items === 1 ? "platillo" : "platillos"} · en {m._count.experiences}{" "}
                    {m._count.experiences === 1 ? "experiencia" : "experiencias"}
                    {m.dietaryTags.length ? ` · ${m.dietaryTags.map((d) => DIETARY_LABELS[d]).join(", ")}` : ""}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-4 text-sm md:w-64">
                  <div>
                    <dt className="text-muted-foreground text-xs">Precio</dt>
                    <dd className="tabular font-medium">
                      {m.pricingType === "INCLUDED"
                        ? "Incluido"
                        : `${formatMXN(m.priceCents)}${m.pricingType === "PER_GUEST" ? " / persona" : ""}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Costo</dt>
                    <dd className="tabular font-medium">{formatMXN(m.costPerGuestCents)} / persona</dd>
                  </div>
                </dl>
                <div className="flex items-center justify-between gap-3 md:justify-end">
                  <ActiveToggle entity="menu" id={m.id} name={m.name} active={m.active} disabled={!canWrite} />
                  <Button asChild variant="ghost" size="lg">
                    <Link href={`/admin/catalog/menus/${m.id}`} aria-label={`${canWrite ? "Editar" : "Ver"} ${m.name}`}>
                      {canWrite ? "Editar" : "Ver"}
                      <ChevronRight aria-hidden />
                    </Link>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={UtensilsCrossed}
          title="Aún no hay menús"
          description="Crea un menú incluido para tus experiencias y, si quieres, upgrades por persona o por evento."
          action={newButton}
        />
      )}
    </>
  );
}
