import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
      <span className="sr-only">Preparando vista para imprimir…</span>
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-[640px] w-full rounded-2xl" />
    </div>
  );
}
