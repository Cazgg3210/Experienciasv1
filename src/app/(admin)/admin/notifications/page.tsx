import type { Metadata } from "next";
import { Inbox, MailSearch, ShieldAlert } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { Pagination, parsePage } from "@/components/data/pagination";
import { cn } from "@/lib/utils";
import { hasInboxFilters, inboxHref, parseInboxFilters } from "@/features/notifications/domain/inbox-filters";
import {
  INBOX_PAGE_SIZE,
  getNotification,
  listNotifications,
  messagingMockStatus,
} from "@/features/notifications/server/inbox-service";
import { InboxFiltersForm } from "@/features/notifications/components/inbox-filters";
import { InboxList } from "@/features/notifications/components/inbox-list";
import { InboxDetailView } from "@/features/notifications/components/inbox-detail";
import { MarkAllReadButton, RunRemindersButton } from "@/features/notifications/components/inbox-toolbar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bandeja" };

const BASE = "/admin/notifications";

export default async function NotificationsInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePagePermission("notifications:read", BASE);
  const sp = await searchParams;
  const filters = parseInboxFilters(sp);
  const page = parsePage(sp.page);
  const [{ items, total, unreadTotal }, selected] = await Promise.all([
    listNotifications(filters, page),
    filters.id ? getNotification(filters.id) : Promise.resolve(null),
  ]);
  const mock = messagingMockStatus();
  const anyMock = mock.email || mock.whatsapp;
  const canRun = can(user.role, "settings:write");
  const filtered = hasInboxFilters(filters);
  const backHref = inboxHref(BASE, filters, { id: null, page });
  const paginationParams = { ...sp, id: undefined };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Mensajería"
        title="Bandeja"
        description="Cada email y WhatsApp que genera la plataforma: confirmaciones, propuestas, pagos y recordatorios."
        actions={
          <>
            <MarkAllReadButton disabled={unreadTotal === 0} />
            {canRun ? <RunRemindersButton /> : null}
          </>
        }
        className="mb-0"
      />

      {anyMock ? (
        <div role="note" className="bg-sand-soft text-charcoal flex items-start gap-3 rounded-xl border px-4 py-3 text-sm">
          <ShieldAlert className="text-taupe mt-0.5 size-5 shrink-0" aria-hidden />
          <p>
            <span className="font-medium">Modo demo: los mensajes no salen a internet, se guardan aquí.</span>{" "}
            {mock.email && mock.whatsapp
              ? "Email y WhatsApp usan proveedores de prueba."
              : mock.email
                ? "El email usa un proveedor de prueba."
                : "WhatsApp usa un proveedor de prueba."}{" "}
            {mock.whatsapp ? "Usa “Abrir en WhatsApp” para enviar un mensaje a mano desde tu teléfono." : null}
          </p>
        </div>
      ) : null}

      <InboxFiltersForm basePath={BASE} filters={filters} />

      <p className="text-muted-foreground text-sm" aria-live="polite">
        {total} mensaje{total === 1 ? "" : "s"}
        {filtered ? " con estos filtros" : ""} · {unreadTotal} sin leer en total
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
        <section
          aria-label="Lista de mensajes"
          className={cn("bg-card min-w-0 rounded-xl border shadow-xs", filters.id ? "hidden lg:block" : undefined)}
        >
          {items.length === 0 ? (
            <EmptyState
              icon={filtered ? MailSearch : Inbox}
              title={filtered ? "Ningún mensaje coincide" : "Tu bandeja está vacía"}
              description={
                filtered
                  ? "Prueba con otros filtros o límpialos para ver todo."
                  : "Aquí aparecerán los mensajes en cuanto lleguen leads, se envíen propuestas o corran los recordatorios."
              }
              className="border-0"
            />
          ) : (
            <>
              <InboxList items={items} filters={filters} basePath={BASE} page={page} />
              <div className="border-t px-3 pb-3 sm:px-4">
                <Pagination page={page} pageSize={INBOX_PAGE_SIZE} total={total} basePath={BASE} searchParams={paginationParams} />
              </div>
            </>
          )}
        </section>

        <section
          aria-label="Detalle del mensaje"
          className={cn(
            "bg-card min-w-0 rounded-xl border p-4 shadow-xs sm:p-6 lg:sticky lg:top-6 lg:self-start",
            filters.id ? undefined : "hidden lg:block",
          )}
        >
          {selected ? (
            <InboxDetailView n={selected} backHref={backHref} />
          ) : filters.id ? (
            <EmptyState
              icon={MailSearch}
              title="No encontramos ese mensaje"
              description="Puede que el enlace sea antiguo. Elige otro mensaje de la lista."
              className="border-0"
            />
          ) : (
            <div className="text-muted-foreground flex min-h-64 flex-col items-center justify-center gap-2 text-center text-sm">
              <Inbox className="text-olive size-6" aria-hidden />
              <p>Selecciona un mensaje para ver su contenido.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
