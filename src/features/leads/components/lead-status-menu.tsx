"use client";

import * as React from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import type { LeadStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { handleActionResult } from "@/components/forms/action-result";
import { LEAD_STATUS_LABELS } from "@/lib/labels";
import { nextLeadStatuses } from "../domain/lead-workflow";
import { changeLeadStatusAction } from "../server/actions";
import { LostReasonDialog } from "./lost-reason-dialog";

/** Menú "Mover a…" de las tarjetas del kanban (sólo transiciones válidas). */
export function LeadStatusMenu({ leadId, leadName, status }: { leadId: string; leadName: string; status: LeadStatus }) {
  const [pending, setPending] = React.useState(false);
  const [lostOpen, setLostOpen] = React.useState(false);
  const options = nextLeadStatuses(status);

  if (!options.length) return null;

  async function move(toStatus: LeadStatus, lostReason?: string): Promise<boolean> {
    setPending(true);
    try {
      const res = await changeLeadStatusAction({ leadId, toStatus, lostReason });
      // La acción revalida /admin/leads: el tablero se actualiza solo
      return handleActionResult(res, { success: `${leadName}: ${LEAD_STATUS_LABELS[toStatus]}` });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={pending} aria-label={`Mover ${leadName} a otro estado`}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ArrowRightLeft aria-hidden />}
            Mover
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuLabel>Mover a…</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map((s) => (
            <DropdownMenuItem
              key={s}
              onSelect={() => {
                if (s === "LOST") setLostOpen(true);
                else void move(s);
              }}
            >
              {LEAD_STATUS_LABELS[s]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <LostReasonDialog
        open={lostOpen}
        onOpenChange={setLostOpen}
        leadName={leadName}
        onConfirm={(reason) => move("LOST", reason)}
      />
    </>
  );
}
