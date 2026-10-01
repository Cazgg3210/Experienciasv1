import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { EMPTY_MENU, getEngineSettings, nextSortOrder } from "@/features/catalog/server/queries";
import { MenuEditor } from "@/features/catalog/components/menu-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nuevo menú" };

export default async function NewMenuPage() {
  const user = await requirePagePermission("catalog:write", "/admin/catalog/menus/new");
  const [settings, sortOrder] = await Promise.all([getEngineSettings(), nextSortOrder("menu")]);
  return (
    <>
      <PageHeader
        back={{ href: "/admin/catalog/menus", label: "Menús" }}
        title="Nuevo menú"
        description="Define precio y costo; después podrás agregar los platillos."
      />
      <MenuEditor
        mode="create"
        defaultValues={{ ...EMPTY_MENU, sortOrder }}
        settings={settings}
        canWrite
        canPrice={can(user.role, "pricing:write")}
      />
    </>
  );
}
