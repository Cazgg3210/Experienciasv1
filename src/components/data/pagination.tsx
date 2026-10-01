import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Paginación por enlaces (funciona sin JS, conserva filtros de searchParams).
 * <Pagination page={2} pageSize={25} total={130} basePath="/admin/leads" searchParams={sp} />
 */
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  searchParams = {},
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === "page" || v == null) continue;
      if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
      else params.set(k, v);
    }
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const linkCls = "inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-sm hover:bg-muted";
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3 pt-4">
      <p className="text-muted-foreground text-sm">
        {from}–{to} de {total}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={linkCls} rel="prev">
            <ChevronLeft className="size-4" aria-hidden /> Anterior
          </Link>
        ) : (
          <span className={cn(linkCls, "pointer-events-none opacity-40")} aria-disabled>
            <ChevronLeft className="size-4" aria-hidden /> Anterior
          </span>
        )}
        <span className="text-sm tabular-nums">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className={linkCls} rel="next">
            Siguiente <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <span className={cn(linkCls, "pointer-events-none opacity-40")} aria-disabled>
            Siguiente <ChevronRight className="size-4" aria-hidden />
          </span>
        )}
      </div>
    </nav>
  );
}

/** Lee page de searchParams de forma segura */
export function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 10_000) : 1;
}
