"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { WhatsAppIcon } from "./brand-icons";

/**
 * Botón flotante de WhatsApp. Se oculta en el configurador (/crear-experiencia),
 * que tiene su propia barra de acciones fija en móvil.
 */
export function WhatsAppFab({ href, hiddenOn = ["/crear-experiencia"] }: { href: string; hiddenOn?: string[] }) {
  const pathname = usePathname();
  if (pathname && hiddenOn.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp (se abre en una pestaña nueva)"
      className={cn(
        "no-print bg-olive text-ivory fixed right-4 z-30 inline-flex items-center gap-2 rounded-full p-3.5 shadow-lg shadow-black/10 sm:right-6 sm:px-5",
        "bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-6",
        "transition-transform duration-200 motion-safe:hover:-translate-y-0.5 hover:bg-[color-mix(in_oklch,var(--brand-olive),black_12%)]",
        "focus-visible:outline-offset-4",
      )}
    >
      <WhatsAppIcon className="size-6 sm:size-5" />
      <span className="hidden text-sm font-medium sm:inline">WhatsApp</span>
    </a>
  );
}
