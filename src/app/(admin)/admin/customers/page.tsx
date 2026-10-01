import type { Metadata } from "next";
import Link from "next/link";
import { Search, SearchX, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { Pagination, parsePage } from "@/components/data/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requirePagePermission } from "@/server/auth/session";
import {
  CUSTOMERS_PAGE_SIZE,
  CUSTOMER_SORTS,
  listCustomers,
  type CustomerSort,
} from "@/features/customers/server/customer-service";
import { CustomersTable } from "@/features/customers/components/customers-table";
import { NativeSelect } from "@/features/leads/components/native-select";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Clientes" };

type SP = Record<string, string | string[] | undefined>;

const SORT_LABELS: Record<CustomerSort, string> = { recent: "Más recientes", name: "Nombre (A–Z)" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePagePermission("customers:read", "/admin/customers");
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 100) || null;
  const sortRaw = Array.isArray(sp.sort) ? sp.sort[0] : sp.sort;
  const sort: CustomerSort = (CUSTOMER_SORTS as readonly string[]).includes(sortRaw ?? "") ? (sortRaw as CustomerSort) : "recent";
  const result = await listCustomers(user, { q, sort, page: parsePage(sp.page), pageSize: CUSTOMERS_PAGE_SIZE });

  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Clientes"
        description="Quienes ya celebraron con nosotras o están por hacerlo: historial, pagos y referidos."
      />

      <form method="get" action="/admin/customers" role="search" aria-label="Buscar clientas" className="mb-5 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="customers-q" className="sr-only">
            Buscar clientas
          </label>
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
          <Input
            id="customers-q"
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder="Nombre, email, teléfono, Instagram o código de referido"
            className="h-9 pl-8"
            maxLength={100}
          />
        </div>
        <div className="flex gap-2">
          <label htmlFor="customers-sort" className="sr-only">
            Orden
          </label>
          <NativeSelect id="customers-sort" name="sort" defaultValue={sort} className="flex-1 sm:w-44 sm:flex-none">
            {CUSTOMER_SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" size="lg">
            Buscar
          </Button>
        </div>
      </form>

      {result.total === 0 ? (
        q ? (
          <EmptyState
            icon={SearchX}
            title="Sin coincidencias"
            description={`No encontramos clientas para “${q}”. Revisa la ortografía o busca por teléfono.`}
            action={
              <Button asChild variant="outline">
                <Link href="/admin/customers">Ver todas</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={UsersRound}
            title="Aún no hay clientas"
            description="Se crean automáticamente con cada lead nuevo (por correo o teléfono)."
            action={
              <Button asChild>
                <Link href="/admin/leads">Ir a leads</Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          <p className="text-muted-foreground mb-3 text-sm" aria-live="polite">
            {result.total} {result.total === 1 ? "clienta" : "clientas"}
            {q ? ` para “${q}”` : ""}
          </p>
          <CustomersTable customers={result.items} />
          <Pagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            basePath="/admin/customers"
            searchParams={sp}
          />
        </>
      )}
    </>
  );
}
