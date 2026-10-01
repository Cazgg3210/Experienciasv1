import type { Metadata } from "next";
import { AlertTriangle, Pencil, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/data/status-badge";
import { cn } from "@/lib/utils";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { EMPTY_BUDGET, listBudgetRangesForAdmin, nextSortOrder } from "@/features/catalog/server/queries";
import { budgetRangeIssues, formatBudgetRange } from "@/features/catalog/domain/budget-label";
import { ActiveToggle, DeleteCatalogButton } from "@/features/catalog/components/catalog-actions";
import { BudgetDialog } from "@/features/catalog/components/budget-dialog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rangos de presupuesto" };

export default async function CatalogBudgetsPage() {
  const user = await requirePagePermission("catalog:read", "/admin/catalog/budgets");
  const canWrite = can(user.role, "catalog:write");
  const [ranges, sortOrder] = await Promise.all([listBudgetRangesForAdmin(), nextSortOrder("budgetRange")]);
  const issues = budgetRangeIssues(ranges);

  const newButton = canWrite ? (
    <BudgetDialog
      mode="create"
      defaultValues={{ ...EMPTY_BUDGET, sortOrder }}
      trigger={
        <Button size="lg">
          <Plus aria-hidden />
          Nuevo rango
        </Button>
      }
    />
  ) : null;

  return (
    <>
      <PageHeader
        title="Rangos de presupuesto"
        description="Opciones que eligen las clientas al pedir su cotización; nos ayudan a priorizar leads."
        actions={newButton}
      />
      {issues.length ? (
        <div role="status" className="border-warning/40 bg-warning/10 mb-4 flex gap-3 rounded-xl border p-3 text-sm">
          <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Revisa los rangos activos</p>
            <ul className="text-muted-foreground mt-1 list-disc space-y-0.5 pl-4">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {ranges.length ? (
        <ol className="divide-y rounded-2xl border bg-card shadow-xs">
          {ranges.map((r) => (
            <li key={r.id} className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-center", !r.active && "opacity-80")}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium">{r.label}</h2>
                  {!r.active ? <StatusBadge tone="muted">Inactivo</StatusBadge> : null}
                </div>
                <p className="text-muted-foreground tabular text-sm">
                  {formatBudgetRange(r.minCents, r.maxCents)} · {r.leads} {r.leads === 1 ? "lead" : "leads"}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <ActiveToggle entity="budgetRange" id={r.id} name={r.label} active={r.active} disabled={!canWrite} />
                {canWrite ? (
                  <div className="flex gap-1">
                    <BudgetDialog
                      mode="edit"
                      budgetId={r.id}
                      defaultValues={r.values}
                      trigger={
                        <Button variant="outline" size="lg" aria-label={`Editar ${r.label}`}>
                          <Pencil aria-hidden />
                          Editar
                        </Button>
                      }
                    />
                    <DeleteCatalogButton entity="budgetRange" id={r.id} name={r.label} compact />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          icon={Wallet}
          title="Aún no hay rangos de presupuesto"
          description="Crea rangos como “Hasta $15,000” o “$15,000 – $20,000” para que las clientas indiquen su presupuesto."
          action={newButton}
        />
      )}
    </>
  );
}
