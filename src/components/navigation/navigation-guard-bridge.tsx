"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getNavigationGuard } from "./navigation-guard";

/**
 * Entrega `router.refresh()` a la salvaguarda de navegación que instala src/instrumentation-client.ts
 * (BUG-006): la usa para recuperar las URLs cuyo segmento se descartó por obsoleto. No pinta nada.
 */
export function NavigationGuardBridge() {
  const router = useRouter();
  useEffect(() => {
    const guard = getNavigationGuard();
    guard?.setRefresh(() => router.refresh());
    return () => guard?.setRefresh(null);
  }, [router]);
  return null;
}
