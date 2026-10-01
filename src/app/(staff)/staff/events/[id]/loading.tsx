import { Skeleton } from "@/components/ui/skeleton";

export default function StaffEventLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only">Cargando el evento…</span>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
