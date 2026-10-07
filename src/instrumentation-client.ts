import { installNavigationGuard } from "@/components/navigation/navigation-guard";
import type { NavigationType } from "@/lib/navigation-guard";

// Next carga este archivo en el navegador antes de hidratar y antes de que el router haga su primera
// petición RSC. BUG-006: entregar las respuestas RSC completas evita que las transiciones del router
// (searchParams en la misma ruta, router.refresh(), Server Actions que revalidan) se queden colgadas; el
// registro de navegaciones descarta las respuestas de segmentos que otra navegación ya dejó obsoletas y
// recupera esas URLs al volver a ellas; si aun así una navegación no se confirma, se hace una carga completa.
// Causa, corrección en React y criterio para retirarlo en src/lib/rsc-response-buffer.ts.
const navigationGuard = installNavigationGuard(window);

/** Hook de Next: se llama al iniciar cada navegación del router (push, replace o atrás/adelante). */
export function onRouterTransitionStart(url: string, navigationType: NavigationType): void {
  navigationGuard.start(url, navigationType);
}
