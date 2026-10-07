"use client";

import * as React from "react";

/**
 * Id que React debe usar para un grupo de elementos ligados por id (label/for, aria-describedby, aria-controls…)
 * cuando uno de ellos ya llegó pintado en el HTML del servidor (BUG-024).
 *
 * Por qué: al hidratar, `useId` puede calcular en el cliente otro id que el del HTML. Pasa con el React
 * 19.2-canary que incluye Next 15.5.27 (visto en Firefox, EVT-005). Si durante la hidratación se suspende una
 * fibra que no es función (Provider, Fragment o elemento HTML) e hija de un arreglo, p. ej. el
 * `TemplateContext.Provider` de `OuterLayoutRouter` de Next, `replayBeginWork` la reinicia con
 * `resetWorkInProgress`. Esa máscara borra el flag *Forked*, `beginWork` ya no llama a `pushTreeId` y todo el
 * subárbol calcula otros ids. React no reescribe los atributos ya pintados, pero usa SU id en todo lo que monta o
 * actualiza después (un error nuevo, un aria-describedby que cambia, una lista que aparece): la referencia apunta
 * a un id que no existe y se pierde la etiqueta, la descripción o el control.
 *
 * Qué hace: después de hidratar lee el id con que se pintó `ref` (en `attr`, con `suffix` al final) y, si difiere
 * de `generated`, lo adopta para que todo el grupo vuelva a coincidir. En un montaje normal en el cliente, o si
 * ambos ids coinciden, devuelve `generated` sin volver a renderizar.
 *
 * Criterio de retiro: quitar el hook (y volver a `React.useId()` / el `id` explícito en sus consumidores) cuando
 * Next incluya un React que conserve *Forked* al reiniciar una fibra durante la hidratación, y CUST-017 y EVT-040
 * pasen en Firefox sin él.
 *
 * @param generated id calculado en el cliente (normalmente `React.useId()` o el `id` explícito del componente).
 * @param ref elemento pintado por el servidor que lleva `${id}${suffix}` en el atributo `attr`.
 */
export function usePaintedId(
  generated: string,
  ref: React.RefObject<Element | null>,
  { attr = "id", suffix = "" }: { attr?: string; suffix?: string } = {},
): string {
  // Se recuerda para qué `generated` se adoptó: si ese id cambia después (p. ej. llega un `id` explícito), manda.
  const [painted, setPainted] = React.useState<{ generated: string; id: string } | null>(null);
  React.useLayoutEffect(() => {
    const id = paintedIdToAdopt(ref.current?.getAttribute(attr), suffix, generated);
    if (id) setPainted((prev) => (prev?.generated === generated && prev.id === id ? prev : { generated, id }));
  }, [generated, ref, attr, suffix]);
  return painted?.generated === generated ? painted.id : generated;
}

/**
 * Parte pura de `usePaintedId`: dado el valor del atributo pintado por el servidor (`${id}${suffix}`), el sufijo
 * y el id generado en el cliente, devuelve el id que hay que adoptar, o `null` si no hay nada que adoptar (sin
 * atributo, con otro sufijo, sin id antes del sufijo o igual al generado).
 */
export function paintedIdToAdopt(painted: string | null | undefined, suffix: string, generated: string): string | null {
  if (!painted || !painted.endsWith(suffix)) return null;
  const id = painted.slice(0, painted.length - suffix.length);
  return id && id !== generated ? id : null;
}
