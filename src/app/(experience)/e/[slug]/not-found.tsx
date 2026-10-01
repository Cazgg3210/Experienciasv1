import Link from "next/link";
import { MailQuestion } from "lucide-react";

export default function MicrositeNotFound() {
  return (
    <main id="contenido" className="bg-ivory flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="bg-sage-soft text-olive mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
          <MailQuestion className="size-6" aria-hidden />
        </div>
        <p className="eyebrow">Invitación</p>
        <h1 className="font-heading mt-2 text-3xl font-semibold">Esta invitación no está disponible</h1>
        <p className="text-muted-foreground mt-3">
          El enlace puede estar incompleto o ya no estar activo. Pídele a la anfitriona que te lo comparta de nuevo.
        </p>
        <p className="mt-6 text-sm">
          <Link href="/" className="text-olive font-medium underline underline-offset-4">
            Conoce Ivonne &amp; Rosa
          </Link>
        </p>
      </div>
    </main>
  );
}
