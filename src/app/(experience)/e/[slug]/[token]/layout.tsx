import { notFound } from "next/navigation";
import { resolveInvite } from "@/features/portal/server/portal-service";

export const dynamic = "force-dynamic";

/**
 * Valida slug + token ANTES del límite de carga (loading.tsx): slug incorrecto, micrositio
 * deshabilitado o token ajeno/inexistente responden un 404 real y genérico.
 * (El route handler calendar.ics valida por su cuenta; los layouts no aplican a route handlers.)
 */
export default async function InviteTokenLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const resolved = await resolveInvite(slug, token);
  if (!resolved) notFound();
  return children;
}
