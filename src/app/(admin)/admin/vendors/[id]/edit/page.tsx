import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { requirePagePermission } from "@/server/auth/session";
import { getVendorForEdit } from "@/features/vendors/server/queries";
import { VendorForm } from "@/features/vendors/components/vendor-form";

export const metadata: Metadata = { title: "Editar proveedor" };
export const dynamic = "force-dynamic";

export default async function EditVendorPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("vendors:write");
  const { id } = await params;
  if (!id || id.length > 64) notFound();
  const vendor = await getVendorForEdit(id);
  if (!vendor) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader back={{ href: `/admin/vendors/${vendor.id}`, label: vendor.name }} title="Editar proveedor" />
      <VendorForm
        vendor={{
          id: vendor.id,
          name: vendor.name,
          category: vendor.category,
          contactName: vendor.contactName,
          phone: vendor.phone,
          whatsapp: vendor.whatsapp,
          email: vendor.email,
          slaNotes: vendor.slaNotes,
          notes: vendor.notes,
          status: vendor.status,
          rating: vendor.rating,
        }}
      />
    </div>
  );
}
