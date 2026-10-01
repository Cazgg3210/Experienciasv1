import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getCurrentUser } from "@/server/auth/session";
import { isBackofficeRole } from "@/server/auth/permissions";
import { providerStatus } from "@/server/providers";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel Ivonne & Rosa" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/admin");
  if (!isBackofficeRole(user.role)) redirect(user.role === "STAFF" ? "/staff" : "/sin-acceso");

  const status = providerStatus();
  const labels: Record<keyof typeof status, string> = {
    payments: "Pagos",
    email: "Email",
    whatsapp: "WhatsApp",
    ai: "IA",
    storage: "Archivos",
  };
  const mockProviders = (Object.keys(status) as Array<keyof typeof status>)
    .filter((k) => status[k].mock)
    .map((k) => labels[k]);

  return (
    <AdminShell user={{ name: user.name, email: user.email, role: user.role }} mockProviders={mockProviders}>
      {children}
    </AdminShell>
  );
}
