import { Skeleton } from "@/components/ui/skeleton";

export default function StaffHomeLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only">Cargando tus eventos…</span>
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-4 w-72 max-w-full" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-2xl" />
      ))}
    </div>
  );
}
