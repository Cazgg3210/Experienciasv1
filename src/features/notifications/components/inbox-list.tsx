import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import { StatusBadge } from "@/components/data/status-badge";
import { formatDateTime } from "@/lib/dates";
import { NOTIFICATION_STATUS_LABELS, NOTIFICATION_TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { NOTIFICATION_STATUS_TONES, inboxHref, previewText, type InboxFilters } from "../domain/inbox-filters";
import type { InboxListItem } from "../server/inbox-service";

export function InboxList({
  items,
  filters,
  basePath,
  page,
}: {
  items: InboxListItem[];
  filters: InboxFilters;
  basePath: string;
  page: number;
}) {
  return (
    <ul className="divide-y" aria-label="Mensajes">
      {items.map((n) => {
        const selected = filters.id === n.id;
        const unread = !n.readAt;
        const Icon = n.channel === "WHATSAPP" ? MessageCircle : Mail;
        const title = n.subject || previewText(n.body, 80);
        return (
          <li key={n.id}>
            <Link
              href={inboxHref(basePath, filters, { id: n.id, page })}
              scroll={false}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "focus-visible:ring-ring/50 block px-3 py-3 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-inset sm:px-4",
                selected ? "bg-sage-soft/70" : "hover:bg-muted/50",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                    n.channel === "WHATSAPP" ? "bg-success/10 text-success" : "bg-sand-soft text-taupe",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  <span className="sr-only">{n.channel === "WHATSAPP" ? "WhatsApp" : "Email"}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {unread ? (
                      <>
                        <span className="bg-olive size-2 shrink-0 rounded-full" aria-hidden />
                        <span className="sr-only">No leído:</span>
                      </>
                    ) : null}
                    <p className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>{title}</p>
                  </div>
                  <p className="text-muted-foreground truncate text-xs">Para: {n.to}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StatusBadge tone={NOTIFICATION_STATUS_TONES[n.status]} className="h-5 px-2 text-[11px]">
                      {NOTIFICATION_STATUS_LABELS[n.status]}
                    </StatusBadge>
                    <span className="text-muted-foreground text-[11px]">{NOTIFICATION_TYPE_LABELS[n.type]}</span>
                    <span className="text-muted-foreground text-[11px] tabular-nums sm:hidden">
                      · {formatDateTime(n.createdAt)}
                    </span>
                  </div>
                </div>
                <time dateTime={n.createdAt.toISOString()} className="text-muted-foreground hidden shrink-0 text-[11px] tabular-nums sm:block">
                  {formatDateTime(n.createdAt)}
                </time>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
