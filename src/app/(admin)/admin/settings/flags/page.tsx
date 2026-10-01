import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { getFlagStates, getSettingsMeta } from "@/features/settings/server/settings-service";
import { SettingsSection } from "@/features/settings/components/settings-section";
import { FlagsPanel } from "@/features/settings/components/flags-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Funciones · Configuración" };

export default async function FlagsSettingsPage() {
  const user = await requirePagePermission("settings:read", "/admin/settings/flags");
  const [flags, meta] = await Promise.all([getFlagStates(), getSettingsMeta()]);
  const canEdit = can(user.role, "settings:write");
  return (
    <SettingsSection
      title="Funciones"
      description="Enciende o apaga módulos sin redeplegar. El ajuste del panel tiene prioridad sobre la variable de entorno; puedes restablecerlo cuando quieras."
      meta={meta.flags}
      readOnly={!canEdit}
    >
      <FlagsPanel flags={flags} canEdit={canEdit} />
    </SettingsSection>
  );
}
