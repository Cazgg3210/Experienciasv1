import { NextResponse, type NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { toDateKey } from "@/lib/dates";
import { EVENT_STATUS_LABELS } from "@/lib/labels";
import { logger } from "@/lib/logger";
import { requirePermission } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { financeCsv } from "@/features/financials/domain/finance-csv";
import { FINANCE_EXPORT_LIMIT, getFinanceRows } from "@/features/financials/server/finance-queries";
import { parseFinanceFilters } from "@/features/financials/schemas";
import type { EventStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/** GET /admin/finance/export?month=YYYY-MM&status=... → CSV (permiso financials:read). */
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requirePermission("financials:read");
  } catch (error) {
    const status = error instanceof AppError ? error.status : 401;
    return NextResponse.json(
      {
        error: status === 403 ? "No tienes permiso para exportar finanzas." : "Inicia sesión para continuar.",
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
    const filters = parseFinanceFilters(sp);
    const { rows, truncated } = await getFinanceRows(filters, { limit: FINANCE_EXPORT_LIMIT });
    const csv = financeCsv(rows, {
      statusLabel: (s) => EVENT_STATUS_LABELS[s as EventStatus] ?? s,
      dateKey: toDateKey,
    });
    await audit({
      action: "finance.exported",
      entityType: "Finance",
      after: { ...filters, rows: rows.length, truncated },
      actor: user,
    });
    const name = `finanzas-ivonne-rosa${filters.month ? `-${filters.month}` : ""}${filters.status ? `-${filters.status.toLowerCase()}` : ""}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    logger.error("finance.export_failed", { error });
    return NextResponse.json({ error: "No pudimos generar el archivo. Intenta de nuevo." }, { status: 500 });
  }
}
