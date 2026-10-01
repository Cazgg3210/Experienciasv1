import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="bg-ivory min-h-dvh" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando tu Memory Capsule…</span>
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <Skeleton className="h-7 w-40" />
      </div>
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 pt-2 pb-12 sm:px-6 md:grid-cols-2 md:gap-12">
        <div className="order-2 space-y-4 md:order-1">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-12 w-4/5" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-20 w-full" />
          <div className="flex gap-3">
            <Skeleton className="h-12 w-40 rounded-full" />
            <Skeleton className="h-12 w-32 rounded-full" />
          </div>
        </div>
        <Skeleton className="order-1 aspect-[4/3] w-full rounded-[2rem] md:order-2 md:aspect-[4/5]" />
      </div>
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-4 sm:grid-cols-3 sm:px-6 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className={i % 3 === 0 ? "aspect-[3/4] rounded-2xl" : "aspect-square rounded-2xl"} />
        ))}
      </div>
    </div>
  );
}
