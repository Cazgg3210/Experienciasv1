# Hallazgos — Paquete 4 «Eventos y experiencia» (carril 4)

- **Fecha:** 2026-10-06 · **Commit:** `f26b1a1` (sin cambios de código de la app) · **Modo:** FULL (paquete 4/6)
- **Entorno:** TEST — build de producción local (`next start`, `.next-e2e`) en `http://localhost:3204`, base `ivonne_rosa_e2e_l4` re-sembrada por corrida, Windows 11, Chromium (escritorio 1440×900 y Pixel 7 390×844).
- **Alcance:** EVT (eventos admin + pagos manuales/reembolsos), CAL (calendario y disponibilidad), PORT (portal de la clienta), GST (invitadas, RSVP, micrositio, .ics), MEM (Memory Capsule).
- **Autoverificación `@infra` en el carril 4:** 3/3 PASS.

## Resumen por severidad

| ID provisional | Severidad | Tipo | Título |
|---|---|---|---|
| EVX-BUG-01 | CRITICAL | APPLICATION BUG (dinero) | Cancelar un evento no invalida el checkout de anticipo abierto: la clienta puede pagarlo y queda **PAID** en un evento cancelado |
| EVX-BUG-02 | HIGH | APPLICATION BUG | (P0 por el RSVP) La navegación del cliente a la misma ruta con otros `searchParams` y `router.refresh()` se quedan colgados: calendario (Anterior/Siguiente/Hoy), «Limpiar filtros» y confirmación del RSVP |
| EVX-BUG-03 | CRITICAL | POTENTIAL SECURITY ISSUE | Con el link general de invitación, cualquiera que escriba el nombre de otra invitada sobrescribe su RSVP (incluidas sus restricciones/alergias) y recibe su link personal |
| EVX-BUG-04 | MEDIUM | UX ISSUE (accesibilidad) | Contraste insuficiente (WCAG AA) en el tono *warning*, `taupe` y textos atenuados (admin de eventos/calendario y Memory Capsule pública) |
| EVX-BUG-05 | LOW | UX ISSUE (accesibilidad) | Micrositio: `<dl>` mal formado en «Los detalles» (`dt`/`dd` fuera de su lista) |

---

## EVX-BUG-01 — Cancelar un evento no invalida el checkout de anticipo abierto: se cobra un evento cancelado

**Severity:** CRITICAL
**Priority:** P0
**Status:** Fixed — consolidado como BUG-002 (ver «Fix» al final de esta sección)
**Type:** APPLICATION BUG (corrupción de datos financieros / cobro indebido)
**Module:** events / payments
**Role:** OWNER (ivonne@ivonne-rosa.test) + Clienta (token del portal)
**Environment:** TEST — build de producción local :3204, base ivonne_rosa_e2e_l4, commit f26b1a1
**Reproducible:** Sí (8/8: corridas de desarrollo, `--repeat-each=2`, corrida final con reintento y re-ejecución para evidencia)
**Test:** [EVT-024] tests/e2e/events/event-status.spec.ts

### Preconditions
Evento `PENDING_PAYMENT` con reserva (total $12,000, anticipo $6,000) y sin pagos.

### Steps to reproduce
1. La clienta abre `/mi-evento/<portalToken>` y pulsa «Pagar anticipo · $6,000» → se crea `Payment` DEPOSIT `PENDING` (proveedor mock) y la redirige a `/pago/mock/mock_cs_…`.
2. La fundadora cancela el evento desde `/admin/events/<id>` (motivo válido).
3. La clienta vuelve al enlace de pago que tenía abierto y pulsa «Pagar $6,000 (simulado)».

### Expected
Al cancelar, los checkouts `PENDING` del evento quedan inválidos (FAILED/expirados) y cualquier intento de pago posterior se rechaza o, si la pasarela ya capturó dinero, se marca para reembolso y se avisa al equipo. Nunca debe quedar un anticipo «pagado» de un evento cancelado ni avisarle a la clienta «Recibimos tu pago».

### Actual
- Tras la cancelación el pago sigue `PENDING` (anotación «estado del pago tras cancelar: PENDING»).
- La página `/pago/mock/<checkoutId>` sigue mostrando el botón de pago; el webhook firmado se procesa y el pago queda **`PAID`** con el evento y la reserva en `CANCELLED`.
- Se envían a la clienta las notificaciones `PAYMENT_RECEIVED` («Recibimos tu pago», correo y WhatsApp) y al equipo «Pago recibido».

### Evidence
- trace/screenshots/video: `test-results/l4/artifacts/events-event-status-Evento-1dfe8-ENTE-no-debe-poder-cobrarse-chromium/` (`trace.zip`, `test-failed-*.png`, `video.webm`) y `…-chromium-retry1/` (corrida final: 2/2 intentos con «estado final del pago: PAID»).
- Consulta a la base del carril:
  ```sql
  SELECT e.code, e.status, e."cancelledAt", p.kind, p.status, p.provider, p."amountCents", p."paidAt", b."cancelledAt"
  FROM "Payment" p JOIN "Booking" b ON b.id = p."bookingId" JOIN "Event" e ON e.id = b."eventId"
  WHERE e.status = 'CANCELLED' AND p.status = 'PAID' AND p.provider = 'mock';
  ```
  → `EV-E2E-77A43D | CANCELLED | 07:24:41.901Z | DEPOSIT | PAID | mock | 600000 | paidAt 07:24:42.437Z | booking cancelado 07:24:41.901Z` (y filas idénticas de otras repeticiones: `EV-E2E-8ED291`, `EV-E2E-3D1334`; re-ejecución de evidencia tras la corrida final, estado actual de la base del carril: `EV-E2E-A97DB5 | CANCELLED | DEPOSIT | PAID | 600000 | paidAt 08:06:26.869Z`; artefactos en `test-results/l4/evidence/`).
- Corrida final (`test-results/l4/results.json`, EVT-024, 2/2 intentos): anotaciones «estado del pago tras cancelar: PENDING» y «estado final del pago: PAID».
  `NotificationLog`: `PAYMENT_RECEIVED` «Recibimos tu pago» (EMAIL y WHATSAPP) para esos eventos cancelados.

### Console
Sin errores de consola ni respuestas 5xx (el guard no registró violaciones).

### Network
`POST /pago/mock/<checkoutId>` (Server Action `mockCheckoutAction`) → 200 `{ redirectTo: "/pago/resultado?…" }`; webhook interno `POST /api/webhooks/payments/mock` → 200 `applied: true`.

### Technical Analysis
- `src/features/events/server/event-service.ts:514-602` (`cancelEvent`): cancela evento, reserva e inventario, pero **no toca los `Payment` `PENDING`** de la reserva ni la sesión del proveedor.
- `src/features/payments/domain/amounts.ts:96-109` (`checkoutLinkState`) y `src/app/(experience)/pago/mock/[checkoutId]/page.tsx`: el estado del enlace no considera `booking.cancelledAt` / `event.status`, así que sigue «payable».
- `src/features/payments/server/mock-checkout-actions.ts:57-104`: no valida la cancelación antes de emitir el webhook.
- `src/features/payments/server/payment-service.ts:271-304` (`applyPaymentSucceeded`): marca `PAID` sin revisar si la reserva está cancelada; `confirmEventIfDepositSatisfied` sólo evita re-confirmar el evento. `runPaymentSuccessEffects` (`:405-482`) notifica a la clienta como un pago normal.
- Con un proveedor real (Stripe/Mercado Pago) la sesión de checkout seguiría viva hasta 1 h: el dinero se capturaría de verdad.

### Suspected Root Cause
La cancelación no forma parte del ciclo de vida de los pagos: ni se invalidan los checkouts abiertos ni el webhook/checkout rechaza pagos de reservas canceladas.

### Recommended Fix
1. En la transacción de `cancelEvent`: `payment.updateMany({ where: { bookingId, status: "PENDING", kind: { not: "REFUND" } }, data: { status: "FAILED", failedAt: now, failureReason: "Evento cancelado" } })` y expirar la sesión en el proveedor cuando exista API (`provider.expireCheckout?`).
2. `checkoutLinkState` / página mock / `mockCheckoutAction`: tratar reservas canceladas como no pagables (estado «cancelled»).
3. `applyPaymentSucceeded`/`processPaymentEvent`: si la reserva está cancelada y llega un cobro capturado, registrar el pago pero **marcarlo para reembolso** (nota + `notifyTeamPaymentAnomaly`) y no enviar «Recibimos tu pago» genérico; idealmente reembolso automático.
4. Mantener [EVT-024] como prueba `@regression`.

### Fix (BUG-002)
Corregido junto con SAL-BUG-03 (mismo defecto). Detalle de la regla y evidencia en `sales.md` → SAL-BUG-03 «Fix». Resumen: `cancelEvent` anula en su transacción (candado de la reserva) los checkouts `PENDING` → `FAILED` «Evento cancelado.»; el checkout simulado muestra «Esta reserva fue cancelada» y rechaza el cobro (`EVENT_CANCELLED`); un cobro que un proveedor real confirme después se registra para reembolso sin reconfirmar el evento ni avisar a la clienta. [EVT-024] queda `@regression` (anotación `regression: BUG-002`) y pasa 3/3 con `--repeat-each=3 --retries=0` en el carril 2. Tras la revisión: un webhook de cobro que compite con la cancelación lee el pago después del candado de la reserva (nunca queda `FAILED` un cobro real), la transacción de `cancelEvent` tolera esperar a un checkout en curso (30 s) y, al confirmar, pide a la pasarela expirar las sesiones anuladas (best-effort). Detalle en `sales.md` → SAL-BUG-03 «Fix (BUG-002) — cambios de la revisión».

---

## EVX-BUG-02 — Navegación del cliente a la misma ruta (sólo cambian `searchParams`) y `router.refresh()` se quedan colgados

**Severity:** HIGH
**Priority:** P0 (afecta de forma intermitente la confirmación visible del recorrido crítico de RSVP; los datos sí se guardan)
**Status:** Fixed — consolidado como **BUG-006** (mitigación en la app; causa raíz en React/Next, ver «Corrección (BUG-006)» al final de esta sección)
**Type:** APPLICATION BUG
**Module:** calendar / events / guests (RSVP) — probablemente transversal al App Router
**Role:** OWNER (admin) e Invitada (micrositio)
**Environment:** TEST — build de producción local :3204 (`next start`, Next 15.5.27, Windows), base ivonne_rosa_e2e_l4, commit f26b1a1
**Reproducible:** Sí, intermitente — calendario «Siguiente» 6/6 y 14/16 en sesiones nuevas (scripts) y CAL-002 FAIL en todas las corridas completas; «Limpiar filtros» 3/8 en scripts y EVT-038 FAIL en 3 de 4 corridas completas; RSVP: GST-015 FAIL 4 veces, GST-012 FAIL/FLAKY en 3 corridas, GST-011 FAIL (móvil) o FLAKY (escritorio y móvil, corrida final).
**Test:** [CAL-002] tests/e2e/calendar/calendar.spec.ts · [EVT-038] tests/e2e/events/events.spec.ts · [GST-012], [GST-015] (y de forma intermitente [GST-011]) tests/e2e/guests/rsvp.spec.ts

### Preconditions
Sesión de owner (admin) o invitada con link personal. Página ya hidratada.

### Steps to reproduce
1. Abrir `/admin/calendar` y pulsar «Siguiente» (o «Anterior»/«Hoy»).
2. Abrir `/admin/events?status=INQUIRY` (o `?period=past`) y pulsar «Limpiar filtros».
3. En `/e/<slug>/<tokenPersonal>` responder y pulsar «Enviar mi respuesta»/«Guardar cambios» (el panel hace `startTransition(() => { onSaved(); router.refresh(); })`).

### Expected
El mes / el listado cambian y la URL se actualiza; tras guardar el RSVP se muestra la confirmación («¡Gracias, …! Te esperamos» / «Te vamos a extrañar»).

### Actual
- La URL no cambia (`/admin/calendar`, `/admin/events?status=INQUIRY`), el contenido tampoco, ni siquiera con un segundo clic; sin errores en consola.
- En el micrositio la respuesta **sí se guarda** en la base, pero la pantalla se queda en el formulario: la invitada no ve confirmación (riesgo de reenvíos o de creer que no se guardó).
- Con `window.next.router.push()` se reproduce igual en `/admin/leads?status=NEW`, `/admin/quotes?status=SENT`, `/admin/events?period=past` (misma ruta) y **no** ocurre entre rutas distintas (`/admin/events` → `/admin/calendar?month=…` funciona).

### Evidence
- Corrida final (`test-results/l4/results.json`): CAL-002 FAIL — anotación «intentos»: «intento 1: sin navegar (…/admin/calendar) · intento 2: sin navegar · intento 3: OK»; GST-011 FLAKY en escritorio y móvil (1.er intento esperando «¡Gracias, Daniela! Te esperamos»).
- Artefactos: `test-results/l4/artifacts/calendar-calendar-Calendar-fd81c-guiente»-«Anterior»-y-«Hoy»-chromium{,-retry1}/` y `guests-rsvp-RSVP-·-invitad-07d73-e-refleja-en-admin-y-portal-{chromium,mobile-chrome}/` (trace.zip, screenshots, video). Corridas previas (artefactos sobrescritos por la corrida final, resultados en el registro de este documento): EVT-038, GST-012, GST-015.
- Diagnóstico con scripts de Playwright (scratchpad del carril): la petición RSC de la navegación (`/admin/calendar?month=2026-11&_rsc=…`, cabecera `next-router-state-tree` con `"refetch"`) termina en **`net::ERR_ABORTED`** en el navegador; el mismo request repetido con `fetch` desde Node devuelve 200 completo (64 KB, 80 ms). Si la respuesta se entrega **bufferizada** (Playwright `route.fetch()` + `route.fulfill()`), la navegación sí funciona. Bloquear los prefetch o desactivar la compresión no cambia nada.
- Base (GST-015): `EventMessage` HONOREE actualizado a «¡Feliz vida, Regi!» mientras la UI sigue en modo edición.

### Console
Sin errores ni excepciones de página.

### Network
`GET /admin/calendar?month=YYYY-MM&_rsc=…` → abortada por el cliente (`net::ERR_ABORTED`); en otros intentos 200 sin commit de la transición.

### Technical Analysis
- Enlaces afectados: `src/app/(admin)/admin/calendar/page.tsx:83-95` (Anterior/Hoy/Siguiente), `src/features/events/components/events-filters.tsx:176-181` («Limpiar filtros»), y el patrón de `src/features/guests/components/rsvp-panel.tsx:225-238` (`startTransition` que agrupa `onSaved()` con `router.refresh()`; si el refresh nunca termina, el cambio de estado `editing=false` nunca se confirma).
- Todas son navegaciones/refrescos de la **misma ruta** con páginas `force-dynamic` + `loading.tsx` (Suspense) y respuesta RSC en streaming. El router del App Router aborta la petición y la transición queda pendiente.

### Suspected Root Cause
Interacción del router de Next 15.5 (navegación same-route / refresh) con respuestas RSC en streaming en `next start` (posible defecto de Next o del entorno Windows). No hay código de la app que manipule la URL (`router.replace`/`history`).

### Recommended Fix
1. Confirmar en el contenedor Linux (Dokploy) y con la última 15.5.x; si persiste, reportar a Next/actualizar.
2. Mitigación inmediata: en `rsvp-panel.tsx` llamar `onSaved()` **fuera** de la transición (y `router.refresh()` aparte); en calendario/filtros usar navegación completa (`<a href>`) o `router.push` con `{ scroll: false }` + fallback `window.location.assign` si no hay commit.
3. Mantener CAL-002, EVT-038, GST-012 y GST-015 como `@regression`.

### Corrección (BUG-006)

Consolida EVX-BUG-02, COM-BUG-03 (commercial.md), OPX-BUG-01 y OPX-BUG-02 (operations.md) y TRV-BUG-01 (transversal.md). Investigado y corregido en el carril 5 (`:3205`, `ivonne_rosa_e2e_l5`) sobre `8020b91`.

**Causa raíz (confirmada).** No es la red, ni el servidor, ni código de la app. Es un ping perdido en el reconciliador de React `19.2.0-canary-0bdb9206-20250818`, la versión que trae Next 15.5.27:
1. Una transición del router renderiza un payload RSC que todavía llega por streaming. React se suspende en un *lazy* de Flight (`$L…`) cuya fila aún no llega. Pasa dentro de un Suspense **ya visible**: el de `loading.tsx`, cuya key es el segmento sin searchParams (`__PAGE__`). React cede el hilo (`SuspendedOnImmediate` → `SuspendedAndReadyToUnwind`).
2. La fila llega en ese intervalo. El chunk pasa a `resolved_model`: el dato está recibido pero sin inicializar, porque el camino de *lazy* no adjunta listeners. `isThenableResolved()` no lo cuenta como resuelto.
3. React desenrolla: `renderDidSuspendDelayIfPossible()` deja el estado en `RootSuspendedWithDelay`. Luego `attachPingListener` llama `chunk.then()`, que inicializa el chunk y ejecuta el ping **de forma síncrona en plena fase de render**. Con estado 4 y `RenderContext` activo, `pingSuspendedRoot` no reinicia el render ni registra `workInProgressRootPingedLanes`. El ping se pierde y la raíz queda suspendida sin nada que la reintente.

Esto explica cada síntoma:
- **Misma ruta.** El `<Link>` a `?month=…` (o `?page=2`) reutiliza, por alias de pathname, el prefetch sembrado con la página actual (sólo en producción). Eso dispara un *lazy fetch* durante la transición. Entre rutas distintas la frontera de `loading.tsx` es nueva: se muestra el fallback y el ping no se pierde.
- **`router.refresh()` y Server Actions que revalidan.** Renderizan el árbol mientras llega el stream: es el mismo mecanismo (contenido, notificaciones, RSVP).
- **«Funciona si la respuesta llega en bloque».** Con todas las filas presentes React nunca se suspende esperando red.

**Evidencia** (scripts de diagnóstico de Playwright en el scratchpad del carril; no forman parte de la suite):
- Sin instrumentación ni `page.route`, el clic en «Siguiente» del calendario navegó 0–2 veces de 5 en sesiones nuevas. La búsqueda de inventario, «Limpiar filtros» de eventos y `router.refresh()` se colgaron casi siempre.
- El lector de React Flight recibe el cuerpo completo (64 735 bytes) y el fin del stream unos 25 ms después de pedirlo. Desde Node, la misma petición termina en 149 ms. `net::ERR_ABORTED` aparece *después* de recibir el cuerpo completo, incluso en prefetch que sí terminaron: es ruido de Chromium, no la causa.
- Con el router instrumentado (chunk servido con logs, sólo para diagnóstico) se ve esta secuencia: `navigate` (alias) → *lazy fetch* con `refetch` → `server-patch` aplicado, sin descartes → React re-renderiza la página y no hace commit (`history.pushState` nunca ocurre).
- En el estado colgado, la raíz de React tiene `pendingLanes = suspendedLanes = 0b111000000000000`, `pingedLanes = 0` y ningún callback programado. El último `attachPingListener` fue sobre un lazy de Flight (sección «Disponibilidad») que ya estaba en `resolved_model`.

**Hipótesis del análisis:**

| Hipótesis | Resultado |
|---|---|
| 1. `Set-Cookie` de `auth()` en cada respuesta RSC | **Descartada.** La cabecera sigue presente con la mitigación y ya no hay cuelgues. El stream llega completo a React. |
| 2. `force-dynamic` + `loading.tsx` en streaming | **Es la condición, no la causa.** Pone el lazy dentro de una frontera ya visible. |
| 3. Compresión / chunked de `next start` | **Descartada.** La respuesta termina y el navegador entrega todos los bytes y el fin del stream. |
| 4. Componente cliente con `router.*` en efectos | **Descartada.** El calendario no tiene ninguno y `grep` no encontró nada que aborte la navegación. |
| 5. Suspense / `useTransition` pendiente | **Es el síntoma.** La transición queda suspendida por el ping perdido. |
| 6. Artefacto de Playwright | **Descartada.** Se reproduce sin `page.route` ni init scripts. Con `next dev` no se reproduce (24/24 OK): en desarrollo no se usa el alias del prefetch y los tiempos del build de React son otros. |

**Mitigación aplicada** (nivel app, sin dependencias nuevas ni cambios de versión): `src/lib/rsc-response-buffer.ts` y `src/instrumentation-client.ts`, que Next carga antes de hidratar. Envuelven `window.fetch` en dos partes:
- **A. Respuestas RSC completas.** Las respuestas `text/x-component` se entregan ya completas, conservando estado, cabeceras, `url` y `redirected`; el router usa estos dos últimos para detectar redirecciones (sesión vencida → `/login`). Con todo el payload disponible, Flight resuelve todas las filas antes de que React renderice y la carrera no puede ocurrir. Cubre navegaciones, prefetch, `router.refresh()` y Server Actions sin tocar cada componente.
- **B. Lazy fetch obsoletos.** Next 15.5 aplica la respuesta del *lazy fetch* del layout-router como `SERVER_PATCH` sin comparar `previousTree`. Si mientras tanto empezó otra navegación a una ruta hermana, el parche reemplaza la ruta nueva por la vieja: URL nueva con contenido viejo. El defecto es de Next y ya existía, pero con (A) la ventana pasa de «primer byte» a «respuesta completa»; SET-001 lo hizo visible 3/3 tras la primera versión de la corrección. Con el traceo del router se confirmó que el parche de `/admin/settings` (clic en «Negocio») caía sobre `/admin/settings/pricing` («Precios y márgenes»).
  - **Corrección:** el hook oficial `onRouterTransitionStart` de `instrumentation-client` registra cada navegación. Si un *lazy fetch* (GET RSC con `refetch` debajo de la raíz) termina después de que empezó otra navegación a otra URL, se entrega un payload RSC válido sin datos (`f: []`, mismo buildId). Next lo aplica sin cambios, igual que cuando la ruta del parche ya no coincide.
  - **Límite:** si no reconoce el formato de la fila raíz, entrega la respuesta real (comportamiento original).
- **Costo:** las navegaciones del cliente ya no pintan por partes. La carga inicial (HTML) sigue en streaming.
- **Riesgo residual (de Next, no introducido):** un nodo cuyo lazy fetch quedó obsoleto conserva `lazyData` sin `rsc`. Volver a esa URL con atrás/adelante puede quedarse en el esqueleto de carga, igual que cuando Next descarta un parche por ruta distinta. Requiere dos navegaciones en menos que el tiempo de respuesta y luego «atrás».
- **Pruebas unitarias:** `src/lib/rsc-response-buffer.test.ts` (18 casos).
- **Validación previa de (A)** (misma función inyectada antes de compilarla en la app): con buffer, 32/32 OK (8 por escenario: calendario Siguiente→Anterior→Hoy, «Limpiar filtros» de eventos, búsqueda de inventario, `router.refresh()` + navegación). Sin buffer, 2/16.

**Versión que lo arreglaría.** No verificada: no se actualizó (fuera de alcance sin aprobación). Hace falta un React canary posterior que no pierda pings síncronos durante el render (o que trate `resolved_model` como resuelto en el camino de *lazy*). Para retirar la mitigación, quitar la llamada en `src/instrumentation-client.ts` tras actualizar Next y comprobar que pasan CAL-002, EVT-038, LEAD-037, INV-025, GST-011/012/015, CNT-022..024, NOT-002 y CRIT-004 con `--repeat-each=5 --retries=0`.

**Verificación tras la corrección:** ver «Registro de verificación BUG-006» abajo.

#### Registro de verificación BUG-006 (carril 5, build de producción `:3205`, base `ivonne_rosa_e2e_l5`)

| Corrida | Resultado |
|---|---|
| Reproducción antes de corregir (`8020b91`, `--retries=0`) | CAL-002, EVT-038, LEAD-037, INV-025, GST-012, GST-015 **FAIL**. GST-011, NOT-002 y SET-001 pasaron en esa corrida (intermitentes). |
| Diagnóstico sin instrumentación (scripts, sesiones nuevas) | Calendario «Siguiente»: 0–2/5 OK. `next dev`: 24/24 OK, no reproduce. |
| Corrección v1 (sólo A), `--repeat-each=3` | 35/38. SET-001 **3/3 FAIL**: parche obsoleto (B), confirmado con el traceo del router. |
| **Corrección final (A+B)**, `--repeat-each=5 --retries=0` | **70/70 PASS**: 5 de setup + CAL-002, EVT-038, LEAD-037, INV-025, GST-011, GST-012, GST-015, NOT-002, SET-001 y CRIT-004 en chromium, y GST-011, GST-012 y CRIT-004 en mobile-chrome. |
| CNT-022/023/024 (`E2E_SUITE=global`), `--repeat-each=5 --retries=0` | **15/15 PASS** |
| Cross-browser P0 (GST-011, CRIT-004), Firefox + WebKit, `--repeat-each=2` | **8/8 PASS** |
| Regresión: calendar, leads, events, guests, inventory, content, notifications, settings, quotes y smoke (chromium + mobile-chrome, config por defecto) | 225 PASS, 9 FAIL, 0 flaky (detalle abajo). |
| Regresión global (calendar, content, notifications, settings, quotes) | **25/25 PASS** |
| Extra: navigation, auth, critical y portal (chromium + mobile-chrome) | 106 PASS, 8 FAIL (detalle abajo). |
| Unitarias / typecheck / lint | 753/753 · OK · OK |

**FAIL de la regresión de 10 carpetas:**
- 7 son bugs abiertos ya reportados, ajenos a BUG-006: EVT-024 (EVX-BUG-01), GST-014 (EVX-BUG-03), CAL-007, EVT-037 y GST-022 (EVX-BUG-04/05), LEAD-036 (COM-BUG-01) y NOT-007 (OPX-BUG-04).
- LEAD-021 es un **TEST BUG expuesto por la corrección**. El locator `getByText("Asignado a Rosa")` coincidía con el toast y, ahora que el timeline sí se repinta tras la Server Action, también con la entrada «Asignado a Rosa.» (strict mode). Antes pasaba porque el timeline no se actualizaba: es otra manifestación de BUG-006. Se separaron los asserts (toast y entrada del timeline, y lo mismo al desasignar): 3/3 PASS.
- SMK-023 es una **dependencia de datos de la prueba**. En una sola corrida, la carpeta quotes crea unas 60 cotizaciones y la sembrada sale de la página 1 (20 por página). En una base recién sembrada: 3/3 PASS. No se modificó.

**FAIL de la corrida extra:**
- 5 son bugs abiertos ya reportados: AUTH-025 (ACC-BUG-02), AUTH-049 (ACC-BUG-03), NAV-002 (ACC-BUG-04), NAV-015 (ACC-BUG-05) y CRIT-014 (TRV-BUG-06).
- AUTH-004/005 son un **TEST BUG expuesto por la corrección**. `getByText("Hola, Lupita")` coincidía con el saludo del encabezado y con el párrafo de la página «Hola, Lupita. Aquí ves…»; antes el contenido de la página llegaba por streaming después del encabezado. Se usa coincidencia exacta: 3/3 PASS.
- CRIT-006 es una **dependencia de datos de la prueba**. Usa `findFirst({ role: "OWNER", email contains "ivonne" })`, que en la misma base también encuentra las fundadoras `…@e2e.ivonne-rosa.test` que crean las pruebas de auth. En una base recién sembrada: 3/3 PASS. No se modificó.

Evidencia (no versionada): `test-results/l5-evidence/BUG-006/{before-fix,fix1,fix2,regression1,regression-extra}/`.

---

## EVX-BUG-03 — Link general de invitación: escribir el nombre de otra invitada sobrescribe su RSVP y entrega su link personal

**Severity:** CRITICAL (regla del gate: problema de seguridad que expone/corrompe datos de terceros)
**Priority:** P0
**Status:** Fixed — Verified (consolidado como **BUG-003**; ver «Resolution» al final de esta sección)
**Type:** POTENTIAL SECURITY ISSUE (integridad de datos de terceros + exposición de datos personales)
**Module:** guests (RSVP público)
**Role:** Invitada anónima con el link general (`Event.inviteToken`)
**Environment:** TEST — build de producción local :3204, base ivonne_rosa_e2e_l4, commit f26b1a1
**Reproducible:** Sí (5/5: corridas de desarrollo, `--repeat-each=3`, corrida final con reintento y re-ejecución para evidencia)
**Test:** [GST-014] tests/e2e/guests/rsvp.spec.ts

### Preconditions
Evento confirmado con una invitada «Camila Ruiz …» que ya respondió «Asiste», con email, restricción Vegana, nota alimentaria «Alergia severa a la nuez» y comentario.

### Steps to reproduce
1. Abrir el link general `/e/<slug>/<inviteToken>` (el que la anfitriona comparte en su grupo).
2. Escribir en «Tu nombre» el nombre de Camila (en minúsculas sirve), dejar el email vacío, elegir «No podré ir» y enviar.

### Expected
Una respuesta hecha con el link general no puede modificar a una invitada existente sin comprobar que es ella (p. ej. su email), y nunca debe devolver el token personal de otra persona.

### Actual
- El RSVP de Camila pasa de `ATTENDING` a **`NOT_ATTENDING`** y **se sobrescriben sus datos**: el nombre queda como lo escribió el tercero (en minúsculas), y sus restricciones, nota alimentaria («Alergia severa a la nuez») y comentario se borran (el formulario genérico llega vacío). Es pérdida de información de seguridad alimentaria de otra persona.
- El navegador es redirigido al **link personal de Camila**, que muestra su formulario precargado (nombre, acompañante, restricciones, nota alimentaria, comentario, mensaje a la homenajeada, email enmascarado) y permite seguir editándolo; con «Asiste» además revela la dirección exacta.

### Evidence
- `test-results/l4/artifacts/guests-rsvp-RSVP-·-invitad-14a88-i-entregar-su-link-personal-chromium{,-retry1}/` (trace, screenshots, video). Anotación «resultado»: URL final = link personal de la víctima; RSVP original = `NOT_ATTENDING`.
- Base (re-ejecución tras la corrida final): `SELECT g.name, g."rsvpStatus", g."dietaryNotes", g.token FROM "EventGuest" g WHERE g.name ILIKE 'camila ruiz v-%'` → estado actual de la base del carril (re-ejecución de evidencia, artefactos en `test-results/l4/evidence/`): `camila ruiz v-muwea4ad-3e1f27 | NOT_ATTENDING | dietaryRestrictions {} | dietaryNotes NULL | comment NULL` (antes de la respuesta del tercero: «Camila Ruiz V-…», ATTENDING, [VEGAN], «Alergia severa a la nuez», «Llego tarde»).
- Corrida final: anotación `resultado` = «URL final /e/e2e-509706f9cc/s_kOkpaVy41E… · RSVP de la invitada original: NOT_ATTENDING» (la URL final es el link personal de la víctima).

### Console / Network
Sin errores. `POST /e/<slug>/<inviteToken>` (Server Action `submitRsvpAction`) → 200 `{ ok: true, data: { personalPath: "/e/<slug>/<token de Camila>" } }`.

### Technical Analysis
- `src/features/guests/domain/rsvp.ts:58-75` (`findMatchingGuest`): sin email, empata por nombre normalizado aunque la invitada tenga email y ya haya respondido.
- `src/features/guests/server/rsvp-service.ts:72-96`: actualiza esa invitada y devuelve su `token`.
- `src/features/guests/server/actions.ts:17-24` arma `personalPath` con ese token y `rsvp-panel.tsx:228-232` redirige ahí. El propio código lo reconoce (comentario en `maskEmail`).

### Suspected Root Cause
Diseño de «re-identificación por nombre» sin factor de posesión.

### Recommended Fix
Con el link general: si hay coincidencia por nombre con una invitada que ya respondió o que tiene email/teléfono, **no** actualizarla ni devolver su token; crear una nueva invitada `SELF_RSVP` marcada como posible duplicado (o pedir el email registrado / enviar el link personal por correo/WhatsApp a la invitada). Sólo empatar por nombre invitadas `PENDING` sin contacto, y nunca exponer el token de otra.

### Resolution (BUG-003)

**Fixed** en la rama del carril 4 (commit `e8165ae`, sobre `8020b91`).

- **Diseño**: el link general **nunca** re-identifica (ni por nombre ni por email; tampoco a invitadas `PENDING` sin contacto, porque eso también permitiría responder por otra y quedarse con su link). Cada respuesta con el link general crea una invitada nueva `SELF_RSVP` con token propio y sólo recibe **su** link personal. El token personal sigue actualizando únicamente a su invitada; la anfitriona (portal) y el admin no cambian.
- **Posible duplicado**: si el nombre normalizado o el email coinciden con alguien registrado antes, la respuesta es idéntica para quien responde (sin enumerar la lista), y el registro nuevo aparece como «Posible duplicado» en el admin (aviso + insignia) y en el portal de la anfitriona («Si es la misma persona, escríbenos y dejamos un solo registro»). Queda auditoría `guest.possible_duplicate` (ids coincidentes + IP) y `possibleDuplicate` en analytics. La marca es derivada (`possibleDuplicateIds`), sin cambios de esquema.
- **Amable**: el micrositio con link general pide a quien ya tiene link personal que responda desde ahí.
- **Cupo y rate limit**: el cupo de 60 se aplica ahora a toda respuesta con el link general, dentro del `pg_advisory_xact_lock` del evento ([GST-021] PASS). El rate limit de `submitRsvpAction` (10 / 10 min por IP) se mantiene y quedó cubierto por [GST-024] (`tests/e2e/guests/rsvp.ratelimit.spec.ts`, suite `E2E_SUITE=ratelimit`): 10 respuestas OK, la 11ª `RATE_LIMITED` y sin invitada nueva. Observación (decisión de producto, no se cambió): las invitadas `SELF_RSVP` sólo las puede quitar el equipo; con CGNAT varias invitadas pueden compartir IP y la cubeta.
- **Código**: `src/features/guests/domain/rsvp.ts` (`findPossibleDuplicates`, `possibleDuplicateIds`; se elimina `findMatchingGuest`), `src/features/guests/server/rsvp-service.ts`, `src/features/guests/server/actions.ts` (pasa la IP), `src/features/events/server/guest-admin-service.ts` + `components/guests-table.tsx` + página de invitadas, `src/features/portal/server/portal-service.ts` + `components/guest-list.tsx` / `portal-dashboard.tsx`, `src/features/guests/components/microsite-view.tsx`, etiqueta en `src/features/audit/domain/filters.ts`. `rsvp-panel.tsx` no se tocó.
- **Pruebas**: unitarias nuevas en `rsvp.test.ts`; integración `tests/integration/portal-rsvp.test.ts` actualizada (las 3 pruebas que exigían la re-identificación ahora exigen lo contrario: la original queda intacta, se crea otra, auditoría y marca en el portal); [GST-014] pasa a `@regression` (anotación `regression: BUG-003`) con asserts adicionales (datos de la original intactos, una sola invitada nueva, aterriza en su propio link); nueva [GST-023] (nombre y email de otra invitada vía backend → original intacta, token no revelado, marca en admin y portal, aviso en el link general).

**Verificación (TEST — build de producción :3204, base ivonne_rosa_e2e_l4):**
- Antes de corregir: [GST-014] FAIL 3/3 (`--repeat-each=3 --retries=0`): RSVP original → `NOT_ATTENDING` y URL final = link personal de la víctima. Evidencia: `test-results/l4-evidence/BUG-003/before-fix/`.
- Después: [GST-014] 3/3 PASS y [GST-023] 3/3 PASS (`--repeat-each=3 --retries=0`, `test-results/l4-evidence/BUG-003/after-fix/`); [GST-024] PASS (limitador encendido); `pnpm test` 740/740; `pnpm test:integration` 298/300 (portal-rsvp 21/21; las 2 fallas — `devops.test.ts` «salida standalone» y `memory-capsule.test.ts` CSRF del upload — fallan igual en la base `8020b91` y no tocan este módulo); typecheck y lint limpios.
- Regresión `tests/e2e/guests`, `tests/e2e/portal`, `tests/e2e/critical/experience.spec.ts`, `tests/e2e/permissions/public-actions-idor.spec.ts`: todo PASS salvo fallas preexistentes ajenas a este cambio — confirmación visible tras guardar con el link personal ([GST-011]/[GST-012]/[GST-015]/[CRIT-004], EVX-BUG-02 → BUG-006; los datos sí se guardan) y `<dl>` del micrositio ([GST-022], EVX-BUG-05 → BUG-010). [PORT-020] (contraste en el portal sembrado) es intermitente también en la base `8020b91` (4/5 FAIL con `--repeat-each=5 --retries=0`; en esta rama 3/5), nodos `bg-warning/10`, `bg-info/10`, `text-ivory/80` (EVX-BUG-04 → BUG-009): no depende de este cambio.

---

## EVX-BUG-04 — Contraste insuficiente (WCAG 2.1 AA 1.4.3) en tonos *warning*, *taupe* y textos atenuados

**Severity:** MEDIUM
**Priority:** P2
**Status:** Open
**Type:** UX ISSUE (accesibilidad; requisito explícito de CLAUDE.md «contraste AA»)
**Module:** events / calendar (admin) · memory (público)
**Role:** Owner, Invitada
**Environment:** TEST — build de producción local :3204, base ivonne_rosa_e2e_l4, commit f26b1a1
**Reproducible:** Sí (3/3 por página)
**Test:** [EVT-037] tests/e2e/events/event-experience.spec.ts · [CAL-007] tests/e2e/calendar/calendar.spec.ts · [MEM-019] tests/e2e/memory/memory-public.spec.ts

### Steps to reproduce
Correr axe (WCAG 2.0/2.1 A+AA; fixture `scanA11y`) en `/admin/events`, `/admin/events/new`, `/admin/events/[id]`, `/admin/calendar` y `/memory/<token>`.

### Expected
Contraste ≥ 4.5:1 en texto normal.

### Actual (axe `color-contrast`, impacto *serious*)
- Insignia «Modo demo: …» del shell del admin (`src/components/admin/admin-shell.tsx:115-122`): `#9a6a1f` sobre `#eee5d7` → **3.77:1** (12 px).
- `StatusBadge` tono warning (p. ej. «Pendiente de pago» en la tabla de eventos): `#9a6a1f` sobre `#f5eee3` → **4.08:1** (12 px).
- `/memory/[token]`: fecha `text-taupe` `#a48f7e` sobre `#f7f3ec` → **2.78:1**; pies de tarjetas `#a29b95` sobre `#fffdf9` → **2.69:1**.

### Evidence
Adjuntos `a11y-axe.json` de cada prueba en `test-results/l4/results.json` / reporte HTML `playwright-report/l4/`; screenshots en `test-results/l4/artifacts/*WCAG*`.

### Recommended Fix
Oscurecer `--warning` (≈ `#7f5616`) o usar fondo más claro en insignias; `--brand-taupe` sólo para elementos decorativos o subir a ≥ `#7a6656` en texto; revisar opacidades aplicadas a `text-muted-foreground` en la cápsula.

---

## EVX-BUG-05 — Micrositio: lista de definiciones mal formada en «Los detalles»

**Severity:** LOW
**Priority:** P3
**Status:** Open
**Type:** UX ISSUE (accesibilidad, lectores de pantalla)
**Module:** guests (micrositio)
**Role:** Invitada
**Environment:** TEST — build de producción local :3204, base ivonne_rosa_e2e_l4, commit f26b1a1
**Reproducible:** Sí (3/3)
**Test:** [GST-022] tests/e2e/guests/rsvp.spec.ts

### Actual
axe *serious*: `definition-list` («dl element has direct children that are not allowed: div > span, div > div») y `dlitem` (`dt`/`dd` sin padre `dl`) en `/e/cumple-sofia/<token Camila>`.

### Technical Analysis
`src/features/guests/components/microsite-view.tsx:277-299` (`DetailCard`) envuelve `dt`/`dd` en `div > div` junto con un `span` de icono dentro del `<dl>`.

### Recommended Fix
Que cada `DetailCard` sea un `<div>` hijo directo del `dl` que contenga **sólo** `dt` y `dd` (icono dentro del `dt` con `aria-hidden`), o cambiar a `<ul>`/`<p>` si no es una lista de definiciones.

---

## Observaciones (no son bugs)

- **REQUIREMENT AMBIGUITY — CSV de invitadas:** `toCsv` antepone `'` a valores que empiezan con `+`, `=`, `-`, `@`, por lo que los teléfonos internacionales salen como `'+525512345678` (anotado en GST-006). Protege contra inyección de fórmulas (correcto para `=`), pero altera datos de contacto; decidir si el teléfono debe exportarse en otra forma (p. ej. sin `+` o en columna de texto).
- **Estado HTTP de «evento no encontrado» en admin:** `/admin/events/<id inexistente>` muestra «No encontramos este evento» pero responde **HTTP 200** (anotación `http-status: 200` de EVT-004). Comportamiento conocido de `notFound()` bajo `loading.tsx`; zona privada `noindex`, sin impacto de seguridad (LOW si se consolida con el hallazgo transversal del paquete 1).
- **Pagos a eventos cancelados por pago manual:** correctamente bloqueados (`EVENT_CANCELLED`, EVT-027); el hueco es sólo el checkout en línea abierto (EVX-BUG-01).
- **Recordatorios RSVP:** deduplicación diaria por invitada y canal correcta (GST-007). La coincidencia con la llave del programador (`/api/cron/notifications`) queda fuera del alcance del carril (NOT TESTED aquí).
- **Cambios de invitadas/experiencia en eventos con reserva** no recalculan el total de la reserva (`updateEvent` sólo audita): no se probó el recálculo porque no hay requisito documentado; queda como riesgo para el paquete comercial.
- **Hidratación:** los formularios cliente (alta/edición de evento, filtros) ignoran interacciones previas a la hidratación (react-hook-form no ve el cambio); las pruebas esperan la hidratación. En conexiones lentas un usuario podría escribir antes de que el formulario responda.
- **Rendimiento:** todas las páginas del alcance cargan < 2 s en la build local; sin consultas lentas observadas.
- **Infraestructura compartida (fixtures):** `rolePage`/`anonPage` funcionan bien; `replayServerAction.classify` trata cualquier `ok:false` con código `NOT_FOUND` como «denied», lo que mezcla autorización con recurso inexistente (en este paquete se usó un helper propio, `tests/e2e/events/_helpers.ts → callAction`, que distingue `denied` de `rejected`). Además, al invocar `pnpm.cmd exec playwright … -g "A|B"` en Windows el `|` lo interpreta `cmd.exe`; usar `node node_modules/@playwright/test/cli.js`.
- **Infraestructura compartida (guard):** `tests/e2e/fixtures/guard.ts` clasifica `net::ERR_ABORTED` como ruido benigno; justo así se manifiesta EVX-BUG-02 (la petición RSC de la navegación se aborta), por lo que el guard no puede detectarlo: las pruebas deben afirmar el resultado (URL/contenido), como hacen CAL-002 y EVT-038.
- **Datos en paralelo:** el alta de eventos depende de la disponibilidad del día; para evitar que dos workers usen la misma fecha, `pickFreeDate` (helper del paquete) reparte las fechas por `TEST_PARALLEL_INDEX`. Una corrida previa tuvo un FLAKY de EVT-006 por esa colisión (TEST BUG, corregido antes de la corrida final).
