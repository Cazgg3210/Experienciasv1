"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** CTA fija en móvil que lleva al formulario; se oculta cuando el formulario ya está a la vista. */
export function StickyRsvpCta({ label, targetId = "rsvp" }: { label: string; targetId?: string }) {
  // Oculta al inicio (el hero ya tiene su CTA) y cuando el formulario está a la vista.
  const [formVisible, setFormVisible] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const el = document.getElementById(targetId);
    let io: IntersectionObserver | null = null;
    if (el && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(([entry]) => setFormVisible(!!entry?.isIntersecting), { threshold: 0.05 });
      io.observe(el);
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      io?.disconnect();
    };
  }, [targetId]);
  const hidden = formVisible || !scrolled;

  return (
    <div
      className={cn(
        "bg-ivory/95 supports-backdrop-filter:bg-ivory/80 fixed inset-x-0 bottom-0 z-40 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-200 md:hidden print:hidden",
        hidden && "pointer-events-none translate-y-full",
      )}
      aria-hidden={hidden || undefined}
    >
      <a
        href={`#${targetId}`}
        tabIndex={hidden ? -1 : undefined}
        className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-12 w-full items-center justify-center rounded-full text-base font-medium"
      >
        {label}
      </a>
    </div>
  );
}
