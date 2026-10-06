import { CardsSkeleton } from "@/components/feedback/loading";
import { Skeleton } from "@/components/ui/skeleton";

export default function ExperiencesLoading() {
  return (
    <div className="container-page space-y-10 py-14 sm:py-20" aria-busy="true">
      <span className="sr-only">Cargando experiencias…</span>
      <div className="space-y-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-12 w-full max-w-xl" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      <Skeleton className="h-28 w-full rounded-3xl lg:h-20" />
      <CardsSkeleton count={6} />
    </div>
  );
}
