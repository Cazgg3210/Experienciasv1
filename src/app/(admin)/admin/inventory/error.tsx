"use client";

import { ModuleError } from "@/features/inventory/components/module-error";

export default function InventoryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ModuleError error={error} reset={reset} title="No pudimos cargar el inventario" backHref="/admin" backLabel="Ir al resumen" />;
}
