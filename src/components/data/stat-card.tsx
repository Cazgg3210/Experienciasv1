import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** KPI del dashboard. `tone="danger"` para márgenes negativos (nunca se ocultan). */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
  className?: string;
}) {
  return (
    <div className={cn("bg-card rounded-xl border p-4 shadow-xs sm:p-5", className)}>
      <div className="text-muted-foreground flex items-center justify-between gap-2 text-sm">
        <span>{label}</span>
        {Icon ? <Icon className="size-4" aria-hidden /> : null}
      </div>
      <div
        className={cn(
          "tabular mt-2 text-2xl font-semibold tracking-tight sm:text-3xl",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </div>
      {hint ? <div className="text-muted-foreground mt-1 text-xs">{hint}</div> : null}
    </div>
  );
}
