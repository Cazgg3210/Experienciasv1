import { Salad } from "lucide-react";
import type { DietaryAggregate } from "../domain/guest-summary";

/** Restricciones alimentarias agregadas (para cocina) con nombres y notas. */
export function DietarySummary({ dietary }: { dietary: DietaryAggregate }) {
  return (
    <section
      aria-labelledby="dietary-title"
      className="bg-card space-y-3 rounded-xl border p-4 shadow-xs sm:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="dietary-title" className="font-heading flex items-center gap-2 text-xl font-semibold">
          <Salad className="text-olive size-5" aria-hidden />
          Restricciones alimentarias
        </h2>
        <span className="text-muted-foreground text-sm">
          {dietary.peopleWithRestrictions === 1 ? "1 persona" : `${dietary.peopleWithRestrictions} personas`}
        </span>
      </div>
      {dietary.restrictions.length === 0 && dietary.notes.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nadie ha reportado restricciones (sin contar a quienes no asisten).
        </p>
      ) : (
        <>
          {dietary.restrictions.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {dietary.restrictions.map((r) => (
                <li key={r.restriction} className="bg-sage-soft/50 rounded-lg px-3 py-2">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{r.label}</span>
                    <span className="tabular text-olive text-lg font-semibold">{r.count}</span>
                  </p>
                  <p className="text-muted-foreground text-xs">{r.names.join(", ")}</p>
                </li>
              ))}
            </ul>
          ) : null}
          {dietary.notes.length ? (
            <div>
              <h3 className="mb-1 text-sm font-semibold">Notas</h3>
              <ul className="space-y-1 text-sm">
                {dietary.notes.map((n, i) => (
                  <li key={`${n.name}-${i}`}>
                    <span className="font-medium">{n.name}:</span>{" "}
                    <span className="text-muted-foreground">{n.notes}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
