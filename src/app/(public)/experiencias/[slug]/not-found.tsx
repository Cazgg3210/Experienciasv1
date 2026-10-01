import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ExperienceNotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="eyebrow mb-3">Experiencia no disponible</p>
      <h1 className="font-heading text-charcoal max-w-xl text-4xl font-medium text-balance sm:text-5xl">
        Esta mesa ya no está puesta
      </h1>
      <p className="text-muted-foreground mt-4 max-w-md">
        La experiencia que buscas no existe o ya no está disponible. Te invitamos a conocer las demás o a diseñar una a tu medida.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="xl">
          <Link href="/experiencias">Ver experiencias</Link>
        </Button>
        <Button asChild size="xl" variant="ghost" className="rounded-full">
          <Link href="/crear-experiencia">Diseña tu experiencia</Link>
        </Button>
      </div>
    </div>
  );
}
