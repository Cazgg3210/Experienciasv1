import Link from "next/link";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NOTIFICATION_CHANNEL_LABELS, NOTIFICATION_STATUS_LABELS, NOTIFICATION_TYPE_LABELS } from "@/lib/labels";
import { NativeSelect } from "@/features/settings/components/native-select";
import { hasInboxFilters, type InboxFilters } from "../domain/inbox-filters";
import { NOTIFICATION_CHANNELS, NOTIFICATION_STATUSES, NOTIFICATION_TYPES } from "../domain/inbox-types";

export function InboxFiltersForm({ basePath, filters }: { basePath: string; filters: InboxFilters }) {
  return (
    <form method="get" action={basePath} role="search" aria-label="Filtrar mensajes" className="bg-card rounded-xl border p-3 shadow-xs sm:p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="inbox-q">Buscar</Label>
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
            <Input id="inbox-q" name="q" type="search" defaultValue={filters.q ?? ""} placeholder="Destinatario o asunto" className="pl-8" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inbox-channel">Canal</Label>
          <NativeSelect id="inbox-channel" name="channel" defaultValue={filters.channel ?? ""}>
            <option value="">Todos</option>
            {NOTIFICATION_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {NOTIFICATION_CHANNEL_LABELS[c]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inbox-type">Tipo</Label>
          <NativeSelect id="inbox-type" name="type" defaultValue={filters.type ?? ""}>
            <option value="">Todos</option>
            {NOTIFICATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {NOTIFICATION_TYPE_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inbox-status">Estado</Label>
          <NativeSelect id="inbox-status" name="status" defaultValue={filters.status ?? ""}>
            <option value="">Todos</option>
            {NOTIFICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {NOTIFICATION_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="unread"
            value="1"
            defaultChecked={filters.unread}
            className="accent-olive size-4 rounded"
          />
          Sólo no leídos
        </label>
        <div className="flex gap-2 sm:ml-auto">
          {hasInboxFilters(filters) ? (
            <Button asChild variant="ghost" size="lg">
              <Link href={basePath}>
                <X aria-hidden />
                Limpiar
              </Link>
            </Button>
          ) : null}
          <Button type="submit" size="lg">
            Filtrar
          </Button>
        </div>
      </div>
    </form>
  );
}
