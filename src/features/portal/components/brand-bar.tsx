import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/** Barra superior mínima de las experiencias por token (sin navegación de marketing). */
export function BrandBar({
  brandName,
  right,
  className,
}: {
  brandName?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("border-border/60 bg-ivory/90 border-b print:hidden", className)}>
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo href="/" name={brandName} className="[&>span:first-child]:text-xl" />
        {right}
      </div>
    </header>
  );
}
