import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { getSettings, getSettingsMeta } from "@/features/settings/server/settings-service";
import { pricingToForm } from "@/features/settings/domain/pricing-form";
import { SettingsSection } from "@/features/settings/components/settings-section";
import { PricingSettingsForm } from "@/features/settings/components/pricing-settings-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Precios y márgenes · Configuración" };

export default async function PricingSettingsPage() {
  const user = await requirePagePermission("settings:read", "/admin/settings/pricing");
  const [pricing, meta] = await Promise.all([getSettings("pricing"), getSettingsMeta()]);
  const canEdit = can(user.role, "settings:write");
  return (
    <SettingsSection
      title="Precios y márgenes"
      description="IVA, anticipo, vigencia, margen mínimo y comisiones que usa el motor de cotización. Los porcentajes se capturan en % y los montos en pesos."
      meta={meta.pricing}
      readOnly={!canEdit}
    >
      <PricingSettingsForm defaults={pricingToForm(pricing)} canEdit={canEdit} />
    </SettingsSection>
  );
}
