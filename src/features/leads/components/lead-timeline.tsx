import {
  ArrowRightLeft,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Send,
  Settings2,
  Sparkles,
  StickyNote,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import type { LeadActivityType, LeadStatus } from "@prisma/client";
import { LEAD_ACTIVITY_LABELS, LEAD_STATUS_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { relativeTime } from "../domain/format";

const ICONS: Record<LeadActivityType, LucideIcon> = {
  CREATED: Sparkles,
  STATUS_CHANGE: ArrowRightLeft,
  NOTE: StickyNote,
  CALL: Phone,
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  QUOTE_CREATED: FileText,
  QUOTE_SENT: Send,
  ASSIGNED: UserCheck,
  SYSTEM: Settings2,
};

const TONES: Partial<Record<LeadActivityType, string>> = {
  CREATED: "bg-sage-soft text-olive",
  STATUS_CHANGE: "bg-sand-soft text-charcoal",
  CALL: "bg-info/10 text-info",
  WHATSAPP: "bg-success/10 text-success",
  EMAIL: "bg-info/10 text-info",
  QUOTE_CREATED: "bg-sage-soft text-olive",
  QUOTE_SENT: "bg-sage-soft text-olive",
};

export type TimelineActivity = {
  id: string;
  type: LeadActivityType;
  message: string | null;
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus | null;
  createdAt: Date;
  actor: { name: string } | null;
};

/** Timeline de actividad del lead (más reciente primero). */
export function LeadTimeline({ activities, now = new Date() }: { activities: TimelineActivity[]; now?: Date }) {
  if (!activities.length) {
    return <p className="text-muted-foreground text-sm">Todavía no hay actividad registrada.</p>;
  }
  return (
    <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-4 before:w-px before:bg-border">
      {activities.map((a) => {
        const Icon = ICONS[a.type];
        const title =
          a.type === "STATUS_CHANGE" && a.toStatus
            ? a.fromStatus
              ? `${LEAD_STATUS_LABELS[a.fromStatus]} → ${LEAD_STATUS_LABELS[a.toStatus]}`
              : `Estado: ${LEAD_STATUS_LABELS[a.toStatus]}`
            : LEAD_ACTIVITY_LABELS[a.type];
        return (
          <li key={a.id} className="relative flex gap-3">
            <span
              className={cn(
                "ring-background relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4",
                TONES[a.type] ?? "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-sm font-medium">{title}</p>
                <time dateTime={a.createdAt.toISOString()} title={formatDateTime(a.createdAt)} className="text-muted-foreground text-xs">
                  {relativeTime(a.createdAt, now)}
                </time>
              </div>
              {a.message ? <p className="text-muted-foreground mt-0.5 text-sm break-words whitespace-pre-line">{a.message}</p> : null}
              <p className="text-muted-foreground mt-0.5 text-xs">{a.actor?.name ?? "Sistema"}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
