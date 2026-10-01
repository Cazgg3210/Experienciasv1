import { HeartCrack, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { capitalize } from "../domain/portal";

/** Aviso amable para eventos cancelados (portal), con datos de contacto. */
export function CancelledNotice({
  title,
  dateLabel,
  hostFirstName,
  contactEmail,
  whatsappUrl,
}: {
  title: string;
  dateLabel: string;
  hostFirstName: string;
  contactEmail: string;
  whatsappUrl: string;
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:py-20">
      <div className="bg-card rounded-3xl border p-6 text-center shadow-xs sm:p-10">
        <div className="bg-sand-soft text-taupe mx-auto mb-5 flex size-14 items-center justify-center rounded-full">
          <HeartCrack className="size-6" aria-hidden />
        </div>
        <p className="eyebrow">Evento cancelado</p>
        <h1 className="font-heading mt-2 text-3xl font-semibold text-balance sm:text-4xl">{title}</h1>
        <p className="text-muted-foreground mt-2">{capitalize(dateLabel)}</p>
        <p className="mt-6">
          {hostFirstName ? `${hostFirstName}, ` : ""}esta celebración fue cancelada. Si tienes cualquier duda sobre tu
          reserva, reembolsos o quieres elegir una nueva fecha, aquí estamos para ayudarte.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild size="xl">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden /> Escribir por WhatsApp
            </a>
          </Button>
          <Button asChild variant="outline" className="h-12 rounded-full px-6 text-base">
            <a href={`mailto:${contactEmail}`}>
              <Mail aria-hidden /> {contactEmail}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
