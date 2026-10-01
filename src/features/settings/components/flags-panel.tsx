"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/data/status-badge";
import { handleActionResult } from "@/components/forms/action-result";
import { FLAG_META, type FlagKey, type FlagState } from "../domain/flags-meta";
import { resetFeatureFlagAction, setFeatureFlagAction } from "../server/actions";

function FlagRow({ initial, canEdit }: { initial: FlagState; canEdit: boolean }) {
  const [state, setState] = useState(initial);
  const [pending, startTransition] = useTransition();
  const meta = FLAG_META[state.flag];
  const switchId = `flag-${state.flag}`;
  const descId = `${switchId}-desc`;
  const hasOverride = typeof state.override === "boolean";

  function toggle(enabled: boolean) {
    startTransition(async () => {
      const res = await setFeatureFlagAction({ flag: state.flag as FlagKey, enabled });
      if (handleActionResult(res, { success: `${meta.label}: ${enabled ? "activado" : "desactivado"}` })) setState(res.data);
    });
  }

  function reset() {
    startTransition(async () => {
      const res = await resetFeatureFlagAction({ flag: state.flag as FlagKey });
      if (handleActionResult(res, { success: `${meta.label}: restablecido al valor de entorno` })) setState(res.data);
    });
  }

  return (
    <li className="bg-card flex flex-col gap-4 rounded-xl border p-4 shadow-xs sm:flex-row sm:items-start sm:justify-between sm:p-5">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={switchId} className="font-heading text-lg font-semibold">
            {meta.label}
          </label>
          <StatusBadge tone={state.effective ? "success" : "muted"}>{state.effective ? "Activo" : "Apagado"}</StatusBadge>
        </div>
        <p id={descId} className="text-muted-foreground text-sm">
          {meta.description} {!state.effective ? meta.offImpact : null}
        </p>
        <dl className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <div className="flex gap-1">
            <dt>Valor de entorno:</dt>
            <dd className="text-foreground font-medium">{state.envDefault ? "Activo" : "Apagado"}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Ajuste en panel:</dt>
            <dd className="text-foreground font-medium">
              {hasOverride ? (state.override ? "Forzado activo" : "Forzado apagado") : "Sin ajuste (usa entorno)"}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt>Variable:</dt>
            <dd>
              <code className="bg-muted rounded px-1 py-0.5">{state.flag}</code>
            </dd>
          </div>
        </dl>
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
        <Switch
          id={switchId}
          checked={state.effective}
          onCheckedChange={toggle}
          disabled={!canEdit || pending}
          aria-describedby={descId}
        />
        {hasOverride ? (
          <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={!canEdit || pending}>
            <RotateCcw aria-hidden />
            Restablecer a valor de entorno
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function FlagsPanel({ flags, canEdit }: { flags: FlagState[]; canEdit: boolean }) {
  return (
    <ul className="space-y-3">
      {flags.map((f) => (
        <FlagRow key={f.flag} initial={f} canEdit={canEdit} />
      ))}
    </ul>
  );
}
