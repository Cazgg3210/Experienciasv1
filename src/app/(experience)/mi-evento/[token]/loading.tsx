import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main id="contenido" className="bg-ivory min-h-dvh" aria-busy="true">
      <span className="sr-only">Cargando tu evento…</span>
      <div className="bg-sand-soft">
        <div className="mx-auto max-w-6xl space-y-4 px-4 pt-10 pb-10 sm:px-6">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-12 w-3/4 max-w-lg" />
          <Skeleton className="h-5 w-64" />
          <div className="flex gap-2 pt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-24 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card space-y-3 rounded-3xl border p-6">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ))}
      </div>
    </main>
  );
}
