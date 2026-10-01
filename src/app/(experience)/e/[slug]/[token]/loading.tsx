import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main id="contenido" className="bg-ivory min-h-dvh" aria-busy="true">
      <span className="sr-only">Cargando tu invitación…</span>
      <div className="bg-sand-soft">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 pt-16 pb-12">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-14 w-4/5 max-w-xl" />
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-5 w-72" />
          <Skeleton className="mt-4 h-12 w-56 rounded-full" />
        </div>
      </div>
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-12">
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    </main>
  );
}
