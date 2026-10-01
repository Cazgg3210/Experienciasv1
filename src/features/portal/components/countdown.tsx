"use client";

import * as React from "react";
import { countdownParts } from "../domain/portal";
import { cn } from "@/lib/utils";

/**
 * Cuenta regresiva (días / horas / minutos). Render inicial con el "now" del servidor para evitar
 * diferencias de hidratación; luego se actualiza cada 30 s (sin animaciones: respeta reduced motion).
 */
export function Countdown({
  startsAt,
  endsAt,
  serverNow,
  className,
}: {
  startsAt: string;
  endsAt: string;
  serverNow: string;
  className?: string;
}) {
  const start = React.useMemo(() => new Date(startsAt), [startsAt]);
  const end = React.useMemo(() => new Date(endsAt), [endsAt]);
  const [now, setNow] = React.useState(() => new Date(serverNow));

  React.useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const c = countdownParts(start, end, now);

  if (c.state === "past") return null;
  if (c.state === "today") {
    return (
      <p className={cn("font-heading text-olive text-2xl font-semibold", className)} role="status">
        ¡Hoy es el día! Disfruta cada momento.
      </p>
    );
  }

  const units = [
    { value: c.days, label: c.days === 1 ? "día" : "días" },
    { value: c.hours, label: c.hours === 1 ? "hora" : "horas" },
    { value: c.minutes, label: "min" },
  ];
  const spoken = `Faltan ${c.days} ${units[0]!.label}, ${c.hours} ${units[1]!.label} y ${c.minutes} minutos`;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="eyebrow">Cuenta regresiva</p>
      <div role="timer" aria-live="off" aria-label={spoken} className="flex gap-2 sm:gap-3">
        {units.map((u) => (
          <div
            key={u.label}
            aria-hidden
            className="bg-card/90 min-w-[5.25rem] flex-1 rounded-2xl border px-3 py-3 text-center shadow-xs sm:flex-none sm:px-5"
          >
            <span className="font-heading block text-3xl leading-none font-semibold lining-nums tabular-nums sm:text-4xl">
              {String(u.value).padStart(2, "0")}
            </span>
            <span className="text-muted-foreground mt-1 block text-xs tracking-wide uppercase">{u.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
