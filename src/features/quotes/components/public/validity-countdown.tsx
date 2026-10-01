"use client";

import * as React from "react";
import { Hourglass } from "lucide-react";
import { countdown } from "../../domain/quote-lines";

/** "Quedan 2 días 5 h para aceptarla" — se actualiza cada 30 s (sin animaciones). */
export function ValidityCountdown({ validUntilIso, className }: { validUntilIso: string; className?: string }) {
  const target = React.useMemo(() => new Date(validUntilIso), [validUntilIso]);
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className={className} aria-hidden />;
  const c = countdown(target, now);
  let text: string;
  if (c.expired) text = "La vigencia terminó";
  else if (c.days >= 1) text = `Quedan ${c.days} ${c.days === 1 ? "día" : "días"}${c.hours ? ` ${c.hours} h` : ""}`;
  else if (c.hours >= 1) text = `Quedan ${c.hours} h ${c.minutes} min`;
  else text = `Quedan ${Math.max(1, c.minutes)} min`;
  const urgent = !c.expired && c.days < 2;
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        urgent ? "border-warning/30 bg-warning/10 text-warning" : "border-sage/40 bg-sage-soft text-olive",
        className ?? "",
      ].join(" ")}
      role="timer"
      aria-live="off"
    >
      <Hourglass className="size-3.5" aria-hidden />
      {text}
    </span>
  );
}
