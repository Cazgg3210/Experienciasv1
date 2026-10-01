/**
 * Filas CSV de leads (puro). La serialización (escape, BOM, anti-inyección) la hace `toCsv`.
 */
import type { LeadSource, LeadStatus, Occasion } from "@prisma/client";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, OCCASION_LABELS } from "@/lib/labels";
import { formatDateTime, toDateKey } from "@/lib/dates";

export type LeadExportRecord = {
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  occasion: Occasion;
  occasionOther: string | null;
  experienceName: string | null;
  eventDate: Date | null;
  guestCount: number | null;
  budgetLabel: string | null;
  estimatedTotalCents: number | null;
  status: LeadStatus;
  source: LeadSource;
  zone: string | null;
  outOfArea: boolean;
  specialRequest: boolean;
  assignedToName: string | null;
  lostReason: string | null;
  createdAt: Date;
  lastContactedAt: Date | null;
};

export const LEAD_CSV_HEADERS = [
  "Código",
  "Nombre",
  "Teléfono",
  "Email",
  "Ocasión",
  "Experiencia",
  "Fecha del evento",
  "Invitadas",
  "Presupuesto",
  "Estimado (MXN)",
  "Estado",
  "Origen",
  "Zona",
  "Fuera de cobertura",
  "Consulta especial",
  "Asignada a",
  "Motivo de pérdida",
  "Creado",
  "Último contacto",
];

export function occasionText(occasion: Occasion, other?: string | null): string {
  return occasion === "OTHER" && other?.trim() ? `${OCCASION_LABELS.OTHER}: ${other.trim()}` : OCCASION_LABELS[occasion];
}

export function leadCsvRow(lead: LeadExportRecord): Array<string | number | null> {
  return [
    lead.code,
    lead.name,
    lead.phone,
    lead.email,
    occasionText(lead.occasion, lead.occasionOther),
    lead.experienceName,
    lead.eventDate ? toDateKey(lead.eventDate) : null,
    lead.guestCount,
    lead.budgetLabel,
    lead.estimatedTotalCents != null ? (lead.estimatedTotalCents / 100).toFixed(2) : null,
    LEAD_STATUS_LABELS[lead.status],
    LEAD_SOURCE_LABELS[lead.source],
    lead.zone,
    lead.outOfArea ? "Sí" : "No",
    lead.specialRequest ? "Sí" : "No",
    lead.assignedToName,
    lead.lostReason,
    formatDateTime(lead.createdAt),
    lead.lastContactedAt ? formatDateTime(lead.lastContactedAt) : null,
  ];
}
