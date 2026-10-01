/**
 * Copy y reglas de UI para las transiciones de estado de un evento (puro).
 * La validez de cada transición la decide eventStatusMachine.
 */
import { eventStatusMachine, type EventStatus } from "./event-status";

export type StatusAction = {
  to: EventStatus;
  label: string;
  description: string;
  destructive: boolean;
};

const ACTION_COPY: Record<EventStatus, { label: string; description: string }> = {
  INQUIRY: { label: "Volver a consulta", description: "El evento regresa a etapa de consulta." },
  PENDING_PAYMENT: {
    label: "Pasar a pendiente de pago",
    description: "La fecha queda apartada mientras la clienta paga el anticipo.",
  },
  CONFIRMED: {
    label: "Confirmar evento",
    description:
      "Úsalo cuando el anticipo se pagó fuera del sistema (p. ej. transferencia). Se generan checklists y reservas de inventario.",
  },
  PLANNING: {
    label: "Pasar a planeación",
    description: "El equipo empieza a afinar detalles, compras y staff.",
  },
  READY: { label: "Marcar como listo", description: "Todo está preparado para el día del evento." },
  IN_PROGRESS: { label: "Iniciar evento", description: "El evento está en curso." },
  COMPLETED: {
    label: "Marcar como completado",
    description: "El evento terminó. Podrás hacer el cierre financiero.",
  },
  CANCELLED: {
    label: "Cancelar evento",
    description: "Libera la fecha y cancela las reservas de inventario. Es irreversible.",
  },
};

/** Acciones disponibles desde un estado, en el orden de la máquina de estados. */
export function statusActionsFor(status: EventStatus): StatusAction[] {
  return eventStatusMachine.next(status).map((to) => ({
    to,
    label: ACTION_COPY[to].label,
    description: ACTION_COPY[to].description,
    destructive: to === "CANCELLED",
  }));
}

/** Estados en los que ya no se puede reprogramar (fecha/horario). */
export function isScheduleLocked(status: EventStatus): boolean {
  return status === "CANCELLED" || status === "COMPLETED";
}

/** Al pasar de un estado sin capacidad a uno que ocupa capacidad hay que revisar disponibilidad. */
export function entersCapacity(
  from: EventStatus,
  to: EventStatus,
  capacityStatuses: readonly EventStatus[],
): boolean {
  return !capacityStatuses.includes(from) && capacityStatuses.includes(to);
}
