import { createStateMachine } from "@/lib/state-machine";

export type PurchaseStatus = "REQUESTED" | "ORDERED" | "RECEIVED" | "CANCELLED";

export const purchaseStatusMachine = createStateMachine<PurchaseStatus>("Purchase", {
  REQUESTED: ["ORDERED", "RECEIVED", "CANCELLED"],
  ORDERED: ["RECEIVED", "CANCELLED", "REQUESTED"],
  RECEIVED: [],
  CANCELLED: ["REQUESTED"],
});
