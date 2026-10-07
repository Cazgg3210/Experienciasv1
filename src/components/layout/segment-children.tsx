import { Fragment } from "react";

/**
 * Envuelve el `children` de un layout que tiene un `error.tsx` en su misma carpeta cuando ese
 * `children` va dentro de un elemento HTML (`<main>`, `<div>`…), directamente o a través de un
 * componente que lo pinta así (p. ej. `AdminShell`). No agrega nodos al DOM.
 *
 * Por qué existe: Next pasa el componente de `error.tsx` POR VALOR al router del segmento. Si
 * su chunk de JS todavía no llegó cuando React empieza a hidratar (Firefox lo provoca al
 * llegar desde otra página con el resto de los chunks en caché), React suspende al reconciliar
 * el hijo de ese elemento HTML y, al reintentarlo, vuelve a reclamar el MISMO nodo del DOM con
 * el cursor de hidratación ya adentro: error #418, se descarta el HTML del servidor y toda la
 * página se vuelve a pintar en el cliente. Un `Fragment` con `key` tiene su propio fiber: la
 * suspensión se reintenta en él, que no reclama nodos, y la hidratación sigue intacta.
 * Es un defecto de React (canary 19.2 incluido en Next 15.5), no de la app; quitar este envoltorio
 * sólo cuando una versión de Next lo corrija y [NAV-034..036] (tests/e2e/navigation/hydration.spec.ts)
 * sigan pasando en Firefox sin él.
 */
export function SegmentChildren({ children }: { children: React.ReactNode }) {
  return <Fragment key="segment-children">{children}</Fragment>;
}
