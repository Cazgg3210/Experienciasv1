/**
 * Diff de JSON para el visor de auditoría (puro, sin I/O).
 * Recorre objetos de forma recursiva; los arreglos se comparan completos.
 */

export type DiffKind = "added" | "removed" | "changed";
export type DiffEntry = { path: string; kind: DiffKind; before?: unknown; after?: unknown };

const MAX_DEPTH = 8;
const MAX_ENTRIES = 300;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

function join(base: string, key: string): string {
  return base ? `${base}.${key}` : key;
}

export function diffJson(before: unknown, after: unknown): DiffEntry[] {
  const out: DiffEntry[] = [];

  function walk(a: unknown, b: unknown, path: string, depth: number) {
    if (out.length >= MAX_ENTRIES) return;
    if (deepEqual(a, b)) return;
    if (a === undefined) {
      if (isPlainObject(b) && depth < MAX_DEPTH && Object.keys(b).length) {
        for (const k of Object.keys(b).sort()) walk(undefined, b[k], join(path, k), depth + 1);
      } else out.push({ path: path || "(valor)", kind: "added", after: b });
      return;
    }
    if (b === undefined) {
      if (isPlainObject(a) && depth < MAX_DEPTH && Object.keys(a).length) {
        for (const k of Object.keys(a).sort()) walk(a[k], undefined, join(path, k), depth + 1);
      } else out.push({ path: path || "(valor)", kind: "removed", before: a });
      return;
    }
    if (isPlainObject(a) && isPlainObject(b) && depth < MAX_DEPTH) {
      const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
      for (const k of keys) walk(a[k], b[k], join(path, k), depth + 1);
      return;
    }
    out.push({ path: path || "(valor)", kind: "changed", before: a, after: b });
  }

  walk(before ?? undefined, after ?? undefined, "", 0);
  return out;
}

/** Representación corta y legible de un valor JSON para la tabla del diff. */
export function formatDiffValue(value: unknown, max = 160): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "string") {
    const s = value.length > max ? `${value.slice(0, max)}…` : value;
    return `"${s}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  let s: string;
  try {
    s = JSON.stringify(value);
  } catch {
    s = String(value);
  }
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
