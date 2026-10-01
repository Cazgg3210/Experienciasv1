import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ArrowRight } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { getSettings, getSettingsMeta } from "@/features/settings/server/settings-service";
import { SettingsSection } from "@/features/settings/components/settings-section";
import { AvailabilitySettingsForm } from "@/features/settings/components/availability-settings-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Disponibilidad · Configuración" };

export default async function AvailabilitySettingsPage() {
  const user = await requirePagePermission("settings:read", "/admin/settings/availability");
  const [availability, meta] = await Promise.all([getSettings("availability"), getSettingsMeta()]);
  const canEdit = can(user.role, "settings:write");
  return (
    <SettingsSection
      title="Disponibilidad"
      description="Anticipación, margen entre eventos y hora sugerida. Los días de operación y las fechas bloqueadas se administran en el calendario."
      meta={meta.availability}
      readOnly={!canEdit}
    >
      <Link
        href="/admin/calendar"
        className="bg-sage-soft/60 hover:bg-sage-soft focus-visible:ring-ring/50 group flex items-center gap-3 rounded-xl border border-sage/40 p-4 outline-none transition-colors focus-visible:ring-3"
      >
        <span className="bg-card text-olive flex size-10 shrink-0 items-center justify-center rounded-full">
          <CalendarDays className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Reglas semanales y excepciones</span>
          <span className="text-muted-foreground block text-sm">
            Días y horarios de operación, capacidad por día, bloqueos y temporadas especiales.
          </span>
        </span>
        <ArrowRight className="text-olive size-4 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
        <span className="sr-only">Abrir calendario</span>
      </Link>
      <AvailabilitySettingsForm defaults={availability} canEdit={canEdit} />
    </SettingsSection>
  );
}
