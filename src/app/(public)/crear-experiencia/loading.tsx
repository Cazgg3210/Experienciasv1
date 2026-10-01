import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="bg-ivory" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando el configurador…</span>
      <div className="container-page pt-8 pb-2 sm:pt-14">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="mt-4 h-12 w-full max-w-xl" />
        <Skeleton className="mt-4 h-5 w-full max-w-2xl" />
      </div>
      <div className="container-page pt-8 pb-16 sm:pt-10">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
          <div>
            <Skeleton className="h-10 w-72 max-w-full" />
            <Skeleton className="mt-3 h-5 w-96 max-w-full" />
            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-2xl" />
              ))}
            </div>
          </div>
          <Skeleton className="hidden h-80 rounded-3xl lg:block" />
        </div>
      </div>
    </div>
  );
}
