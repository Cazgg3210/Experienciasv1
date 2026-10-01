import Link from "next/link";
import { cn } from "@/lib/utils";

/** Wordmark de la marca (configurable: el nombre real puede cambiar en Configuración). */
export function Logo({
  href = "/",
  className,
  name = "Ivonne & Rosa",
  subtitle,
}: {
  href?: string | null;
  className?: string;
  name?: string;
  subtitle?: string;
}) {
  const content = (
    <span className={cn("inline-flex flex-col leading-none", className)}>
      <span className="font-heading text-2xl font-semibold tracking-tight">{name}</span>
      {subtitle ? <span className="text-muted-foreground mt-1 text-[10px] tracking-[0.22em] uppercase">{subtitle}</span> : null}
    </span>
  );
  if (!href) return content;
  return (
    <Link href={href} aria-label={`${name} — inicio`} className="focus-visible:ring-ring rounded-md">
      {content}
    </Link>
  );
}
