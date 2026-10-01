import { cn } from "@/lib/utils";
import type { DesignPaletteColor } from "../types";

/** Muestras de color con nombre y hex (lista accesible). */
export function PaletteSwatches({
  palette,
  className,
}: {
  palette: DesignPaletteColor[];
  className?: string;
}) {
  return (
    <ul
      className={cn("grid grid-cols-3 gap-3 sm:grid-cols-5", className)}
      aria-label="Paleta de colores sugerida"
    >
      {palette.map((c) => (
        <li key={c.hex} className="min-w-0">
          <span
            aria-hidden
            className="block aspect-square w-full rounded-2xl border border-black/10 shadow-inner"
            style={{ backgroundColor: c.hex }}
          />
          <span className="mt-1.5 block truncate text-sm font-medium">{c.name}</span>
          <span className="text-muted-foreground block font-mono text-xs uppercase">{c.hex}</span>
        </li>
      ))}
    </ul>
  );
}

/** Franja de la paleta (decorativa). */
export function PaletteStrip({ palette, className }: { palette: DesignPaletteColor[]; className?: string }) {
  return (
    <div aria-hidden className={cn("flex h-2.5 w-full overflow-hidden", className)}>
      {palette.map((c) => (
        <span key={c.hex} className="flex-1" style={{ backgroundColor: c.hex }} />
      ))}
    </div>
  );
}
