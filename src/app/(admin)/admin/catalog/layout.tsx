import { requirePagePermission } from "@/server/auth/session";
import { CatalogNav } from "@/features/catalog/components/catalog-nav";

export const dynamic = "force-dynamic";

export default async function CatalogLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission("catalog:read", "/admin/catalog");
  return (
    <div className="min-w-0">
      <CatalogNav />
      {children}
    </div>
  );
}
