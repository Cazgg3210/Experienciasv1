import Link from "next/link";
import { Button } from "@/components/ui/button";

/** 404 genérico: no revela si el token existe, está en borrador o pertenece a otra persona. */
export default function QuoteNotFound() {
  return (
    <main id="contenido" className="bg-ivory flex min-h-dvh items-center justify-center px-5">
      <div className="max-w-md text-center">
        <p className="eyebrow mb-3">404</p>
        <h1 className="font-heading text-4xl font-semibold">No encontramos esta propuesta</h1>
        <p className="text-muted-foreground mt-3">
          El enlace no es válido o ya no está disponible. Si crees que es un error, escríbenos y con gusto te ayudamos.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild className="rounded-full">
            <Link href="/contacto">Contáctanos</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/">Ir al inicio</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
