import { PageSkeleton } from "@/components/feedback/loading";

export default function Loading() {
  return (
    <main id="contenido" className="bg-ivory min-h-dvh">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <PageSkeleton rows={8} />
      </div>
    </main>
  );
}
