import { notFound } from "next/navigation";
import { loadPublicQuote } from "@/features/quotes/server/public-quote";

export const dynamic = "force-dynamic";

/**
 * Valida el token ANTES del límite de carga (loading.tsx) para responder un 404 real
 * a tokens inválidos, borradores o inexistentes.
 */
export default async function QuoteTokenLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const quote = await loadPublicQuote(token);
  if (!quote) notFound();
  return children;
}
