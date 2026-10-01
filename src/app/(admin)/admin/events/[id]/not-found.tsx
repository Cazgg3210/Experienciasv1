import Link from "next/link";
import { CalendarX2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EventNotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <div className="bg-sage-soft text-olive mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
        <CalendarX2 className="size-5" aria-hidden />
      </div>
      <h1 className="font-heading text-3xl font-semibold">No encontramos este evento</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Puede que el enlace sea incorrecto o que el registro ya no exista.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/admin/events">Ver todos los eventos</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/calendar">Ir al calendario</Link>
        </Button>
      </div>
    </div>
  );
}
