import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requirePagePermission } from "@/server/auth/session";
import { getPurchaseFormOptions } from "@/features/purchases/server/queries";
import { PurchaseForm } from "@/features/purchases/components/purchase-form";
import { defaultCostCategoryForVendor } from "@/features/purchases/domain/purchase-rules";

export const metadata: Metadata = { title: "Nueva compra" };
export const dynamic = "force-dynamic";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function NewPurchasePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission("purchases:write");
  const sp = await searchParams;
  const eventIdParam = first(sp.eventId)?.slice(0, 64) ?? null;
  const vendorIdParam = first(sp.vendorId)?.slice(0, 64) ?? null;
  const options = await getPurchaseFormOptions({ includeEventId: eventIdParam, includeVendorId: null });
  // Sólo pre-llenamos valores que existen (ignora ids inválidos o proveedores bloqueados).
  const event = options.events.find((e) => e.id === eventIdParam);
  const vendor = options.vendors.find((v) => v.id === vendorIdParam);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        back={event ? { href: `/admin/purchases?event=${event.id}`, label: "Compras del evento" } : { href: "/admin/purchases", label: "Compras" }}
        title="Nueva compra"
        description={
          event
            ? `Para ${event.label}. Registra lo que se pedirá y cuánto esperas pagar.`
            : "Registra lo que se pedirá y cuánto esperas pagar. Al recibirla capturas el monto real."
        }
      />
      <div className="bg-card rounded-xl border p-4 sm:p-6">
        <PurchaseForm
          options={options}
          initial={{
            eventId: event?.id ?? null,
            vendorId: vendor?.id ?? null,
            category: defaultCostCategoryForVendor(vendor?.category),
          }}
        />
      </div>
    </div>
  );
}
