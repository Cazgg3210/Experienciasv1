import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/data/status-badge";
import { can } from "@/server/auth/permissions";
import { countLabel } from "@/features/catalog/domain/catalog-rules";
import { requirePagePermission } from "@/server/auth/session";
import { getEngineSettings, getMenuEditorData, isPlausibleId } from "@/features/catalog/server/queries";
import { MenuEditor } from "@/features/catalog/components/menu-editor";
import { MenuItemsEditor } from "@/features/catalog/components/menu-items-editor";
import { SectionCard } from "@/features/catalog/components/form-bits";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!isPlausibleId(id)) return { title: "Menú" };
  const data = await getMenuEditorData(id).catch(() => null);
  return { title: data ? data.name : "Menú" };
}

export default async function MenuEditorPage({ params }: Props) {
  const user = await requirePagePermission("catalog:read", "/admin/catalog/menus");
  const { id } = await params;
  if (!isPlausibleId(id)) notFound();
  const [data, settings] = await Promise.all([getMenuEditorData(id), getEngineSettings()]);
  if (!data) notFound();
  const canWrite = can(user.role, "catalog:write");
  const usage = [
    data.counts.events ? countLabel(data.counts.events, "evento", "eventos") : null,
    data.counts.quotes ? countLabel(data.counts.quotes, "cotización", "cotizaciones") : null,
    data.counts.leads ? countLabel(data.counts.leads, "lead", "leads") : null,
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/catalog/menus", label: "Menús" }}
        eyebrow={
          <span className="normal-case">
            <StatusBadge tone={data.values.active ? "success" : "muted"}>{data.values.active ? "Activo" : "Inactivo"}</StatusBadge>
          </span>
        }
        title={data.name}
        description={usage.length ? `Usado en ${usage.join(", ")}.` : "Todavía no se ha usado en cotizaciones ni eventos."}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <MenuEditor
          key={JSON.stringify(data.values)}
          mode="edit"
          menuId={data.id}
          defaultValues={data.values}
          settings={settings}
          canWrite={canWrite}
          canPrice={can(user.role, "pricing:write")}
          deletable={canWrite}
        />
        <div className="min-w-0 space-y-6">
          <MenuItemsEditor menuId={data.id} items={data.items} canWrite={canWrite} />
          <SectionCard title="Experiencias con este menú">
            {data.experiences.length ? (
              <ul className="flex flex-wrap gap-2">
                {data.experiences.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/admin/catalog/experiences/${e.id}`}
                      className="bg-sand-soft hover:bg-sand focus-visible:ring-ring/50 inline-flex rounded-full px-3 py-1 text-sm outline-none focus-visible:ring-3"
                    >
                      {e.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                Ninguna experiencia ofrece este menú todavía. Lígalo desde la sección “Relaciones” de una experiencia.
              </p>
            )}
          </SectionCard>
        </div>
      </div>
    </>
  );
}
