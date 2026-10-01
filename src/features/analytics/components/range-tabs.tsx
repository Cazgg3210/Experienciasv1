import Link from "next/link";
import { cn } from "@/lib/utils";
import { RANGE_OPTIONS, type RangeDays } from "../domain/metrics";

/** Selector de rango (7/30/90 días) por enlaces: funciona sin JS y conserva la URL compartible. */
export function RangeTabs({ value, basePath }: { value: RangeDays; basePath: string }) {
  return (
    <nav aria-label="Rango de fechas" className="bg-muted/60 inline-flex rounded-full border p-1">
      {RANGE_OPTIONS.map((r) => {
        const active = r === value;
        return (
          <Link
            key={r}
            href={`${basePath}?range=${r}`}
            aria-current={active ? "page" : undefined}
            scroll={false}
            className={cn(
              "focus-visible:ring-ring/50 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 motion-reduce:transition-none",
              active ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {r} días
          </Link>
        );
      })}
    </nav>
  );
}
