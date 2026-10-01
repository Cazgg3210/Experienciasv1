import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/data/status-badge";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { getAddOnEditorData, getEngineSettings, getInventoryOptions, isPlausibleId } from "@/features/catalog/server/queries";
import { AddOnEditor } from "@/features/catalog/components/addon-editor";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!isPlausibleId(id)) return { title: "Add-on" };
  const data = await getAddOnEditorData(id).catch(() => null);
  return { title: data ? data.name : "Add-on" };
}

export default async function AddOnEditorPage({ params }: Props) {
  const user = await requirePagePermission("catalog:read", "/admin/catalog/addons");
  const { id } = await params;
  if (!isPlausibleId(id)) notFound();
  const data = await getAddOnEditorData(id);
  if (!data) notFound();
  const [inventory, settings] = await Promise.all([
    getInventoryOptions(data.values.inventoryReqs.map((r) => r.inventoryItemId)),
    getEngineSettings(),
  ]);
  const canWrite = can(user.role, "catalog:write");

  return (
    <>
      <PageHeader
        back={{ href: "/admin/catalog/addons", label: "Add-ons" }}
        eyebrow={
          <span className="normal-case">
            <StatusBadge tone={data.values.active ? "success" : "muted"}>{data.values.active ? "Disponible" : "No disponible"}</StatusBadge>
          </span>
        }
        title={data.name}
        description={
          data.counts.eventAddOns
            ? `Contratado en ${data.counts.eventAddOns} ${data.counts.eventAddOns === 1 ? "evento" : "eventos"}.`
            : "Todavía no se ha contratado en ningún evento."
        }
      />
      <AddOnEditor
        key={JSON.stringify(data.values)}
        mode="edit"
        addOnId={data.id}
        defaultValues={data.values}
        inventory={inventory}
        settings={settings}
        canWrite={canWrite}
        canPrice={can(user.role, "pricing:write")}
        canUpload={can(user.role, "media:upload")}
        deletable={canWrite}
      />
      {data.experiences.length ? (
        <p className="text-muted-foreground mt-6 text-sm">
          Disponible en:{" "}
          {data.experiences.map((e, i) => (
            <span key={e.id}>
              {i > 0 ? ", " : null}
              <Link href={`/admin/catalog/experiences/${e.id}`} className="text-foreground underline-offset-4 hover:underline">
                {e.name}
              </Link>
            </span>
          ))}
          .
        </p>
      ) : null}
    </>
  );
}
