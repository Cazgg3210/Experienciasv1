import type { Metadata } from "next";
import Link from "next/link";
import { Download, Megaphone, SearchX } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { Pagination, parsePage } from "@/components/data/pagination";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import {
  countLeadsByStatus,
  listAssignableUsers,
  listLeads,
  listLeadsForKanban,
  LEADS_PAGE_SIZE,
} from "@/features/leads/server/lead-service";
import { getLeadFormOptions } from "@/features/leads/server/lead-queries";
import {
  hasAnyFilter,
  leadFiltersToSearchParams,
  parseLeadFilters,
  type RawSearchParams,
} from "@/features/leads/domain/lead-filters";
import { LeadStatusSummary } from "@/features/leads/components/lead-status-summary";
import { LeadFiltersBar } from "@/features/leads/components/lead-filters-bar";
import { LeadsTable } from "@/features/leads/components/leads-table";
import { LeadsKanban } from "@/features/leads/components/leads-kanban";
import { LeadViewToggle } from "@/features/leads/components/lead-view-toggle";
import { NewLeadDialog } from "@/features/leads/components/new-lead-dialog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requirePagePermission("leads:read", "/admin/leads");
  const sp = await searchParams;
  const filters = parseLeadFilters(sp);
  const view = sp.view === "kanban" ? "kanban" : "table";
  const canWrite = can(user.role, "leads:write");
  const now = new Date();

  const [counts, assignees, formOptions] = await Promise.all([
    countLeadsByStatus(user, filters),
    listAssignableUsers(),
    canWrite ? getLeadFormOptions() : Promise.resolve(null),
  ]);

  const exportQs = leadFiltersToSearchParams(filters).toString();
  const filtered = hasAnyFilter(filters);

  let content: React.ReactNode;
  if (view === "kanban") {
    const columns = await listLeadsForKanban(user, filters, { counts });
    const empty = columns.every((c) => c.total === 0);
    content = empty ? (
      <NoResults filtered={filtered} />
    ) : (
      <LeadsKanban columns={columns} canWrite={canWrite} now={now} />
    );
  } else {
    const result = await listLeads(user, filters, { page: parsePage(sp.page), pageSize: LEADS_PAGE_SIZE });
    content =
      result.total === 0 ? (
        <NoResults filtered={filtered} />
      ) : (
        <>
          <LeadsTable leads={result.items} now={now} />
          <Pagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            basePath="/admin/leads"
            searchParams={sp}
          />
        </>
      );
  }

  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Leads"
        description="Cada solicitud es una celebración por diseñar. Da seguimiento, asigna y convierte en cotización."
        actions={
          <>
            <Button asChild variant="outline" size="lg">
              <a href={`/api/admin/leads-export${exportQs ? `?${exportQs}` : ""}`} download>
                <Download aria-hidden />
                Exportar CSV
              </a>
            </Button>
            {canWrite && formOptions ? <NewLeadDialog options={formOptions} /> : null}
          </>
        }
      />
      <LeadStatusSummary counts={counts} filters={filters} view={view} />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <LeadViewToggle view={view} filters={filters} />
      </div>
      <LeadFiltersBar filters={filters} view={view} assignees={assignees} />
      {content}
    </>
  );
}

function NoResults({ filtered }: { filtered: boolean }) {
  return filtered ? (
    <EmptyState
      icon={SearchX}
      title="Ningún lead coincide"
      description="Prueba con otra búsqueda o quita algunos filtros para ver más resultados."
      action={
        <Button asChild variant="outline">
          <Link href="/admin/leads">Limpiar filtros</Link>
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={Megaphone}
      title="Aún no hay leads"
      description="Cuando alguien pida disponibilidad desde el sitio, el configurador o el diseñador IA, aparecerá aquí. También puedes registrar uno a mano con “Nuevo lead”."
    />
  );
}
