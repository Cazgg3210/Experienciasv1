import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ListChecks } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/data/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { CHECKLIST_PHASE_LABELS, CHECKLIST_PHASE_ORDER } from "@/lib/labels";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { listExperienceOptions, listTemplates } from "@/features/operations/server/ops-queries";
import { NewTemplateDialog } from "@/features/operations/components/template-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plantillas de checklist" };

export default async function TemplatesPage() {
  const user = await requirePagePermission("operations:read", "/admin/operations/templates");
  const canWrite = can(user.role, "checklists:write");
  const [templates, experiences] = await Promise.all([listTemplates(), canWrite ? listExperienceOptions() : Promise.resolve([])]);

  const byPhase = CHECKLIST_PHASE_ORDER.map((phase) => ({
    phase,
    templates: templates.filter((t) => t.phase === phase),
  })).filter((g) => g.templates.length > 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operación"
        title="Plantillas de checklist"
        description="Las tareas modelo que se copian a cada evento al confirmarse: generales o específicas de una experiencia."
        back={{ href: "/admin/operations", label: "Operaciones" }}
        actions={canWrite ? <NewTemplateDialog experiences={experiences} /> : null}
      />

      {templates.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Aún no hay plantillas"
          description="Crea una plantilla por fase (T-7, T-3, montaje, evento…) y agrégale sus tareas."
          action={canWrite ? <NewTemplateDialog experiences={experiences} /> : undefined}
        />
      ) : (
        byPhase.map((g) => (
          <section key={g.phase} aria-labelledby={`fase-${g.phase}`} className="space-y-3">
            <h2 id={`fase-${g.phase}`} className="font-heading text-xl font-semibold">
              {CHECKLIST_PHASE_LABELS[g.phase]}
            </h2>
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {g.templates.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/admin/operations/templates/${t.id}`}
                    className="bg-card hover:border-olive/40 focus-visible:ring-ring/50 group flex h-full flex-col gap-2 rounded-2xl border p-4 shadow-xs transition-colors outline-none focus-visible:ring-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{t.name}</p>
                      <ChevronRight className="text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </div>
                    {t.description ? <p className="text-muted-foreground line-clamp-2 text-sm">{t.description}</p> : null}
                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                      <StatusBadge tone={t.active ? "success" : "muted"}>{t.active ? "Activa" : "Inactiva"}</StatusBadge>
                      <StatusBadge tone="neutral" dot={false}>
                        {t._count.items} {t._count.items === 1 ? "tarea" : "tareas"}
                      </StatusBadge>
                      <StatusBadge tone="brand" dot={false}>
                        {t.experience ? t.experience.name : "Todas las experiencias"}
                      </StatusBadge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
