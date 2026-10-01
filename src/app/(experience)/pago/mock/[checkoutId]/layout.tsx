import { notFound } from "next/navigation";
import { getPaymentProvider } from "@/server/providers";
import { getMockCheckout } from "@/features/payments/server/queries";

export const dynamic = "force-dynamic";

const CHECKOUT_ID = /^mock_cs_[A-Za-z0-9_-]{6,80}$/;

/**
 * Valida el checkout ANTES de que empiece el streaming (loading.tsx), para responder un 404 real
 * a IDs inválidos o cuando la pasarela activa no es la simulada.
 */
export default async function MockCheckoutLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ checkoutId: string }>;
}) {
  const { checkoutId } = await params;
  if (!CHECKOUT_ID.test(checkoutId) || !getPaymentProvider().isMock) notFound();
  const payment = await getMockCheckout(checkoutId);
  if (!payment || payment.kind === "REFUND") notFound();
  return children;
}
