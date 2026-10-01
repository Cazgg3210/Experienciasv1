/**
 * Ordenamiento manual (subir/bajar) de listas de contenido. Puro y testeable.
 */
export type Direction = "up" | "down";

/** Mueve `id` una posición. Devuelve el nuevo arreglo o null si no se puede mover. */
export function moveInList<T extends string>(ids: readonly T[], id: T, direction: Direction): T[] | null {
  const index = ids.indexOf(id);
  if (index === -1) return null;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return null;
  const next = [...ids];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

/** sortOrder consecutivo (1..n) para un orden dado. */
export function normalizeOrder<T extends string>(ids: readonly T[]): Array<{ id: T; sortOrder: number }> {
  return ids.map((id, i) => ({ id, sortOrder: i + 1 }));
}

/** Siguiente sortOrder para agregar al final. */
export function nextSortOrder(orders: readonly number[]): number {
  return orders.length ? Math.max(...orders) + 1 : 1;
}
