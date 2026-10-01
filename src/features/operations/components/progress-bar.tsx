import { cn } from "@/lib/utils";
import type { Progress } from "../domain/checklist";

/** Barra de avance accesible (role=progressbar) con texto "3/5 · 60 %". */
export function ProgressBar({
  progress,
  label,
  className,
  showText = true,
  size = "default",
}: {
  progress: Progress;
  label: string;
  className?: string;
  showText?: boolean;
  size?: "sm" | "default";
}) {
  const applicable = progress.total - progress.skipped;
  const tone =
    progress.total === 0
      ? "bg-muted-foreground/30"
      : progress.percent >= 100
        ? "bg-success"
        : progress.percent >= 60
          ? "bg-olive"
          : progress.percent >= 30
            ? "bg-warning"
            : "bg-destructive/70";
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-valuetext={`${progress.done} de ${applicable} tareas (${progress.percent} %)`}
        className={cn("bg-muted relative w-full overflow-hidden rounded-full", size === "sm" ? "h-1.5" : "h-2")}
      >
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${progress.percent}%` }} />
      </div>
      {showText ? (
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {progress.done}/{applicable} · {progress.percent}%
        </span>
      ) : null}
    </div>
  );
}
