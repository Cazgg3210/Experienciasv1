import { Skeleton } from "@/components/ui/skeleton";

export default function PagoLoading() {
  return (
    <div className="bg-card space-y-5 rounded-3xl border p-6 sm:p-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando tu pago…</span>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-2/3" />
      <div className="space-y-2">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
      <Skeleton className="h-12 w-full rounded-full" />
    </div>
  );
}
