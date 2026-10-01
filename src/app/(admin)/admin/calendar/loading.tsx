import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando calendario…</span>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-56" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-56 rounded-lg" />
      </div>
      <div className="hidden grid-cols-7 gap-px overflow-hidden rounded-xl border md:grid">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-none" />
        ))}
      </div>
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
