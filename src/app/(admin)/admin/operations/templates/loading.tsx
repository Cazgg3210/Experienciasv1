import { CardsSkeleton } from "@/components/feedback/loading";
import { Skeleton } from "@/components/ui/skeleton";

export default function TemplatesLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-72" />
      </div>
      <CardsSkeleton count={6} />
    </div>
  );
}
