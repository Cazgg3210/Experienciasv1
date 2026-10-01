"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * true sólo después de hidratar en el navegador. Sirve para deshabilitar envíos antes de que
 * React tome el control (evita que el navegador envíe el formulario nativo por GET y deje
 * nombre/mensaje en la URL).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
