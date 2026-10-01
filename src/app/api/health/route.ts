import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness: el proceso responde. Usado por Docker HEALTHCHECK y Dokploy. */
export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
