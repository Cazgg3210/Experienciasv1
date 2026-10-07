"use client";

import * as React from "react";

/**
 * Id que React debe usar para un grupo de elementos ligados por id (label/for, aria-describedby, aria-controls…)
 * cuando uno de ellos ya llegó pintado en el HTML del servidor.
 *
 * Al hidratar, `useId` puede calcular en el cliente otro id que el del HTML: pasa en Firefox cuando la
 * hidratación se reparte en varias pasadas (EVT-005, React 19.2 de Next 15.5). React no reescribe los atributos
 * ya pintados, pero usa SU id en todo lo que monta o actualiza después (un error nuevo, un aria-describedby que
 * cambia, una lista que aparece): la referencia apunta a un id que no existe y se pierde la etiqueta, la
 * descripción o el control. Este hook lee, después de hidratar, el id con que se pintó `ref` (en `attr`, con
 * `suffix` al final) y, si difiere de `generated`, lo adopta para que todo el grupo vuelva a coincidir.
 *
 * En un montaje normal en el cliente, o si ambos ids coinciden, devuelve `generated` sin volver a renderizar.
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
    const value = ref.current?.getAttribute(attr);
    if (!value || !value.endsWith(suffix)) return;
    const id = value.slice(0, value.length - suffix.length);
    if (id && id !== generated) setPainted((prev) => (prev?.generated === generated && prev.id === id ? prev : { generated, id }));
  }, [generated, ref, attr, suffix]);
  return painted?.generated === generated ? painted.id : generated;
}
