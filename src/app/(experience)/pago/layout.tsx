import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";

/** Layout de checkout/resultado de pago: marca, contenido centrado y aviso de pago seguro. */
export default function PagoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-ivory flex min-h-dvh flex-col">
      <header className="border-b border-black/5">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo href={null} subtitle="Pago seguro" />
          <span className="text-taupe inline-flex items-center gap-1.5 text-xs">
            <ShieldCheck className="size-4" aria-hidden />
            Conexión cifrada
          </span>
        </div>
      </header>
      <main id="contenido" className="flex flex-1 items-start justify-center px-4 py-10 sm:px-6 sm:py-16">
        <div className="w-full max-w-xl">{children}</div>
      </main>
      <footer className="text-muted-foreground px-4 pb-8 text-center text-xs">
        Nunca te pediremos datos de tu tarjeta por WhatsApp ni por correo.
      </footer>
    </div>
  );
}
