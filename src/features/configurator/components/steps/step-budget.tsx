"use client";

import { MessageCircle, Wallet } from "lucide-react";
import { formatMXN } from "@/lib/money";
import { ChoiceCard, ChoiceGroup } from "../choice-cards";
import type { ConfiguratorEstimate } from "../../types";
import type { StepProps } from "./types";

const UNDECIDED = "__platicarlo";

export function StepBudget({
  draft,
  update,
  catalog,
  labelledBy,
  errorId,
  invalid,
  estimate,
}: StepProps & { estimate: ConfiguratorEstimate | null }) {
  const value = draft.budgetUndecided ? UNDECIDED : draft.budgetRangeId;
  return (
    <div className="space-y-5">
      {estimate ? (
        <p className="bg-sand-soft/70 rounded-2xl px-4 py-3 text-sm">
          Tu estimado con lo que elegiste es de{" "}
          <strong className="tabular">{formatMXN(estimate.totalCents)}</strong>. Esto nos ayuda a proponerte
          la mejor combinación para tu presupuesto.
        </p>
      ) : null}
      <ChoiceGroup
        value={value}
        onValueChange={(v) =>
          v === UNDECIDED
            ? update({ budgetUndecided: true, budgetRangeId: null })
            : update({ budgetUndecided: false, budgetRangeId: v })
        }
        labelledBy={labelledBy}
        describedBy={invalid ? errorId : undefined}
        invalid={invalid}
        className="sm:grid-cols-2"
      >
        {catalog.budgetRanges.map((b) => (
          <ChoiceCard key={b.id} value={b.id} title={b.label} icon={<Wallet className="size-5" />} />
        ))}
        <ChoiceCard
          value={UNDECIDED}
          title="Prefiero platicarlo"
          description="Sin problema: lo vemos juntas al revisar tu fecha."
          icon={<MessageCircle className="size-5" />}
        />
      </ChoiceGroup>
    </div>
  );
}
