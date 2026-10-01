import { Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export default function MemoryNotFound() {
  return (
    <div className="bg-ivory flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
        <Logo href={null} subtitle="Memory Capsule" />
      </header>
      <main id="contenido" className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="max-w-md text-center">
          <div className="bg-sage-soft text-olive mx-auto mb-6 flex size-14 items-center justify-center rounded-full">
            <Sparkles className="size-6" aria-hidden />
          </div>
          <h1 className="font-heading text-3xl font-semibold text-balance sm:text-4xl">No encontramos esta cápsula</h1>
          <p className="text-muted-foreground mt-3">
            El enlace no es válido o ya fue reemplazado por uno nuevo. Pídele a quien te lo compartió el enlace más reciente.
          </p>
        </div>
      </main>
    </div>
  );
}
