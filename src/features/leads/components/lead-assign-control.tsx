"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { handleActionResult } from "@/components/forms/action-result";
import { Label } from "@/components/ui/label";
import { assignLeadAction } from "../server/actions";
import { NativeSelect } from "./native-select";

const NONE = "";

/** Responsable del lead (fundadoras / administradoras). Guarda al elegir. */
export function LeadAssignControl({
  leadId,
  assigneeId,
  users,
  disabled,
}: {
  leadId: string;
  assigneeId: string | null;
  users: Array<{ id: string; name: string }>;
  disabled?: boolean;
}) {
  const [value, setValue] = React.useState(assigneeId ?? NONE);
  const [pending, setPending] = React.useState(false);
  const id = React.useId();

  React.useEffect(() => setValue(assigneeId ?? NONE), [assigneeId]);

  async function onChange(next: string) {
    const previous = value;
    setValue(next);
    setPending(true);
    try {
      const res = await assignLeadAction({ leadId, assigneeId: next || null });
      const name = users.find((u) => u.id === next)?.name;
      if (!handleActionResult(res, { success: next ? `Asignado a ${name}` : "Lead sin asignar" })) setValue(previous);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        Responsable
      </Label>
      <div className="flex items-center gap-2">
        <NativeSelect
          id={id}
          className="flex-1"
          value={value}
          disabled={disabled || pending}
          onChange={(e) => void onChange(e.target.value)}
          aria-busy={pending || undefined}
        >
          <option value={NONE}>Sin asignar</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </NativeSelect>
        {pending ? <Loader2 className="text-muted-foreground size-4 animate-spin" aria-label="Guardando" /> : null}
      </div>
    </div>
  );
}
