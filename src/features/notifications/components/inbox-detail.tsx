import Link from "next/link";
import { AlertTriangle, ArrowLeft, ExternalLink, FileText, Megaphone, MessageCircle, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/data/status-badge";
import { CopyButton } from "@/components/data/copy-button";
import { formatDateTime } from "@/lib/dates";
import { NOTIFICATION_CHANNEL_LABELS, NOTIFICATION_STATUS_LABELS, NOTIFICATION_TYPE_LABELS } from "@/lib/labels";
import { whatsappLink } from "@/server/providers/whatsapp/links";
import { NOTIFICATION_STATUS_TONES } from "../domain/inbox-filters";
import type { InboxDetail } from "../server/inbox-service";
import { AutoMarkRead, FocusDetailOnMobile, ToggleReadButton } from "./read-controls";

/** Sólo enlaces http(s) o rutas internas (nunca javascript:, data:, etc.). */
function safeHref(url: string | null): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) || (url.startsWith("/") && !url.startsWith("//")) ? url : null;
}

export function InboxDetailView({ n, backHref }: { n: InboxDetail; backHref: string }) {
  const isWhatsApp = n.channel === "WHATSAPP";
  const actionHref = safeHref(n.actionUrl);
  const meta: Array<[string, React.ReactNode]> = [
    ["Para", <span key="to" className="break-all">{n.to}</span>],
    ["Canal", NOTIFICATION_CHANNEL_LABELS[n.channel]],
    ["Tipo", NOTIFICATION_TYPE_LABELS[n.type]],
    ["Proveedor", n.provider],
    ["Creado", formatDateTime(n.createdAt)],
    ["Enviado", n.sentAt ? formatDateTime(n.sentAt) : "—"],
    ["Leído en bandeja", n.readAt ? formatDateTime(n.readAt) : "No"],
  ];
  return (
    <article aria-labelledby="inbox-detail-title" className="space-y-5">
      <AutoMarkRead id={n.id} unread={!n.readAt} />
      <FocusDetailOnMobile targetId="inbox-detail-title" messageId={n.id} />
      <Link href={backHref} scroll={false} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm lg:hidden">
        <ArrowLeft className="size-4" aria-hidden />
        Volver a la bandeja
      </Link>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={NOTIFICATION_STATUS_TONES[n.status]}>{NOTIFICATION_STATUS_LABELS[n.status]}</StatusBadge>
          <StatusBadge tone={isWhatsApp ? "success" : "neutral"} dot={false}>
            {NOTIFICATION_CHANNEL_LABELS[n.channel]}
          </StatusBadge>
        </div>
        <h2 id="inbox-detail-title" tabIndex={-1} className="font-heading scroll-mt-4 text-2xl leading-tight font-semibold text-balance outline-none">
          {n.subject || (isWhatsApp ? "Mensaje de WhatsApp" : "(Sin asunto)")}
        </h2>
      </header>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {meta.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="text-muted-foreground w-32 shrink-0">{k}</dt>
            <dd className="min-w-0">{v}</dd>
          </div>
        ))}
      </dl>

      {n.error ? (
        <p role="note" className="border-warning/30 bg-warning/10 text-warning flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {n.status === "SKIPPED" ? "Omitido: " : "Error: "}
            {n.error}
          </span>
        </p>
      ) : null}

      <section aria-label="Contenido del mensaje" className="bg-ivory rounded-xl border p-4 sm:p-5">
        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{n.body}</p>
      </section>

      <div className="flex flex-wrap gap-2">
        {isWhatsApp ? (
          <Button asChild size="lg">
            <a href={whatsappLink(n.to, n.body)} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden />
              Abrir en WhatsApp
              <span className="sr-only">(se abre en una pestaña nueva)</span>
            </a>
          </Button>
        ) : null}
        {actionHref ? (
          <Button asChild variant="outline" size="lg">
            <a href={actionHref} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden />
              Abrir enlace del mensaje
              <span className="sr-only">(se abre en una pestaña nueva)</span>
            </a>
          </Button>
        ) : null}
        <CopyButton value={n.body} size="lg" label="Copiar texto" toastMessage="Texto copiado" />
        <ToggleReadButton id={n.id} read={!!n.readAt} />
      </div>

      {n.actionUrl ? (
        <p className="text-muted-foreground text-xs break-all">
          Enlace: <span className="font-mono">{n.actionUrl}</span>
        </p>
      ) : null}

      {n.lead || n.quote || n.event ? (
        <section aria-labelledby="inbox-related" className="border-t pt-4">
          <h3 id="inbox-related" className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Relacionado
          </h3>
          <ul className="flex flex-wrap gap-2">
            {n.lead ? (
              <li>
                <Link href={`/admin/leads/${n.lead.id}`} className="hover:bg-muted inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm">
                  <Megaphone className="size-3.5" aria-hidden />
                  Lead {n.lead.code}
                </Link>
              </li>
            ) : null}
            {n.quote ? (
              <li>
                <Link href={`/admin/quotes/${n.quote.id}`} className="hover:bg-muted inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm">
                  <FileText className="size-3.5" aria-hidden />
                  Cotización {n.quote.code}
                </Link>
              </li>
            ) : null}
            {n.event ? (
              <li>
                <Link href={`/admin/events/${n.event.id}`} className="hover:bg-muted inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm">
                  <PartyPopper className="size-3.5" aria-hidden />
                  {n.event.title} · {n.event.code}
                </Link>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
