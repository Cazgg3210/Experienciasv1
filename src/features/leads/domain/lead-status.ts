import { createStateMachine } from "@/lib/state-machine";

export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "QUOTED" | "WON" | "LOST";

export const leadStatusMachine = createStateMachine<LeadStatus>("Lead", {
  NEW: ["CONTACTED", "QUALIFIED", "QUOTED", "LOST"],
  CONTACTED: ["QUALIFIED", "QUOTED", "LOST", "NEW"],
  QUALIFIED: ["QUOTED", "LOST", "CONTACTED"],
  QUOTED: ["WON", "LOST", "QUALIFIED"],
  WON: [],
  LOST: ["NEW", "CONTACTED"], // reactivar
});

export const LEAD_PIPELINE: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "QUOTED", "WON", "LOST"];
