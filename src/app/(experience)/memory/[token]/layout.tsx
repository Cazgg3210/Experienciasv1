import { notFound } from "next/navigation";
import { isEnabled } from "@/lib/flags";
import { isPlausibleToken } from "@/lib/tokens";
import { capsuleTokenExists } from "@/features/memory-capsule/server/public-service";

export const dynamic = "force-dynamic";

/**
 * Valida el token ANTES del límite de Suspense (loading.tsx) de la página, para que un enlace
 * inválido responda un 404 real (y genérico) en lugar de un 200 con contenido de "no encontrado".
 * Con el módulo desactivado no se consulta la cápsula: la página muestra un aviso amable.
 */
export default async function MemoryTokenLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isPlausibleToken(token)) notFound();
  if ((await isEnabled("MEMORY_CAPSULE_ENABLED")) && !(await capsuleTokenExists(token))) notFound();
  return children;
}
