import { Skeleton } from "@/components/ui/skeleton";

export default function ExperienceDetailLoading() {
  return (
    <div className="container-page py-14 sm:py-20" aria-busy="true">
      <span className="sr-only">Cargando experiencia…</span>
      <div className="space-y-4">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-14 w-full max-w-lg" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <div className="mt-10 grid gap-10 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <Skeleton className="aspect-[4/3] w-full rounded-[1.75rem]" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="aspect-[4/3] rounded-2xl" />
            <Skeleton className="aspect-[4/3] rounded-2xl" />
          </div>
        </div>
        <Skeleton className="h-96 w-full rounded-[1.75rem] lg:col-span-5" />
      </div>
    </div>
  );
}
