import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/data/status-badge";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { diffJson, formatDiffValue, type DiffKind } from "../domain/diff";
import { auditActionLabel, auditActionTone } from "../domain/filters";
import type { AuditRow } from "../server/audit-queries";

const KIND_LABELS: Record<DiffKind, string> = { added: "Agregado", removed: "Eliminado", changed: "Modificado" };
const KIND_CLASSES: Record<DiffKind, string> = {
  added: "bg-success/10 text-success",
  removed: "bg-destructive/10 text-destructive",
  changed: "bg-warning/10 text-warning",
};

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground mb-1 text-xs font-medium">{label}</p>
      <pre className="bg-muted/60 max-h-72 overflow-auto rounded-lg p-3 text-xs leading-relaxed">
        <code>{value === null || value === undefined ? "—" : JSON.stringify(value, null, 2)}</code>
      </pre>
    </div>
  );
}

/** Entrada expandible de la bitácora con diff antes/después (sin JS: <details>). */
export function AuditEntry({ row }: { row: AuditRow }) {
  const diff = diffJson(row.before ?? undefined, row.after ?? undefined);
  const who = row.actor ? row.actor.name : row.actorEmail ?? "Sistema";
  const label = auditActionLabel(row.action);
  return (
    <li>
      <details className="group bg-card rounded-xl border shadow-xs open:shadow-sm">
        <summary className="hover:bg-muted/40 focus-visible:ring-ring/50 flex cursor-pointer list-none items-start gap-3 rounded-xl p-4 outline-none focus-visible:ring-3 [&::-webkit-details-marker]:hidden">
          <ChevronRight
            className="text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
            aria-hidden
          />
          <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={auditActionTone(row.action)}>{label}</StatusBadge>
                <span className="text-muted-foreground text-xs">
                  {row.entityType}
                  {row.entityId ? <span className="font-mono"> · {row.entityId}</span> : null}
                </span>
              </div>
              <p className="text-sm">
                <span className="font-medium">{who}</span>
                {row.actor?.email || row.actorEmail ? (
                  <span className="text-muted-foreground"> · {row.actor?.email ?? row.actorEmail}</span>
                ) : null}
              </p>
            </div>
            <div className="text-muted-foreground text-xs sm:text-right">
              <time dateTime={row.createdAt.toISOString()}>{formatDateTime(row.createdAt)}</time>
              <p>
                {diff.length} cambio{diff.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </summary>
        <div className="space-y-4 border-t p-4">
          <p className="text-muted-foreground text-xs">
            Acción técnica: <code className="bg-muted rounded px-1 py-0.5">{row.action}</code>
            {row.ip ? (
              <>
                {" "}
                · IP <span className="font-mono">{row.ip}</span>
              </>
            ) : null}
          </p>
          {diff.length ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <caption className="sr-only">Diferencias entre antes y después</caption>
                <thead className="bg-muted/50 text-muted-foreground text-xs">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Campo
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Cambio
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Antes
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Después
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {diff.map((d) => (
                    <tr key={d.path} className="align-top">
                      <th scope="row" className="px-3 py-2 font-mono text-xs font-normal break-all">
                        {d.path}
                      </th>
                      <td className="px-3 py-2">
                        <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", KIND_CLASSES[d.kind])}>
                          {KIND_LABELS[d.kind]}
                        </span>
                      </td>
                      <td className="text-muted-foreground px-3 py-2 font-mono text-xs break-all">
                        {d.kind === "added" ? "—" : formatDiffValue(d.before)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs break-all">
                        {d.kind === "removed" ? "—" : formatDiffValue(d.after)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Sin diferencias registradas.</p>
          )}
          <details className="group/raw">
            <summary className="text-olive cursor-pointer text-xs font-medium underline-offset-4 hover:underline">
              Ver JSON completo
            </summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <JsonBlock label="Antes" value={row.before} />
              <JsonBlock label="Después" value={row.after} />
            </div>
          </details>
        </div>
      </details>
    </li>
  );
}
