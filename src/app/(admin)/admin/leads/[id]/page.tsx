import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  ClipboardList,
  FilePlus2,
  FileText,
  History,
  MessageSquarePlus,
  Phone,
  Settings2,
  ShoppingBasket,
  UserRound,
  Wand2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { formatDateTime, formatLongDate, toDateKey } from "@/lib/dates";
import { formatMXN } from "@/lib/money";
import { LEAD_SOURCE_LABELS, QUOTE_STATUS_LABELS, QUOTE_STATUS_TONES } from "@/lib/labels";
import {
  getLeadDetail,
  getLeadFormOptions,
  resolveAiDesigns,
  resolveLeadSnapshot,
} from "@/features/leads/server/lead-queries";
import { listAssignableUsers } from "@/features/leads/server/lead-service";
import { occasionText } from "@/features/leads/domain/lead-export";
import { guestsLabel, relativeTime } from "@/features/leads/domain/format";
import { Panel, DetailList } from "@/features/leads/components/panel";
import { LeadFlagBadges, LeadStatusBadge } from "@/features/leads/components/lead-badges";
import { LeadContactCard } from "@/features/leads/components/lead-contact-card";
import { LeadStatusControl } from "@/features/leads/components/lead-status-control";
import { LeadAssignControl } from "@/features/leads/components/lead-assign-control";
import { LeadActivityForm } from "@/features/leads/components/lead-activity-form";
import { LeadTimeline } from "@/features/leads/components/lead-timeline";
import { AiDesignCard, LeadSnapshotCard } from "@/features/leads/components/lead-snapshot-card";
import { LeadEditDialog } from "@/features/leads/components/lead-edit-dialog";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Detalle del lead" };

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

export default async function LeadDetailPage({ params }: Props) {
  const user = await requirePagePermission("leads:read");
  const { id } = await params;
  const lead = await getLeadDetail(user, id);
  if (!lead) notFound();

  const canWrite = can(user.role, "leads:write");
  const canQuote = can(user.role, "quotes:write");
  const canSeeQuotes = can(user.role, "quotes:read");
  const canSeeCustomer = can(user.role, "customers:read");
  const now = new Date();

  const [snapshot, assignees, formOptions] = await Promise.all([
    resolveLeadSnapshot(user, lead),
    listAssignableUsers(),
    canWrite ? getLeadFormOptions() : Promise.resolve(null),
  ]);
  const aiDesigns = resolveAiDesigns(lead);
  const assigneeOptions = assignees.some((u) => u.id === lead.assignedToId) || !lead.assignedTo
    ? assignees
    : [...assignees, { id: lead.assignedTo.id, name: `${lead.assignedTo.name} (inactiva)`, role: "OWNER" as const }];

  const zone = lead.serviceArea ? (
    <span className="inline-flex flex-wrap items-center gap-2">
      {lead.serviceArea.name}
      {!lead.serviceArea.active ? <Muted>(zona inactiva)</Muted> : null}
    </span>
  ) : lead.zoneText ? (
    lead.zoneText
  ) : (
    <Muted>Sin definir</Muted>
  );

  const details = [
    { label: "Ocasión", value: occasionText(lead.occasion, lead.occasionOther) },
    { label: "Fecha del evento", value: lead.eventDate ? formatLongDate(lead.eventDate) : <Muted>Por definir</Muted> },
    { label: "Invitadas", value: lead.guestCount ? guestsLabel(lead.guestCount) : <Muted>Por definir</Muted> },
    {
      label: "Zona",
      value: (
        <span className="inline-flex flex-wrap items-center gap-2">
          {zone}
          <LeadFlagBadges outOfArea={lead.outOfArea} specialRequest={false} />
        </span>
      ),
    },
    { label: "Experiencia", value: lead.experience?.name ?? <Muted>Sin elegir</Muted> },
    { label: "Estilo", value: lead.style?.name ?? <Muted>Sin elegir</Muted> },
    { label: "Menú", value: lead.menu?.name ?? <Muted>Sin elegir</Muted> },
    {
      label: "Presupuesto",
      value: (
        <span>
          {lead.budgetRange?.label ?? <Muted>Sin definir</Muted>}
          {lead.estimatedTotalCents != null ? (
            <span className="text-muted-foreground block text-xs">Estimado: {formatMXN(lead.estimatedTotalCents)}</span>
          ) : null}
          {lead.budgetNotes ? <span className="text-muted-foreground block text-xs">{lead.budgetNotes}</span> : null}
        </span>
      ),
    },
    { label: "Homenajeada", value: lead.honoreeName ?? <Muted>—</Muted> },
    {
      label: "Colores",
      value: lead.colors.length ? (
        <span className="flex flex-wrap gap-1">
          {lead.colors.map((c) => (
            <span key={c} className="bg-sand-soft rounded-full px-2 py-0.5 text-xs">
              {c}
            </span>
          ))}
        </span>
      ) : (
        <Muted>—</Muted>
      ),
    },
    { label: "Origen", value: LEAD_SOURCE_LABELS[lead.source] },
    {
      label: "Referido / UTM",
      value:
        lead.referredByCode || lead.utmSource ? (
          <span>
            {lead.referredByCode ? <span className="font-mono text-xs">{lead.referredByCode}</span> : null}
            {lead.referredByCode && lead.utmSource ? " · " : null}
            {lead.utmSource ? <span>utm: {lead.utmSource}</span> : null}
          </span>
        ) : (
          <Muted>—</Muted>
        ),
    },
  ];

  const editValues = {
    leadId: lead.id,
    name: lead.name,
    phone: lead.phone ?? "",
    email: lead.email ?? "",
    occasion: lead.occasion,
    occasionOther: lead.occasionOther ?? "",
    eventDate: lead.eventDate ? toDateKey(lead.eventDate) : "",
    guestCount: lead.guestCount ?? "",
    budgetRangeId: lead.budgetRangeId ?? "",
    serviceAreaId: lead.serviceAreaId ?? (lead.zoneText ? "__other" : ""),
    zoneText: lead.zoneText ?? "",
    experienceId: lead.experienceId ?? "",
    styleId: lead.styleId ?? "",
    menuId: lead.menuId ?? "",
    budgetNotes: lead.budgetNotes ?? "",
    honoreeName: lead.honoreeName ?? "",
    colors: lead.colors.join(", "),
    inspiration: lead.inspiration ?? "",
    notes: lead.notes ?? "",
  };

  return (
    <>
      <PageHeader
        back={{ href: "/admin/leads", label: "Leads" }}
        eyebrow={<span className="font-mono tracking-normal normal-case">{lead.code}</span>}
        title={lead.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <LeadStatusBadge status={lead.status} />
            <LeadFlagBadges outOfArea={lead.outOfArea} specialRequest={lead.specialRequest} />
            <span>
              Recibido{" "}
              <time dateTime={lead.createdAt.toISOString()} title={formatDateTime(lead.createdAt)}>
                {relativeTime(lead.createdAt, now)}
              </time>{" "}
              vía {LEAD_SOURCE_LABELS[lead.source]}
            </span>
          </span>
        }
        actions={
          <>
            {canWrite && formOptions ? <LeadEditDialog options={formOptions} values={editValues} /> : null}
            {canQuote && lead.status !== "LOST" ? (
              <Button asChild size="lg">
                <Link href={`/admin/quotes/new?leadId=${lead.id}`}>
                  <FilePlus2 aria-hidden />
                  Crear cotización
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      {lead.status === "LOST" && lead.lostReason ? (
        <div role="note" className="bg-muted mb-6 rounded-xl border px-4 py-3 text-sm">
          <span className="font-medium">Motivo de pérdida:</span> {lead.lostReason}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna lateral: acciones (primero en móvil) */}
        <div className="space-y-6 lg:order-2">
          <Panel title="Contacto" icon={Phone}>
            <LeadContactCard
              now={now}
              senderName={user.name}
              lead={{
                name: lead.name,
                phone: lead.phone,
                email: lead.email,
                occasion: lead.occasion,
                occasionOther: lead.occasionOther,
                eventDate: lead.eventDate,
                guestCount: lead.guestCount,
                experienceName: lead.experience?.name ?? null,
                lastContactedAt: lead.lastContactedAt,
              }}
            />
          </Panel>

          <Panel title="Seguimiento" icon={Settings2}>
            <div className="space-y-5">
              <LeadAssignControl
                leadId={lead.id}
                assigneeId={lead.assignedToId}
                users={assigneeOptions.map((u) => ({ id: u.id, name: u.name }))}
                disabled={!canWrite}
              />
              {canWrite ? (
                <div className="border-t pt-4">
                  <LeadStatusControl leadId={lead.id} status={lead.status} />
                </div>
              ) : null}
            </div>
          </Panel>

          {canWrite ? (
            <Panel title="Registrar contacto" icon={MessageSquarePlus}>
              <LeadActivityForm leadId={lead.id} isNew={lead.status === "NEW"} />
            </Panel>
          ) : null}

          {canSeeCustomer && lead.customer ? (
            <Panel title="Clienta" icon={UserRound}>
              <Link
                href={`/admin/customers/${lead.customer.id}`}
                className="hover:bg-muted group -m-2 flex items-center justify-between gap-2 rounded-lg p-2"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{lead.customer.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {lead.customer.email ?? lead.customer.phone ?? "Sin datos de contacto"}
                  </span>
                </span>
                <ArrowUpRight className="text-muted-foreground size-4 shrink-0 group-hover:text-foreground" aria-hidden />
                <span className="sr-only">Ver ficha de la clienta</span>
              </Link>
            </Panel>
          ) : null}
        </div>

        {/* Columna principal */}
        <div className="space-y-6 lg:order-1 lg:col-span-2">
          <Panel title="Detalles del evento" icon={ClipboardList}>
            <DetailList items={details} />
            {lead.inspiration || lead.notes ? (
              <div className="mt-5 grid gap-4 border-t pt-4 sm:grid-cols-2">
                {lead.inspiration ? (
                  <div>
                    <h3 className="text-muted-foreground text-xs">Inspiración</h3>
                    <p className="mt-1 text-sm whitespace-pre-line">{lead.inspiration}</p>
                  </div>
                ) : null}
                {lead.notes ? (
                  <div>
                    <h3 className="text-muted-foreground text-xs">Notas</h3>
                    <p className="mt-1 text-sm whitespace-pre-line">{lead.notes}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {lead.specialRequest ? (
              <p className="bg-info/10 text-info mt-4 rounded-lg px-3 py-2 text-sm">
                Consulta especial: el grupo supera el máximo estándar. Revisa logística y precio antes de cotizar.
              </p>
            ) : null}
          </Panel>

          {snapshot ? (
            <Panel title="Lo que configuró" icon={ShoppingBasket} description="Selección y estimado del configurador web.">
              <LeadSnapshotCard snapshot={snapshot} />
            </Panel>
          ) : null}

          {aiDesigns.length ? (
            <Panel title="Diseño con IA" icon={Wand2}>
              <div className="space-y-3">
                {aiDesigns.map((d) => (
                  <AiDesignCard key={d.id} design={d} />
                ))}
              </div>
            </Panel>
          ) : null}

          <Panel
            title="Cotizaciones"
            icon={FileText}
            actions={
              canQuote && lead.status !== "LOST" && lead.quotes.length ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/quotes/new?leadId=${lead.id}`}>
                    <FilePlus2 aria-hidden />
                    Nueva versión
                  </Link>
                </Button>
              ) : null
            }
          >
            {lead.quotes.length ? (
              <ul className="divide-y">
                {lead.quotes.map((q) => (
                  <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      {canSeeQuotes ? (
                        <Link href={`/admin/quotes/${q.id}`} className="font-mono text-sm font-medium hover:underline">
                          {q.code}
                        </Link>
                      ) : (
                        <span className="font-mono text-sm font-medium">{q.code}</span>
                      )}
                      <span className="text-muted-foreground text-xs"> · v{q.version}</span>
                      <p className="text-muted-foreground truncate text-xs">
                        {q.title} · {formatDateTime(q.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge tone={QUOTE_STATUS_TONES[q.status]}>{QUOTE_STATUS_LABELS[q.status]}</StatusBadge>
                      <span className="tabular font-medium">{formatMXN(q.totalCents)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="bg-sand-soft/50 flex flex-col items-start gap-3 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground text-sm">Aún no hay cotizaciones para este lead.</p>
                {canQuote && lead.status !== "LOST" ? (
                  <Button asChild size="sm">
                    <Link href={`/admin/quotes/new?leadId=${lead.id}`}>
                      <FilePlus2 aria-hidden />
                      Crear cotización
                    </Link>
                  </Button>
                ) : null}
              </div>
            )}
          </Panel>

          <Panel title="Actividad" icon={History} description="Lo más reciente primero.">
            <LeadTimeline activities={lead.activities} now={now} />
          </Panel>
        </div>
      </div>
    </>
  );
}
