import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff/staff-shell";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";

export const metadata: Metadata = {
  title: { default: "Mis eventos", template: "%s · Staff Ivonne & Rosa" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/staff");
  if (!can(user.role, "events:read_assigned")) redirect("/sin-acceso");
  return <StaffShell name={user.name}>{children}</StaffShell>;
}
