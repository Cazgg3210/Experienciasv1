import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Estado vacío cálido y con siguiente paso claro. */
export function EmptyState({
  title,
  description,
  icon: Icon = Sparkles,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-card/60 flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <div className="bg-sage-soft text-olive mb-4 flex size-12 items-center justify-center rounded-full">
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="font-heading text-xl font-semibold">{title}</h3>
      {description ? <p className="text-muted-foreground mt-1 max-w-md text-sm">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
