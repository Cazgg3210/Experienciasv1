import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { EMPTY_ADDON, getEngineSettings, getInventoryOptions, nextSortOrder } from "@/features/catalog/server/queries";
import { AddOnEditor } from "@/features/catalog/components/addon-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nuevo add-on" };

export default async function NewAddOnPage() {
  const user = await requirePagePermission("catalog:write", "/admin/catalog/addons/new");
  const [inventory, settings, sortOrder] = await Promise.all([
    getInventoryOptions(),
    getEngineSettings(),
    nextSortOrder("addOn"),
  ]);
  return (
    <>
      <PageHeader
        back={{ href: "/admin/catalog/addons", label: "Add-ons" }}
        title="Nuevo add-on"
        description="Un extra con precio claro, su costo real y lo que aparta del inventario."
      />
      <AddOnEditor
        mode="create"
        defaultValues={{ ...EMPTY_ADDON, sortOrder }}
        inventory={inventory}
        settings={settings}
        canWrite
        canPrice={can(user.role, "pricing:write")}
        canUpload={can(user.role, "media:upload")}
      />
    </>
  );
}
