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
**Status:** Open
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

---

## EVX-BUG-03 — Link general de invitación: escribir el nombre de otra invitada sobrescribe su RSVP y entrega su link personal

**Severity:** CRITICAL (regla del gate: problema de seguridad que expone/corrompe datos de terceros)
**Priority:** P0
**Status:** Open
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
