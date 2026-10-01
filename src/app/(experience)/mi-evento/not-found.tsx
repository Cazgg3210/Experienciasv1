import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PortalNotFound() {
  return (
    <main id="contenido" className="bg-ivory flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="bg-sage-soft text-olive mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
          <KeyRound className="size-6" aria-hidden />
        </div>
        <p className="eyebrow">Mi evento</p>
        <h1 className="font-heading mt-2 text-3xl font-semibold">Este enlace no es válido</h1>
        <p className="text-muted-foreground mt-3">
          Puede que esté incompleto o que haya cambiado. Escribe tu correo y te enviamos tu enlace personal de nuevo.
        </p>
        <Button asChild size="xl" className="mt-6">
          <Link href="/mi-evento">Pedir mi enlace</Link>
        </Button>
      </div>
    </main>
  );
}
