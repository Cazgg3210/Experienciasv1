import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminNotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="font-heading text-3xl font-semibold">No encontramos este registro</h1>
      <p className="text-muted-foreground mt-2 text-sm">Puede que haya sido eliminado o que el enlace sea incorrecto.</p>
      <Button asChild className="mt-6">
        <Link href="/admin">Volver al resumen</Link>
      </Button>
    </div>
  );
}
