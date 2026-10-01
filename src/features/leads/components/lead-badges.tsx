import { MapPinOff, UsersRound } from "lucide-react";
import type { LeadStatus } from "@prisma/client";
import { StatusBadge } from "@/components/data/status-badge";
import { LEAD_STATUS_LABELS, LEAD_STATUS_TONES } from "@/lib/labels";

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <StatusBadge tone={LEAD_STATUS_TONES[status]}>{LEAD_STATUS_LABELS[status]}</StatusBadge>;
}

/** Alertas del lead: fuera de cobertura / consulta especial (grupo grande). */
export function LeadFlagBadges({ outOfArea, specialRequest }: { outOfArea: boolean; specialRequest: boolean }) {
  if (!outOfArea && !specialRequest) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {outOfArea ? (
        <StatusBadge tone="warning" dot={false} className="h-5 px-2 text-[11px]">
          <MapPinOff className="size-3" aria-hidden />
          Fuera de cobertura
        </StatusBadge>
      ) : null}
      {specialRequest ? (
        <StatusBadge tone="info" dot={false} className="h-5 px-2 text-[11px]">
          <UsersRound className="size-3" aria-hidden />
          Consulta especial
        </StatusBadge>
      ) : null}
    </span>
  );
}
