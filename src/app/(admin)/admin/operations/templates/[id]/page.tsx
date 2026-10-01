import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/data/status-badge";
import { CHECKLIST_PHASE_LABELS } from "@/lib/labels";
import { can } from "@/server/auth/permissions";
import { requirePagePermission } from "@/server/auth/session";
import { getTemplate, listExperienceOptions } from "@/features/operations/server/ops-queries";
import { EditTemplateForm } from "@/features/operations/components/template-form";
import { TemplateItems } from "@/features/operations/components/template-items";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plantilla de checklist" };

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission("operations:read", `/admin/operations/templates/${id}`);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound();
  const [template, experiences] = await Promise.all([getTemplate(id), listExperienceOptions()]);
  if (!template) notFound();
  const canWrite = can(user.role, "checklists:write");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Plantilla · ${CHECKLIST_PHASE_LABELS[template.phase]}`}
        title={template.name}
        description={template.experience ? `Sólo para ${template.experience.name}.` : "Aplica a todas las experiencias."}
        back={{ href: "/admin/operations/templates", label: "Plantillas" }}
        actions={<StatusBadge tone={template.active ? "success" : "muted"}>{template.active ? "Activa" : "Inactiva"}</StatusBadge>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section aria-labelledby="datos" className="bg-card h-fit rounded-2xl border p-5 shadow-xs">
          <h2 id="datos" className="font-heading mb-4 text-xl font-semibold">
            Datos de la plantilla
          </h2>
          <EditTemplateForm
            template={{
              id: template.id,
              name: template.name,
              phase: template.phase,
              description: template.description,
              experienceId: template.experienceId,
              active: template.active,
              sortOrder: template.sortOrder,
            }}
            experiences={experiences}
            canWrite={canWrite}
          />
        </section>
        <section aria-labelledby="tareas" className="space-y-3">
          <div>
            <h2 id="tareas" className="font-heading text-xl font-semibold">
              Tareas ({template.items.length})
            </h2>
            <p className="text-muted-foreground text-sm">
              Al generar el checklist de un evento, cada tarea vence en «inicio del evento ± desfase» y se asigna a quien tenga la
              función por defecto.
            </p>
          </div>
          <TemplateItems
            templateId={template.id}
            canWrite={canWrite}
            items={template.items.map((i) => ({
              id: i.id,
              title: i.title,
              description: i.description,
              area: i.area,
              offsetMinutes: i.offsetMinutes,
              defaultFunction: i.defaultFunction,
              requiresEvidence: i.requiresEvidence,
              sortOrder: i.sortOrder,
            }))}
          />
        </section>
      </div>
    </div>
  );
}
