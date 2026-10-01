"use client";

import { useEffect, useRef } from "react";
import type { ClientTrackableType } from "../domain/analytics";
import { sendTrackEvent } from "../client/track";

/** Registra una vista (p. ej. VIEW_EXPERIENCE) una sola vez por montaje. No renderiza nada. */
export function ViewBeacon({ type = "VIEW_EXPERIENCE", experienceId }: { type?: ClientTrackableType; experienceId?: string }) {
  const sent = useRef<string | null>(null);
  useEffect(() => {
    const key = `${type}:${experienceId ?? ""}`;
    if (sent.current === key) return;
    sent.current = key;
    sendTrackEvent({ type, experienceId: experienceId ?? null });
  }, [type, experienceId]);
  return null;
}
