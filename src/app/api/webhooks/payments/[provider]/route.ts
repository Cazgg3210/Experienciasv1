import { NextResponse } from "next/server";
import { newErrorId } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { handlePaymentWebhook } from "@/features/payments/server/webhook-service";
import { MP_QUERY_DATA_ID_HEADER } from "@/server/providers/payments/mercadopago-provider";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 256 * 1024;

/**
 * Webhooks de pagos: /api/webhooks/payments/{mock|stripe|mercadopago}
 * Verifica firma sobre el cuerpo crudo + idempotencia (WebhookEvent). Sin CSRF (lo firma el proveedor).
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!/^[a-z]{2,20}$/.test(provider)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const length = Number(req.headers.get("content-length") ?? "0");
    if (length > MAX_BODY_BYTES) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    const headers = new Headers(req.headers);
    // Mercado Pago firma el `data.id` de la query string: se reenvía al proveedor (siempre sobrescrito,
    // nunca el valor que mande el cliente; además va dentro del HMAC, así que no se puede falsificar).
    headers.delete(MP_QUERY_DATA_ID_HEADER);
    const queryDataId = new URL(req.url).searchParams.get("data.id");
    if (queryDataId && queryDataId.length <= 64) headers.set(MP_QUERY_DATA_ID_HEADER, queryDataId);
    const result = await handlePaymentWebhook(provider, raw, headers);
    return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const errorId = newErrorId();
    logger.error("payments.webhook_route_failed", { error, errorId, provider });
    return NextResponse.json({ error: "internal_error", errorId }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405, headers: { Allow: "POST" } });
}
