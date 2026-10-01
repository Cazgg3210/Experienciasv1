import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatCard } from "@/components/data/stat-card";
import { formatBps } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { listExperiencesForAdmin } from "@/features/catalog/server/queries";
import { ExperienceCard } from "@/features/catalog/components/experience-card";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Experiencias" };

export default async function CatalogExperiencesPage() {
  const user = await requirePagePermission("catalog:read", "/admin/catalog");
  const canWrite = can(user.role, "catalog:write");
  const items = await listExperiencesForAdmin();

  const active = items.filter((i) => i.active);
  const withMargin = active.filter((i) => i.margin);
  const avgMargin = withMargin.length
    ? Math.round(withMargin.reduce((s, i) => s + (i.margin?.marginBps ?? 0), 0) / withMargin.length)
    : null;
  const atRisk = active.filter((i) => i.margin && i.margin.level !== "healthy").length;

  const newButton = canWrite ? (
    <Button asChild size="lg">
      <Link href="/admin/catalog/experiences/new">
        <Plus aria-hidden />
        Nueva experiencia
      </Link>
    </Button>
  ) : null;

  return (
    <>
      <PageHeader
        title="Experiencias"
        description="Lo que ofrecemos: precio, personas, costos y margen estimado de cada experiencia."
        actions={newButton}
      />
      {items.length ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Experiencias" value={items.length} hint={`${active.length} activas`} />
            <StatCard label="Destacadas" value={items.filter((i) => i.featured && i.active).length} hint="Visibles en la home" />
            <StatCard
              label="Margen promedio"
              value={avgMargin != null ? formatBps(avgMargin) : "—"}
              hint="Activas, para personas base"
              tone={avgMargin != null && avgMargin < 0 ? "danger" : "default"}
            />
            <StatCard
              label="Con margen en riesgo"
              value={atRisk}
              hint="Bajo el mínimo o negativo"
              tone={atRisk ? "warning" : "success"}
            />
          </div>
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item, i) => (
              <li key={item.id} className="flex">
                <div className="flex w-full">
                  <ExperienceCard item={item} canWrite={canWrite} priority={i < 3} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState
          icon={Sparkles}
          title="Aún no hay experiencias"
          description="Crea la primera experiencia: nombre, precio base, personas y lo que incluye. Después podrás subir fotos y estimar su margen."
          action={newButton}
        />
      )}
    </>
  );
}
