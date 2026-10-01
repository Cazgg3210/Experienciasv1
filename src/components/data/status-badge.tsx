import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/labels";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-sand-soft text-charcoal border-sand",
  info: "bg-info/10 text-info border-info/20",
  success: "bg-success/10 text-success border-success/25",
  warning: "bg-warning/10 text-warning border-warning/25",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
  brand: "bg-sage-soft text-olive border-sage/40",
  muted: "bg-muted text-muted-foreground border-border",
};

/**
 * Badge de estado accesible (texto + color, nunca sólo color).
 * Uso: <StatusBadge tone={LEAD_STATUS_TONES[s]}>{LEAD_STATUS_LABELS[s]}</StatusBadge>
 */
export function StatusBadge({
  tone = "neutral",
  children,
  className,
  dot = true,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" /> : null}
      {children}
    </span>
  );
}
