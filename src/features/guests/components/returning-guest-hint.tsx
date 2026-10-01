"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RSVP_STORAGE_PREFIX } from "./rsvp-panel";

/**
 * En el link genérico: si en este dispositivo ya respondió, ofrece volver a su respuesta
 * (guardada localmente; nunca se consulta al servidor por nombre).
 */
export function ReturningGuestHint({ slug }: { slug: string }) {
  const [saved, setSaved] = React.useState<{ path: string; name: string } | null>(null);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`${RSVP_STORAGE_PREFIX}${slug}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { path?: unknown; name?: unknown };
      if (
        typeof parsed.path === "string" &&
        parsed.path.startsWith(`/e/${slug}/`) &&
        /^\/e\/[a-z0-9-]+\/[A-Za-z0-9_-]{20,128}$/.test(parsed.path) &&
        typeof parsed.name === "string"
      ) {
        setSaved({ path: parsed.path, name: parsed.name.slice(0, 80) });
      }
    } catch {
      // sin almacenamiento local
    }
  }, [slug]);

  if (!saved) return null;
  return (
    <div className="bg-sage-soft text-olive mx-auto mb-6 flex max-w-xl flex-col items-center gap-2 rounded-2xl px-4 py-3 text-center text-sm sm:flex-row sm:justify-between sm:text-left">
      <p>
        Ya respondiste como <span className="font-semibold">{saved.name}</span>.
      </p>
      <Link href={saved.path} className="inline-flex min-h-10 items-center gap-1 font-medium underline underline-offset-4">
        Ver o editar mi respuesta <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
