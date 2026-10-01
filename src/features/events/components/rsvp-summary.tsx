import { CircleHelp, Clock3, HeartHandshake, UserX, UsersRound } from "lucide-react";
import { StatCard } from "@/components/data/stat-card";
import type { RsvpSummary } from "../domain/guest-summary";

/** Tarjetas de resumen RSVP. */
export function RsvpSummaryCards({
  summary,
  plannedGuests,
}: {
  summary: RsvpSummary;
  plannedGuests: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      <StatCard
        label="Confirmadas"
        value={summary.attendingTotal}
        icon={HeartHandshake}
        tone="success"
        hint={
          summary.plusOnes
            ? `${summary.attending} invitada${summary.attending === 1 ? "" : "s"} + ${summary.plusOnes} acompañante${summary.plusOnes === 1 ? "" : "s"}`
            : `de ${plannedGuests} planeadas`
        }
      />
      <StatCard
        label="Pendientes"
        value={summary.pending}
        icon={Clock3}
        tone={summary.pending ? "warning" : "default"}
      />
      <StatCard label="No asisten" value={summary.notAttending} icon={UserX} />
      <StatCard label="Tal vez" value={summary.maybe} icon={CircleHelp} />
      <StatCard
        label="Total registradas"
        value={summary.total}
        icon={UsersRound}
        hint={`Evento planeado para ${plannedGuests}`}
        className="col-span-2 lg:col-span-1"
      />
    </div>
  );
}
