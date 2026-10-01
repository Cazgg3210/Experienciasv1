import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="bg-ivory min-h-[70dvh]" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando el diseñador…</span>
      <div className="container-page max-w-5xl pt-8 pb-8 sm:pt-14">
        <div className="bg-sand-soft space-y-4 rounded-[2rem] px-6 py-9 sm:px-10 sm:py-12">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-10 w-full max-w-xl" />
          <Skeleton className="h-10 w-2/3 max-w-md" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
      </div>
      <div className="container-page max-w-4xl space-y-5 pb-20">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border-border bg-card/80 space-y-4 rounded-3xl border p-5 sm:p-7">
            <Skeleton className="h-7 w-64 max-w-full" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 6 }).map((__, k) => (
                <Skeleton key={k} className="h-11 w-28 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
