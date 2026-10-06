import { installRscResponseBuffer } from "@/lib/rsc-response-buffer";

// Next carga este archivo en el navegador antes de hidratar y antes de que el router haga su primera
// petición RSC. BUG-006: entregar las respuestas RSC completas evita que las transiciones del router
// (searchParams en la misma ruta, router.refresh(), Server Actions que revalidan) se queden colgadas, y
// el registro de navegaciones descarta las respuestas de segmentos que otra navegación ya dejó obsoletas.
// Detalle de la causa y criterio para retirarlo en src/lib/rsc-response-buffer.ts.
const routerTransitions = installRscResponseBuffer(window);

/** Hook de Next: se llama al iniciar cada navegación del router (push, replace o atrás/adelante). */
export function onRouterTransitionStart(url: string): void {
  routerTransitions.start(url);
}
