import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requirePagePermission } from "@/server/auth/session";
import { VendorForm } from "@/features/vendors/components/vendor-form";

export const metadata: Metadata = { title: "Nuevo proveedor" };
export const dynamic = "force-dynamic";

export default async function NewVendorPage() {
  await requirePagePermission("vendors:write");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        back={{ href: "/admin/vendors", label: "Proveedores" }}
        title="Nuevo proveedor"
        description="Datos de contacto, condiciones y calificación para elegir al aliado correcto en cada evento."
      />
      <VendorForm />
    </div>
  );
}
