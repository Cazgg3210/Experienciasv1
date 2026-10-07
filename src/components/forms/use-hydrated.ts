"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * true sólo después de hidratar en el navegador (en el HTML del servidor y durante la hidratación es false; en
 * componentes que se montan ya en el cliente es true desde el primer render).
 *
 * Sirve para deshabilitar el envío de formularios que llegan en el HTML del servidor: antes de que React tome el
 * control, el navegador los enviaría de forma nativa (GET a la URL actual, con los datos en la query) en lugar de
 * llamar a la Server Action. Ver `waitForHydration` en `SubmitButton`.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
