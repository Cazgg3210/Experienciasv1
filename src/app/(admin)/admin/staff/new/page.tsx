import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requirePagePermission } from "@/server/auth/session";
import { StaffForm } from "@/features/staff/components/staff-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nuevo integrante" };

export default async function NewStaffPage() {
  await requirePagePermission("staff:write", "/admin/staff/new");
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Staff"
        title="Nuevo integrante"
        description="Después podrás crearle acceso al portal y asignarla a eventos."
        back={{ href: "/admin/staff", label: "Staff" }}
      />
      <section aria-label="Datos del integrante" className="bg-card rounded-2xl border p-5 shadow-xs sm:p-6">
        <StaffForm />
      </section>
    </div>
  );
}
