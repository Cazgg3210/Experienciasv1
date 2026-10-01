import type { Metadata } from "next";
import { CheckCircle2, CircleDashed, Clock, Webhook } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { StatusBadge } from "@/components/data/status-badge";
import { CopyButton } from "@/components/data/copy-button";
import { cn } from "@/lib/utils";
import { SettingsSection, FormCard } from "@/features/settings/components/settings-section";
import { IntegrationTestButtons } from "@/features/settings/components/integration-test-buttons";
import { getCronInfo, getIntegrationCards, getWebhookUrls } from "@/features/settings/server/integrations-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Integraciones · Configuración" };

export default async function IntegrationsPage() {
  const user = await requirePagePermission("settings:read", "/admin/settings/integrations");
  const canEdit = can(user.role, "settings:write");
  const cards = getIntegrationCards();
  const webhooks = getWebhookUrls();
  const cron = getCronInfo();
  const demoCount = cards.filter((c) => c.mock).length;

  return (
    <SettingsSection
      title="Integraciones"
      description="Estado de los proveedores externos. Si falta una credencial, la plataforma funciona en modo demo y todo queda registrado sin salir a internet."
    >
      <p
        className={cn(
          "rounded-lg border px-3 py-2 text-sm",
          demoCount ? "bg-sand-soft text-charcoal" : "bg-sage-soft text-olive border-sage/40",
        )}
        role="status"
      >
        {demoCount
          ? `${demoCount} de ${cards.length} integraciones están en modo demo. Configura las variables de entorno indicadas y vuelve a desplegar para activarlas.`
          : "Todas las integraciones están conectadas a proveedores reales."}
      </p>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <li key={c.key} className="bg-card flex flex-col rounded-xl border p-4 shadow-xs sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-heading text-lg font-semibold">{c.title}</h3>
                <p className="text-muted-foreground text-sm">{c.description}</p>
              </div>
              <StatusBadge tone={c.mock ? "warning" : "success"}>{c.mock ? "Modo demo" : "Real"}</StatusBadge>
            </div>
            <p className="mt-3 text-sm">
              Proveedor: <span className="font-medium">{c.providerName}</span>
            </p>
            {c.mock ? <p className="text-muted-foreground mt-1 text-xs">{c.demoNote}</p> : null}
            <div className="mt-4 border-t pt-3">
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Variables de entorno</p>
              <ul className="space-y-1.5">
                {c.envVars.map((v) => (
                  <li key={v.name} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                    {v.set ? (
                      <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
                    ) : (
                      <CircleDashed className="text-muted-foreground size-4 shrink-0" aria-hidden />
                    )}
                    <code className="bg-muted rounded px-1.5 py-0.5 text-xs break-all">{v.name}</code>
                    <span className={cn("text-xs", v.set ? "text-success" : "text-muted-foreground")}>
                      {v.set ? "configurada" : v.required ? "falta" : "opcional"}
                    </span>
                    {v.hint ? <span className="text-muted-foreground text-xs">· {v.hint}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>

      <FormCard
        title="Webhooks de pagos"
        description="Configura estas URLs en el panel del proveedor de pagos para confirmar anticipos y saldos automáticamente."
      >
        <ul className="divide-y">
          {webhooks.map((w) => (
            <li key={w.provider} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Webhook className="text-olive size-4" aria-hidden />
                  {w.label}
                </p>
                <code className="text-muted-foreground block text-xs break-all">{w.url}</code>
                <p className="text-muted-foreground text-xs">{w.note}</p>
              </div>
              <CopyButton value={w.url} size="sm" label="Copiar URL" toastMessage="URL copiada" />
            </li>
          ))}
        </ul>
      </FormCard>

      <FormCard
        title="Recordatorios programados (cron)"
        description="Un servicio de cron debe llamar a esta URL cada hora con el encabezado de autorización. El secreto nunca se muestra aquí."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Clock className="text-olive size-4" aria-hidden />
            <span>{cron.schedule}</span>
            <StatusBadge tone={cron.secretConfigured ? "success" : "danger"}>
              {cron.secretConfigured ? "CRON_SECRET configurado" : "Falta CRON_SECRET"}
            </StatusBadge>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <code className="text-muted-foreground text-xs break-all">{cron.url}</code>
            <CopyButton value={cron.url} size="sm" label="Copiar URL" toastMessage="URL copiada" />
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-xs">Ejemplo (GET o POST):</p>
            <pre className="bg-charcoal text-ivory overflow-x-auto rounded-lg p-3 text-xs leading-relaxed">
              <code>{cron.curl}</code>
            </pre>
            <div className="mt-2">
              <CopyButton value={cron.curl} size="sm" label="Copiar comando" toastMessage="Comando copiado" />
            </div>
          </div>
        </div>
      </FormCard>

      <FormCard
        title="Prueba de mensajes"
        description="Envía un mensaje de prueba por el proveedor actual. En modo demo se registra en la Bandeja."
      >
        <IntegrationTestButtons canEdit={canEdit} email={user.email} />
      </FormCard>
    </SettingsSection>
  );
}
