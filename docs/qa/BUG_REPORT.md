# BUG REPORT — Ivonne & Rosa (auditoría FULL E2E)

- **Fecha:** 2026-10-06
- **Commit auditado:** `f26b1a1` (FULL inicial; sin cambios de código de la app durante la auditoría)
- **Modo:** FULL (6 paquetes: acceso y seguridad · venta pública · comercial admin · eventos y experiencia · operación y back-office · transversal)
- **Entorno:** TEST — 6 carriles paralelos (`E2E_LANE=1..6`, servidores `:3201`–`:3206`, bases `ivonne_rosa_e2e_l1`…`_l6` re-sembradas en cada invocación; suites especiales `global` y `ratelimit` en `:3209`), build de producción local (`.next-e2e`, `next start`, Next 15.5.27), proveedores mock (pagos, email, WhatsApp, IA), S3 local (RustFS `:9000`), Windows 11. Navegadores: Chromium, mobile-chrome (Pixel 7) y WebKit; Firefox BLOCKED (ENV-02).
- **Fuentes:** `docs/qa/findings/{access,sales,commercial,events,operations,transversal}.md` (31 hallazgos provisionales) y el mapa de IDs `docs/qa/.bug-map.json`.

> **Nota:** Las correcciones están en curso; el estado se actualizará tras la verificación.

## Resumen por severidad

| Severidad | Cantidad | Bugs |
|---|---|---|
| BLOCKER | 0 | — |
| CRITICAL | 3 | BUG-001, BUG-002, BUG-003 |
| HIGH | 3 | BUG-004, BUG-005, BUG-006 |
| MEDIUM | 5 | BUG-007, BUG-008, BUG-009, BUG-010, BUG-011 |
| LOW | 5 | BUG-012, BUG-013, BUG-014, BUG-015, BUG-016 |
| **Total** | **16** | 31 IDs provisionales de 6 carriles, deduplicados (ver «Mapa de IDs provisionales») |

| BUG | Severidad | Prioridad | Estado | Título | Módulo |
|---|---|---|---|---|---|
| BUG-001 | CRITICAL | P0 | Open | «Cerrar sesión» no es definitivo: las respuestas en vuelo re-emiten la cookie y no hay revocación en servidor | auth |
| BUG-002 | CRITICAL | P0 | Open | Un checkout de anticipo abierto se puede cobrar después de cancelar el evento | events / payments |
| BUG-003 | CRITICAL | P0 | Open | Link general de invitación: el nombre de otra invitada sobrescribe su RSVP y entrega su link personal | guests |
| BUG-004 | HIGH | P1 | Open | Una cookie copiada antes del logout sigue dando acceso | auth |
| BUG-005 | HIGH | P1 | Open | `callbackUrl` con caracteres de control evade `safeCallback` | auth |
| BUG-006 | HIGH | P0 | Open | Navegación a la misma ruta / `router.refresh()` colgada (filtros, paginación, calendario, contenido, bandeja, RSVP) | transversal (App Router) |
| BUG-007 | MEDIUM | P2 | Open | Checkout concurrente crea dos pagos PENDING | payments |
| BUG-008 | MEDIUM | P2 | Open | Teléfonos con formatos distintos duplican a la clienta | leads / customers |
| BUG-009 | MEDIUM | P2 | Open | Contraste insuficiente (warning/info, taupe, atenuados) | UI compartida |
| BUG-010 | MEDIUM | P2 | Open | `<dl>` inválidas en propuesta pública y micrositio | quotes / guests |
| BUG-011 | MEDIUM | P2 | Open | `aria-controls` de «Agregar nota» apunta a un id inexistente | staff |
| BUG-012 | LOW | P3 | Open | El diálogo «Aceptar propuesta» no devuelve el foco | quotes |
| BUG-013 | LOW | P3 | Open | Soft-404 en `/experiencias/[slug]` | public |
| BUG-014 | LOW | P3 | Open | Lead manual con «Origen» ≠ «Captura manual» envía avisos | leads |
| BUG-015 | LOW | P3 | Open | El encabezado del evento no muestra «Cerrado» | finance / events |
| BUG-016 | LOW | P3 | Open | Seed DEMO con enlaces a `/…/eventos/…` (404) | notifications / seed |

**Criterios de consolidación.** Cuando dos carriles vieron el mismo defecto se conserva la severidad más alta justificada por la regla del gate (seguridad o datos de terceros ⇒ CRITICAL; cobro indebido ⇒ CRITICAL). Reclasificaciones respecto a los IDs provisionales: SAL-BUG-03 (HIGH) y TRV-BUG-06 (HIGH) suben a CRITICAL al fusionarse con EVX-BUG-01 y ACC-BUG-01; COM-BUG-03 y OPX-BUG-02 (MEDIUM) se integran en BUG-006 (HIGH); SAL-BUG-04 (LOW) se integra en BUG-009 (MEDIUM); EVX-BUG-05 y TRV-BUG-04 (LOW) se integran en BUG-010 (MEDIUM). La parte de contraste de OPX-BUG-05 se documenta en BUG-009; el ID se asigna a BUG-011 según el mapa.

---

## BUG-001 — «Cerrar sesión» no es definitivo: las respuestas en vuelo re-emiten la cookie y no hay revocación en servidor

**Severity:** CRITICAL
**Priority:** P0
**Status:** Open
**Type:** POTENTIAL SECURITY ISSUE (gestión de sesión / logout)
**Module:** auth (logout) / middleware (Auth.js v5) — panel admin y portal staff
**Role:** cualquier rol del equipo (SUPER_ADMIN, OWNER, STAFF); reproducido con OWNER (carril 1) y STAFF (carril 6)
**Environment:** TEST — build de producción local; carril 1 `:3201` (base ivonne_rosa_e2e_l1) y carril 6 `:3206` (base ivonne_rosa_e2e_l6); commit f26b1a1; Chromium, WebKit y mobile-chrome
**Reproducible:** Sí — determinista: [AUTH-032] 7/7 (3 + 2 de reproducción + 2 de la corrida final) y [CRIT-014] 8/8 (Chromium 2/2 y WebKit 2/2 de reproducción + corrida final en Chromium y WebKit, intento y reintento). Natural (una pestaña, sin manipulación): 3 de 6 logouts en la variante de [AUTH-020]/[AUTH-021]/[AUTH-025] antes de esperar `networkidle`; [CRIT-012] mobile-chrome 1/7 (depende de la latencia de los prefetch).
**Test:** [AUTH-032] tests/e2e/auth/session.spec.ts · [CRIT-014], [CRIT-012] tests/e2e/critical/access.spec.ts · variante natural en [AUTH-020], [AUTH-021], [AUTH-025] tests/e2e/auth/session.spec.ts
**Fuentes:** ACC-BUG-01 (carril 1, CRITICAL), TRV-BUG-06 (carril 6, HIGH)

### Preconditions
Persona del equipo con sesión iniciada en el panel (`/admin/*`) o en el portal staff (`/staff`) y requests autenticados en curso: prefetch RSC del router (el sidebar del panel dispara ~20 al cargar cada página; las tarjetas de `/staff` hacen prefetch de `/staff/events/<id>`), otra pestaña abierta o red lenta. Es la situación normal de uso.

### Steps to reproduce
**Variante determinista — panel ([AUTH-032])**
1. Iniciar sesión como OWNER y abrir `/admin/leads` en dos pestañas.
2. En la pestaña 2 mantener navegación/prefetch del panel en curso (la prueba lanza `fetch('/admin/customers', { headers: { RSC: '1' } })` consecutivos durante 4 s).
3. En la pestaña 1 pulsar **Cerrar sesión** (sidebar).
4. Ir a `/admin/customers`.

**Variante determinista — portal staff ([CRIT-014])**
1. Iniciar sesión como staff y quedarse en `/staff`.
2. Pulsar **Cerrar sesión** mientras hay peticiones autenticadas en vuelo (prefetch de las tarjetas; en WebKit, una respuesta retenida de `/staff?e2e-inflight=1`).
3. Cuando llegan esas respuestas (después del `POST /api/auth/signout`), visitar `/staff`.

**Variante natural (una pestaña)**
1. Entrar a `/admin/leads` (o a `/staff` en móvil) y pulsar **Cerrar sesión** antes de que terminen los prefetch del sidebar/listado/tarjetas.
2. En ~50 % de los intentos del panel el navegador termina de nuevo en `/admin` (el `/login` detecta sesión y redirige) o queda en `/login` con la cookie de sesión presente.

### Expected result
Tras «Cerrar sesión» no queda cookie de sesión válida, ninguna respuesta posterior la vuelve a crear y cualquier página privada redirige a `/login` (`/staff` → `/login?callbackUrl=%2Fstaff`).

### Actual result
`POST /api/auth/signout` responde `Set-Cookie: authjs.session-token=; Max-Age=0`, pero las respuestas de requests emitidos **antes** del logout llegan después con `Set-Cookie: authjs.session-token=<JWT nuevo>` (el middleware re-emite la cookie en cada respuesta autenticada, incluidos los prefetch `?_rsc=`). El navegador guarda la cookie re-emitida y la sesión revive: `/admin/customers` carga con datos (200) y `/staff` abre el portal con eventos, direcciones y teléfonos de clientas. La persona cree haber cerrado sesión; quien use ese navegador después (p. ej. un celular compartido por el equipo) entra al panel o al portal con su rol.

### Evidence
- **Carril 1 — [AUTH-032]:** trace/screenshot/video `test-results/l1/artifacts/auth-session-Logout-y-sesi-ead15-o-la-sesión-NO-debe-revivir-chromium/` (y `…-retry1/`). Anotaciones de la corrida final: «pestaña 2: 105 requests; estados tras el logout: 200» y «cookie de sesión tras logout: PRESENTE (sesión revivida)»; `page.goto('/admin/customers')` → URL final `/admin/customers` (esperado `/login`).
- **Carril 1 — variante natural:** red extraída del trace de la corrida exploratoria de [AUTH-020] (el artefacto se reemplazó en corridas posteriores; extracto):
  ```
  07:01:25.178 POST /api/auth/signout          200 set-cookie: authjs.session-token=; Max-Age=0
               GET  /admin/leads/<id>?_rsc=…   200 set-cookie: authjs.session-token=eyJhbGciOiJkaXIi…   ← prefetch emitido antes del logout
               GET  /login                     200
               GET  /?_rsc=…                   200 set-cookie: authjs.session-token=eyJ…                ← ya en /login, sesión revivida
  ```
  En [AUTH-025] la misma carrera llevó a la persona de `/login` de vuelta a `/admin`.
- **Carril 6 — [CRIT-012] (natural, mobile-chrome), orden por tiempo:**
  ```
  07:34:41.629 GET  /staff/events/<id>?_rsc=…   200  Set-Cookie: authjs.session-token=eyJ…   ← prefetch emitido antes del logout
  07:34:41.634 POST /api/auth/signout           200  Set-Cookie: authjs.session-token=; Max-Age=0
  07:34:41.746 GET  /?_rsc=…                    200  (ya viaja con sesión) …
  07:34:41.754 GET  /staff                      200  ← portal abierto tras el logout
  ```
  Trace: `test-results/l6-evidence/TRV-BUG-06/CRIT-012-mobile-chrome-logout-natural-trace.zip`.
- **Carril 6 — [CRIT-014]:** anotación «Set-Cookie de sesión tras logout»: `GET /staff/events/<id>?_rsc=… 200` ×2 en Chromium; respuesta retenida de `/staff?e2e-inflight=1` en WebKit. Trace/screenshot/video: `test-results/l6-evidence/TRV-BUG-06/critical-access-Recorridos-b406a--sesión-no-revive-la-sesión-{chromium,webkit}[-retry1]/`.
- **Base:** `select active, role from "User" where email='<cuenta de prueba>'` → `true | OWNER`: no existe ningún estado de sesión en servidor que el logout pueda invalidar.

### Console errors
Ninguno.

### Network errors
Ninguno: todas las respuestas son 200/3xx; el defecto es el `Set-Cookie` tardío.

### Technical analysis
- `src/middleware.ts:16` envuelve todo con `auth((req) => …)` de Auth.js v5 y el `matcher` (`src/middleware.ts:48`) sólo excluye `api` y estáticos: con estrategia JWT cada request que coincide (incluidos los prefetch `?_rsc=`) devuelve la cookie re-codificada (renovación deslizante).
- `src/components/admin/admin-shell.tsx:161` y `src/components/staff/staff-shell.tsx:38` cierran sesión desde el cliente (`signOut({ callbackUrl: "/login" })` de `next-auth/react`) sin cancelar ni invalidar los requests en curso.
- `src/server/auth/session.ts:21-31` (`getCurrentUser`) revalida `active` y `role`, pero no existe ninguna marca de «sesión revocada»: cualquier JWT válido firmado antes del logout se acepta (ver también BUG-004).

### Suspected root cause
Sesión 100 % stateless (`src/auth.config.ts:12`: `strategy: "jwt"`, `maxAge` 12 h) + re-emisión de la cookie en cada respuesta del middleware ⇒ el logout sólo borra la cookie del navegador y cualquier respuesta tardía la vuelve a escribir; sin revocación en servidor, la cookie revivida es plenamente válida.

### Recommended fix
1. Revocación en servidor: agregar a `User` un `sessionVersion` (o `sessionsValidAfter`/`loggedOutAt`), incluirlo en el JWT en el callback `jwt` y compararlo en `getCurrentUser` (que ya consulta la base en cada request) y, si se quiere cortar antes, en el middleware. Cerrar sesión = Server Action `logoutAction` que incrementa la versión en servidor + borra la cookie. Alternativa: `jti` en lista de revocados. Requiere cambio de `prisma/schema.prisma` (coordinar).
2. Mitigación parcial inmediata: no re-emitir la cookie en respuestas de prefetch/RSC (o subir `session.updateAge`) y hacer el logout con navegación completa a un endpoint de servidor que responda `Clear-Site-Data: "cookies"` y redirija a `/login`.
3. Mantener [AUTH-032] y [CRIT-014] como pruebas `@regression`. La misma revocación resuelve BUG-004.

---

## BUG-002 — Un checkout de anticipo abierto se puede cobrar después de cancelar el evento

**Severity:** CRITICAL
**Priority:** P0
**Status:** Open
**Type:** APPLICATION BUG (integridad de cobros / corrupción de datos financieros)
**Module:** events / payments
**Role:** OWNER (cancela; ivonne@ivonne-rosa.test en el carril 4) + Clienta (token de cotización o del portal)
**Environment:** TEST — build de producción local; carril 2 `:3202` (base ivonne_rosa_e2e_l2) y carril 4 `:3204` (base ivonne_rosa_e2e_l4); commit f26b1a1; Chromium
**Reproducible:** Sí — [EVT-024] 8/8 (corridas de desarrollo, `--repeat-each=2`, corrida final con reintento y re-ejecución para evidencia); [PAY-021] 4/4 (2 corridas aisladas + 2 intentos en la corrida completa) + sonda manual con la misma secuencia.
**Test:** [EVT-024] tests/e2e/events/event-status.spec.ts · [PAY-021] tests/e2e/payments/payments.spec.ts
**Fuentes:** EVX-BUG-01 (carril 4, CRITICAL), SAL-BUG-03 (carril 2, HIGH)

### Preconditions
Evento `PENDING_PAYMENT` con reserva (cotización aceptada; en EVT-024: total $12,000, anticipo $6,000) y sin pagos. La clienta abrió «Pagar anticipo» (Payment DEPOSIT `PENDING` con `checkoutUrl`, proveedor mock).

### Steps to reproduce
1. Clienta: desde `/mi-evento/<portalToken>` pulsar «Pagar anticipo · $6,000» (o, desde la cotización, `startCheckoutAction({ token, tokenType: "quote", kind: "DEPOSIT" })`) → se crea el `Payment` `PENDING` y redirige a `/pago/mock/mock_cs_…`.
2. Fundadora: cancelar el evento desde `/admin/events/<id>` con motivo válido (`cancelEventAction({ eventId, reason, notifyCustomer: false })`) → evento `CANCELLED`, `Booking.cancelledAt` lleno.
3. Clienta: volver al enlace de pago que ya tenía abierto y pulsar «Pagar $6,000 (simulado)» (o `mockCheckoutAction({ outcome: "success" })`).

### Expected result
Al cancelar, los checkouts `PENDING` de la reserva quedan inválidos (FAILED/expirados); el enlace muestra «no vigente»/cancelado y la acción se rechaza. Nunca queda un anticipo «pagado» de un evento cancelado ni se avisa a la clienta «Recibimos tu pago». Si un proveedor real confirmara un cobro tardío, se registra para reembolso y se avisa al equipo.

### Actual result
- Tras la cancelación el pago sigue `PENDING` (anotación «estado del pago tras cancelar: PENDING»).
- `/pago/mock/<checkoutId>` sigue mostrando el botón de pago; `mockCheckoutAction` responde `ok: true`; el webhook firmado se procesa y el Payment queda **`PAID`** con el evento y la reserva en `CANCELLED`.
- Se envían `PAYMENT_RECEIVED` («Recibimos tu pago», email y WhatsApp) a la clienta y «Pago recibido · …» al equipo, sin mencionar la cancelación.
- Con un proveedor real (Stripe/Mercado Pago) la sesión de checkout seguiría viva hasta 1 h: el dinero se capturaría de verdad.

### Evidence
- **Carril 4 — [EVT-024]:** `test-results/l4/artifacts/events-event-status-Evento-1dfe8-ENTE-no-debe-poder-cobrarse-chromium/` (`trace.zip`, `test-failed-*.png`, `video.webm`) y `…-chromium-retry1/`. Corrida final (`test-results/l4/results.json`, 2/2 intentos): anotaciones «estado del pago tras cancelar: PENDING» y «estado final del pago: PAID». Re-ejecución para evidencia: `test-results/l4/evidence/`.
- **Consulta (base del carril 4):**
  ```sql
  SELECT e.code, e.status, e."cancelledAt", p.kind, p.status, p.provider, p."amountCents", p."paidAt", b."cancelledAt"
  FROM "Payment" p JOIN "Booking" b ON b.id = p."bookingId" JOIN "Event" e ON e.id = b."eventId"
  WHERE e.status = 'CANCELLED' AND p.status = 'PAID' AND p.provider = 'mock';
  ```
  → `EV-E2E-77A43D | CANCELLED | 07:24:41.901Z | DEPOSIT | PAID | mock | 600000 | paidAt 07:24:42.437Z | booking cancelado 07:24:41.901Z` (filas idénticas de otras repeticiones: `EV-E2E-8ED291`, `EV-E2E-3D1334`; estado actual tras la re-ejecución de evidencia: `EV-E2E-A97DB5 | CANCELLED | DEPOSIT | PAID | 600000 | paidAt 08:06:26.869Z`). `NotificationLog`: `PAYMENT_RECEIVED` «Recibimos tu pago» (EMAIL y WHATSAPP) para esos eventos cancelados.
- **Carril 2 — [PAY-021]:** trace `test-results/l2/artifacts/payments-payments-Pagos-pr-a0e1d-o-ya-no-debe-poder-cobrarse-chromium/trace.zip` · screenshot `test-results/l2/artifacts/payments-payments-Pagos-pr-a0e1d-o-ya-no-debe-poder-cobrarse-chromium/test-failed-1.png`. Anotación `observado` en `test-results/l2/results.json` (ambos intentos): `botón de pago visible=true; acción={"ok":true,"data":{"redirectTo":"/pago/resultado?p=…"}}; pago=PAID`.
- **Sonda (carril 2, misma secuencia):** `select status from "Payment" where id=…` → `PAID`; `select status from "Event" where id=…` → `CANCELLED`; `NotificationLog` del evento: `PAYMENT_RECEIVED` (EMAIL, WHATSAPP) + `GENERIC "Pago recibido · E2E …"`.

### Console errors
Ninguno (el guard no registró violaciones).

### Network errors
Ninguno (sin 4xx/5xx). Secuencia observada: `POST /pago/mock/<checkoutId>` (Server Action `mockCheckoutAction`) → 200 `{"ok":true,"data":{"redirectTo":"/pago/resultado?…"}}`; webhook interno `POST /api/webhooks/payments/mock` → 200 `applied: true`.

### Technical analysis
- `src/features/events/server/event-service.ts:514-602` (`cancelEvent`): cancela evento, reserva e inventario, pero **no toca los `Payment` `PENDING`** de la reserva ni la sesión del proveedor.
- `src/features/payments/domain/amounts.ts:93-109` (`checkoutLinkState`) y `src/app/(experience)/pago/mock/[checkoutId]/page.tsx`: el estado del enlace sólo mira estado/edad/monto del pago, no `booking.cancelledAt` ni `event.status` ⇒ sigue «payable».
- `src/features/payments/server/mock-checkout-actions.ts:57-104` (validación en `:60-72`): no valida la cancelación antes de emitir el webhook.
- `src/features/payments/server/payment-service.ts:271-304` (`applyPaymentSucceeded`): marca `PAID` sin revisar si la reserva está cancelada; `confirmEventIfDepositSatisfied` (`:246`) sólo evita re-confirmar el evento; `runPaymentSuccessEffects` (`:405-482`) notifica a la clienta como un pago normal.
- Contraste: el **pago manual** sobre un evento cancelado sí se bloquea (`EVENT_CANCELLED`, [EVT-027] PASS); el hueco es sólo el checkout en línea abierto.

### Suspected root cause
La cancelación no forma parte del ciclo de vida de los pagos: ni se invalidan los checkouts abiertos ni el checkout/webhook consultan el estado de la reserva.

### Recommended fix
1. En la transacción de `cancelEvent`: `payment.updateMany({ where: { bookingId, status: "PENDING", kind: { not: "REFUND" } }, data: { status: "FAILED", failedAt: now, failureReason: "Evento cancelado" } })` y expirar la sesión en el proveedor cuando exista API (`provider.expireCheckout?`).
2. `checkoutLinkState` / página mock / `mockCheckoutAction`: estado `cancelled` (no pagable) si `booking.cancelledAt` o `event.status === "CANCELLED"`.
3. `applyPaymentSucceeded` / `processPaymentEvent`: si llega un cobro capturado sobre una reserva cancelada, registrarlo con nota «Reembolso requerido», notificar al equipo (`notifyTeamPaymentAnomaly`) y **no** enviar `PAYMENT_RECEIVED` a la clienta; idealmente reembolso automático. Auditar el caso con `audit(...)`.
4. Mantener [EVT-024] y [PAY-021] como pruebas `@regression`.

---

## BUG-003 — Link general de invitación: escribir el nombre de otra invitada sobrescribe su RSVP y entrega su link personal

**Severity:** CRITICAL
**Priority:** P0
**Status:** Open
**Type:** POTENTIAL SECURITY ISSUE (integridad de datos de terceros + exposición de datos personales)
**Module:** guests (RSVP público / micrositio)
**Role:** Invitada anónima con el link general (`Event.inviteToken`)
**Environment:** TEST — build de producción local `:3204`, base ivonne_rosa_e2e_l4, commit f26b1a1; Chromium
**Reproducible:** Sí (5/5: corridas de desarrollo, `--repeat-each=3`, corrida final con reintento y re-ejecución para evidencia)
**Test:** [GST-014] tests/e2e/guests/rsvp.spec.ts
**Fuentes:** EVX-BUG-03 (carril 4, CRITICAL)

### Preconditions
Evento confirmado con una invitada «Camila Ruiz …» que ya respondió «Asiste», con email, restricción Vegana, nota alimentaria «Alergia severa a la nuez» y comentario.

### Steps to reproduce
1. Abrir el link general `/e/<slug>/<inviteToken>` (el que la anfitriona comparte en su grupo).
2. Escribir en «Tu nombre» el nombre de Camila (en minúsculas también funciona), dejar el email vacío, elegir «No podré ir» y enviar.

### Expected result
Una respuesta hecha con el link general no puede modificar a una invitada existente sin comprobar que es ella (p. ej. con su email) y nunca devuelve el token personal de otra persona.

### Actual result
- El RSVP de Camila pasa de `ATTENDING` a **`NOT_ATTENDING`** y **se sobrescriben sus datos**: el nombre queda como lo escribió el tercero (en minúsculas) y sus restricciones, nota alimentaria («Alergia severa a la nuez») y comentario se borran (el formulario genérico llega vacío). Es pérdida de información de seguridad alimentaria de otra persona.
- El navegador es redirigido al **link personal de Camila**, que muestra su formulario precargado (nombre, acompañante, restricciones, nota alimentaria, comentario, mensaje a la homenajeada, email enmascarado) y permite seguir editándolo; con «Asiste» además revela la dirección exacta del evento.

### Evidence
- trace/screenshots/video: `test-results/l4/artifacts/guests-rsvp-RSVP-·-invitad-14a88-i-entregar-su-link-personal-chromium{,-retry1}/`. Anotación «resultado»: URL final = link personal de la víctima; RSVP original = `NOT_ATTENDING`.
- Corrida final: anotación `resultado` = «URL final /e/e2e-509706f9cc/s_kOkpaVy41E… · RSVP de la invitada original: NOT_ATTENDING».
- Base (re-ejecución tras la corrida final; artefactos en `test-results/l4/evidence/`): `SELECT g.name, g."rsvpStatus", g."dietaryNotes", g.token FROM "EventGuest" g WHERE g.name ILIKE 'camila ruiz v-%'` → `camila ruiz v-muwea4ad-3e1f27 | NOT_ATTENDING | dietaryRestrictions {} | dietaryNotes NULL | comment NULL` (antes de la respuesta del tercero: «Camila Ruiz V-…», ATTENDING, [VEGAN], «Alergia severa a la nuez», «Llego tarde»).

### Console errors
Ninguno.

### Network errors
Ninguno. `POST /e/<slug>/<inviteToken>` (Server Action `submitRsvpAction`) → 200 `{ ok: true, data: { personalPath: "/e/<slug>/<token de Camila>" } }`.

### Technical analysis
- `src/features/guests/domain/rsvp.ts:58-75` (`findMatchingGuest`): sin email, empata por nombre normalizado aunque la invitada tenga email y ya haya respondido.
- `src/features/guests/server/rsvp-service.ts:72-96`: actualiza esa invitada con el formulario recibido y devuelve su `token`.
- `src/features/guests/server/actions.ts:17-24` arma `personalPath` con ese token y `src/features/guests/components/rsvp-panel.tsx:228-232` redirige ahí. El propio código reconoce el riesgo (comentario en `maskEmail`).

### Suspected root cause
Diseño de «re-identificación por nombre» sin ningún factor de posesión.

### Recommended fix
Con el link general: si hay coincidencia por nombre con una invitada que ya respondió o que tiene email/teléfono, **no** actualizarla ni devolver su token; crear una nueva invitada `SELF_RSVP` marcada como posible duplicado (o pedir el email registrado / enviar el link personal por correo o WhatsApp a la invitada). Sólo empatar por nombre invitadas `PENDING` sin contacto, y nunca exponer el token de otra persona. Mantener [GST-014] como `@regression`.

---

## BUG-004 — La sesión no se invalida en el servidor: una cookie copiada antes del logout sigue dando acceso

**Severity:** HIGH
**Priority:** P1
**Status:** Open
**Type:** POTENTIAL SECURITY ISSUE (gestión de sesión)
**Module:** auth (sesión)
**Role:** OWNER (aplica a cualquier rol del equipo)
**Environment:** TEST — build de producción local `:3201`, base ivonne_rosa_e2e_l1, commit f26b1a1; Chromium
**Reproducible:** Sí (≥ 4/4: 2 de reproducción + 2 de la corrida final con reintento)
**Test:** [AUTH-025] tests/e2e/auth/session.spec.ts
**Fuentes:** ACC-BUG-02 (carril 1, HIGH)

### Preconditions
Persona del equipo con sesión iniciada; alguien obtuvo una copia de su cookie `authjs.session-token` (equipo compartido, extensión maliciosa, respaldo del perfil del navegador, etc.).

### Steps to reproduce
1. Iniciar sesión como OWNER (cuenta propia de la prueba) y copiar el valor de `authjs.session-token`.
2. Pulsar **Cerrar sesión** esperando `networkidle` (para descartar BUG-001): la cookie desaparece del navegador.
3. Desde otro cliente: `GET /admin/customers` con `Cookie: authjs.session-token=<valor copiado>`.

### Expected result
307 a `/login`: una sesión cerrada ya no autoriza (OWASP ASVS 3.3.1).

### Actual result
`200` con el listado de clientas. La cookie sigue válida hasta 12 h y, como el middleware la renueva en cada request, puede mantenerse indefinidamente mientras se use. Sólo la desactivación y el cambio de rol cortan el acceso de una sesión abierta ([AUTH-027]/[AUTH-028] en PASS). Por el mismo diseño es previsible que restablecer la contraseña tampoco cierre las sesiones abiertas (inferido del código, NOT TESTED).

### Evidence
- `test-results/l1/artifacts/auth-session-Logout-y-sesi-5b4d6-ie-anterior-deja-de-servir--chromium/` (trace, screenshot, video) y `…-retry1/`.
- Anotación: `GET /admin/customers con cookie previa al logout → 200`.

### Console errors
Ninguno.

### Network errors
Ninguno.

### Technical analysis
- `src/auth.config.ts:12` (`strategy: "jwt"`, `maxAge` 12 h) y `src/server/auth/session.ts:21-31` (`getCurrentUser` sin verificación de revocación).
- El logout (`signOut` en el cliente) sólo expira la cookie local; el JWT copiado sigue firmado y vigente.

### Suspected root cause
Misma causa raíz que BUG-001: no existe estado de sesión en el servidor que se pueda revocar.

### Recommended fix
La misma revocación por `sessionVersion` de BUG-001; incrementarla también al restablecer contraseña (`src/features/users/server/user-service.ts` → `resetUserPassword`, `src/features/staff/server/staff-service.ts` → `resetStaffPassword`) y al desactivar. Mantener [AUTH-025] como `@regression` y agregar el caso «restablecer contraseña cierra sesiones».

---

## BUG-005 — `callbackUrl` con caracteres de control evade `safeCallback`

**Severity:** HIGH
**Priority:** P1
**Status:** Open
**Type:** POTENTIAL SECURITY ISSUE (bypass del filtro anti open-redirect)
**Module:** auth (login)
**Role:** cualquier persona del equipo que abra un enlace de login manipulado
**Environment:** TEST — build de producción local `:3201`, base ivonne_rosa_e2e_l1, commit f26b1a1; Chromium y WebKit
**Reproducible:** Sí (≥ 4/4 en Chromium: 2 de reproducción + 2 de la corrida final; también en WebKit)
**Test:** [AUTH-049] tests/e2e/auth/callback.spec.ts
**Fuentes:** ACC-BUG-03 (carril 1, HIGH)

### Preconditions
Cuenta del equipo válida. El atacante envía el enlace `/login?callbackUrl=%2F%09%2Fevil.example`.

### Steps to reproduce
1. Abrir `/login?callbackUrl=%2F%09%2Fevil.example` (`/` + TAB + `/evil.example`).
2. Iniciar sesión con credenciales válidas.

### Expected result
El `callbackUrl` se descarta (no es una ruta interna limpia) y la persona llega a `/admin`.

### Actual result
`safeCallback` lo acepta (empieza con `/` y el 2.º carácter es TAB). El servidor responde `x-action-redirect: http://localhost:3201/<TAB>/evil.example;push`; el navegador elimina el TAB al parsear la URL ⇒ ruta `//evil.example` (protocol-relative). El router de Next intenta `history.pushState('http://evil.example/')`; Chromium y WebKit lo bloquean con `SecurityError` y la app queda en **«Application error: a client-side exception has occurred»** (la sesión sí se creó). No se observó navegación efectiva a `evil.example`: la protección final es del navegador, no de la app.

### Evidence
- `test-results/l1/artifacts/auth-callback-callbackUrl--caacc-no-redirige-fuera-de-la-app-chromium/` (trace, screenshot, video) y `…-retry1/`.
- Red: `POST /login?callbackUrl=%2F%09%2Fevil.example 303 x-action-redirect: http://localhost:3201/<TAB>/evil.example;push`.

### Console errors
`SecurityError: Failed to execute 'pushState' on 'History': A history state object with URL 'http://evil.example/' cannot be created in a document with origin 'http://localhost:3201'…`

### Network errors
Ninguno.

### Technical analysis
`src/features/auth/server/actions.ts:17-22` (`safeCallback`) sólo rechaza `//` y `/\` literales; los navegadores eliminan TAB/CR/LF de las URL (WHATWG URL), así que `/\t/x` se convierte en `//x`. El `redirect` por defecto de Auth.js también lo acepta (empieza con `/`).

### Suspected root cause
Validación por prefijo de cadena en lugar de normalizar y comparar el origen de la URL.

### Recommended fix
En `safeCallback`: rechazar cualquier carácter de control, espacio o barra invertida (`/[\u0000-\u001F\u007F\s\\]/`) y validar con `const u = new URL(url, "http://x"); if (u.origin !== "http://x" || u.pathname.startsWith("//")) return null; return u.pathname + u.search;`. Agregar `callbacks.redirect` en `src/auth.config.ts` con la misma regla (defensa en profundidad). Mantener [AUTH-049] como `@regression`.

---

## BUG-006 — Navegaciones a la misma ruta y `router.refresh()` dentro de transiciones se quedan colgadas

**Severity:** HIGH
**Priority:** P0 (afecta la confirmación visible del recorrido crítico de RSVP [CRIT-004]; los datos sí se guardan)
**Status:** Open
**Type:** APPLICATION BUG (navegación del cliente; posible INTEGRATION ISSUE con el App Router de Next 15.5)
**Module:** transversal (App Router) — calendar, events, leads, customers, quotes, inventory (+ compras y proveedores vía `ListFilters`), content, notifications, settings, guests (RSVP)
**Role:** OWNER (panel) e Invitada (micrositio, link personal sin sesión)
**Environment:** TEST — build de producción local (`next start`, Next 15.5.27, Windows); carril 3 `:3203` (ivonne_rosa_e2e_l3), carril 4 `:3204` (ivonne_rosa_e2e_l4), carril 5 `:3205` (ivonne_rosa_e2e_l5, también suite `global`), carril 6 `:3206` (ivonne_rosa_e2e_l6); commit f26b1a1; Chromium y mobile-chrome (WebKit sólo en corridas previas de CRIT-004)
**Reproducible:** Sí — determinista en «Limpiar filtros» de leads (8/8) y filtros del inventario (4/4); intermitente en el resto (detalle por efecto en *Actual result*). Todos los efectos se repitieron en ≥ 2 corridas.
**Test:** [CAL-002] tests/e2e/calendar/calendar.spec.ts · [EVT-038] tests/e2e/events/events.spec.ts · [LEAD-037], [LEAD-011] tests/e2e/leads/leads-list.spec.ts · [INV-025] tests/e2e/inventory/inventory.spec.ts · [CNT-022], [CNT-023], [CNT-024] tests/e2e/content/content.global.spec.ts · [NOT-002] tests/e2e/notifications/inbox.spec.ts · [GST-011], [GST-012], [GST-015] tests/e2e/guests/rsvp.spec.ts · [CRIT-004] tests/e2e/critical/experience.spec.ts · relacionado (FLAKY): [SET-001] tests/e2e/settings/settings.spec.ts
**Fuentes:** EVX-BUG-02 (carril 4, HIGH), COM-BUG-03 (carril 3, MEDIUM), OPX-BUG-01 (carril 5, HIGH), OPX-BUG-02 (carril 5, MEDIUM), TRV-BUG-01 (carril 6, HIGH)

### Preconditions
Página ya hidratada (las pruebas esperan red en reposo). Sesión de owner en el panel, o invitada con su link personal en el micrositio (evento CONFIRMED con micrositio activo e invitada PENDING agregada desde el portal). Las páginas afectadas son `force-dynamic` con `loading.tsx` (Suspense).

### Steps to reproduce
1. **Calendario:** `/admin/calendar` → «Siguiente» (o «Anterior»/«Hoy»).
2. **Filtros de eventos:** `/admin/events?status=INQUIRY` (o `?period=past`) → «Limpiar filtros».
3. **Estado vacío de leads:** `/admin/leads?q=zz-no-existe`, esperar red en reposo → «Limpiar filtros» (`href="/admin/leads"`).
4. **Paginación:** `/admin/customers?q=<prefijo con 27 resultados>` → «Siguiente» (igual en `/admin/leads`).
5. **Inventario:** `/admin/inventory` (carga completa) → escribir un SKU en «Buscar» y esperar el debounce de 400 ms, o activar «Incluir inactivos».
6. **Contenido:** `/admin/content` → «Bajar testimonio de Valeria C.» (o `/admin/content/gallery` → «Bajar imagen 1»; FAQ → «Subir/Bajar pregunta …»).
7. **Bandeja:** `/admin/notifications` → abrir un aviso no leído (se marca leído con `AutoMarkRead` + `router.refresh()`).
8. **RSVP:** `/e/<slug>/<guestToken>` → «¡Sí, ahí estaré!» → «Enviar mi respuesta» (o editar → «Guardar cambios»).
9. **Programático:** `window.next.router.push()` a la misma ruta con otros `searchParams`: `/admin/leads?status=NEW`, `/admin/quotes?status=SENT`, `/admin/events?period=past`.

### Expected result
La URL y el contenido cambian (mes siguiente, listado sin filtros, página 2, inventario filtrado `?q=`/`?inactive=1`); tras reordenar, la lista se repinta con el nuevo orden y los botones se re-habilitan; tras marcar leído aparece «Marcar como no leído»; tras guardar el RSVP se muestra la confirmación «¡Gracias, <nombre>! Te esperamos» (o «Te vamos a extrañar») con «Agregar a mi calendario» y «Editar mi respuesta» (`confirmationCopy()`, `src/features/guests/domain/rsvp.ts:108`).

### Actual result
El router pide el payload RSC de destino pero la transición **no se confirma**: la URL y la pantalla se quedan igual indefinidamente (> 45 s en leads, > 15 s en inventario/contenido/RSVP), incluso con un segundo clic, sin errores de consola. Una carga completa (`page.goto(href)`) del mismo destino sí funciona. No ocurre entre rutas distintas (`/admin/events` → `/admin/calendar?month=…` funciona) ni con formularios GET de carga completa (filtros de leads por formulario, `/admin/staff` [STF-012] PASS).

Efectos observados:

| # | Efecto | Ruta / componente | Síntoma | Reproducción | Prueba |
|---|---|---|---|---|---|
| 1 | Calendario «Anterior/Siguiente/Hoy» | `/admin/calendar` | URL y mes no cambian | «Siguiente» 6/6 y 14/16 en sesiones nuevas (scripts); FAIL en todas las corridas completas (final: «intento 1: sin navegar · intento 2: sin navegar · intento 3: OK») | CAL-002 |
| 2 | «Limpiar filtros» de eventos | `/admin/events?status=INQUIRY`, `?period=past` | la URL conserva el filtro | 3/8 en scripts; FAIL en 3 de 4 corridas completas | EVT-038 |
| 3 | «Limpiar filtros» del estado vacío de leads | `/admin/leads?q=…` | no navega (> 45 s) | 8/8 (exploración 4/4 + repeat 2/2 + final 2/2) | LEAD-037 |
| 4 | Paginación «Anterior/Siguiente» | `/admin/customers`, `/admin/leads` | no navega | intermitente: clientas 3/8 sin navegar (exploración); LEAD-011 falló 1 de 3 | LEAD-011 |
| 5 | Otros enlaces a la misma ruta | pestañas de `/admin/quotes`, «Ver todas» de clientas, barra de filtros de leads | mismo patrón; con `router.push` se reproduce en `/admin/leads?status=NEW`, `/admin/quotes?status=SENT`, `/admin/events?period=past` | diagnóstico (carriles 3 y 4) | — |
| 6 | Filtros del inventario (búsqueda, «Incluir inactivos») | `/admin/inventory` (`ListFilters`, compartido con `/admin/purchases` y `/admin/vendors`, no verificados por esta vía) | la URL sigue `/admin/inventory` tras 15 s, la tabla no se filtra y «Filtrando…» queda activo | 4/4 (final 2/2) | INV-025 |
| 7 | Reordenar contenido (testimonios, FAQ, galería) | `/admin/content`, `/admin/content/gallery` (`OrderButtons`) | el orden **sí** cambia en la base pero la lista no se repinta; todos los «Subir/Bajar» quedan `disabled` hasta recargar; las etiquetas posicionales («Subir imagen 2») apuntan a otro elemento ⇒ riesgo de mover la foto equivocada | CNT-022 2/2 en la corrida global final; CNT-023/CNT-024 6 de 8 con `--repeat-each` (PASS en la final) | CNT-022, CNT-023, CNT-024 |
| 8 | Bandeja: marcar como leído | `/admin/notifications` (`AutoMarkRead` + `router.refresh()`) | `readAt` se guarda pero «Marcar como no leído» nunca aparece | FLAKY en la corrida final (falló el 1.er intento) | NOT-002 |
| 9 | Confirmación del RSVP | `/e/<slug>/<guestToken>` (`RsvpPanel`) | la respuesta **sí** se guarda (`ATTENDING`, `respondedAt`) pero el formulario queda igual > 15 s, sin toast ni mensaje; al recargar aparece la confirmación ⇒ la invitada reenvía o abandona. En GST-015 el mensaje a la homenajeada se guardó mientras la UI seguía en edición | CRIT-004: 17 de 26 antes de la final (`--repeat-each=4` 6/8 [chromium 3/4, mobile-chrome 3/4]; diagnóstico aislado 6/7; corridas previas 5/8 [chromium 4/5, mobile-chrome 1/2, webkit 0/1]); PASS 3/3 en la final (sigue abierto). GST-015 FAIL 4 veces; GST-012 FAIL/FLAKY en 3 corridas; GST-011 FAIL (móvil) o FLAKY (escritorio y móvil, corrida final) | CRIT-004, GST-011, GST-012, GST-015 |
| 10 | Navegación lateral de ajustes (relacionado) | `/admin/settings` → «Precios y márgenes» | el clic no cambia de página en 15 s, con un refresh RSC de `/admin/settings?_rsc=…` pendiente justo antes | 1/2 en la final (pasó al reintentar); 1/5 con `--repeat-each=5 --retries=0` | SET-001 (POTENTIAL FLAKY TEST con causa probable en la app) |

### Evidence
- **Carril 3 (leads/clientas):** `test-results/l3/artifacts/leads-leads-list-Leads-·-n-2297e-ma-ruta-otros-searchParams--chromium/` (trace, video, screenshot) y `…-retry1/`. Trace de la paginación de clientas (exploración): `…/admin/customers?q=…&page=2&_rsc=…` 200 a los 59 ms del clic; la URL nunca cambió. Script de diagnóstico (fuera de la suite): «fast-click» 2/4 sin navegar, «hover + red en reposo + clic» 1/4 sin navegar, «Limpiar filtros» 4/4 sin navegar. Si la respuesta RSC se entrega de una sola vez (`page.route` + `route.fulfill`) la navegación **sí** ocurre.
- **Carril 4 (calendario, eventos, RSVP):** `test-results/l4/results.json` (CAL-002 FAIL con la anotación «intentos»; GST-011 FLAKY en escritorio y móvil esperando «¡Gracias, Daniela! Te esperamos»). Artefactos: `test-results/l4/artifacts/calendar-calendar-Calendar-fd81c-guiente»-«Anterior»-y-«Hoy»-chromium{,-retry1}/` y `test-results/l4/artifacts/guests-rsvp-RSVP-·-invitad-07d73-e-refleja-en-admin-y-portal-{chromium,mobile-chrome}/` (trace.zip, screenshots, video). EVT-038, GST-012 y GST-015: artefactos sobrescritos por la corrida final (resultados en `docs/qa/findings/events.md`). Diagnóstico con Playwright: la petición RSC (`/admin/calendar?month=2026-11&_rsc=…`, cabecera `next-router-state-tree` con `"refetch"`) termina en `net::ERR_ABORTED`; el mismo request con `fetch` desde Node devuelve 200 completo (64 KB, 80 ms); entregada **bufferizada** (`route.fetch()` + `route.fulfill()`) la navegación funciona; bloquear los prefetch o desactivar la compresión no cambia nada. Base (GST-015): `EventMessage` HONOREE actualizado a «¡Feliz vida, Regi!» con la UI en modo edición.
- **Carril 5 (inventario, contenido, bandeja, ajustes):** INV-025 `test-results/l5/artifacts/inventory-inventory-Invent-90ef1-URL-y-la-lista-sin-recargar-chromium/trace.zip` (y `-retry1/`, screenshot `test-failed-1.png`, video); red: `GET /admin/inventory?q=<SKU>&inactive=1&_rsc=…` → 200 `text/x-component`, cabeceras en ~22 ms pero el cuerpo nunca se marca como recibido (`receive=-1`, `size=-1`); por fuera del navegador (curl con la sesión E2E, `RSC: 1` + el `Next-Router-State-Tree` capturado, con y sin gzip) el servidor responde completo (14–41 KB en < 0.11 s). Contenido: `test-results/l5/global/artifacts/content-content.global-Con-43a70-a-su-posición-con-la-vecina-chromium-global/` y `-retry1/` («Bajar pregunta …» `disabled` 15 s tras «Subir»); repeticiones previas `test-results/l5/global/artifacts/content-content.global-Con-42d0d-ta-se-actualiza-en-pantalla-chromium-global*/` y `…-43f0c--tarjeta-cambia-de-posición-chromium-global*/`; red: `POST /admin/content` (Next-Action de `moveTestimonialAction`) 200 y `GET /admin/content?_rsc=…` 200, ambos sin cierre de cuerpo (`receive=-1`); base: `select id, "sortOrder" from "Testimonial" order by "sortOrder"` → el testimonio movido quedó en la posición 2. NOT-002: `test-results/l5/artifacts/notifications-inbox-Notifi-731ce-lver-a-marcar-como-no-leído-chromium/` (`readAt` no nulo en la base). SET-001: `test-results/l5/artifacts/settings-settings-Ajustes--b84b7-desde-la-navegación-lateral-chromium/trace.zip`.
- **Carril 6 (RSVP crítico):** trace `test-results/l6-evidence/TRV-BUG-01/CRIT-004-chromium-rsvp-sin-confirmacion-trace.zip`; CRIT-004 falla en el `expect.soft` «la invitada ve la confirmación tras enviar» (anotación `bug: TRV-BUG-01`) y el resto del recorrido (base, admin «Asiste», portal «Asiste») pasa. Base: `SELECT "rsvpStatus","respondedAt" FROM "EventGuest" WHERE token = '<guestToken>'` → `ATTENDING | 2026-10-06T07:09:50.259Z`. Diagnóstico de red (spec temporal, ya eliminado):
  ```
  POST …/e/<slug>/<token>  200 action=true  len=0
  GET  …?_rsc=…            200              len=26070 respTrue=true
  confirmation visible: false
  ```

### Console errors
Ninguno, ni excepciones de página. Nota: el guard clasifica `net::ERR_ABORTED` como ruido benigno, así que no puede detectar este defecto; las pruebas afirman el resultado (URL/contenido), como CAL-002 y EVT-038.

### Network errors
Sin 4xx/5xx. `GET <ruta>?<searchParams>&_rsc=…` → 200 `text/x-component`, `transfer-encoding: chunked`, `content-encoding: gzip`, sin commit de la transición; en otros intentos el navegador aborta la petición (`net::ERR_ABORTED`) o nunca marca el cuerpo como recibido (`receive=-1`).

### Technical analysis
- Patrón común: navegación o refresco de la **misma ruta** en páginas `force-dynamic` + `loading.tsx` con respuesta RSC en streaming. La navegación es una transición de React que conserva la UI anterior hasta que el nuevo árbol resuelve; la transición nunca se confirma. El servidor sí termina (curl/Node: 200 completo) y con la respuesta bufferizada la navegación funciona ⇒ el bloqueo está del lado del cliente.
- Puntos afectados:
  - `src/app/(admin)/admin/calendar/page.tsx:83-95` (Anterior/Hoy/Siguiente).
  - `src/features/events/components/events-filters.tsx:176-181` («Limpiar filtros»).
  - `src/app/(admin)/admin/leads/page.tsx:115` (EmptyState «Limpiar filtros») y `src/features/leads/components/lead-filters-bar.tsx:184`.
  - `src/components/data/pagination.tsx:44,56` (Anterior/Siguiente), pestañas de `/admin/quotes` y `src/app/(admin)/admin/customers/page.tsx:83` («Ver todas»).
  - `src/features/inventory/components/list-filters.tsx:41-50`: `router.push(...)` dentro de `startTransition`; la URL sólo se actualiza al confirmar la transición. Usa `useSearchParams` sin `Suspense` propio.
  - `src/features/content/components/content-controls.tsx:28-33`: `startTransition(async () => { await onMove(); router.refresh(); })` deja el botón `disabled` mientras `pending`; la acción (`src/features/content/server/actions.ts:78-85`) además llama `revalidatePath("/")` y `revalidateTag("content")`, así que su respuesta ya trae el árbol revalidado. `OrderButtons` identifica las filas por posición (`imagen ${i + 1}`).
  - `AutoMarkRead` de la bandeja (`router.refresh()` tras marcar leído).
  - `src/features/guests/components/rsvp-panel.tsx:225-238`: `React.startTransition(() => { onSaved(); router.refresh(); })`; el panel decide qué mostrar con `guest?.responded && !editing` (`:88`) y la acción ya disparó `revalidatePath` (`src/features/guests/server/actions.ts:19`). Si el refresh no termina (o el árbol de la acción llega en otro orden), `editing=false` nunca se confirma o queda superado. Aun cuando la respuesta trae `"responded":true` el panel sigue en modo formulario.
- No hay código de la app que manipule la URL (`router.replace`/`history`) ni que intercepte clics (`admin-shell.tsx` sólo cierra el menú).

### Suspected root cause
Interacción del router del App Router de Next 15.5 (navegación a la misma ruta y `router.refresh()`) con respuestas RSC en streaming en `next start` (posible defecto de Next o del entorno Windows). Hipótesis por confirmar sin instrumentar la app: un componente cliente que suspende durante la transición (`useSearchParams` sin `<Suspense>` propio bajo un segmento con `loading.tsx`) o el `Set-Cookie` de sesión que Auth.js agrega a cada respuesta RSC (ver BUG-001). Agravantes propios de la app: estado de UI (confirmación del RSVP, re-habilitar botones) acoplado a que la transición termine, y botones de orden identificados por posición.

### Recommended fix
1. Aislar: reproducir a mano en Chrome con la build de producción y en el contenedor Linux (Dokploy), con React DevTools/`NEXT_DEBUG` para ver qué frontera queda suspendida; actualizar al último parche 15.5.x y, si persiste, reportarlo a Next.
2. Mitigaciones inmediatas en la app:
   - RSVP: mostrar la confirmación a partir del resultado de `submitRsvpAction` (`onSaved(res.data)` → `savedGuest` en el estado del panel), llamar `setEditing(false)` **fuera** de `startTransition` y usar `router.refresh()` aparte sólo para sincronizar el resto del micrositio.
   - Contenido y bandeja: no envolver `router.refresh()` en la transición del botón (o usar `useOptimistic` para el orden) y etiquetar `OrderButtons` por contenido (alt/título), no por posición.
   - Filtros, paginación y calendario: navegación completa (`<a href>` o `<form method="get">`, como `/admin/staff`) o `prefetch={false}` + `router.push(..., { scroll: false })` con fallback `window.location.assign` si no hay commit; envolver `ListFilters` y todo cliente con `useSearchParams` en un `<Suspense>` propio.
3. Revisar el streaming de la respuesta (compresión, Suspense del `loading.tsx` con `searchParams`) y la re-emisión de la cookie en respuestas RSC (relación con BUG-001).
4. Mantener como `@regression` CAL-002, EVT-038, LEAD-037, INV-025, CNT-022, NOT-002, GST-012, GST-015 y CRIT-004; verificar también `/admin/purchases` y `/admin/vendors`, y agregar una prueba de componente del `RsvpPanel`.

---

## BUG-007 — Dos solicitudes simultáneas de checkout crean dos pagos PENDING del mismo anticipo

**Severity:** MEDIUM
**Priority:** P2
**Status:** Open
**Type:** APPLICATION BUG (condición de carrera)
**Module:** payments
**Role:** Clienta (token de cotización o del portal)
**Environment:** TEST — build de producción local `:3202`, base ivonne_rosa_e2e_l2, commit f26b1a1; Chromium
**Reproducible:** Sí (4/4)
**Test:** [PAY-019] tests/e2e/payments/payments.spec.ts (el caso secuencial [PAY-006] sí reutiliza el pago: PASS)
**Fuentes:** SAL-BUG-01 (carril 2, MEDIUM)

### Preconditions
Cotización aceptada sin pagos.

### Steps to reproduce
1. Enviar en paralelo dos `startCheckoutAction({ token, tokenType: "quote", kind: "DEPOSIT" })` (dos pestañas, doble envío o reintento de red).
2. Consultar los pagos de la reserva.

### Expected result
Una sola fila `Payment` `PENDING` y la misma URL de checkout para ambas solicitudes (regla de reutilización de `startCheckout`).

### Actual result
Dos filas `PENDING` por el mismo monto y dos URLs distintas (última corrida: Payments `cmuwe31u600e8…` y `cmuwe31ua00ea…`, 1 032 500 centavos cada uno; checkouts `mock_cs_Ku7vHr7V…` y otro distinto). Con un proveedor real ambas sesiones son cobrables: doble cargo del anticipo (el sistema sólo lo detecta después como «excedente»). En el mock la segunda queda «no vigente» tras pagar la primera.

### Evidence
- trace: `test-results/l2/artifacts/payments-payments-Pagos-pr-af478--duplicar-el-pago-pendiente-chromium/trace.zip` · screenshot: `test-results/l2/artifacts/payments-payments-Pagos-pr-af478--duplicar-el-pago-pendiente-chromium/test-failed-1.png`.
- Consulta: `select id, status, "amountCents" from "Payment" where "bookingId"=…` → 2 filas `PENDING` 1032500.

### Console errors
Ninguno.

### Network errors
Ninguno; ambas acciones responden 200 `ok: true`.

### Technical analysis
`src/features/payments/server/payment-service.ts:120-139`: busca un pago reutilizable sobre `booking.payments` leído antes y crea el nuevo sin bloqueo ni restricción única ⇒ dos requests concurrentes no se ven entre sí.

### Suspected root cause
Check-then-insert sin serialización por reserva.

### Recommended fix
Envolver búsqueda + creación en una transacción con `lockBooking(tx, bookingId)` (ya existe en el mismo servicio) o un `pg_advisory_xact_lock` por reserva; opcionalmente un índice único parcial `(bookingId, kind) WHERE status = 'PENDING'` (cambio de schema, coordinar). Mantener [PAY-019] como `@regression`.

---

## BUG-008 — La misma clienta se duplica porque el teléfono se guarda con formatos distintos

**Severity:** MEDIUM
**Priority:** P2
**Status:** Open
**Type:** APPLICATION BUG (integridad de datos: clientas duplicadas, historial partido; regla «busca o crea clienta por email/teléfono»)
**Module:** leads (`createInboundLead`) / customers / configurator / marketing (contacto) / ai-designer / quotes / seed
**Role:** Anónimo (configurador, contacto, diseñador IA) y OWNER (ficha de clienta, «Nuevo lead»; ivonne@ivonne-rosa.test)
**Environment:** TEST — build de producción local; carril 2 `:3202` (ivonne_rosa_e2e_l2) y carril 3 `:3203` (ivonne_rosa_e2e_l3); commit f26b1a1; Chromium
**Reproducible:** Sí — [CONF-022] 4/4; [CUST-016] 2/2 + corrida final 2/2
**Test:** [CONF-022] tests/e2e/configurator/server.spec.ts · [CUST-016] tests/e2e/customers/customers.spec.ts
**Fuentes:** SAL-BUG-02 (carril 2, MEDIUM), COM-BUG-02 (carril 3, MEDIUM)

### Preconditions
Variante A: ninguna. Variante B: clienta existente en `/admin/customers/<id>` (con o sin teléfono).

### Steps to reproduce
**Variante A — entre canales públicos ([CONF-022])**
1. Enviar el configurador con teléfono `5556071732` y sin correo → Customer con `phone = "+525556071732"`.
2. Enviar el formulario de contacto con el mismo teléfono `5556071732` (correo nuevo).

**Variante B — teléfono con formato en la ficha ([CUST-016])**
1. En la ficha de la clienta escribir en «Teléfono» `55 1234 5678` (con espacios, como lo sugiere el formulario) → «Guardar perfil» → «Perfil actualizado».
2. Registrar un lead con el mismo número sin espacios (`5512345678`) desde «Nuevo lead», el configurador, el formulario de contacto o `createLeadAction`.

### Expected result
`createInboundLead` encuentra a la clienta existente por teléfono (después de buscar por correo) y el nuevo lead queda vinculado al mismo `customerId`.

### Actual result
- Variante A: se crea una segunda Customer. Mensaje de la prueba (última corrida): `configurador guardó phone=+525556071732, contacto guardó phone=5556071732` (en otra corrida, `5571161346` frente a `+525571161346`).
- Variante B: se crea **otra** clienta con `phone = "5512345678"` y el lead queda vinculado a la nueva; la original conserva `phone = "55 1234 5678"`.
- Mismo síntoma con el seed: las clientas DEMO tienen `phone = '+52 55 5102 3301'` (con espacios); un lead del configurador con ese número llega normalizado (`+525551023301`) y tampoco coincide.
- Relacionado: `/admin/quotes/new` → «Clienta nueva» sólo reutiliza por correo; con teléfono solo siempre crea clienta.

### Evidence
- Carril 2: trace `test-results/l2/artifacts/configurator-server-Config-7aee3-or-→-diseñador-IA-contacto--chromium/trace.zip`; consulta `select id, phone from "Customer" where phone like '%5556071732'` → 2 filas (una por canal).
- Carril 3: trace/screenshot `test-results/l3/artifacts/customers-customers-Client-22f12-egar-un-lead-con-ese-número-chromium/` (y `…-retry1/`); anotación «teléfono guardado»: `55 1234 5678`; aserción: `lead.customerId` esperado = id de la clienta original, recibido = id de una clienta nueva; consulta `select id, name, phone from "Customer" where phone in ('55 1234 5678','5512345678');` → 2 filas para la misma persona.

### Console errors
Ninguno.

### Network errors
Ninguno. `POST /admin/leads` (Server Action `createLeadAction`) → 200 `{"ok":true,…}`; acciones públicas 200.

### Technical analysis
- `src/features/configurator/server/configurator-service.ts:180` normaliza a `+52` + 10 dígitos.
- `src/features/marketing/server/contact-service.ts:34` y `src/features/ai-designer/server/designer-service.ts:444` envían el teléfono tal cual.
- `src/features/customers/server/customer-service.ts:234`: `phone: normalizeOptional(input.phone)` (sólo `trim`); igual `whatsapp`.
- `src/features/leads/server/lead-intake.ts:53-56` (`normPhone`) sólo quita caracteres que no sean dígitos o `+`; `:63` busca con igualdad exacta (`tx.customer.findFirst({ where: { phone: input.phone } })`).
- `src/features/quotes/server/quote-service.ts:160`: la «Clienta nueva» de la cotización rápida sólo reutiliza por correo.

### Suspected root cause
No existe una forma canónica única del teléfono: cada canal (y el perfil y el seed) guarda su propio formato y la captura única compara por igualdad exacta.

### Recommended fix
Normalizar en `createInboundLead` y en **todas** las escrituras (perfil, seed, cotización rápida) con la misma función (`normalizeMxPhone10` → E.164 `+52XXXXXXXXXX`) y buscar por la forma normalizada (en transición, también por las variantes de 10/12 dígitos) o por una columna `phoneNormalized` indexada (cambio de schema, coordinar). Migración para normalizar `Customer.phone`/`whatsapp` y `Lead.phone` existentes. Mantener [CONF-022] y [CUST-016] como `@regression`. Ver también la observación sobre unicidad del teléfono ([CUST-009]).

---

## BUG-009 — Contraste insuficiente (WCAG 1.4.3) en tonos warning/info, taupe y textos atenuados

**Severity:** MEDIUM
**Priority:** P2
**Status:** Open
**Type:** UX ISSUE (accesibilidad; axe `color-contrast` *serious*; requisito explícito «contraste AA» de CLAUDE.md)
**Module:** UI compartida — `StatusBadge`, admin-shell, events/calendar (admin), finance, portal de la clienta, Memory Capsule, payments (layout `/pago/*`), staff
**Role:** OWNER/SUPER_ADMIN (panel), STAFF (portal), Clienta (portal, pago) e Invitada (cápsula)
**Environment:** TEST — build de producción local; carril 2 `:3202` (l2), carril 4 `:3204` (l4), carril 5 `:3205` (l5), carril 6 `:3206` (l6); commit f26b1a1; Chromium
**Reproducible:** Sí, determinista (PAY-022 4/4; carril 4 3/3 por página; carril 6 2/2; STF-024 2/2)
**Test:** [PAY-022] tests/e2e/payments/payments.spec.ts · [EVT-037] tests/e2e/events/event-experience.spec.ts · [CAL-007] tests/e2e/calendar/calendar.spec.ts · [MEM-019] tests/e2e/memory/memory-public.spec.ts · [A11Y-008], [A11Y-009], [A11Y-011], [A11Y-012], [A11Y-013], [A11Y-014], [A11Y-015], [A11Y-018] tests/e2e/accessibility/a11y.spec.ts · [STF-024] tests/e2e/staff/staff-portal.spec.ts (parte de contraste)
**Fuentes:** SAL-BUG-04 (carril 2, LOW), EVX-BUG-04 (carril 4, MEDIUM), TRV-BUG-02 (carril 6, MEDIUM), TRV-BUG-03 (carril 6, MEDIUM); además la parte de contraste de OPX-BUG-05 (carril 5; el ID se asigna a BUG-011)

### Preconditions
Seed DEMO (pagos/anticipos pendientes, eventos en varios estados) o datos propios de la prueba; escáner axe WCAG 2.0/2.1 A + AA (fixture `scanA11y`).

### Steps to reproduce
1. Abrir `/admin`, `/admin/leads`, `/admin/events`, `/admin/events/new`, `/admin/events/<id>`, `/admin/calendar`, `/admin/finance` (OWNER); `/staff` y `/staff/events/<id>` (STAFF); `/mi-evento/demo-portal-cumple-sofia-2026`; `/memory/<token>` (p. ej. `/memory/demo-memory-valeria-2026-9tk3w7hb`); `/pago/mock/<checkoutId>` y `/pago/resultado?p=…&s=…`.
2. Ejecutar axe (WCAG 2.1 AA).

### Expected result
Contraste ≥ 4.5:1 en texto normal (11–14 px).

### Actual result
axe `color-contrast` (*serious*), 1–11 nodos por página:

| Elemento | Colores | Contraste | Dónde | Prueba |
|---|---|---|---|---|
| Píldora «Modo demo»/pendientes del encabezado admin (`text-warning`, 12 px) | `#9a6a1f` sobre `#eee5d7` | **3.77:1** | todo el panel | EVT-037; grupo A11Y-009…A11Y-018 |
| `StatusBadge` tono warning («Pendiente de pago», «Anticipo pendiente», «Pendiente»; 11–12 px) | `#9a6a1f` sobre `#f5eee3` (`bg-warning/10`) | **4.08:1** | `/admin/events`, `/admin/events/[id]`, `/admin/finance`, `/staff/events/[id]` | EVT-037; grupo A11Y-009…A11Y-018; STF-024 |
| Texto «· por confirmar» de las tarjetas (`.text-warning`) | tono warning sobre fondo claro | < 4.5:1 | `/staff` | STF-024 |
| `text-info` sobre `bg-info/10` (14 px) | `#4b6577` sobre tinte info | **4.47:1** | portal de la clienta | grupo A11Y-009…A11Y-018 |
| Número del contador `text-ivory/80` (12 px) | `#d8d8cc` sobre olive `#5c6b4e` | **3.98:1** | portal de la clienta | grupo A11Y-009…A11Y-018 |
| Días fuera de mes del calendario | `#a09991` sobre `#faf7f0` | **2.63:1** | `/admin/calendar` | CAL-007; grupo A11Y-009…A11Y-018 |
| `text-taupe`: fecha de la cápsula (`<time>`, 14 px) y texto «Conexión cifrada» del encabezado de pago (12 px) | `#a48f7e` sobre `#f7f3ec` | **2.78:1** | `/memory/[token]`, `/pago/mock/*`, `/pago/resultado` | MEM-019, A11Y-011, PAY-022, A11Y-008 |
| Pies de tarjetas de la cápsula / pista del uploader deshabilitado (opacidad reducida) | `#a29b95` sobre `#fffdf9` | **2.69:1** | `/memory/[token]` | MEM-019, A11Y-011 |

### Evidence
- Carril 2 (PAY-022): `test-results/l2/artifacts/payments-payments-Pagos-pr-7c626-do-y-del-resultado-del-pago-chromium/trace.zip` · adjunto `a11y-axe.json` en `test-results/l2/results.json`.
- Carril 4 (EVT-037, CAL-007, MEM-019): adjuntos `a11y-axe.json` en `test-results/l4/results.json`, reporte HTML `playwright-report/l4/`, screenshots `test-results/l4/artifacts/*WCAG*`.
- Carril 5 (STF-024): adjunto `a11y-axe.json` en `test-results/l5/results.json` y trace `test-results/l5/artifacts/staff-staff-portal-Portal--2d61e-laciones-WCAG-2-1-AA-graves-chromium/` (y `-retry1/`).
- Carril 6: `test-results/l6-evidence/TRV-BUG-02/A11Y-0{09,12,13,14,15,18}-a11y-axe.json` y `test-results/l6-evidence/TRV-BUG-03/A11Y-008-a11y-axe.json`, `A11Y-011-a11y-axe.json` + carpetas de artefactos de cada prueba (screenshot, trace); resumen en el error (`serious color-contrast ×N …`).

### Console errors
Ninguno.

### Network errors
Ninguno.

### Technical analysis
- Tokens: `--warning: #9a6a1f` e `--info: #4b6577` (`src/app/globals.css:108-110`), `--brand-taupe: #a48f7e` (`src/app/globals.css:83`).
- `src/components/data/status-badge.tsx:6-8` usa esos tonos sobre fondo al 10 %; `src/components/admin/admin-shell.tsx:115-122` (enlace de pendientes en `:118`) igual.
- `src/app/(experience)/memory/[token]/page.tsx:85` (fecha) y `src/app/(experience)/pago/layout.tsx:11` (`text-taupe text-xs`) usan taupe como color de texto.
- `MediaUploader` deshabilitado aplica opacidad al texto de ayuda; el portal usa `text-ivory/80` sobre olive; los días fuera de mes del calendario usan un gris claro.

### Suspected root cause
Tokens de marca pensados para decoración o fondos sólidos usados como color de texto pequeño sobre fondos tintados u opacidades reducidas.

### Recommended fix
Oscurecer el texto de los tonos (warning ≈ `#7d5414`–`#7f5616`, info ≈ `#3d5363`) o usar `text-*-foreground`/`text-charcoal` sobre `bg-*/10` en insignias pequeñas; reservar `taupe` para decoración/íconos y usar `text-muted-foreground` (`#645a52`, 6+:1) o un taupe ≥ `#7a6656` para texto; mantener el texto de ayuda del uploader deshabilitado sin opacidad; revisar `text-ivory/80` y los días fuera de mes (más oscuros, o `aria-hidden` si son puramente decorativos). Volver a correr todas las pruebas listadas.

---

## BUG-010 — Listas de definición (`<dl>`) inválidas en la propuesta pública y el micrositio

**Severity:** MEDIUM
**Priority:** P2
**Status:** Open
**Type:** UX ISSUE (accesibilidad WCAG 1.3.1; axe `definition-list` + `dlitem` *serious*)
**Module:** quotes (vista pública `/cotizacion/[token]`) · guests (micrositio `/e/[slug]/[token]`)
**Role:** Clienta e Invitada (lectores de pantalla)
**Environment:** TEST — build de producción local; carril 2 `:3202` (l2), carril 4 `:3204` (l4), carril 6 `:3206` (l6); commit f26b1a1; Chromium
**Reproducible:** Sí, determinista (QPUB-014 4/4; GST-022 3/3; A11Y-007/A11Y-010 2/2)
**Test:** [QPUB-014] tests/e2e/quote-public/quote-public.spec.ts · [GST-022] tests/e2e/guests/rsvp.spec.ts · [A11Y-007], [A11Y-010] tests/e2e/accessibility/a11y.spec.ts
**Fuentes:** SAL-BUG-06 (carril 2, MEDIUM), EVX-BUG-05 (carril 4, LOW), TRV-BUG-04 (carril 6, LOW)

### Preconditions
Cotización SENT con token público (p. ej. `/cotizacion/demo-quote-lucia-2026-4fq8m2zp`) y micrositio activo con link de invitada (p. ej. `/e/cumple-sofia/demo-guest-sofia-camila-2026`).

### Steps to reproduce
1. Abrir `/cotizacion/<token>` y ejecutar axe (WCAG 2.1 AA).
2. Abrir `/e/<slug>/<token de invitada>` y ejecutar axe.

### Expected result
Sin violaciones *critical*/*serious*: `<dt>`/`<dd>` como hijos directos de `<dl>` o de un único `<div>` hijo directo de `<dl>`.

### Actual result
- `/cotizacion/<token>`: `definition-list` y `dlitem`. Los pares de «Fecha / Hora de inicio / Zona / Invitadas» y del «Resumen de pago» (total, anticipo, saldo) están dentro de `<div>` anidados, así que los lectores de pantalla pierden la relación etiqueta–valor justo en la propuesta que la clienta acepta.
- Micrositio: «dl element has direct children that are not allowed: div > span, div > div» (`definition-list` ×1–2) y `dlitem` (`dt`/`dd` sin padre `dl`, ×10–12 nodos: «Fecha», «Hora de inicio», «Cuándo», «Horario»…) en «Los detalles».

### Evidence
- Carril 2: `test-results/l2/artifacts/quote-public-quote-public--ae8fa-ta-y-del-diálogo-de-aceptar-chromium/trace.zip` · adjunto `a11y-axe.json` en `test-results/l2/results.json`.
- Carril 4: adjunto `a11y-axe.json` de GST-022 en `test-results/l4/results.json` (página `/e/cumple-sofia/<token Camila>`).
- Carril 6: `test-results/l6-evidence/TRV-BUG-04/A11Y-007-a11y-axe.json`, `A11Y-010-a11y-axe.json`.

### Console errors
Ninguno.

### Network errors
Ninguno.

### Technical analysis
- `src/app/(experience)/cotizacion/[token]/page.tsx:73-85` (`DetailTile`: `<div><span icono/><div><dt/><dd/></div></div>` dentro del `<dl>`) y `:151-190` (`<dl>` del resumen con un `<div className="bg-sand-soft/70 …">` que envuelve otros `<div>` con `dt/dd`).
- `src/features/guests/components/microsite-view.tsx:116` (`<dl>` de Cuándo/Horario/Dónde con la misma estructura) y `:277-299` (`DetailCard`: `dt`/`dd` en `div > div` junto con un `span` de ícono).

### Suspected root cause
Envoltorios visuales (ícono + contenedor) intercalados entre `<dl>` y sus pares `dt`/`dd`.

### Recommended fix
Que cada par quede en un único `<div>` hijo directo del `<dl>` que contenga **sólo** `dt` y `dd` (ícono dentro del `dt` con `aria-hidden`, o fuera del `<dl>`); sacar el bloque «anticipo/saldo» a su propio `<dl>`; o usar `<ul>`/`<p>` donde no sea una lista de definiciones. Volver a correr QPUB-014, GST-022, A11Y-007 y A11Y-010.

---

## BUG-011 — Portal staff: `aria-controls` de «Agregar nota» apunta a un id inexistente

**Severity:** MEDIUM
**Priority:** P2
**Status:** Open
**Type:** UX ISSUE (accesibilidad; axe `aria-valid-attr-value` *critical*)
**Module:** staff (portal `/staff/events/[id]`, checklist)
**Role:** STAFF (staff@ivonne-rosa.test)
**Environment:** TEST — build de producción local `:3205`, base ivonne_rosa_e2e_l5, commit f26b1a1; Chromium
**Reproducible:** Sí (2/2 en la corrida final: intento + reintento)
**Test:** [STF-024] tests/e2e/staff/staff-portal.spec.ts
**Fuentes:** OPX-BUG-05 (carril 5, MEDIUM) — la parte de contraste del mismo hallazgo se consolida en BUG-009

### Preconditions
Lupita asignada a un evento propio con una tarea pendiente.

### Steps to reproduce
1. Como staff abrir `/staff/events/<id>`.
2. Ejecutar axe (WCAG 2.0/2.1 A + AA) con `scanA11y`.

### Expected result
Sin violaciones *critical*/*serious*; los atributos ARIA referencian elementos existentes.

### Actual result
**Critical `aria-valid-attr-value`** en el botón `.h-7` «Agregar nota»: su `aria-controls` apunta a un id que no existe en el DOM mientras el panel de notas está cerrado. (Además, contraste insuficiente del tono warning en `/staff` y `/staff/events/<id>`: ver BUG-009.)

### Evidence
- Adjunto `a11y-axe.json` de la prueba en `test-results/l5/results.json` y trace en `test-results/l5/artifacts/staff-staff-portal-Portal--2d61e-laciones-WCAG-2-1-AA-graves-chromium/` (y `-retry1/`).

### Console errors
Ninguno.

### Network errors
Ninguno.

### Technical analysis
`src/features/staff/components/portal-checklist.tsx:261`: `<Button … aria-controls={notesId}>` apunta a `notas-<id>`, pero el `<Textarea id={notesId}>` sólo se renderiza cuando `notesOpen` es verdadero ⇒ referencia ARIA inválida.

### Suspected root cause
Referencia ARIA a un elemento que se monta condicionalmente.

### Recommended fix
Poner `aria-controls` sólo cuando el panel exista (o renderizar el panel oculto con `hidden`) y exponer el estado con `aria-expanded`. Volver a correr [STF-024].

---

## BUG-012 — El diálogo «Aceptar propuesta» no devuelve el foco al cerrarse

**Severity:** LOW
**Priority:** P3
**Status:** Open
**Type:** UX ISSUE (accesibilidad WCAG 2.4.3, orden del foco)
**Module:** quotes (vista pública `/cotizacion/[token]`)
**Role:** Clienta (teclado / lector de pantalla)
**Environment:** TEST — build de producción local; carril 2 `:3202` (l2) y carril 6 `:3206` (l6); commit f26b1a1; Chromium
**Reproducible:** Sí (QPUB-015 4/4; A11Y-028 2/2 + corrida final)
**Test:** [QPUB-015] tests/e2e/quote-public/quote-public.spec.ts · [A11Y-028] tests/e2e/accessibility/a11y.spec.ts
**Fuentes:** SAL-BUG-05 (carril 2, LOW), TRV-BUG-05 (carril 6, LOW)

### Preconditions
Cotización SENT con token público (p. ej. `/cotizacion/demo-quote-lucia-2026-4fq8m2zp`).

### Steps to reproduce
1. En `/cotizacion/<token>` enfocar «Aceptar propuesta» con el teclado y pulsar Enter (abre el diálogo con el foco en «Nombre completo»: correcto).
2. Pulsar Escape.

### Expected result
El foco regresa a «Aceptar propuesta» (como sí ocurre con «No por ahora», que usa `DialogTrigger`).

### Actual result
El diálogo se cierra y la trampa de foco interna funciona, pero `document.activeElement` queda en `<body>` (anotación «foco tras cerrar: body …»): quien navega con teclado o lector de pantalla vuelve al inicio de la página.

### Evidence
- Carril 2: `test-results/l2/artifacts/quote-public-quote-public--ac9d6-e-devuelve-el-foco-al-botón-chromium/trace.zip` · screenshot `test-failed-1.png`.
- Carril 6: `test-results/l6-evidence/TRV-BUG-05/` (screenshot, trace, anotación «foco tras cerrar: body …»).

### Console errors
Ninguno.

### Network errors
Ninguno.

### Technical analysis
`src/features/quotes/components/public/accept-quote.tsx:58,83`: el botón abre con `setOpen(true)` y el `<Dialog open>` controlado no tiene `DialogTrigger`; además hay dos disparadores (botón inline y barra fija móvil).

### Suspected root cause
Radix no sabe a qué elemento devolver el foco porque el diálogo controlado no tiene disparador registrado.

### Recommended fix
Guardar el botón que abrió el diálogo (ref) y devolverle el foco en `onCloseAutoFocus` del `DialogContent`, o envolver cada botón en `DialogTrigger asChild`. Volver a correr QPUB-015 y A11Y-028.

---

## BUG-013 — Soft-404: `/experiencias/[slug]` inexistente o inactivo responde HTTP 200

**Severity:** LOW
**Priority:** P3
**Status:** Open
**Type:** APPLICATION BUG (SEO)
**Module:** public (catálogo de experiencias)
**Role:** Anónimo / rastreadores
**Environment:** TEST — build de producción local; carril 1 `:3201` (l1) y carril 2 `:3202` (l2); commit f26b1a1; Chromium y `curl`
**Reproducible:** Sí (≥ 4/4 en NAV-002: 2 de reproducción + 2 de la corrida final con reintento; siempre con `curl`)
**Test:** [NAV-002] tests/e2e/navigation/not-found.spec.ts · [PUB-016] tests/e2e/public/site.spec.ts (valida contenido + `noindex`: PASS; el status se registra en la anotación `http-status`)
**Fuentes:** ACC-BUG-04 (carril 1, LOW), SAL-BUG-07 (carril 2, LOW)

### Preconditions
Ninguna.

### Steps to reproduce
1. `curl -i http://localhost:3201/experiencias/no-existe-e2e` (o `curl -s -o /dev/null -w "%{http_code}" http://localhost:3202/experiencias/no-existe-esta-mesa`).
2. Repetir con el slug de una experiencia inactiva.

### Expected result
HTTP 404 real con la página «Esta mesa ya no está puesta» (como ya hace `/cotizacion/[token]`, que valida en su `layout.tsx` antes del streaming).

### Actual result
HTTP 200 con el contenido 404 y `<meta name="robots" content="noindex">` repetido 2–3 veces. Para buscadores y monitoreo es un soft-404: los enlaces rotos y las experiencias dadas de baja no se detectan por status. El propio código lo documenta como «soft 404 controlado». Las rutas por token (`/cotizacion`, `/mi-evento`, `/e`, `/memory`, `/pago`) y las rutas sin match sí responden 404 real.

### Evidence
- Carril 1: `test-results/l1/artifacts/navigation-not-found-404-N-2cb36-404-y-HTTP-404-no-soft-404--chromium/` y `…-retry1/`; anotación `HTTP 200 para /experiencias/no-existe-e2e`.
- Carril 2: `curl` → `200`; anotación `http-status` de PUB-016.

### Console errors
Ninguno.

### Network errors
Ninguno (el defecto es el status 200).

### Technical analysis
`src/app/(public)/experiencias/[slug]/loading.tsx` envuelve la página en Suspense: el `notFound()` de `page.tsx:62` (y el de `generateMetadata`, `page.tsx:46`) ocurre después de iniciar el streaming, cuando el status 200 ya se envió (comportamiento conocido de Next 15.5). Comentario «soft 404 controlado» en `src/app/(public)/experiencias/[slug]/page.tsx:43-46`.

### Suspected root cause
La existencia del slug se resuelve dentro del límite de Suspense en lugar de antes del streaming.

### Recommended fix
Agregar `src/app/(public)/experiencias/[slug]/layout.tsx` que valide el slug (activo) y llame `notFound()` antes de `loading.tsx` (mismo patrón que `cotizacion/[token]/layout.tsx`), o quitar `loading.tsx` de ese segmento; deduplicar el `<meta name="robots">`. Volver a correr NAV-002 y endurecer PUB-016 para exigir 404.

---

## BUG-014 — Un lead capturado a mano con «Origen» ≠ «Captura manual» dispara los avisos de lead entrante

**Severity:** LOW
**Priority:** P3
**Status:** Open
**Type:** APPLICATION BUG (con REQUIREMENT AMBIGUITY: no hay requisito escrito; la intención del código es no notificar capturas manuales)
**Module:** leads
**Role:** OWNER (ivonne@ivonne-rosa.test)
**Environment:** TEST — build de producción local `:3203`, base ivonne_rosa_e2e_l3, commit f26b1a1; Chromium
**Reproducible:** Sí (2/2 + corrida final 2/2)
**Test:** [LEAD-036] tests/e2e/leads/leads-detail.spec.ts (control positivo: [LEAD-035] con origen «Captura manual» → 0 avisos, PASS)
**Fuentes:** COM-BUG-01 (carril 3, LOW)

### Preconditions
Sesión de owner en `/admin/leads`.

### Steps to reproduce
1. «Nuevo lead» → nombre, correo, «Origen» = «Instagram» (o WhatsApp, Recomendación…) → «Crear lead».
2. Consultar `NotificationLog` del lead.

### Expected result
Una captura hecha por el equipo desde el panel no genera avisos de «lead entrante» (es lo que ocurre con el origen por defecto «Captura manual»).

### Actual result
Se registran `LEAD_RECEIVED` a la clienta (email, y WhatsApp si tiene teléfono) y un `GENERIC` «Nuevo lead L-…» al correo del equipo (`equipo@ivonne-rosa.test`): la fundadora recibe aviso de un lead que ella misma capturó y la clienta recibe un «Recibimos tu solicitud» automático.

### Evidence
- `test-results/l3/artifacts/leads-leads-detail-Leads-·-274a2-adora-de-su-propio-registro-chromium/` (+ `…-retry1/`); la anotación «notificaciones» lista los registros creados. Corrida final, lead `L-2610-MHFD`: `LEAD_RECEIVED / EMAIL → insta-…@e2e.ivonne-rosa.test «Recibimos tu solicitud»` y `GENERIC / EMAIL → equipo@ivonne-rosa.test «Nuevo lead L-2610-MHFD»` (reintento: `L-2610-XMJQ`, mismos 2 registros).
- Consulta: `select type, channel, "to" from "NotificationLog" where "leadId" = '<id>';`

### Console errors
Ninguno.

### Network errors
Ninguno; `createLeadAction` → `{ ok: true }`.

### Technical analysis
`src/features/leads/server/lead-intake.ts:192` decide con `if (input.source !== "MANUAL")`; `createManualLead` (`src/features/leads/server/lead-service.ts:205`) pasa el origen elegido en el formulario, así que el «origen comercial» se usa como si fuera el «canal de captura».

### Suspected root cause
Se mezcla el origen del lead (marketing) con el canal por el que se capturó (panel vs. sitio).

### Recommended fix
Pasar un indicador explícito (p. ej. `ctx.actor` presente o `{ notify: false }` desde `createManualLead`) y notificar sólo capturas públicas; si se desea avisar a la clienta en capturas manuales, hacerlo con una opción explícita en el formulario. Mantener [LEAD-035]/[LEAD-036] como `@regression`.

---

## BUG-015 — El encabezado del evento no indica que el evento está cerrado

**Severity:** LOW
**Priority:** P3
**Status:** Open
**Type:** UX ISSUE
**Module:** finance / events (encabezado compartido de las pestañas del evento)
**Role:** OWNER
**Environment:** TEST — build de producción local `:3205`, base ivonne_rosa_e2e_l5, commit f26b1a1; Chromium
**Reproducible:** Sí (2/2 en la corrida final: intento + reintento)
**Test:** [FIN-007] tests/e2e/finance/finance.spec.ts
**Fuentes:** OPX-BUG-03 (carril 5, LOW)

### Preconditions
Evento COMPLETED con `closedAt` (cerrado desde Finanzas).

### Steps to reproduce
1. Cerrar un evento completado en `/admin/events/<id>/financials` («Cerrar evento»).
2. Abrir cualquier otra pestaña del evento (Resumen, Operaciones, Invitadas).

### Expected result
El encabezado del evento (código, estado, título) muestra una insignia «Cerrado», como la pestaña Finanzas y la tabla de `/admin/finance`.

### Actual result
El encabezado sólo muestra «EV-… · Completado»; nada indica que los costos están congelados salvo en la pestaña Finanzas.

### Evidence
- trace/screenshot: `test-results/l5/artifacts/finance-finance-Finanzas-·-fc22c--que-el-evento-está-cerrado-chromium/` (y `-retry1`); snapshot: `text: EV-2610-B4YE Completado` junto al `h1`.
- Base: `select "closedAt" from "Event" where id = '<id>'` → no nulo.

### Console errors
Ninguno.

### Network errors
Ninguno.

### Technical analysis
`src/features/events/server/event-queries.ts:160-183` (`getEventHeader`) no selecciona `closedAt`; `src/features/events/components/event-header.tsx:32-37` sólo pinta `EVENT_STATUS_LABELS[status]`.

### Suspected root cause
El dato `closedAt` no llega al encabezado.

### Recommended fix
Agregar `closedAt: true` a `getEventHeader` y mostrar `<StatusBadge tone="neutral" dot={false}><Lock/> Cerrado</StatusBadge>` en `EventHeader` cuando exista. Volver a correr [FIN-007].

---

## BUG-016 — Seed DEMO: notificaciones con enlaces a rutas inexistentes

**Severity:** LOW
**Priority:** P3
**Status:** Open
**Type:** DATA ISSUE (seed DEMO de la app)
**Module:** notifications (bandeja mock) / seed
**Role:** OWNER (bandeja) · STAFF (enlace de WhatsApp; staff@ivonne-rosa.test)
**Environment:** TEST — build de producción local; carril 1 `:3201` (l1) y carril 5 `:3205` (l5); commit f26b1a1; Chromium
**Reproducible:** Sí, determinista (NAV-015 ≥ 4/4: 2 de reproducción + 2 de la corrida final con reintento; NOT-007 2/2)
**Test:** [NAV-015] tests/e2e/navigation/links.spec.ts · [NOT-007] tests/e2e/notifications/inbox.spec.ts
**Fuentes:** ACC-BUG-05 (carril 1, LOW), OPX-BUG-04 (carril 5, LOW)

### Preconditions
Base re-sembrada con el seed DEMO.

### Steps to reproduce
1. `select type, "actionUrl" from "NotificationLog" where "actionUrl" like '%/eventos/%'` → 2 filas: `QUOTE_ACCEPTED http://localhost:3000/admin/eventos/<id>` y `STAFF_ASSIGNED http://localhost:3000/staff/eventos/<id>`.
2. En `/admin/notifications` abrir el aviso «Lupita, quedaste asignada como coordinadora…» (WhatsApp) o el de cotización aceptada.
3. Abrir esas rutas con la sesión correspondiente (OWNER / Lupita).

### Expected result
Los enlaces de acción abren el evento (`/admin/events/<id>`, `/staff/events/<id>`).

### Actual result
404 / «No encontramos este evento» en ambos: las rutas reales son `/admin/events/<id>` y `/staff/events/<id>`. Además el `actionUrl` del seed usa el host de `APP_URL` del momento de sembrar (`localhost:3000`). El código de la app genera bien sus enlaces ([OPS-010] y [CRIT-005] PASS); sólo el seed está mal.

### Evidence
- Carril 1: `test-results/l1/artifacts/navigation-links-Enlaces-i-9d72f--apuntan-a-rutas-existentes-chromium/` (resultado: `QUOTE_ACCEPTED → 404 /admin/eventos/…`, `STAFF_ASSIGNED → 404 /staff/eventos/…`).
- Carril 5: `test-results/l5/artifacts/notifications-inbox-Notifi-3386e-del-portal-staff-events-id--chromium/` (y `-retry1/`); anotación `…: /staff/eventos/<id>`; base: `select "actionUrl" from "NotificationLog" where type = 'STAFF_ASSIGNED' and "dedupeKey" is null` → `/staff/eventos/…`.

### Console errors
Ninguno de la app; sólo el `Failed to load resource … 404` que Chromium registra al abrir el enlace roto.

### Network errors
`GET /admin/eventos/<id>` → 404 y `GET /staff/eventos/<id>` → 404 (es el defecto reportado).

### Technical analysis
`prisma/seed-data/demo-activity.ts:85` (`actionUrl: \`${appUrl}/admin/eventos/${e6.id}\``) y `:102` (`actionUrl: \`${appUrl}/staff/eventos/${e1.id}\``). La app usa la ruta correcta: `src/features/operations/server/assignment-service.ts:167` (`appUrl(\`/staff/events/${event.id}\`)`).

### Suspected root cause
Rutas en español escritas a mano en el seed, distintas de las rutas reales del App Router.

### Recommended fix
Cambiar `eventos` por `events` en `prisma/seed-data/demo-activity.ts:85` y `:102` (sólo datos de demo; no afecta producción) y, de preferencia, construir los enlaces con el mismo helper `appUrl()` de la app. Mantener [NAV-015] y [NOT-007] como `@regression`.

---

## Mapa de IDs provisionales

| ID provisional | BUG final | Carril | Prueba(s) |
|---|---|---|---|
| ACC-BUG-01 | BUG-001 | 1 — Acceso y seguridad | [AUTH-032] tests/e2e/auth/session.spec.ts (+ variante natural [AUTH-020], [AUTH-021], [AUTH-025]) |
| ACC-BUG-02 | BUG-004 | 1 — Acceso y seguridad | [AUTH-025] tests/e2e/auth/session.spec.ts |
| ACC-BUG-03 | BUG-005 | 1 — Acceso y seguridad | [AUTH-049] tests/e2e/auth/callback.spec.ts |
| ACC-BUG-04 | BUG-013 | 1 — Acceso y seguridad | [NAV-002] tests/e2e/navigation/not-found.spec.ts |
| ACC-BUG-05 | BUG-016 | 1 — Acceso y seguridad | [NAV-015] tests/e2e/navigation/links.spec.ts |
| SAL-BUG-01 | BUG-007 | 2 — Venta pública | [PAY-019] tests/e2e/payments/payments.spec.ts |
| SAL-BUG-02 | BUG-008 | 2 — Venta pública | [CONF-022] tests/e2e/configurator/server.spec.ts |
| SAL-BUG-03 | BUG-002 | 2 — Venta pública | [PAY-021] tests/e2e/payments/payments.spec.ts |
| SAL-BUG-04 | BUG-009 | 2 — Venta pública | [PAY-022] tests/e2e/payments/payments.spec.ts |
| SAL-BUG-05 | BUG-012 | 2 — Venta pública | [QPUB-015] tests/e2e/quote-public/quote-public.spec.ts |
| SAL-BUG-06 | BUG-010 | 2 — Venta pública | [QPUB-014] tests/e2e/quote-public/quote-public.spec.ts |
| SAL-BUG-07 | BUG-013 | 2 — Venta pública | [PUB-016] tests/e2e/public/site.spec.ts |
| COM-BUG-01 | BUG-014 | 3 — Comercial admin | [LEAD-036] tests/e2e/leads/leads-detail.spec.ts (control [LEAD-035]) |
| COM-BUG-02 | BUG-008 | 3 — Comercial admin | [CUST-016] tests/e2e/customers/customers.spec.ts |
| COM-BUG-03 | BUG-006 | 3 — Comercial admin | [LEAD-037], [LEAD-011] tests/e2e/leads/leads-list.spec.ts |
| EVX-BUG-01 | BUG-002 | 4 — Eventos y experiencia | [EVT-024] tests/e2e/events/event-status.spec.ts |
| EVX-BUG-02 | BUG-006 | 4 — Eventos y experiencia | [CAL-002] tests/e2e/calendar/calendar.spec.ts · [EVT-038] tests/e2e/events/events.spec.ts · [GST-011], [GST-012], [GST-015] tests/e2e/guests/rsvp.spec.ts |
| EVX-BUG-03 | BUG-003 | 4 — Eventos y experiencia | [GST-014] tests/e2e/guests/rsvp.spec.ts |
| EVX-BUG-04 | BUG-009 | 4 — Eventos y experiencia | [EVT-037] tests/e2e/events/event-experience.spec.ts · [CAL-007] tests/e2e/calendar/calendar.spec.ts · [MEM-019] tests/e2e/memory/memory-public.spec.ts |
| EVX-BUG-05 | BUG-010 | 4 — Eventos y experiencia | [GST-022] tests/e2e/guests/rsvp.spec.ts |
| OPX-BUG-01 | BUG-006 | 5 — Operación y back-office | [INV-025] tests/e2e/inventory/inventory.spec.ts |
| OPX-BUG-02 | BUG-006 | 5 — Operación y back-office | [CNT-022], [CNT-023], [CNT-024] tests/e2e/content/content.global.spec.ts · [NOT-002] tests/e2e/notifications/inbox.spec.ts (relacionado: [SET-001] tests/e2e/settings/settings.spec.ts) |
| OPX-BUG-03 | BUG-015 | 5 — Operación y back-office | [FIN-007] tests/e2e/finance/finance.spec.ts |
| OPX-BUG-04 | BUG-016 | 5 — Operación y back-office | [NOT-007] tests/e2e/notifications/inbox.spec.ts |
| OPX-BUG-05 | BUG-011 | 5 — Operación y back-office | [STF-024] tests/e2e/staff/staff-portal.spec.ts (su parte de contraste se documenta en BUG-009) |
| TRV-BUG-01 | BUG-006 | 6 — Transversal | [CRIT-004] tests/e2e/critical/experience.spec.ts |
| TRV-BUG-02 | BUG-009 | 6 — Transversal | [A11Y-009], [A11Y-012], [A11Y-013], [A11Y-014], [A11Y-015], [A11Y-018] tests/e2e/accessibility/a11y.spec.ts |
| TRV-BUG-03 | BUG-009 | 6 — Transversal | [A11Y-008], [A11Y-011] tests/e2e/accessibility/a11y.spec.ts |
| TRV-BUG-04 | BUG-010 | 6 — Transversal | [A11Y-007], [A11Y-010] tests/e2e/accessibility/a11y.spec.ts |
| TRV-BUG-05 | BUG-012 | 6 — Transversal | [A11Y-028] tests/e2e/accessibility/a11y.spec.ts |
| TRV-BUG-06 | BUG-001 | 6 — Transversal | [CRIT-014], [CRIT-012] tests/e2e/critical/access.spec.ts |

---

## Observaciones (no son bugs)

Consolidadas de los 6 carriles y deduplicadas. No cuentan para el gate; se listan con su prueba o evidencia.

### Seguridad y diseño
- **Superficie expuesta por co-ubicación de Server Actions:** la página pública `/memory/[token]` incluye las 7 acciones de administración de la cápsula y `/staff/events/[id]` las 6 de administración de staff (Next agrega todas las exportaciones del módulo `"use server"`). Hoy las frena el RBAC de cada acción ([PERM-121..127], [PERM-130..138] PASS); conviene separar acciones públicas y de admin en módulos distintos. *(carril 1)*
- **Validación antes de autorización:** `src/server/action.ts:71-74` corre Zod antes de autorizar ⇒ un anónimo que llama una acción protegida con datos inválidos recibe `VALIDATION_ERROR` con los mensajes de campo (revela el esquema). Autenticar/autorizar antes de validar en `protectedAction`. *(carril 1)*
- **Rate limit de login sólo por correo** (`src/auth.ts:39`): cualquiera puede bloquear 15 min una cuenta conocida con 9 intentos ([AUTH-061], suite `ratelimit` en `:3209`). Considerar límite combinado correo+IP y desbloqueo por admin. *(carril 1)*
- **`clientIp()` confía en `X-Real-Ip`** (`src/lib/rate-limit.ts:55`): correcto detrás de Traefik (que la sobreescribe), pero sin proxy los límites por IP se evaden variando esa cabecera. Documentar el requisito en DEPLOY. *(carril 1)*
- **Documentación de `Referrer-Policy` desalineada:** `docs/SECURITY.md` dice `no-referrer` en páginas por token; el middleware envía `same-origin` ([PERM-170] PASS) y `/cotizacion/[token]` además declara `<meta name="referrer" content="no-referrer">` (`page.tsx:43`), que en el documento anula la cabecera; el comentario del middleware advierte que `no-referrer` puede dejar `Origin: null` en los POST de Server Actions. Conviene alinear la doc y confirmar aceptar/rechazar en todos los navegadores. *(carril 1)*
- **CSRF en Server Actions:** con `Origin` ajeno Next rechaza la acción (no escribe) pero responde **HTTP 500** con `digest` en lugar de un 4xx ([PERM-159] PASS; comportamiento de Next 15.5 que ensucia logs/alertas de 5xx). *(carril 1)*
- **Disponibilidad pública** expone `remaining` (lugares restantes por día): por diseño; no expone datos de otros eventos ([CONF-016]). *(carril 2)*

### UX y funcionalidad
- **Carrera de hidratación en formularios con `react-hook-form`:** lo que se escribe o selecciona antes de que React hidrate se descarta en silencio (un `select` nativo cambia en el DOM pero el formulario no lo ve; alta/edición de evento, filtros, «Transporte y montaje»: la salida de bodega no se guardó en la primera versión de [OPS-016]). En celulares lentos el staff o la fundadora podrían perder lo tecleado. Sugerencia: deshabilitar campos/botón hasta hidratar, como ya hacen compras/proveedores con `useHydrated`. Las pruebas esperan la hidratación (`gotoReady()`). *(carriles 3, 4 y 5)*
- **`notFound()` responde HTTP 200 en zonas privadas** (streaming bajo `loading.tsx`): `/admin/events/<id inexistente>` (anotación `http-status: 200` de [EVT-004]), detalles del panel ([NAV-004]) y `/staff/events/<id ajeno>` ([CRIT-005]; la barrera «No encontramos este evento» es correcta). Zonas con sesión y `noindex`, sin impacto de seguridad; misma causa que BUG-013. *(carriles 1, 4 y 6)*
- **404 dentro de `/admin`:** una URL inexistente muestra el 404 raíz sin el shell del panel ([NAV-003]); sólo los `notFound()` de detalle usan el 404 del panel. *(carril 1)*
- **`<meta name="robots" content="noindex">` duplicado** (2–3 veces) en las páginas 404 (incluida «Esta mesa ya no está puesta»); se corrige junto con BUG-013. *(carriles 1 y 2)*
- **`callbackUrl` con sesión abierta:** `/login?callbackUrl=/admin/leads` ignora el `callbackUrl` y lleva al inicio del rol (menor). *(carril 1)*
- **Cambio de rol con sesión abierta:** STAFF promovida a OWNER sigue en `/staff` hasta re-login (el middleware usa el rol del JWT) — sin riesgo (menos privilegio), sólo UX ([AUTH-029]). *(carril 1)*
- **Formulario de contacto:** al salir de un campo inválido (modo `onTouched`) aparece su error y desplaza el layout; un clic inmediato en la casilla de consentimiento puede caer en el enlace «aviso de privacidad» del label (abre otra pestaña y no marca la casilla). No envolver el enlace dentro del área clicable o reservar espacio para el error. *(carril 2)*
- **Desbordamiento horizontal transitorio** de 14 px a 390 px en `/crear-experiencia`, medido justo al cargar; desaparece al asentarse hidratación/transiciones (0 px después). Posible «salto» visual en móviles lentos; [PUB-021] ahora mide tras asentar animaciones. *(carril 2)*
- **Contraste transitorio** del botón «Enviar mensaje» mientras pasa de deshabilitado a habilitado (axe a mitad de la transición: 2.32:1); estable después. *(carril 2)*
- **Metadatos en `<body>`:** Next 15.5 transmite title/description/OG al final del documento para navegadores y Googlebot; los rastreadores sin JS (facebookexternalhit, Twitterbot, WhatsApp, Slackbot) sí los reciben en `<head>` ([PUB-018], verificado con ese UA). Vigilar herramientas SEO que no ejecutan JS. *(carril 2)*
- **Cotizaciones en fechas no disponibles:** el admin puede crear/enviar cotizaciones en fechas bloqueadas o sin capacidad; por diseño (DOMAIN.md §Disponibilidad) se valida al aceptar. Sugerencia: aviso en «Cálculo en vivo» para no enviar propuestas que la clienta no podrá aceptar. *(carril 3)*
- **Descuento ≥ subtotal:** se limita al subtotal y deja la cotización en $0, que luego no se puede enviar («La cotización no tiene conceptos con precio»); el mensaje no menciona el descuento como causa ([QUO-013]). *(carril 3)*
- **Auditoría de inventario incompleta:** `addReservation` no deja entrada de auditoría, mientras editar cantidad, liberar y mermas sí. Considerar `inventory.reservation_added`. *(carril 5)*
- **Margen con 1 decimal** (7025 bps → «70.3 %») frente a 70.25 en el CSV: consistente, conviene documentarlo. *(carril 5)*
- **Historial de compras:** lista los campos cambiados en orden de `jsonb` («notas, concepto»), no en el orden del formulario. *(carril 5)*
- **`OrderButtons` etiqueta por posición** («Subir imagen 2»): ambiguo para lector de pantalla y frágil (agravante de BUG-006). *(carril 5)*

### Requisitos ambiguos (REQUIREMENT AMBIGUITY)
- **Teléfonos en CSV:** `toCsv` (`src/lib/csv.ts:6`) antepone `'` a valores que empiezan con `+`, `=`, `-`, `@`, así que los teléfonos internacionales salen como `'+525512345678` en leads ([LEAD-030]) e invitadas ([GST-006]). Protege contra inyección de fórmulas, pero altera datos de contacto; decidir si exportar el teléfono sin `+` o en columna de texto. *(carriles 3 y 4)*
- **Unicidad del teléfono:** sólo el correo es único (`Customer.email @unique`); dos clientas pueden compartir teléfono sin aviso ([CUST-009]), lo que vuelve ambigua la búsqueda por teléfono de la captura única (`findFirst`). Decidir si debe advertirse (relacionado con BUG-008). *(carril 3)*
- **Rechazo de propuesta por token:** el lead se queda en `QUOTED` (sólo se registra actividad SYSTEM y aviso al equipo); [CRIT-003] valida el comportamiento actual. Confirmar con negocio si debe pasar a `LOST` o quedar para re-cotizar. *(carril 6)*
- **Cambios de invitadas/experiencia en eventos con reserva:** no recalculan el total de la reserva (`updateEvent` sólo audita). No se probó el recálculo porque no hay requisito documentado (NOT TESTED); riesgo para el paquete comercial. *(carril 4)*
- **Avisos en captura manual de leads:** se trató como bug (BUG-014) porque la intención del código es no notificar capturas manuales, pero no hay requisito escrito. *(carril 3)*

### Accesibilidad
- `/admin/quotes/[id]/print`: la vista de impresión no tiene ningún encabezado (`h1`–`h6`); el título del documento es un `<p>`. *(carril 1)*
- Not-found de lead (`/admin/leads/<id inexistente>`): el único encabezado es un `h3` («Este lead no existe»); falta `h1`. *(carril 1)*
- `Section` (`src/components/layout/page-header.tsx:46-73`) renderiza `<section>` sin nombre accesible, así que no es landmark/region (p. ej. «Compras», «Staff», «Costos manuales» en Finanzas). Agregar `aria-labelledby` al `h2`. *(carril 5)*
- `StatCard` (`src/components/data/stat-card.tsx`): etiqueta y valor son `span/div` sin relación semántica (sin `dt/dd` ni `aria-labelledby`); un lector de pantalla los lee sueltos. *(carril 3)*
- Calificación de testimonios: radios `sr-only` cuyo ícono intercepta el puntero; funciona con clic en la estrella (label) y con teclado. Sólo se anota. *(carril 5)*
- Violaciones axe *moderate*/*minor*: no cuentan como fallo; se registran como anotación `a11y-observación` en cada prueba A11Y y en el adjunto `a11y-axe.json` de [STF-024] (`test-results/l6/results.json`, `test-results/l5/results.json`). *(carriles 5 y 6)*
- Positivo: radiogroups del configurador navegables con flechas/espacio, foco al abrir diálogos, labels asociados en todos los formularios probados y `aria-invalid` en errores. Con Radix RadioGroup las flechas mueven y seleccionan según WAI-ARIA; el `press` instantáneo de Playwright no seleccionaba (artefacto de prueba corregido en [A11Y-021], no es bug). *(carriles 2 y 6)*

### Rendimiento
- Ninguna página superó 5 s de carga en ningún carril. Las 83 páginas de la matriz cargan con el rol principal en ~1–2 s (carril 1); páginas públicas < 2 s; páginas de eventos/calendario/portal < 2 s; acciones de inventario/compras < 1 s con 3 workers. *(carriles 1, 2, 4 y 5)*
- Recorridos: configurador completo (10 pasos + envío + revisión admin) ~11 s; pago mock completo (checkout → webhook → resultado) ~3 s; [CRIT-002] (≈10 pantallas, 3 actores) ~25–35 s en build de producción local. *(carriles 2 y 6)*
- **Payload RSC grande:** `/admin/leads` sin filtros devuelve ~176 KB de RSC con ~200 leads en base (tabla de 25 filas + opciones del formulario «Nuevo lead»). Observación para bases grandes. *(carril 3)*

### Comportamientos verificados correctos (referencia)
- Pagos manuales sobre eventos cancelados: bloqueados (`EVENT_CANCELLED`, [EVT-027]); el hueco es sólo el checkout en línea (BUG-002). *(carril 4)*
- Recordatorios RSVP: deduplicación diaria por invitada y canal correcta ([GST-007]); la coincidencia con la llave del programador (`/api/cron/notifications`) quedó NOT TESTED en el carril 4. *(carril 4)*
- Teléfonos del configurador normalizados a `+52XXXXXXXXXX` en lead y clienta ([CRIT-001]). *(carril 6)*
- La notificación `STAFF_ASSIGNED` generada por la app usa `/staff/events/<id>` ([OPS-010], [CRIT-005]); `/staff/eventos/…` sólo existe en el seed (BUG-016). *(carriles 5 y 6)*

---

## Problemas de entorno detectados

No son bugs de la app; afectan la ejecución de las pruebas. Las correcciones de infraestructura se incorporaron en el commit `8020b91`.

### ENV-01 — Caché de datos de Next compartida entre carriles — RESUELTA

- **Tipo:** ENVIRONMENT ISSUE (infraestructura del gate paralelo). **Detectado por:** carriles 1, 2, 3, 5 y 6.
- **Descripción:** `scripts/e2e-server.mjs` arrancaba todos los carriles con `NEXT_DIST_DIR=.next-e2e` y Next guardaba las entradas de `unstable_cache` en `.next-e2e/cache/fetch-cache/`, **una sola carpeta para todos los carriles** (cada uno con su base y sus IDs cuid) que además sobrevivía a la re-siembra. Entradas afectadas: catálogo del configurador `configurator-catalog-v1` (`getConfiguratorCatalog`, `src/features/configurator/server/queries.ts:117`, revalidate 60 s), catálogo/ficha de experiencias `marketing:*` (`getExperienceDetail`, `src/features/marketing/server/queries.ts:396`, 300 s), settings de negocio, testimonios, FAQ y galería.
- **Síntomas observados:**
  - Carril 1: `/experiencias/bridal-brunch` sirvió `experienceId = cmuwcuctk006fqmz0t3sck5gd` (de otra base) mientras la base del carril tenía `cmuwc4w2s006fqmtcbxr6lhl0` ⇒ `/api/analytics/track` 422 `unknown_experience` (2/2); [NAV-010] anotado y tolerado.
  - Carril 2: `/experiencias/birthday-table` con `experienceId` ajeno ⇒ 422 del `ViewBeacon` ⇒ error de consola ⇒ [PUB-003], [PUB-015], [PUB-020], [PUB-021] fallaron por el guard en la corrida nº 2; en la nº 3 la espera para recuperar IDs propios superó 90 s.
  - Carril 3: las pruebas públicas ([CAT-008]) se limitaron a slugs únicos del carril y nunca usaron el listado `/experiencias`.
  - Carril 5: [CNT-020]/[CNT-021] pintaron la portada con datos del carril 5 durante segundos en otros carriles.
  - Carril 6: el configurador mostró experiencias de otra base y el envío falló con «Esa experiencia ya no está disponible. Elige otra, por favor.» (primer intento de [CRIT-001]); [SMK-012] recibió 422 del beacon.
- **Mitigaciones aplicadas en las pruebas durante la auditoría:** `ensureFreshConfiguratorCatalog` y `ensureFreshExperienceDetail` (`tests/e2e/configurator/_helpers.ts`, espera hasta 75 s y BLOCKED si no hay IDs propios); `ensureConfiguratorCatalogMatchesDb` (hasta 150 s, BLOCKED) y `toleratesStaleExperienceCache` (tolera el 422 sólo si el id servido no existe en la base) en `tests/e2e/critical/_helpers.ts`.
- **Resolución:** la caché de datos de Next es **sólo en memoria en E2E** (`NEXT_ISR_FLUSH_TO_DISK: "false"` en `scripts/e2e-server.mjs:60` → `experimental.isrFlushToDisk` en `next.config.ts:25`; en producción queda el default) y `.next-e2e/cache/fetch-cache` **se limpia al arrancar** cada servidor (`scripts/e2e-server.mjs:100`). Documentado en `.claude/skills/e2e-quality-gate/references/runbook.md`. Las esperas defensivas de las pruebas pueden mantenerse o simplificarse en la siguiente corrida.

### ENV-02 — Firefox de Playwright no arranca desde `%LOCALAPPDATA%` — RESUELTA

- **Tipo:** ENVIRONMENT ISSUE (máquina). **Detectado por:** carriles 1 y 6.
- **Descripción:** `browserType.launch: spawn UNKNOWN` para `C:\Users\luisc\AppData\Local\ms-playwright\firefox-1543\firefox\firefox.exe`; ejecutado directamente, Windows responde «No se pudo iniciar la aplicación; la configuración en paralelo no es correcta» (error SxS).
- **Efecto en esta auditoría:** todas las pruebas `@P0` del proyecto `firefox` fallaron al lanzar el navegador antes de ejecutar código de prueba ⇒ cross-browser en Firefox **BLOCKED** (sin resultado funcional de Firefox). `quality-gate.mjs` contaba entonces esos 30 errores de lanzamiento como FAIL (Playwright los registra como `unexpected`); en la matriz de cobertura se reportan como BLOCKED.
- **Resolución:** copia del Firefox de Playwright (`ms-playwright/firefox-1543/firefox`) en `D:` y variable `E2E_FIREFOX_EXECUTABLE` en `.env` (`playwright.config.ts:81` la usa como `launchOptions.executablePath`; ejemplo en `.env.example:82`; `preflight.mjs:114-118` verifica que exista). Además `quality-gate.mjs:67` clasifica ahora `browserType.launch` / `Executable doesn't exist` / `spawn UNKNOWN` como **BLOCKED**, no FAIL. Las pruebas de Firefox deben re-ejecutarse con `E2E_CROSS_BROWSER=1 … --project=firefox`.

### Notas del guard de consola/red (`tests/e2e/fixtures/guard.ts`)

1. **Ruido de WebKit al cancelar prefetch** (`Load failed`, `Fetch API cannot load … due to access control checks`, `Failed to fetch RSC payload … Falling back to browser navigation`) no estaba en `BENIGN` ⇒ con `E2E_CROSS_BROWSER=1` cualquier prueba que navegara rápido en el panel fallaba en WebKit. **Aplicado:** patrones agregados (`guard.ts:18-21`). Pendiente de revisión (carril 2): el patrón `Failed to fetch RSC payload … Falling back to browser navigation` también silencia ese aviso en Chromium. *(carriles 1 y 2)*
2. **4xx esperados como violación y sin URL:** Chromium duplica cada respuesta 4xx como `console.error` («Failed to load resource: … status of 4xx») sin la URL en el texto, así que toda prueba con un 4xx esperado necesitaba `guard.allow(/404/)` o un patrón por código de estado (p. ej. [CAT-013] 422, [QUO-025] 404). **Aplicado:** el texto incluye `[url de origen]` y esos mensajes se clasifican como `http4xx` (observación), no como violación (`guard.ts:34-40`; documentado en `references/test-design.md`). *(carriles 2, 3 y 5)*
3. **`net::ERR_ABORTED` es benigno por diseño**, que es justo como se manifiesta BUG-006: el guard no puede detectarlo y las pruebas deben afirmar el resultado (URL/contenido), como hacen CAL-002 y EVT-038. *(carril 4)*
4. **`getByRole("alert")` es ambiguo:** el anunciador de rutas de Next tiene `role="alert"`; acotar a `page.getByRole("main")` o filtrar por texto (documentado en el runbook). *(carril 2)*
5. **`replayServerAction.classify`** trataba cualquier `ok:false` con código `NOT_FOUND` como «denied», mezclando autorización con recurso inexistente (el carril 4 usó su propio `callAction`). `references/test-design.md` distingue ahora `wasDenied` / `wasForbidden` / `wasBlocked`. *(carril 4)*
6. **`mode: "serial"` en `*.global.spec.ts`:** un fallo dejaba el resto del archivo sin ejecutar (6 NOT TESTED en la primera corrida global del carril 5). Con `E2E_SUITE=global` ya hay 1 worker; `references/test-design.md` indica ahora no usar `serial`. *(carril 5)*

### Notas de reporters y ejecución

1. **`--reporter` en la CLI** (p. ej. `--reporter=line`) reemplaza los reporters del config (`list` + `html` en `playwright-report/<carril>` + `json` en `test-results/<carril>/results.json`, `playwright.config.ts:99-103`) y **no se escribe `results.json`**, del que depende `quality-gate.mjs`. Documentado en el runbook. *(carril 1)*
2. **`pnpm.cmd exec playwright … -g "A|B"`** se rompe en Windows (cmd.exe interpreta `|`); usar `node node_modules/@playwright/test/cli.js test … -g "A|B"`. Documentado en el runbook. *(carriles 2, 3 y 4)*
3. **Cada invocación sobrescribe `test-results/<carril>/artifacts`:** parte de la evidencia previa se perdió (exploración de [AUTH-020]; [EVT-038], [GST-012], [GST-015]). Copiar la evidencia de cada bug a `test-results/<carril>-evidence/<BUG>/` antes de volver a correr (el carril 6 lo hizo en `test-results/l6-evidence/`; el carril 4 en `test-results/l4/evidence/`). Documentado en el runbook. *(carriles 1, 4 y 6)*
4. **Respuestas RSC de Server Actions sin `charset`:** `Response.text()`/`body()` del navegador en Playwright las decodifica como latin1 (acentos rotos); `APIRequestContext` sí decodifica UTF-8. Comparar contra la base en lugar del texto capturado. *(carril 2)*
5. **Datos con varios workers:** los conteos globales en la base no sirven en paralelo ([CONF-005]/[CONF-018], TEST BUG corregido) y las altas de eventos pueden chocar por fecha ([EVT-006] FLAKY previo, corregido con `pickFreeDate` por `TEST_PARALLEL_INDEX`). Acotar las aserciones a los datos de la prueba. *(carriles 2 y 4)*
6. **Scratchpad compartido entre agentes de todos los carriles** (scripts que desaparecen a mitad de corrida): usar `scratchpad/l<n>/`. Documentado en el runbook. *(carriles 1 y 2)*
7. **Hidratación:** interactuar antes de hidratar pierde el cambio; conviene un helper compartido tipo `gotoReady()` (espera red en reposo) en los fixtures. *(carriles 3, 4 y 5)*
