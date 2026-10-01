import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PagoNotFound() {
  return (
    <div className="bg-card rounded-3xl border px-6 py-12 text-center">
      <p className="eyebrow mb-3">Enlace no válido</p>
      <h1 className="font-heading text-3xl font-semibold">No encontramos este pago</h1>
      <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm">
        El enlace pudo haber expirado o estar incompleto. Entra a tu portal desde el enlace que te enviamos para revisar
        el estado de tus pagos.
      </p>
      <Button asChild size="xl" variant="outline" className="mt-6">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
