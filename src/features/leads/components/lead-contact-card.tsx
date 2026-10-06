import { Mail, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/data/copy-button";
import { normalizeMxPhone, whatsappLink } from "@/server/providers/whatsapp/links";
import { formatDateTime, formatLongDate } from "@/lib/dates";
import type { Occasion } from "@prisma/client";
import { buildEmailBody, buildEmailSubject, buildWhatsappMessage, mailtoLink, telLink } from "../domain/lead-workflow";
import { relativeTime } from "../domain/format";

/** Bloque de contacto con acciones rápidas (WhatsApp con mensaje plantilla, correo, llamada). */
export function LeadContactCard({
  lead,
  senderName,
  now = new Date(),
}: {
  lead: {
    name: string;
    phone: string | null;
    email: string | null;
    occasion: Occasion;
    occasionOther: string | null;
    eventDate: Date | null;
    guestCount: number | null;
    experienceName: string | null;
    lastContactedAt: Date | null;
  };
  senderName: string;
  now?: Date;
}) {
  const ctx = {
    leadName: lead.name,
    senderName,
    occasion: lead.occasion,
    occasionOther: lead.occasionOther,
    eventDateLabel: lead.eventDate ? formatLongDate(lead.eventDate) : null,
    guestCount: lead.guestCount,
    experienceName: lead.experienceName,
  };
  // Sólo con un número válido para wa.me (si no, el enlace abriría WhatsApp sin destinataria)
  const wa = normalizeMxPhone(lead.phone) ? whatsappLink(lead.phone, buildWhatsappMessage(ctx)) : null;
  const mail = lead.email ? mailtoLink(lead.email, buildEmailSubject(ctx), buildEmailBody(ctx)) : null;

  return (
    <div className="space-y-4">
      {/* Cada <div> del <dl> agrupa SÓLO <dt>/<dd>: el botón de copiar vive dentro del <dd>. */}
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="sr-only">Teléfono</dt>
          <dd className="flex items-center justify-between gap-2">
            <span className="inline-flex min-w-0 items-center gap-2">
              <Phone className="text-muted-foreground size-4 shrink-0" aria-hidden />
              {lead.phone ? <span className="truncate">{lead.phone}</span> : <span className="text-muted-foreground">Sin teléfono</span>}
            </span>
            {lead.phone ? (
              <CopyButton value={lead.phone} label="Copiar" size="xs" variant="ghost" toastMessage="Teléfono copiado" aria-label="Copiar teléfono" />
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Email</dt>
          <dd className="flex items-center justify-between gap-2">
            <span className="inline-flex min-w-0 items-center gap-2">
              <Mail className="text-muted-foreground size-4 shrink-0" aria-hidden />
              {lead.email ? <span className="truncate">{lead.email}</span> : <span className="text-muted-foreground">Sin correo</span>}
            </span>
            {lead.email ? (
              <CopyButton value={lead.email} label="Copiar" size="xs" variant="ghost" toastMessage="Correo copiado" aria-label="Copiar correo" />
            ) : null}
          </dd>
        </div>
      </dl>

      <div className="grid gap-2">
        {wa ? (
          <Button asChild size="lg" className="w-full">
            <a href={wa} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden />
              Escribir por WhatsApp
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
          </Button>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {mail ? (
            <Button asChild variant="outline" size="lg">
              <a href={mail}>
                <Mail aria-hidden />
                Correo
              </a>
            </Button>
          ) : null}
          {lead.phone ? (
            <Button asChild variant="outline" size="lg" className={mail ? undefined : "col-span-2"}>
              <a href={telLink(lead.phone)}>
                <Phone aria-hidden />
                Llamar
              </a>
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        {lead.lastContactedAt ? (
          <>
            Último contacto:{" "}
            <time dateTime={lead.lastContactedAt.toISOString()} title={formatDateTime(lead.lastContactedAt)}>
              {relativeTime(lead.lastContactedAt, now)}
            </time>
          </>
        ) : (
          "Aún no se registra contacto. Después de escribirle, regístralo abajo."
        )}
      </p>
    </div>
  );
}
