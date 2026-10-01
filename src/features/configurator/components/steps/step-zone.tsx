"use client";

import { Compass, Info, MapPin } from "lucide-react";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { formatMXN } from "@/lib/money";
import { joinSpanishList } from "../../domain/wizard";
import { ChoiceCard, ChoiceGroup, MetaPill, SoftBadge } from "../choice-cards";
import type { StepProps } from "./types";

const OTHER = "__otra-zona";

export function StepZone({ draft, update, catalog, labelledBy, errorId, invalid }: StepProps) {
  const active = catalog.areas.filter((a) => a.active);
  const soon = catalog.areas.filter((a) => !a.active);
  const value = draft.zoneOther ? OTHER : draft.serviceAreaId;

  return (
    <div className="space-y-6">
      <ChoiceGroup
        value={value}
        onValueChange={(v) =>
          v === OTHER
            ? update({ zoneOther: true, serviceAreaId: null })
            : update({ zoneOther: false, serviceAreaId: v })
        }
        labelledBy={labelledBy}
        describedBy={invalid ? errorId : undefined}
        invalid={invalid}
        className="sm:grid-cols-2"
      >
        {active.map((a) => (
          <ChoiceCard
            key={a.id}
            value={a.id}
            title={a.name}
            description={a.description ?? undefined}
            icon={<MapPin className="size-5" />}
            meta={
              <MetaPill>
                {a.logisticsFeeCents > 0
                  ? `Logística ${formatMXN(a.logisticsFeeCents)}`
                  : "Logística incluida"}
              </MetaPill>
            }
          />
        ))}
        <ChoiceCard
          value={OTHER}
          title="Otra zona"
          description="¿Tu celebración es en otra colonia? Cuéntanos dónde y revisamos opciones."
          icon={<Compass className="size-5" />}
        />
      </ChoiceGroup>

      {draft.zoneOther ? (
        <div className="space-y-4">
          <div
            role="note"
            className="border-warning/30 bg-warning/8 flex gap-3 rounded-2xl border p-4 text-sm"
          >
            <Info className="text-warning mt-0.5 size-5 shrink-0" aria-hidden />
            <p>
              Por ahora operamos en{" "}
              {joinSpanishList(active.map((a) => a.name)) || "zonas seleccionadas de CDMX"}; déjanos tus datos
              y vemos opciones.
            </p>
          </div>
          <Field label="¿En qué colonia o alcaldía será?" required className="max-w-lg">
            {(p) => (
              <Input
                {...p}
                value={draft.zoneText}
                maxLength={120}
                onChange={(e) => update({ zoneText: e.target.value })}
                placeholder="Ej. Roma Norte, Coyoacán, Santa Fe…"
                autoComplete="address-level3"
                className="bg-card h-11 text-base"
              />
            )}
          </Field>
        </div>
      ) : null}

      {soon.length ? (
        <div>
          <h3 className="eyebrow mb-3">Próximamente</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {soon.map((a) => (
              <li
                key={a.id}
                className="border-border/80 bg-card/50 text-muted-foreground flex items-center justify-between gap-3 rounded-2xl border border-dashed px-4 py-3"
              >
                <span className="flex items-center gap-2">
                  <MapPin className="size-4" aria-hidden />
                  <span className="font-medium">{a.name}</span>
                </span>
                <SoftBadge tone="muted">Próximamente</SoftBadge>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-2 text-xs">
            ¿Es tu zona? Elige “Otra zona” y te avisamos en cuanto lleguemos.
          </p>
        </div>
      ) : null}
    </div>
  );
}
