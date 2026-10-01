import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { getSettings, getSettingsMeta } from "@/features/settings/server/settings-service";
import { SettingsSection, FormCard } from "@/features/settings/components/settings-section";
import { NotificationSettingsForm } from "@/features/settings/components/notification-settings-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notificaciones · Configuración" };

export default async function NotificationSettingsPage() {
  const user = await requirePagePermission("settings:read", "/admin/settings/notifications");
  const [ns, meta] = await Promise.all([getSettings("notifications"), getSettingsMeta()]);
  const canEdit = can(user.role, "settings:write");
  const rules = [
    { title: "Cotización por vencer", text: `${ns.quoteExpiringHoursBefore} h antes del vencimiento; las vencidas pasan a “Expirada”.` },
    { title: "Saldo pendiente", text: "3 días antes de la fecha límite del saldo y otra vez si se vence sin pagarse." },
    { title: "RSVP", text: `${ns.rsvpReminderDaysBefore} días antes, sólo a invitadas pendientes con email o teléfono.` },
    { title: "Evento en 7 días y en 48 h", text: "A la clienta, con el enlace a su portal para revisar detalles." },
    { title: "Post-evento", text: "Un día después, con la Memory Capsule si ya está publicada." },
    { title: "Reseña", text: "Tres días después del evento, si aún no deja su opinión." },
  ];
  return (
    <SettingsSection
      title="Notificaciones"
      description="Tiempos de los recordatorios automáticos y el correo que recibe los avisos internos."
      meta={meta.notifications}
      readOnly={!canEdit}
      actions={
        <Button asChild variant="outline" size="lg">
          <Link href="/admin/notifications">
            <Inbox aria-hidden />
            Abrir bandeja
          </Link>
        </Button>
      }
    >
      <NotificationSettingsForm defaults={ns} canEdit={canEdit} />
      <FormCard
        title="Qué se envía automáticamente"
        description="El programador corre cada hora (cron) y nunca duplica un mensaje: cada envío tiene una clave única."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {rules.map((r) => (
            <li key={r.title} className="bg-sand-soft/50 rounded-lg border p-3">
              <p className="text-sm font-medium">{r.title}</p>
              <p className="text-muted-foreground text-sm">{r.text}</p>
            </li>
          ))}
        </ul>
      </FormCard>
    </SettingsSection>
  );
}
