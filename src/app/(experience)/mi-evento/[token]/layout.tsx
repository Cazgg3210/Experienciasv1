import { notFound } from "next/navigation";
import { resolvePortalEvent } from "@/features/portal/server/portal-service";

export const dynamic = "force-dynamic";

/**
 * Valida el token del portal ANTES del límite de carga (loading.tsx) para que un enlace
 * inválido o inexistente responda un 404 real (y genérico), no un 200 con "no encontrado".
 * También cubre /mi-evento/[token]/resumen.
 */
export default async function PortalTokenLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const event = await resolvePortalEvent(token);
  if (!event) notFound();
  return children;
}
