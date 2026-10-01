import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton editorial para páginas del sitio público (loading.tsx). */
export function MarketingPageSkeleton({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="container-page py-14 sm:py-20" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-12 w-full max-w-xl sm:h-14" />
        <Skeleton className="h-5 w-full max-w-2xl" />
        <Skeleton className="h-5 w-3/4 max-w-xl" />
      </div>
      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <Skeleton className="aspect-[4/3] w-full rounded-[2rem]" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
