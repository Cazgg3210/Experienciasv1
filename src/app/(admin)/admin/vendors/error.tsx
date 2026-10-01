"use client";

import { ModuleError } from "@/features/inventory/components/module-error";

export default function VendorsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ModuleError error={error} reset={reset} title="No pudimos cargar los proveedores" backHref="/admin/vendors" backLabel="Ver proveedores" />
  );
}
