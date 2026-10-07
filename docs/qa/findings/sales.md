# Hallazgos — Paquete 2 «Venta pública» (carril 2)

**Fecha:** 2026-10-06 · **Modo:** FULL (paquete 2/6) · **Commit:** f26b1a1 (sin cambios de código de la app) · **Entorno:** TEST — build de producción local `.next-e2e`, servidor :3202, base `ivonne_rosa_e2e_l2` re-sembrada por corrida, proveedores mock (pagos, email, WhatsApp, IA).
**Alcance:** sitio público, contacto, configurador, diseñador IA, cotización por token, pagos mock + webhooks, mobile y estado global (flags).

Resumen por severidad (IDs provisionales, el consolidado re-numera):

| Severidad | Bugs |
|---|---|
| BLOCKER | — |
| CRITICAL | — |
| HIGH | SAL-BUG-03 |
| MEDIUM | SAL-BUG-01, SAL-BUG-02, SAL-BUG-06 |
| LOW | SAL-BUG-04, SAL-BUG-05, SAL-BUG-07 |

Todos reproducidos al menos 2 veces (corridas `--repeat-each=2 --retries=0` y corridas completas con reintento, mismo resultado). Las rutas de evidencia son de la última corrida completa del carril (`test-results/l2/artifacts/…`).

---

## SAL-BUG-03 — Un checkout abierto se puede cobrar después de que el equipo cancela el evento

**Severity:** HIGH
**Priority:** P1
**Status:** Fixed — consolidado como BUG-002 (ver «Fix» al final de esta sección)
**Type:** APPLICATION BUG (integridad de cobros)
**Module:** payments / events
**Role:** Clienta (token) + OWNER (cancela)
**Environment:** TEST — build local :3202, base ivonne_rosa_e2e_l2, commit f26b1a1
**Reproducible:** Sí (4/4: 2 corridas aisladas + 2 intentos en la corrida completa; además sonda manual)
**Test:** [PAY-021] tests/e2e/payments/payments.spec.ts

### Preconditions
Cotización aceptada (reserva + evento `PENDING_PAYMENT`). La clienta abrió «Pagar anticipo» (Payment `PENDING` con `checkoutUrl`).

### Steps to reproduce
1. Clienta: `startCheckoutAction({ token, tokenType: "quote", kind: "DEPOSIT" })` → `/pago/mock/mock_cs_…`.
2. Fundadora: `cancelEventAction({ eventId, reason, notifyCustomer:false })` desde `/admin/events/[id]` → evento `CANCELLED`, `Booking.cancelledAt` lleno.
3. Clienta abre el enlace de pago que ya tenía y pulsa «Pagar $X (simulado)» (o `mockCheckoutAction({ outcome:"success" })`).

### Expected
El enlace ya no es pagable (pantalla de «no vigente»/cancelado) y la acción se rechaza; ningún cobro sobre una reserva cancelada. Si un proveedor real confirmara un cobro tardío, debería registrarse para reembolso y avisar al equipo, no enviar «Recibimos tu pago».

### Actual
La pasarela simulada muestra el botón de pago; `mockCheckoutAction` responde `ok:true`; el webhook firmado marca el Payment `PAID`. El evento sigue `CANCELLED`, pero se envían `PAYMENT_RECEIVED` (email y WhatsApp) a la clienta y «Pago recibido · …» al equipo sin mencionar la cancelación.

### Evidence
- trace: `test-results/l2/artifacts/payments-payments-Pagos-pr-a0e1d-o-ya-no-debe-poder-cobrarse-chromium/trace.zip` · screenshot: `test-results/l2/artifacts/payments-payments-Pagos-pr-a0e1d-o-ya-no-debe-poder-cobrarse-chromium/test-failed-1.png`
- Anotación `observado` en `test-results/l2/results.json` (ambos intentos): `botón de pago visible=true; acción={"ok":true,"data":{"redirectTo":"/pago/resultado?p=…"}}; pago=PAID`.
- Sonda (misma secuencia): `select status from "Payment" where id=…` → `PAID`; `select status from "Event" where id=…` → `CANCELLED`; `NotificationLog` del evento: `PAYMENT_RECEIVED` (EMAIL, WHATSAPP) + `GENERIC "Pago recibido · E2E …"`.

### Console
Sin errores.
### Network
`POST /pago/mock/<id>` (Server Action) 200 `{"ok":true,"data":{"redirectTo":"/pago/resultado?…"}}`; `POST /api/webhooks/payments/mock` 200 `applied:true`.

### Technical Analysis
- `src/features/events/server/event-service.ts:514` (`cancelEvent`) cancela evento y reserva y libera inventario, pero no anula los `Payment` `PENDING` ni sus sesiones de checkout.
- `src/features/payments/server/mock-checkout-actions.ts:60-72` y `src/features/payments/domain/amounts.ts:93` (`checkoutLinkState`) sólo miran estado/edad/monto del pago, no `booking.cancelledAt` ni `event.status` (la página `/pago/mock/[checkoutId]` usa la misma regla).
- `src/features/payments/server/payment-service.ts:271` (`applyPaymentSucceeded`) marca `PAID` aunque la reserva esté cancelada; `confirmEventIfDepositSatisfied` (línea 246) evita confirmar, pero `runPaymentSuccessEffects` notifica «Recibimos tu pago».

### Suspected Root Cause
La cancelación no tiene efecto sobre los cobros en curso y el flujo de checkout/webhook no consulta el estado de la reserva.

### Recommended Fix
1. En `cancelEvent` (misma transacción): `payment.updateMany({ where:{ bookingId, status:"PENDING" }, data:{ status:"FAILED", failureReason:"Evento cancelado" } })` y expirar la sesión en el proveedor real.
2. `checkoutLinkState`/`mockCheckoutAction`/página mock: estado `cancelled` si `booking.cancelledAt` o `event.status === "CANCELLED"`.
3. Webhook `payment.succeeded` sobre reserva cancelada: registrar el cobro con nota «Reembolso requerido», notificar al equipo y NO enviar `PAYMENT_RECEIVED` a la clienta. Agregar prueba `@regression` (PAY-021).

### Fix (BUG-002)
Commit `fix(payments): cancelar un evento anula sus checkouts abiertos y nunca cobra una reserva cancelada (BUG-002)`.
1. **Cancelación** — `cancelEvent` (`src/features/events/server/event-service.ts`) llama primero, en su misma transacción, a `voidOpenCheckoutsForCancelledBooking` (`payment-service.ts`): toma el candado de la reserva (mismo que `startCheckout`, webhooks y pagos manuales; orden reserva → evento) y pasa los pagos `DEPOSIT/BALANCE/FULL` `PENDING` a `FAILED` con `failureReason` «Evento cancelado.» (los `REFUND` pendientes no se tocan). La auditoría `event.cancelled` incluye `voidedPayments`.
2. **Enlace no pagable** — `checkoutLinkState` (`domain/amounts.ts`) devuelve `"cancelled"` si la reserva o su evento están cancelados y el pago no se cobró (manda sobre `processed/expired/stale`). La página `/pago/mock/[checkoutId]` muestra «Esta reserva fue cancelada» sin botón de pago y `mockCheckoutAction` responde `EVENT_CANCELLED` sin emitir webhook. `startCheckout` y `recordManualPayment` revisan la cancelación dentro del candado.
3. **Regla para un cobro tardío de un proveedor real** (sesión de Stripe/Mercado Pago abierta antes de cancelar; el proveedor no tiene API de expiración en el contrato actual): el dinero existe, así que `applyPaymentSucceeded` lo registra `PAID` (cuenta como cobrado y se puede reembolsar desde el panel) **sin reconfirmar el evento**, con la nota «Reembolso requerido: …», auditoría `payment.collected_after_cancellation` y `note: "cancelled_booking"` (queda en `WebhookEvent.error` para revisión). El webhook **no** ejecuta `runPaymentSuccessEffects` (ni `PAYMENT_RECEIVED`/`BOOKING_CONFIRMED` a la clienta, ni ciclo de vida, ni «Pago recibido» al equipo): sólo `runCancelledBookingPaymentEffects` → `notifyTeamPaymentAnomaly` («Revisar pago · …», dedupe `cancelled-booking-payment:<paymentId>`). `/pago/resultado` le explica a la clienta que el evento está cancelado y que el equipo le reembolsará; el panel de pagos etiqueta el pago «Reembolso requerido».

**Verificación:** antes del cambio PAY-021 y EVT-024 fallaban 1/1 (`botón de pago visible=true; pago=PAID`); después pasan 3/3 con `--repeat-each=3 --retries=0` (carril 2, build de producción, base `ivonne_rosa_e2e_l2`), igual que la nueva [PAY-023] (webhook firmado tras cancelar → `PAID` + «Reembolso requerido», evento `CANCELLED`, 0 `PAYMENT_RECEIVED`, 1 aviso al equipo, duplicado idempotente, resultado y panel correctos). PAY-021 y EVT-024 llevan `@regression` y la anotación `regression: BUG-002`. Integración (`tests/integration/payments.test.ts`): anulación al cancelar, cancelación simultánea con checkout y con pago manual, y webhook tardío + reembolso. Unitarias: `isBookingCancelled`, `isCollectedPaymentStatus`, `checkoutLinkState` «cancelled».

**Regresión (carril 2, tras ambos commits):** `tests/e2e/payments`, `events/event-payments`, `events/event-status`, `quote-public`, `portal` y `critical/sales.spec.ts` en chromium → 72/75 PASS, 0 flaky; las 3 FAIL son hallazgos previos ajenos a este cambio (PAY-022 contraste `text-taupe` = SAL-BUG-04/BUG-009, QPUB-014 = SAL-BUG-06/BUG-010, QPUB-015 = SAL-BUG-05/BUG-012). `@mobile` (mobile-chrome) 10/10 PASS; `payments-flag.global.spec.ts` 1/1 PASS. `pnpm typecheck`, `pnpm lint`, `pnpm test` (739) y `tests/integration/payments.test.ts` + `events-calendar.test.ts` en verde.

### Fix (BUG-002) — cambios de la revisión
Commit `fix(payments): un cobro que compite con la cancelación nunca se pierde; resultado y pasarela coherentes con la cancelación (BUG-002)`.
1. **Carrera webhook ↔ cancelación (mayor)** — `applyPaymentSucceeded` leía el estado del pago *antes* de esperar el candado de la reserva: si la cancelación anulaba el checkout mientras tanto, el webhook veía un `PENDING` obsoleto, su `updateMany` afectaba 0 filas (`concurrent_update`), se marcaba procesado con 200 y el cobro real quedaba `FAILED` «Evento cancelado.» sin nota, auditoría ni aviso. Reproducido con una prueba de integración que fuerza el orden (una transacción retiene el candado de la reserva, la cancelación espera primero y el webhook lee el pago y espera detrás): resultado `applied:false, note:"concurrent_update"`. Corrección: `applyPaymentSucceeded` y `applyPaymentFailed` sólo leen `bookingId`/`kind` antes del candado y leen el estado vigente **después** de tomarlo; así el cobro sigue la regla `FAILED → PAID` con «Reembolso requerido», auditoría y aviso al equipo. Defensa adicional: `handlePaymentWebhook` trata `concurrent_update` como reintentable (revierte la transacción, no marca `processedAt`, responde 500 y el proveedor reintenta).
2. **Resultado de la clienta según el propio pago** — `paymentStatusView` (`domain/amounts.ts`, compartido por la página y `getPaymentStatusAction`) agrega `eventCancelled` y `collectedAfterCancellation` (nota «Reembolso requerido» del pago, no el estado del evento). Un anticipo pagado antes de cancelar ya no promete un reembolso; el checkout anulado muestra «Este pago se anuló» y «si alcanzaste a completar el cobro… te lo reembolsaremos» (no asegura «No se realizó ningún cobro»); «Intentar de nuevo» se oculta también si la cancelación ocurre mientras la página consulta el estado.
3. **Candado y tiempos** — las transacciones que esperan el candado de la reserva (cancelación, webhooks, pagos manuales y reembolsos) usan `BOOKING_LOCK_TX_OPTIONS` (30 s) en lugar de los 5 s por defecto de Prisma, que cubren a un `startCheckout` que lo conserva mientras la pasarela abre la sesión (≤ 15 s). `docs/DEPLOY_DOKPLOY.md` documenta no bajar `connection_limit` de 10.
4. **Sesiones del proveedor y casos históricos** — `PaymentProvider.expireCheckout?` (Stripe `POST /v1/checkout/sessions/{id}/expire`; Mercado Pago `PUT /checkout/preferences/{id}` con `expiration_date_to` = ahora; el mock no tiene sesión externa). `cancelEvent` lo llama best-effort tras confirmar la cancelación (límite 10 s, nunca falla la cancelación; si la pasarela lo rechaza aplica la regla del cobro tardío). `scripts/report-cancelled-booking-payments.ts` (sólo lectura: `pnpm exec tsx scripts/report-cancelled-booking-payments.ts [--json]`) lista los cobros con `paidAt` posterior a la cancelación de su reserva/evento —incluidos los anteriores a esta corrección, sin nota— para que el equipo los revise y reembolse.

**Verificación:** antes de estos cambios fallaban: integración «webhook de cobro que leyó el pago PENDING mientras se cancelaba» (`concurrent_update`, pago `FAILED`) y «webhook que pierde una carrera… 500 y reintento» (respondía 200); E2E [PAY-024] (la página mostraba «Tu pago no se completó · Evento cancelado. No se realizó ningún cobro» con «Intentar de nuevo»), [PAY-025] («Recibimos tu pago, pero tu evento está cancelado… reembolsártelo» para un anticipo pagado antes de cancelar), [PAY-021] (nuevos asserts del resultado) y [PAY-008] (forma exacta de la respuesta). Después: [PAY-008], [PAY-021], [PAY-023], [PAY-024], [PAY-025] y [EVT-024] pasan 3/3 con `--repeat-each=3 --retries=0` (carril 2); PAY-024/025 llevan `@regression` y `regression: BUG-002`. Integración `payments.test.ts` 40/40 (las 3 carreras + expiración, 4 corridas repetidas en verde). Unitarias nuevas: `wasCollectedAfterCancellation`, `isPaidAfterCancellation`, `paymentStatusView`, `expireCheckout` de Stripe y Mercado Pago.

**Regresión (carril 2):** `tests/e2e/payments`, `events` (carpeta completa), `quote-public`, `portal` y `critical/sales.spec.ts` en chromium → 101 pruebas: 95 PASS, 2 FLAKY, 4 FAIL. Las FAIL son hallazgos previos ajenos (EVT-037 contraste = EVX-BUG-04, PAY-022 = BUG-009, QPUB-014 = BUG-010, QPUB-015 = BUG-012). FLAKY: EVT-038 = EVX-BUG-02 (navegación RSC intermitente, ya documentada) y PAY-003, cuyo primer intento murió por un fallo del proceso del worker de Playwright en Windows (`code=3221226505`, 0 ms, sin assert); repetida aislada pasa 3/3 con `--retries=0`. `@mobile` (mobile-chrome) 10/10 PASS; `payments-flag.global.spec.ts` 1/1 PASS. `pnpm typecheck`, `pnpm lint`, `pnpm test` (746) en verde; `pnpm test:integration` 308/310: las 2 FAIL no tocan pagos ni archivos de este cambio (`devops.test.ts` espera `output: "standalone"` literal en `next.config.ts`; `memory-capsule.test.ts` CSRF del upload).

---

## SAL-BUG-01 — Dos solicitudes simultáneas de checkout crean dos pagos PENDING del mismo anticipo

**Severity:** MEDIUM
**Priority:** P2
**Status:** Fixed — consolidado como BUG-007 (ver «Fix» al final de esta sección)
**Type:** APPLICATION BUG (condición de carrera)
**Module:** payments
**Role:** Clienta (token de cotización/portal)
**Environment:** TEST — build local :3202, base ivonne_rosa_e2e_l2, commit f26b1a1
**Reproducible:** Sí (4/4)
**Test:** [PAY-019] tests/e2e/payments/payments.spec.ts (el caso secuencial PAY-006 sí reutiliza: PASS)

### Preconditions
Cotización aceptada sin pagos.

### Steps to reproduce
1. Enviar en paralelo dos `startCheckoutAction({ token, tokenType:"quote", kind:"DEPOSIT" })` (dos pestañas, doble envío o reintento de red).

### Expected
Una sola fila `Payment` `PENDING` y la misma URL de checkout (regla de reutilización de `startCheckout`).

### Actual
Dos filas `PENDING` por el mismo monto y dos URLs distintas (última corrida: Payments `cmuwe31u600e8…` y `cmuwe31ua00ea…`, 1 032 500 centavos cada uno; checkouts `mock_cs_Ku7vHr7V…` y otro distinto). Con un proveedor real ambas sesiones son cobrables: doble cargo del anticipo (el sistema sólo lo detecta después como «excedente»). En el mock la segunda queda «no vigente» tras pagar la primera.

### Evidence
- trace: `test-results/l2/artifacts/payments-payments-Pagos-pr-af478--duplicar-el-pago-pendiente-chromium/trace.zip` · screenshot: `test-results/l2/artifacts/payments-payments-Pagos-pr-af478--duplicar-el-pago-pendiente-chromium/test-failed-1.png`
- Consulta: `select id, status, "amountCents" from "Payment" where "bookingId"=…` → 2 filas `PENDING` 1032500.

### Console / Network
Sin errores; ambas acciones 200 `ok:true`.

### Technical Analysis
`src/features/payments/server/payment-service.ts:120-139`: busca un pago reutilizable sobre `booking.payments` leído antes y crea el nuevo sin bloqueo ni restricción única → dos requests concurrentes no se ven entre sí.

### Suspected Root Cause
Check-then-insert sin serialización por reserva.

### Recommended Fix
Envolver búsqueda + creación en una transacción con `lockBooking(tx, bookingId)` (ya existe en el mismo servicio) o un `pg_advisory_xact_lock` por reserva; opcionalmente índice único parcial `(bookingId, kind) WHERE status='PENDING'`.

### Fix (BUG-007)
Commit `fix(payments): serializar startCheckout por reserva para no duplicar el pago pendiente (BUG-007)`. `startCheckout` corre en una transacción con `lockBooking` (`SELECT … FOR UPDATE` de la reserva): lectura de pagos, regla de reutilización, creación del `Payment` y sesión del proveedor ocurren con la reserva bloqueada, así la segunda solicitud espera y reutiliza el `checkoutUrl` de la primera. La hora de la regla de reutilización se toma ya con el candado (tomada antes de esperar, el pago recién creado parecía «futuro» y no se reutilizaba: lo detectó la nueva prueba de integración con 3 solicitudes simultáneas). La sesión del proveedor tiene límite de 15 s (si falla, el intento queda `FAILED` como antes) y la transacción 40 s. Sin cambios de esquema (no se agregó el índice parcial: el candado basta y `schema.prisma` requiere coordinación).

**Verificación:** antes, PAY-019 fallaba 1/1 (2 `Payment` `PENDING` de 1 032 500 centavos y 2 URLs); después pasa 3/3 con `--repeat-each=3 --retries=0` en el carril 2 (un solo `Payment` en la reserva, misma URL). PAY-019 lleva `@regression` y la anotación `regression: BUG-007`. Integración: 3 `startCheckout` simultáneos → 1 pago, 1 URL, 1 `START_PAYMENT` (estable en 4 corridas). Regresión del módulo: ver SAL-BUG-03 «Fix».

### Revisión adversarial propia de BUG-002/BUG-007 (carril 3)
Commit `445645c` (`fix(payments): startCheckout ya no retiene el candado de la reserva mientras la pasarela abre la sesión`), sobre `86b60de`. Se revisaron `payment-service` (checkout, transiciones, pagos manuales, reembolsos), `webhook-service`, `mock-checkout-actions`, `domain/amounts`, `cancelEvent`, proveedores y `/pago/resultado`.
- **Sesiones de proveedores reales tras cancelar**: ya resuelto en `568d92d` (`expireCheckout` de Stripe `POST /v1/checkout/sessions/{id}/expire` y de Mercado Pago `PUT /checkout/preferences/{id}` con `expiration_date_to` = ahora; best-effort con límite de 10 s y registro en el log si falla). Con el nuevo diseño de dos fases también se expira la sesión que la pasarela abre **después** de que la cancelación anuló el lugar reservado (antes no existía ese caso porque el candado se retenía), y la de un checkout cuya publicación falla por la base.
- **`startCheckout` retenía transacción, conexión y `FOR UPDATE` durante la llamada HTTP** (hasta 15 s; cancelación, webhooks, pagos manuales y reembolsos de esa reserva esperaban, y un pool pequeño se podía agotar): ahora (1) reserva el pago con el candado (`PENDING` sin `checkoutUrl`), (2) llama a la pasarela sin transacción y (3) publica la URL con el candado sólo si el pago sigue reservado y la reserva viva. No reabre BUG-007: una solicitud simultánea del mismo cobro ve el lugar reservado (`checkoutOpeningState` = `opening`), espera fuera del candado y reutiliza la URL publicada (1 `Payment`, 1 sesión). No reabre BUG-002: si la cancelación anula el lugar mientras la pasarela responde, no se publica nada, se expira esa sesión y se responde `EVENT_CANCELLED`. Un lugar sin URL más allá de 20 s se da por fallido (solicitud muerta a la mitad). `BOOKING_LOCK_TX_OPTIONS` vuelve a 15 s y `DEPLOY_DOKPLOY.md` ya no exige un pool mínimo por los checkouts.
- **`eventCancelled` en `/pago/resultado`**: revisado, ya correcto desde `568d92d` — el reembolso se promete según la nota del propio pago (`collectedAfterCancellation`), no según el estado del evento; `eventCancelled` sólo oculta «Intentar de nuevo» (también si la cancelación ocurre mientras la página consulta) y ajusta el texto de un pago cobrado antes de cancelar. [PAY-024]/[PAY-025] lo cubren.
- **Riesgos residuales documentados (sin cambio):** (a) una sesión de checkout que queda obsoleta porque el saldo cambió (p. ej. pago manual mientras la clienta tiene abierta la pasarela) sigue cobrable en el proveedor hasta su hora de vigencia; si se paga, el excedente se registra y el aviso al equipo lo señala («lo cobrado excede el total»). Expirarla al registrar el pago manual sería una mejora aparte. (b) El checkout simulado revisa el estado fuera del candado, igual que una pasarela real: un cobro que gane la carrera a la cancelación sigue la regla «Reembolso requerido».
- **Pruebas** (`tests/integration/payments.test.ts`): la reserva no queda bloqueada mientras la pasarela responde (`FOR UPDATE NOWAIT`) y la segunda solicitud reutiliza la misma URL con una sola llamada al proveedor; cancelación durante la apertura (no espera a la pasarela, no se publica la URL, se expira la sesión, `EVENT_CANCELLED`, 0 `START_PAYMENT`); falla de la pasarela → `FAILED` + `CHECKOUT_FAILED` y el reintento abre otro; lugar abandonado → `FAILED`. Unitarias de `checkoutOpeningState`.
- **Verificación (carril 3):** `payments.test.ts` 44/44 y `pnpm test:integration` 324/324; E2E chromium (`payments`, `events`, `critical`… 231/231 PASS sin flaky); [PAY-019] (BUG-007), [PAY-021], [PAY-023], [PAY-024], [PAY-025] y [EVT-024] 5/5 con `--repeat-each=5 --retries=0`; `payments-flag.global.spec.ts` 1/1.
- **Hallazgos en la corrida cross-browser (no introducidos por este cambio):** (1) [CRIT-010] fallaba en WebKit (3/5) y Firefox: escribía en `/contacto` antes de que el formulario hidratara y el nombre quedaba vacío → TEST BUG corregido (espera a que «Enviar mensaje» se habilite, como `contact.spec.ts`); después 15/15 en Firefox, WebKit y mobile-chrome. (2) En **Firefox**, `/pago/mock/<id>` registra intermitentemente `Minified React error #418` (hidratación, «HTML») y el guard falla [PAY-001]/[EVT-024] aunque todos sus asserts pasan. Es previo: con un build de la base `86b60de` (mismo carril y base de datos) [EVT-024] falla 2/5 y [PAY-001] 7/15 con el mismo error (en la regresión completa ya salió FLAKY [PAY-001] en Firefox, `test-results/l2`); en esta rama [PAY-001] 13/15 y [EVT-024] 3/5. No se reproduce con `next dev` (4/4) ni en Chromium/WebKit; queda como hallazgo abierto (posible APPLICATION BUG de hidratación sólo en Firefox con streaming de `loading.tsx`) para investigar con mensajes de React sin minificar. Evidencia: `test-results/l3-evidence/minors/{xb-fail,xb-repeat-artifacts,pay001-firefox-artifacts,base-86b60de-firefox}`.

---

## SAL-BUG-02 — La misma clienta se duplica entre canales: el teléfono se guarda con formatos distintos

**Severity:** MEDIUM
**Priority:** P2
**Status:** Fixed — consolidado como BUG-008 (commit `75085d4`); verificado en E2E carril 3 (ver «Resolution»)
**Type:** APPLICATION BUG (calidad de datos / regla «busca o crea clienta por email/teléfono»)
**Module:** leads (lead-intake) / configurator / marketing / ai-designer
**Role:** Anónimo
**Environment:** TEST — build local :3202, base ivonne_rosa_e2e_l2, commit f26b1a1
**Reproducible:** Sí (4/4)
**Test:** [CONF-022] tests/e2e/configurator/server.spec.ts

### Preconditions
Ninguna.

### Steps to reproduce
1. Enviar el configurador con teléfono `5556071732` y sin correo → Customer con `phone = "+525556071732"`.
2. Enviar el formulario de contacto con el mismo teléfono `5556071732` (correo nuevo).

### Expected
`createInboundLead` encuentra a la clienta existente por teléfono: ambos leads con el mismo `customerId`.

### Actual
Se crea una segunda Customer: el contacto guarda `phone = "5571161346"` y la búsqueda exacta por teléfono no coincide con `"+525571161346"`. Mensaje de la prueba (última corrida): `configurador guardó phone=+525556071732, contacto guardó phone=5556071732`.

### Evidence
- trace: `test-results/l2/artifacts/configurator-server-Config-7aee3-or-→-diseñador-IA-contacto--chromium/trace.zip`
- Consulta: `select id, phone from "Customer" where phone like '%5556071732'` → 2 filas (una por canal).

### Technical Analysis
- `src/features/configurator/server/configurator-service.ts:180` normaliza a `+52` + 10 dígitos.
- `src/features/marketing/server/contact-service.ts:34` y `src/features/ai-designer/server/designer-service.ts:444` envían el teléfono tal cual.
- `src/features/leads/server/lead-intake.ts:53` (`normPhone`) sólo quita caracteres; `:63` busca por igualdad exacta.

### Suspected Root Cause
Normalización de teléfono por canal en lugar de en el punto único de captura.

### Recommended Fix
Normalizar en `createInboundLead` con `normalizeMxPhone10` → `+52XXXXXXXXXX` para todas las fuentes y buscar por la forma normalizada (y, en transición, por las variantes de 10/12 dígitos); migración para normalizar `Customer.phone`/`Lead.phone` existentes.

### Resolution
Corregido como **BUG-008** (mismo defecto que COM-BUG-02). Detalle en `commercial.md` › COM-BUG-02 › Resolution. [CONF-022] es `@regression` y pasa 3/3 (`--repeat-each=3 --retries=0`, carril 3) y en la corrida completa de `tests/e2e/configurator`.

---

## SAL-BUG-06 — La propuesta pública usa listas de definición inválidas (axe «serious»)

**Severity:** MEDIUM
**Priority:** P2
**Status:** Fixed — consolidado como BUG-010 (commit `7173e13`). Verificado: QPUB-014 PASS 3/3.
**Type:** UX ISSUE (accesibilidad WCAG 1.3.1)
**Module:** quotes (vista pública)
**Role:** Clienta
**Environment:** TEST — build local :3202, base ivonne_rosa_e2e_l2, commit f26b1a1
**Reproducible:** Sí (4/4)
**Test:** [QPUB-014] tests/e2e/quote-public/quote-public.spec.ts

### Steps to reproduce
1. Abrir `/cotizacion/<token>` de una cotización SENT y correr axe (WCAG 2.1 AA).

### Expected
Sin violaciones critical/serious.

### Actual
`definition-list` y `dlitem` (serious): los `<dt>/<dd>` de «Fecha / Hora de inicio / Zona / Invitadas» y del «Resumen de pago» están dentro de `<div>` anidados (no son hijos directos de `<dl>` ni de un `<div>` de agrupación directo), así que los lectores de pantalla pierden la relación etiqueta–valor de fecha, total, anticipo y saldo.

### Evidence
- `test-results/l2/artifacts/quote-public-quote-public--ae8fa-ta-y-del-diálogo-de-aceptar-chromium/trace.zip` · adjunto `a11y-axe.json` en `test-results/l2/results.json`.

### Technical Analysis
`src/app/(experience)/cotizacion/[token]/page.tsx:74-85` (`DetailTile`: `<div><span icono/><div><dt/><dd/></div></div>`) y `:151-190` (`<dl>` del resumen con `<div className="bg-sand-soft/70 …">` que envuelve otros `<div>` con `dt/dd`).

### Recommended Fix
Que cada par quede en un único `<div>` hijo directo del `<dl>` (mover el icono dentro del `<dt>` o fuera del `<dl>`), y sacar el bloque «anticipo/saldo» a su propio `<dl>`.

---

## SAL-BUG-04 — Texto «Conexión cifrada» del encabezado de pago con contraste insuficiente

**Severity:** LOW
**Priority:** P2
**Status:** Fixed — consolidado como BUG-009 (commit `cf3e12d`). «Conexión cifrada» usa `text-taupe-deep` (sólo cambio de clase). Verificado: PAY-022 PASS 3/3.
**Type:** UX ISSUE (accesibilidad WCAG 1.4.3)
**Module:** payments (layout `/pago/*`)
**Role:** Clienta
**Environment:** TEST — build local :3202, base ivonne_rosa_e2e_l2, commit f26b1a1
**Reproducible:** Sí (4/4)
**Test:** [PAY-022] tests/e2e/payments/payments.spec.ts

### Steps to reproduce
1. Abrir `/pago/mock/<checkoutId>` o `/pago/resultado?p=…&s=…` y correr axe.

### Expected
Contraste ≥ 4.5:1 en texto de 12 px.

### Actual
`color-contrast` (serious): `#a48f7e` sobre `#f7f3ec` = **2.78:1** en «Conexión cifrada».

### Evidence
- `test-results/l2/artifacts/payments-payments-Pagos-pr-7c626-do-y-del-resultado-del-pago-chromium/trace.zip` · adjunto `a11y-axe.json`.

### Technical Analysis
`src/app/(experience)/pago/layout.tsx:11` usa `text-taupe text-xs`.

### Recommended Fix
Usar `text-muted-foreground` (o un taupe más oscuro) para ese texto.

---

## SAL-BUG-05 — El diálogo «Aceptar propuesta» no devuelve el foco al botón al cerrarse

**Severity:** LOW
**Priority:** P3
**Status:** Fixed — consolidado como BUG-012 (commit `f35fb04`). Verificado: QPUB-015 PASS 3/3.
**Type:** UX ISSUE (accesibilidad WCAG 2.4.3)
**Module:** quotes (vista pública)
**Role:** Clienta (teclado / lector de pantalla)
**Environment:** TEST — build local :3202, base ivonne_rosa_e2e_l2, commit f26b1a1
**Reproducible:** Sí (4/4)
**Test:** [QPUB-015] tests/e2e/quote-public/quote-public.spec.ts

### Steps to reproduce
1. En `/cotizacion/<token>` enfocar «Aceptar propuesta» y pulsar Enter (abre el diálogo, foco en «Nombre completo»: correcto).
2. Pulsar Escape.

### Expected
El foco regresa a «Aceptar propuesta» (como sí ocurre con «No por ahora», que usa `DialogTrigger`).

### Actual
El foco queda en `<body>`; quien navega con teclado vuelve al inicio de la página.

### Evidence
- `test-results/l2/artifacts/quote-public-quote-public--ac9d6-e-devuelve-el-foco-al-botón-chromium/trace.zip` · screenshot `test-failed-1.png`.

### Technical Analysis
`src/features/quotes/components/public/accept-quote.tsx:58,83`: el botón abre con `setOpen(true)` y el `<Dialog open>` controlado no tiene `DialogTrigger`, así que Radix no sabe a dónde devolver el foco (además hay dos disparadores: el botón inline y la barra fija móvil).

### Recommended Fix
Guardar el elemento disparador y devolverle el foco en `onCloseAutoFocus` del `DialogContent` (o envolver cada botón en `DialogTrigger`).

---

## SAL-BUG-07 — `/experiencias/[slug]` inexistente o inactivo responde HTTP 200 (soft 404)

**Severity:** LOW
**Priority:** P3
**Status:** Fixed — consolidado como BUG-013 (commit `a8ca093`). `experiencias/[slug]/layout.tsx` valida el slug antes de cualquier `loading.tsx` (los esqueletos del inicio y del catálogo pasan a los grupos `(inicio)` y `(catalogo)`). Verificado: PUB-016 (ahora exige HTTP 404 para inexistente, inválido e inactivo) PASS 3/3.
**Type:** APPLICATION BUG (SEO)
**Module:** public (catálogo)
**Role:** Anónimo / rastreadores
**Environment:** TEST — build local :3202, base ivonne_rosa_e2e_l2, commit f26b1a1
**Reproducible:** Sí (siempre; también con `curl`)
**Test:** [PUB-016] tests/e2e/public/site.spec.ts (valida contenido + `noindex`: PASS; el status se registra en la anotación `http-status`)

### Steps to reproduce
1. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3202/experiencias/no-existe-esta-mesa` → `200`.

### Expected
404 real (como ya hace `/cotizacion/[token]` validando en su `layout.tsx` antes del streaming).

### Actual
200 con la página «Esta mesa ya no está puesta» y `<meta name="robots" content="noindex">` repetido 2–3 veces. El propio código lo documenta como «soft 404 controlado» (`src/app/(public)/experiencias/[slug]/page.tsx:43-46`), pero los buscadores lo reportan como soft 404 y los enlaces rotos/experiencias dadas de baja no se detectan por status.

### Recommended Fix
Agregar `experiencias/[slug]/layout.tsx` que valide el slug y llame `notFound()` antes de `loading.tsx` (mismo patrón que `cotizacion/[token]/layout.tsx`).

### Revisión del patrón en otras rutas (BUG-013, seguimiento ronda 1)
**Causa común.** En Next 15.5 un `loading.tsx` envuelve en Suspense todo lo que cuelga de su segmento. Un `notFound()` dentro de ese límite llega cuando el streaming ya empezó con HTTP 200: se ve la página «no encontrado», pero el status es 200 (soft-404). Un `layout.tsx` que valida antes de su propio `loading.tsx` da un 404 real **sólo si ningún segmento por encima** tiene `loading.tsx` ni envuelve `children` en `<Suspense>`.

**Rutas públicas y por token (revisadas; todas con 404 real):**

| Ruta | Dónde se valida | Límite de carga |
|---|---|---|
| `/experiencias/[slug]` | `experiencias/[slug]/layout.tsx` | `[slug]/loading.tsx` (debajo del guardián) |
| `/cotizacion/[token]` | `cotizacion/[token]/layout.tsx` | `[token]/loading.tsx` |
| `/mi-evento/[token]` y `/resumen` | `mi-evento/[token]/layout.tsx` | `[token]/loading.tsx`, `resumen/loading.tsx` |
| `/e/[slug]/[token]` | `e/[slug]/[token]/layout.tsx` | `[token]/loading.tsx` |
| `/memory/[token]` | `memory/[token]/layout.tsx` | `[token]/loading.tsx` |
| `/pago/mock/[checkoutId]` | `pago/mock/[checkoutId]/layout.tsx` | `[checkoutId]/loading.tsx` |
| `/pago/resultado` | la propia página (firma HMAC) | ninguno en su cadena |

El resto de las páginas públicas (`/`, `/experiencias`, `/como-funciona`, `/contacto`, `/crear-experiencia`, `/crear-experiencia/ai`, `/nuestra-historia`, `/privacidad`, `/terminos`, `/login`, `/mi-evento`) no llama `notFound()`; las URL sin ruta responden 404 real desde `app/not-found.tsx`.

**Robustez.** El 404 dependía de que nadie agregara un `loading.tsx` en `(public)/`, `experiencias/`, `(experience)/` o en los segmentos intermedios. Ahora lo vigila `tests/unit/route-not-found-contract.test.ts`: recorre `src/app` y falla si un layout guardián de `(public)`, `(experience)` o `(auth)` queda dentro de un `loading.*` o de un `<Suspense>` ancestro, o si una página de esos grupos llama `notFound()` dentro de un límite de carga sin layout guardián. Se comprobó que falla al crear `(public)/loading.tsx` o `(experience)/loading.tsx`. La restricción también está comentada en `(public)/layout.tsx` y `(experience)/layout.tsx`. [NAV-034] `@regression` verifica en el build real que las 8 rutas responden HTTP 404 con un slug/token inexistente.

**Zonas internas con soft-404 conocido (fuera del contrato a propósito).** `(admin)/admin/loading.tsx` y `(staff)/staff/loading.tsx` envuelven todo su panel, así que estas rutas muestran «No encontramos…» con HTTP 200 cuando el id no existe: `/admin/catalog/addons/[id]`, `/admin/catalog/experiences/[id]`, `/admin/catalog/menus/[id]`, `/admin/customers/[id]`, `/admin/events/[id]` (y `/financials`, `/guests`, `/memory`, `/operations`), `/admin/inventory/[id]`, `/admin/inventory/events/[eventId]`, `/admin/leads/[id]`, `/admin/operations/templates/[id]`, `/admin/purchases/[id]`, `/admin/quotes/[id]` (y `/print`), `/admin/staff/[id]`, `/admin/vendors/[id]` (y `/edit`) y `/staff/events/[id]`. Requieren sesión, llevan `X-Robots-Tag: noindex` y no exponen datos (la barrera «No encontramos este evento» es correcta), así que no hay impacto de SEO ni de seguridad; sólo el monitoreo por status no los distingue. Cambiarlo exigiría quitar el esqueleto general del panel o validar cada id en un layout propio: queda como mejora opcional, no como bug. [NAV-004] lo registra como anotación `observado`.

---

## Defectos / riesgos de la infraestructura compartida (no son bugs de la app)

1. **Caché de datos de Next compartida entre carriles y entre re-siembras (ENVIRONMENT ISSUE, confirmado).** `unstable_cache` persiste en `.next-e2e/cache/fetch-cache`, carpeta común a todos los carriles y que sobrevive a la re-siembra (los ids son cuid nuevos en cada seed). En la corrida completa nº 2 del carril, `/experiencias/birthday-table` sirvió un `experienceId` de otra base: el `ViewBeacon` lo envió a `/api/analytics/track` → **422** → error de consola → PUB-003/015/020/021 fallaron por el guard. Lo mismo puede pasar con el catálogo del configurador (ids de experiencia/menú/zona de otra base ⇒ estimado y envío fallan). Mitigación aplicada sólo en mis pruebas: `ensureFreshConfiguratorCatalog` y `ensureFreshExperienceDetail` (`tests/e2e/configurator/_helpers.ts`) esperan hasta 75 s, por API, a que la página sirva los ids de la base del carril; si no ocurre, la prueba queda **BLOCKED (ENVIRONMENT ISSUE)** en lugar de FAIL. En la corrida nº 3 la espera llegó a superar 90 s (otros carriles reescriben la misma entrada), de ahí el presupuesto explícito. **Corrección recomendada** en `scripts/e2e-server.mjs`: borrar `.next-e2e/cache/fetch-cache` al arrancar y/o dar a cada carril su propio directorio de caché (p. ej. `cacheHandler` con ruta por carril) — si no, cualquier paquete que lea catálogo puede fallar de forma intermitente.
2. **Guard de consola y 404/422 esperados:** Chrome registra «Failed to load resource: … 404» como `console.error`; toda prueba de 404 debe declarar `guard.allow(/404/)`. Correcto pero conviene documentarlo en `test-design.md`.
3. **`getByRole("alert")` es ambiguo** en todas las páginas: el *route announcer* de Next tiene `role="alert"`. Filtrar por texto (`stepAlert()` en mis helpers).
4. **`pnpm.cmd exec playwright … -g "A|B"`** se rompe en Windows (cmd.exe interpreta `|`). Usar `node node_modules/@playwright/test/cli.js test …` (lo usé en todas las corridas); conviene anotarlo en el runbook.
5. **Respuestas RSC de Server Actions sin `charset`:** `Response.text()`/`body()` del navegador en Playwright las decodifica como latin1 (acentos rotos). `APIRequestContext` sí decodifica UTF-8. Mis pruebas comparan contra la base en lugar del texto capturado.
6. **Conteos globales en la base no sirven con varios workers** (otros archivos crean leads/pagos en paralelo): aprendido en la corrida 1 (CONF-005/CONF-018 fallaron por esto, TEST BUG corregido). Las aserciones de «la base no cambió» deben acotarse a los datos de la prueba.
7. `tests/e2e/fixtures/guard.ts` fue modificado por otro carril durante mis corridas (01:51: patrones benignos de WebKit, entre ellos `Failed to fetch RSC payload … Falling back to browser navigation`, que también silencia ese aviso en Chromium). No afectó mis resultados, pero el orquestador debería revisarlo/consolidarlo.
8. La carpeta *scratchpad* de la sesión la comparten los agentes de todos los carriles (un script mío desapareció a mitad de la corrida); usar subcarpetas por carril.

## Observaciones UX / accesibilidad / rendimiento (no son bug)

- **Metadatos en `<body>` para navegadores y Googlebot:** Next 15.5 transmite title/description/OG al final del documento; los rastreadores sin JS (facebookexternalhit, Twitterbot, WhatsApp, Slackbot) sí los reciben en `<head>` (verificado; PUB-018 mide con ese UA). Correcto para Google (ejecuta JS); vigilar herramientas SEO que no ejecutan JS.
- **`<meta name="robots" content="noindex">` duplicado** (2–3 veces) en la página «no encontrada» de experiencias.
- **Desbordamiento horizontal transitorio a 390 px en `/crear-experiencia`** (14 px) medido justo al cargar, antes de que terminen hidratación/transiciones; desaparece al asentarse (sondeo posterior: 0 px). Posible «salto» visual en móviles lentos; PUB-021 ahora mide tras asentar animaciones.
- **Formulario de contacto:** al salir de un campo inválido (modo `onTouched`) aparece su error y desplaza el layout; un clic inmediato en la casilla de consentimiento puede caer en el enlace «aviso de privacidad» del label (abre otra pestaña y no marca la casilla). Sugerencia: no envolver el enlace dentro del área clicable de la casilla o reservar espacio para el error.
- **Contraste transitorio** del botón «Enviar mensaje» mientras pasa de deshabilitado a habilitado (axe a mitad de la transición: 2.32:1); estable después.
- **Disponibilidad pública** expone `remaining` (lugares restantes por día). Es por diseño; no expone datos de otros eventos (CONF-016).
- **Accesibilidad positiva:** radiogroups del configurador navegables con flechas/espacio, foco al abrir diálogos, labels asociados en todos los formularios probados, `aria-invalid` en errores.
- **Rendimiento:** ninguna página pública > 2 s en la build local; el recorrido completo del configurador (10 pasos + envío + revisión admin) ~11 s; pago mock completo (checkout → webhook → resultado) ~3 s.
- **Fechas:** el wizard elige la primera fecha «Disponible» del mes; si las pruebas corren a fin de mes navega al siguiente (manejado en `pickDate`).
