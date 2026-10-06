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
**Status:** Open
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

---

## SAL-BUG-01 — Dos solicitudes simultáneas de checkout crean dos pagos PENDING del mismo anticipo

**Severity:** MEDIUM
**Priority:** P2
**Status:** Open
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

---

## SAL-BUG-02 — La misma clienta se duplica entre canales: el teléfono se guarda con formatos distintos

**Severity:** MEDIUM
**Priority:** P2
**Status:** Open
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
