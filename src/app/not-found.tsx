import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="contenido" className="flex min-h-dvh items-center justify-center px-5">
      <div className="max-w-md text-center">
        <p className="eyebrow mb-3">404</p>
        <h1 className="font-heading text-4xl font-semibold">Esta mesa no está puesta</h1>
        <p className="text-muted-foreground mt-3">La página que buscas no existe o el enlace ya no es válido.</p>
        <Button asChild className="mt-6 rounded-full">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </div>
    </main>
  );
}
