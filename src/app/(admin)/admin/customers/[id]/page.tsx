import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarHeart, Gift, History, Lock, Megaphone, UserRound, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/data/stat-card";
import { CopyButton } from "@/components/data/copy-button";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { formatLongDate, localDateKey } from "@/lib/dates";
import { formatMXN } from "@/lib/money";
import { LEAD_SOURCE_LABELS } from "@/lib/labels";
import { getCustomerDetail } from "@/features/customers/server/customer-service";
import { CustomerProfileForm } from "@/features/customers/components/customer-profile-form";
import { CustomerDeleteButton } from "@/features/customers/components/customer-delete-button";
import { CustomerHistory } from "@/features/customers/components/customer-history";
import { Panel } from "@/features/leads/components/panel";
import { relativeTime } from "@/features/leads/domain/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ficha de clienta" };

type Props = { params: Promise<{ id: string }> };

export default async function CustomerDetailPage({ params }: Props) {
  const user = await requirePagePermission("customers:read");
  const { id } = await params;
  const detail = await getCustomerDetail(user, id);
  if (!detail) notFound();

  const { customer, totalPaidCents, referrals, blockers, lastActivityAt } = detail;
  const canWrite = can(user.role, "customers:write");
  const now = new Date();

  return (
    <>
      <PageHeader
        back={{ href: "/admin/customers", label: "Clientes" }}
        eyebrow={`Clienta desde ${formatLongDate(localDateKey(customer.createdAt)).replace(/^\S+ /, "")}`}
        title={customer.name}
        description={
          <>
            Llegó por {LEAD_SOURCE_LABELS[customer.source]}
            {lastActivityAt ? ` · última actividad ${relativeTime(lastActivityAt, now)}` : ""}
          </>
        }
        actions={
          canWrite && blockers.length === 0 ? (
            <CustomerDeleteButton customerId={customer.id} customerName={customer.name} leadsCount={customer._count.leads} />
          ) : null
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total pagado" value={formatMXN(totalPaidCents)} icon={Wallet} hint="Neto de reembolsos" />
        <StatCard label="Leads" value={customer._count.leads} icon={Megaphone} />
        <StatCard label="Eventos" value={customer._count.events} icon={CalendarHeart} />
        <StatCard label="Referidas" value={referrals} icon={Gift} hint="Leads con su código" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Perfil" icon={UserRound}>
            <CustomerProfileForm
              readOnly={!canWrite}
              defaultValues={{
                customerId: customer.id,
                name: customer.name,
                email: customer.email ?? "",
                phone: customer.phone ?? "",
                whatsapp: customer.whatsapp ?? "",
                instagram: customer.instagram ? `@${customer.instagram}` : "",
                notes: customer.notes ?? "",
                marketingOptIn: customer.marketingOptIn,
              }}
            />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Código de referido" icon={Gift}>
            <p className="bg-sand-soft rounded-xl border px-3 py-3 text-center font-mono text-lg tracking-wider select-all">
              {customer.referralCode}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">
                {referrals ? `${referrals} ${referrals === 1 ? "lead llegó" : "leads llegaron"} con este código.` : "Compártelo para que recomiende a sus amigas."}
              </p>
              <CopyButton value={customer.referralCode} size="sm" toastMessage="Código copiado" aria-label="Copiar código de referido" />
            </div>
          </Panel>

          {customer.user ? (
            <Panel title="Acceso" icon={Lock}>
              <p className="text-sm">
                Vinculada a la cuenta <span className="font-medium">{customer.user.email}</span>.
              </p>
            </Panel>
          ) : null}

          {canWrite && blockers.length > 0 ? (
            <section aria-labelledby="delete-blocked" className="bg-muted/60 rounded-2xl border p-4 text-sm">
              <h2 id="delete-blocked" className="font-medium">
                No se puede eliminar
              </h2>
              <ul className="text-muted-foreground mt-1 list-disc space-y-0.5 pl-5">
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <p className="text-muted-foreground mt-2 text-xs">
                Conservamos su historial comercial y de pagos. Si es un duplicado, actualiza sus datos en lugar de borrarla.
              </p>
            </section>
          ) : null}
        </div>
      </div>

      <section aria-labelledby="history-title" className="mt-8">
        <h2 id="history-title" className="font-heading mb-4 inline-flex items-center gap-2 text-2xl font-semibold">
          <History className="text-olive size-5" aria-hidden />
          Historial
        </h2>
        <CustomerHistory
          detail={detail}
          links={{
            quotes: can(user.role, "quotes:read"),
            events: can(user.role, "events:read_all"),
            payments: can(user.role, "payments:read"),
          }}
        />
      </section>

      <p className="text-muted-foreground mt-8 text-xs">
        ¿Buscas otra clienta?{" "}
        <Link href="/admin/customers" className="underline underline-offset-2">
          Volver al listado
        </Link>
      </p>
    </>
  );
}
