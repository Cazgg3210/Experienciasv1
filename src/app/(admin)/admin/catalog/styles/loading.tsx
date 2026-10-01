import { CardsSkeleton } from "@/components/feedback/loading";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-40" />
      <CardsSkeleton count={6} />
    </div>
  );
}
