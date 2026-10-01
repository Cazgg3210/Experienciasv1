"use client";

import * as React from "react";
import { slugify } from "@/lib/slug";
import type { SlugEntity } from "../schemas";
import { checkSlugAction } from "../server/actions";

export type SlugStatus = "idle" | "checking" | "available" | "taken";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Slug automático desde el nombre (hasta que la persona lo edita) + verificación de disponibilidad
 * con debounce contra el servidor. El servidor vuelve a validar al guardar (ConflictError).
 */
export function useSlugAutofill({
  entity,
  excludeId,
  name,
  slug,
  initialSlug,
  setSlug,
  onTaken,
  onAvailable,
}: {
  entity: SlugEntity;
  excludeId?: string;
  name: string | undefined;
  slug: string | undefined;
  initialSlug?: string;
  setSlug: (value: string) => void;
  onTaken: (message: string) => void;
  onAvailable: () => void;
}) {
  const [edited, setEdited] = React.useState(Boolean(initialSlug));
  const [status, setStatus] = React.useState<SlugStatus>("idle");
  const callbacks = React.useRef({ setSlug, onTaken, onAvailable });
  callbacks.current = { setSlug, onTaken, onAvailable };

  React.useEffect(() => {
    if (edited) return;
    const next = slugify(name ?? "");
    if (next !== slug) callbacks.current.setSlug(next);
  }, [name, edited, slug]);

  React.useEffect(() => {
    const value = (slug ?? "").trim();
    if (!value || !SLUG_RE.test(value) || value === initialSlug) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("checking");
    const timer = setTimeout(async () => {
      const res = await checkSlugAction({ entity, slug: value, excludeId });
      if (cancelled) return;
      if (!res.ok) {
        setStatus("idle");
        return;
      }
      if (res.data.available) {
        setStatus("available");
        callbacks.current.onAvailable();
      } else {
        setStatus("taken");
        callbacks.current.onTaken(`El slug "${value}" ya está en uso. Elige otro.`);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, entity, excludeId, initialSlug]);

  return {
    status,
    edited,
    markEdited: () => setEdited(true),
    regenerate: () => setEdited(false),
  };
}

export function SlugHint({
  status,
  path,
  changedWarning,
}: {
  status: SlugStatus;
  path: string;
  /** Aviso cuando se cambia el slug de algo ya publicado (la URL anterior deja de funcionar). */
  changedWarning?: string | null;
}) {
  return (
    <span aria-live="polite">
      {status === "checking"
        ? "Verificando disponibilidad…"
        : status === "available"
          ? "Disponible ✓ · "
          : status === "taken"
            ? "No disponible · "
            : ""}
      {status !== "checking" ? <span className="font-mono break-all">{path}</span> : null}
      {changedWarning ? <span className="text-warning mt-1 block">{changedWarning}</span> : null}
    </span>
  );
}
