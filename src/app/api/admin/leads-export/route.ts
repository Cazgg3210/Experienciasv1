import type { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { toCsv } from "@/lib/csv";
import { localDateKey } from "@/lib/dates";
import { logger } from "@/lib/logger";
import { audit } from "@/server/audit";
import { requirePermission } from "@/server/auth/session";
import { parseLeadFilters, type RawSearchParams } from "@/features/leads/domain/lead-filters";
import { LEAD_CSV_HEADERS, leadCsvRow } from "@/features/leads/domain/lead-export";
import { listLeadsForExport } from "@/features/leads/server/lead-service";

export const dynamic = "force-dynamic";

/** CSV de los leads filtrados (mismos filtros que /admin/leads). Requiere leads:read. */
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("leads:read");
    const sp: RawSearchParams = {};
    for (const key of new Set(req.nextUrl.searchParams.keys())) {
      const all = req.nextUrl.searchParams.getAll(key);
      sp[key] = all.length > 1 ? all : all[0];
    }
    const filters = parseLeadFilters(sp);
    const rows = await listLeadsForExport(user, filters);
    const csv = toCsv(LEAD_CSV_HEADERS, rows.map(leadCsvRow));

    await audit({
      action: "leads.exported",
      entityType: "Lead",
      after: { count: rows.length, filters },
      actor: user,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${localDateKey()}.csv"`,
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    logger.error("leads.export_failed", { error });
    return Response.json({ error: "No pudimos generar el archivo. Intenta de nuevo." }, { status: 500 });
  }
}
