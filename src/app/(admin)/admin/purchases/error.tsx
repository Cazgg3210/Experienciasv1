"use client";

import { ModuleError } from "@/features/inventory/components/module-error";

export default function PurchasesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ModuleError error={error} reset={reset} title="No pudimos cargar las compras" backHref="/admin/purchases" backLabel="Ver compras" />
  );
}
