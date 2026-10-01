import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { getSettings, getSettingsMeta } from "@/features/settings/server/settings-service";
import { SettingsSection } from "@/features/settings/components/settings-section";
import { BusinessSettingsForm } from "@/features/settings/components/business-settings-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Negocio · Configuración" };

export default async function BusinessSettingsPage() {
  const user = await requirePagePermission("settings:read", "/admin/settings");
  const [business, meta] = await Promise.all([getSettings("business"), getSettingsMeta()]);
  const canEdit = can(user.role, "settings:write");
  return (
    <SettingsSection
      title="Negocio"
      description="Identidad, contacto y políticas que ven las clientas en el sitio, las propuestas y los mensajes."
      meta={meta.business}
      readOnly={!canEdit}
    >
      <BusinessSettingsForm defaults={business} canEdit={canEdit} />
    </SettingsSection>
  );
}
