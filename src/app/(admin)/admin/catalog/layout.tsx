import { requirePagePermission } from "@/server/auth/session";
import { CatalogNav } from "@/features/catalog/components/catalog-nav";
import { SegmentChildren } from "@/components/layout/segment-children";

export const dynamic = "force-dynamic";

export default async function CatalogLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission("catalog:read", "/admin/catalog");
  return (
    <div className="min-w-0">
      <CatalogNav />
      <SegmentChildren>{children}</SegmentChildren>
    </div>
  );
}
