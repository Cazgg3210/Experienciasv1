import "server-only";
import { createHmac } from "node:crypto";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/tokens";

type MediaLike = {
  id: string;
  driver: "S3" | "LOCAL" | "EXTERNAL";
  url: string | null;
  storageKey: string | null;
  visibility: "PUBLIC" | "PRIVATE";
};

function secret(): string {
  return env().AUTH_SECRET ?? "dev-only-media-secret";
}

function sign(id: string, exp: number): string {
  return createHmac("sha256", secret()).update(`media:${id}:${exp}`).digest("base64url");
}

/**
 * URL firmada de la app (expira) para servir un MediaAsset privado vía /api/media/[id].
 * Sólo debe generarse DESPUÉS de autorizar al visitante (admin, token de portal, etc.).
 */
export function signedMediaPath(id: string, ttlSeconds = 60 * 60 * 6): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `/api/media/${id}?exp=${exp}&sig=${sign(id, exp)}`;
}

export function verifyMediaSignature(id: string, exp: string | null, sig: string | null): boolean {
  if (!exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Math.floor(Date.now() / 1000)) return false;
  return safeEqual(sign(id, expNum), sig);
}

/** URL para mostrar un asset: externo/placeholder directo, público con CDN, o firmado. */
export function mediaUrl(asset: MediaLike, ttlSeconds?: number): string {
  if (asset.driver === "EXTERNAL" && asset.url) return asset.url;
  const publicBase = env().STORAGE_PUBLIC_URL;
  if (asset.visibility === "PUBLIC" && publicBase && asset.storageKey) {
    return `${publicBase.replace(/\/$/, "")}/${asset.storageKey}`;
  }
  return signedMediaPath(asset.id, ttlSeconds);
}
