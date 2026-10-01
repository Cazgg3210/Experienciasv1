import { createStateMachine } from "@/lib/state-machine";

export type EventStatus =
  | "INQUIRY"
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "PLANNING"
  | "READY"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export const eventStatusMachine = createStateMachine<EventStatus>("Event", {
  INQUIRY: ["PENDING_PAYMENT", "CONFIRMED", "CANCELLED"],
  PENDING_PAYMENT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PLANNING", "READY", "CANCELLED"],
  PLANNING: ["READY", "CONFIRMED", "CANCELLED"],
  READY: ["IN_PROGRESS", "PLANNING", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
});

/** Estados que ocupan capacidad del calendario (evitan double-booking). */
export const CAPACITY_STATUSES: EventStatus[] = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PLANNING",
  "READY",
  "IN_PROGRESS",
];

/** Estados operativos (ya pagó anticipo). */
export const ACTIVE_EVENT_STATUSES: EventStatus[] = ["CONFIRMED", "PLANNING", "READY", "IN_PROGRESS"];

export function canCloseEvent(status: EventStatus, closedAt: Date | null): boolean {
  return status === "COMPLETED" && !closedAt;
}
