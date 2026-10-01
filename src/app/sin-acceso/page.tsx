import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Sin acceso", robots: { index: false } };

export default function NoAccessPage() {
  return (
    <main id="contenido" className="flex min-h-dvh items-center justify-center px-5">
      <div className="max-w-md text-center">
        <p className="eyebrow mb-3">403</p>
        <h1 className="font-heading text-3xl font-semibold">No tienes acceso a esta sección</h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Si crees que es un error, pide a una fundadora que revise tu rol.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild variant="outline">
            <Link href="/">Ir al sitio</Link>
          </Button>
          <Button asChild>
            <Link href="/login">Cambiar de cuenta</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
