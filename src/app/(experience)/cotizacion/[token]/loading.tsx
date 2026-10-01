import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="bg-ivory min-h-dvh" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando tu propuesta…</span>
      <div className="border-border/60 h-14 border-b" />
      <div className="mx-auto max-w-5xl space-y-8 px-4 pt-10 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <Skeleton className="aspect-[4/3] w-full rounded-3xl" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-3xl" />
      </div>
    </div>
  );
}
