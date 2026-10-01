"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * true sólo después de hidratar. Útil para deshabilitar el envío de formularios con RHF antes de
 * que React tome control (evita envíos nativos GET que pondrían datos en la URL).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
