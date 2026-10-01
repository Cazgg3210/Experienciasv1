import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/tokens";

/** Firma estilo Stripe: header `x-mock-signature: t=<unix>,v1=<hmac_sha256(t.body)>` */
export function signMockPayload(rawBody: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

export function verifyMockSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
  now = Math.floor(Date.now() / 1000),
): { valid: boolean; reason?: string } {
  if (!header) return { valid: false, reason: "missing_signature" };
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k, v.join("=")];
    }),
  ) as Record<string, string>;
  const t = Number(parts.t);
  if (!parts.t || !parts.v1 || !Number.isFinite(t)) return { valid: false, reason: "malformed_signature" };
  if (Math.abs(now - t) > toleranceSeconds) return { valid: false, reason: "timestamp_out_of_tolerance" };
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return safeEqual(expected, parts.v1) ? { valid: true } : { valid: false, reason: "signature_mismatch" };
}
