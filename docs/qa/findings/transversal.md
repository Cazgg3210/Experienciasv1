# Hallazgos — Paquete 6/6 "Transversal" (carril 6)

**Fecha:** 2026-10-06 · **Commit:** `f26b1a1` (+ cambios sin commit sólo en `docs/qa` y `tsconfig.json`, fuera del sello de build) · **Modo:** FULL (paquete transversal)
**Entorno:** TEST — build de producción local `.next-e2e` en `http://localhost:3206`, base `ivonne_rosa_e2e_l6` re-sembrada en cada invocación, proveedores mock (pagos, email, WhatsApp), S3 local (RustFS :9000).
**Alcance:** smoke (`SMK`), recorridos críticos P0 (`CRIT`), responsive (`RESP`), accesibilidad (`A11Y`).
**Evidencia:** artefactos de la corrida final en `test-results/l6/artifacts/<spec>-<proyecto>/` (trace.zip, screenshot, video, `error-context.md`) y `test-results/l6/results.json` (adjuntos `a11y-axe.json`, `responsive.json`, `console-network.json`). Copia preservada de la evidencia de los bugs en `test-results/l6-evidence/`.

| Severidad | Cantidad | IDs |
|---|---|---|
| BLOCKER | 0 | — |
| CRITICAL | 0 | — |
| HIGH | 2 | TRV-BUG-06 (POTENTIAL SECURITY ISSUE), TRV-BUG-01 |
| MEDIUM | 2 | TRV-BUG-02, TRV-BUG-03 |
| LOW | 2 | TRV-BUG-04, TRV-BUG-05 |

Además: **2 problemas de entorno** (no son bugs de la app): ENV-01 caché de datos de Next compartida entre carriles (afecta configurador y detalle de experiencias) y ENV-02 Firefox no arranca en esta máquina (todas las pruebas de Firefox quedan BLOCKED).

---

## TRV-BUG-06 — El logout no es definitivo: respuestas autenticadas que estaban en vuelo vuelven a crear la cookie de sesión

**Severity:** HIGH
**Priority:** P0
**Status:** Fixed — consolidado como BUG-001 (verificado en carril 1; ver access.md ACC-BUG-01 «Resolution»)
**Type:** POTENTIAL SECURITY ISSUE (gestión de sesión / logout)
**Module:** auth (middleware Auth.js v5, logout de admin y staff)
**Role:** STAFF (reproducido); afecta a cualquier rol con sesión (mismo middleware y mismo `signOut`)
**Environment:** TEST — build local :3206, base ivonne_rosa_e2e_l6, commit f26b1a1
**Reproducible:** Sí — determinista: [CRIT-014] 8/8 (reproducción chromium 2/2 y webkit 2/2 + corrida final chromium y webkit, intento y reintento); natural: [CRIT-012] mobile-chrome 1/7 (depende de la latencia de los prefetch)
**Test:** [CRIT-014] y [CRIT-012] `tests/e2e/critical/access.spec.ts`

### Preconditions
Sesión de staff abierta en `/staff` (con las tarjetas de eventos visibles: Next hace *prefetch* RSC de `/staff/events/<id>`), o una segunda pestaña del portal.

### Steps to reproduce
1. Iniciar sesión como staff y quedarse en `/staff`.
2. Pulsar "Cerrar sesión" mientras hay peticiones autenticadas en vuelo (prefetch de las tarjetas, otra pestaña, red lenta).
3. Cuando llega la respuesta de esas peticiones (después del `POST /api/auth/signout`), visitar `/staff`.

### Expected
Tras cerrar sesión, la cookie `authjs.session-token` desaparece y **ninguna** respuesta posterior la vuelve a crear; `/staff` redirige a `/login?callbackUrl=%2Fstaff`.

### Actual
`POST /api/auth/signout` borra la cookie (`authjs.session-token=; Max-Age=0`), pero las respuestas de peticiones emitidas antes del logout traen `Set-Cookie: authjs.session-token=eyJ…` (el middleware re-emite la cookie en **cada** respuesta autenticada) y la re-crean. Resultado: la persona cree haber cerrado sesión, pero el navegador sigue autenticado (`/staff` abre el portal con eventos, direcciones y teléfonos de clientas). En un celular compartido por el equipo es una fuga de datos.

### Evidence
- Traza natural (mobile-chrome, CRIT-012), orden por tiempo:
  ```
  07:34:41.629 GET  /staff/events/<id>?_rsc=…   200  Set-Cookie: authjs.session-token=eyJ…   ← prefetch emitido antes del logout
  07:34:41.634 POST /api/auth/signout           200  Set-Cookie: authjs.session-token=; Max-Age=0
  07:34:41.746 GET  /?_rsc=…                    200  (ya viaja con sesión) …
  07:34:41.754 GET  /staff                      200  ← portal abierto tras el logout
  ```
- CRIT-014 (anotación "Set-Cookie de sesión tras logout"): `GET /staff/events/<id>?_rsc=… 200` ×2 en Chromium; respuesta retenida de `/staff?e2e-inflight=1` en WebKit.
- trace/screenshot/video: `test-results/l6-evidence/TRV-BUG-06/critical-access-Recorridos-b406a--sesión-no-revive-la-sesión-{chromium,webkit}[-retry1]/` (corrida final) y `test-results/l6-evidence/TRV-BUG-06/CRIT-012-mobile-chrome-logout-natural-trace.zip` (reproducción natural).

### Console / Network
Sin errores de consola; todas las respuestas 200/3xx.

### Technical Analysis
`src/middleware.ts` (línea 48: `matcher` excluye sólo `api` y estáticos) envuelve todas las páginas con `auth()` de Auth.js v5, que con estrategia JWT (`src/auth.config.ts`, `maxAge` 12 h) re-firma y re-emite la cookie de sesión en las respuestas autenticadas (incluidos los prefetch RSC). El logout (`signOut({ callbackUrl: "/login" })` en `src/components/staff/staff-shell.tsx:38` y `src/components/admin/admin-shell.tsx:161`) sólo borra la cookie en el navegador; no hay revocación en servidor, así que cualquier `Set-Cookie` que llegue después restablece una sesión válida (y el JWT sigue siendo válido hasta 12 h aunque se copie).

### Suspected Root Cause
Revocación de sesión sólo del lado del cliente + re-emisión de la cookie en cada respuesta del middleware.

### Recommended Fix
1. Revocación en servidor: guardar `sessionVersion`/`loggedOutAt` por usuario (o un `jti` en lista de revocados) y validarlo en el callback `jwt`/`getCurrentUser` (que ya consulta la base en cada request); el logout lo incrementa. Una cookie revivida dejaría de autorizar.
2. Evitar re-emitir la cookie en respuestas de prefetch/RSC (o aumentar `session.updateAge`) para reducir la ventana.
3. Mantener [CRIT-014] como prueba `@regression`.

### Resolution (BUG-001)
Revocación por `User.sessionVersion` + el middleware ya no re-emite la cookie de sesión en cada respuesta (sólo renueva JWT con ≥ 1 h en `GET`). [CRIT-014] y [CRIT-012] quedan `@regression` con cuentas STAFF propias (cerrar sesión revoca todas las sesiones de la cuenta); detalle en `access.md` (ACC-BUG-01).

---

## TRV-BUG-01 — RSVP: la respuesta se guarda pero la invitada no ve la confirmación (el formulario queda igual)

**Severity:** HIGH
**Priority:** P1
**Status:** Fixed — consolidado como **BUG-006**; causa raíz y corrección en docs/qa/findings/events.md (EVX-BUG-02 › «Corrección (BUG-006)»)
**Type:** APPLICATION BUG (UX ISSUE con carrera de estado en el cliente)
**Module:** guests (micrositio / RSVP)
**Role:** Invitada (link personal `/e/[slug]/[guestToken]`, sin sesión)
**Environment:** TEST — build local :3206, base ivonne_rosa_e2e_l6, commit f26b1a1
**Reproducible:** Sí, intermitente — 17 de 26 ejecuciones antes de la corrida final: `--repeat-each=4` 6/8 (chromium 3/4, mobile-chrome 3/4), diagnóstico aislado 6/7, corridas previas 5/8 (chromium 4/5, mobile-chrome 1/2, webkit 0/1). En la corrida final pasó 3/3 (chromium, mobile-chrome, webkit): **sigue abierto**; la prueba lo marca con la anotación `bug: TRV-BUG-01` cuando ocurre.
**Test:** [CRIT-004] `tests/e2e/critical/experience.spec.ts`

### Preconditions
Evento CONFIRMED con micrositio activo y una invitada PENDING agregada por la anfitriona (la prueba la agrega desde el portal).

### Steps to reproduce
1. Abrir el link personal de la invitada `/e/<slug>/<guestToken>`.
2. Elegir "¡Sí, ahí estaré!".
3. Pulsar "Enviar mi respuesta".

### Expected
Aparece la tarjeta de confirmación "¡Gracias, <nombre>! Te esperamos" (con "Agregar a mi calendario" y "Editar mi respuesta"), como define `confirmationCopy()` en `src/features/guests/domain/rsvp.ts:108`.

### Actual
En ~75 % de los intentos el formulario se queda exactamente igual (botón "Enviar mi respuesta", la opción marcada, sin toast ni mensaje) durante más de 15 s. La base **sí** guardó la respuesta: `EventGuest.rsvpStatus = ATTENDING`, `respondedAt` con fecha. Al recargar la página aparece la confirmación. Una invitada no tiene forma de saber que su respuesta llegó y probablemente la reenvíe o abandone.

### Evidence
- Prueba: `[CRIT-004]` falla en el `expect.soft` "la invitada ve la confirmación tras enviar" (anotación `bug: TRV-BUG-01`); el resto del recorrido (base, admin "Asiste", portal "Asiste") pasa.
- trace: `test-results/l6-evidence/TRV-BUG-01/CRIT-004-chromium-rsvp-sin-confirmacion-trace.zip` (corrida de reproducción; `pnpm exec playwright show-trace <zip>`).
- Base tras el fallo (consulta): `SELECT "rsvpStatus","respondedAt" FROM "EventGuest" WHERE token = '<guestToken>'` → `ATTENDING | 2026-10-06T07:09:50.259Z`.
- Diagnóstico de red (spec temporal, ya eliminado): la respuesta de la Server Action (POST con `next-action`) o el refresh RSC (`GET ?_rsc=`) **contienen `"responded":true`** y aun así el panel sigue en modo formulario:
  ```
  POST …/e/<slug>/<token>  200 action=true  len=0
  GET  …?_rsc=…            200              len=26070 respTrue=true
  confirmation visible: false
  ```

### Console
Sin errores de consola ni de red (guard limpio).

### Network
POST de la Server Action 200; GET `?_rsc` 200 con datos frescos.

### Technical Analysis
`RsvpPanel` decide qué mostrar con `guest?.responded && !editing` (`src/features/guests/components/rsvp-panel.tsx:88`). Tras un envío exitoso en el link personal, `RsvpForm.onSubmit` hace `React.startTransition(() => { onSaved(); router.refresh(); })` (`rsvp-panel.tsx:233-236`): `onSaved` pone `editing=false` dentro de la misma transición que el refresh, mientras la acción ya disparó `revalidatePath` (`src/features/guests/server/actions.ts:19`) y Next aplica su propio árbol. Según el orden en que llegan la respuesta de la acción y el refresh, la actualización de estado de la transición se descarta/queda superada y el panel vuelve a renderizar con `editing` en su valor anterior; el resultado depende del timing (pasa ~25 %).

### Suspected Root Cause
`src/features/guests/components/rsvp-panel.tsx:233-236` — la confirmación depende de que `editing=false` (estado local dentro de una transición) coincida con props refrescadas, en vez de derivarse del resultado de la acción.

### Recommended Fix
Mostrar la confirmación a partir del resultado de `submitRsvpAction` (p. ej. `onSaved(res.data)` → guardar `savedGuest` en estado del panel y renderizar la tarjeta con esos datos), llamar `setEditing(false)` fuera de `startTransition`, y usar `router.refresh()` sólo para sincronizar el resto del micrositio. Agregar prueba `@regression` (CRIT-004 ya la cubre) y un test de componente del panel.

---

## TRV-BUG-02 — Contraste insuficiente en insignias de estado "warning"/"info" (panel y portal)

**Severity:** MEDIUM
**Priority:** P2
**Status:** Open
**Type:** UX ISSUE (accesibilidad WCAG 1.4.3, axe `color-contrast` serious)
**Module:** components/data (StatusBadge), admin-shell, portal
**Role:** OWNER/SUPER_ADMIN (panel) y clienta (portal)
**Environment:** TEST — build local :3206, base ivonne_rosa_e2e_l6, commit f26b1a1
**Reproducible:** Sí (2/2, determinista)
**Test:** [A11Y-009] [A11Y-012] [A11Y-013] [A11Y-014] [A11Y-015] [A11Y-018] `tests/e2e/accessibility/a11y.spec.ts`

### Preconditions
Seed DEMO (hay pagos/anticipos pendientes y eventos en varios estados).

### Steps to reproduce
1. Abrir `/admin`, `/admin/leads`, `/admin/events/<id>`, `/admin/calendar`, `/admin/finance` (OWNER) o `/mi-evento/demo-portal-cumple-sofia-2026`.
2. Ejecutar axe (WCAG 2.1 AA).

### Expected
Texto ≥ 4.5:1 (texto normal de 11–14 px).

### Actual
- `text-warning` (#9a6a1f) sobre `bg-warning/10`: **3.77:1** (#eee5d7, píldora del encabezado admin, 12 px) y **4.08:1** (#f5eee3, `StatusBadge` "Anticipo pendiente", 11–12 px). 1–11 nodos por página.
- `text-info` (#4b6577) sobre `bg-info/10` en el portal: **4.47:1** (14 px).
- Número del contador `text-ivory/80` (#d8d8cc) sobre olive (#5c6b4e): **3.98:1** (12 px) en el portal.
- Calendario: números de días fuera de mes #a09991 sobre #faf7f0: **2.63:1**.

### Evidence
`test-results/l6-evidence/TRV-BUG-02/A11Y-0{09,12,13,14,15,18}-a11y-axe.json` (salida de axe) + carpetas de artefactos de cada prueba (screenshot, trace); resumen en el error (`serious color-contrast ×N …`).

### Console / Network
Sin errores.

### Technical Analysis / Suspected Root Cause
Tokens de color: `--warning: #9a6a1f` e `--info: #4b6577` (`src/app/globals.css:108-110`) usados con fondo al 10 % en `src/components/data/status-badge.tsx:6-8` y en el enlace de pendientes de `src/components/admin/admin-shell.tsx:118`. El fondo tintado reduce el contraste por debajo de AA en tamaños `text-xs`.

### Recommended Fix
Oscurecer el texto de los tonos (p. ej. warning ≈ #7d5414, info ≈ #3d5363) o usar `text-*-foreground` sobre fondo sólido para insignias pequeñas; revisar `text-ivory/80` y los días fuera de mes del calendario (o marcarlos `aria-hidden` + `role="presentation"` en la celda si son puramente decorativos). Volver a correr A11Y-009/012/013/014/015/018.

---

## TRV-BUG-03 — Contraste insuficiente de texto secundario "taupe"/atenuado en páginas públicas por token

**Severity:** MEDIUM
**Priority:** P2
**Status:** Open
**Type:** UX ISSUE (WCAG 1.4.3, axe `color-contrast` serious)
**Module:** memory-capsule, payments (mock), marca
**Role:** Invitada / clienta
**Environment:** TEST — build local :3206, base ivonne_rosa_e2e_l6, commit f26b1a1
**Reproducible:** Sí (2/2, determinista)
**Test:** [A11Y-011] [A11Y-008] `tests/e2e/accessibility/a11y.spec.ts`

### Steps to reproduce
1. Abrir `/memory/demo-memory-valeria-2026-9tk3w7hb` o un checkout mock `/pago/mock/<checkoutId>`.
2. Ejecutar axe.

### Expected
≥ 4.5:1.

### Actual
- `text-taupe` (#a48f7e) sobre ivory (#f7f3ec): **2.78:1** — fecha de la cápsula (`<time>`, 14 px) y la nota de "Pago seguro" del checkout (12 px).
- Pista del uploader de la cápsula (#a29b95 sobre #fffdf9, **2.69:1**) mientras está deshabilitado (opacidad reducida).

### Evidence
`test-results/l6-evidence/TRV-BUG-03/A11Y-008-a11y-axe.json`, `A11Y-011-a11y-axe.json` + artefactos.

### Suspected Root Cause
`--brand-taupe: #a48f7e` (`src/app/globals.css:83`) usado como color de texto (clase `text-taupe`) en `src/app/(experience)/memory/[token]/page.tsx:85` (fecha) y `src/app/(experience)/pago/layout.tsx:11` ("Pago seguro" del checkout); el `MediaUploader` deshabilitado aplica opacidad al texto de ayuda.

### Recommended Fix
Reservar `taupe` para decoración/íconos y usar `text-muted-foreground` (#645a52, 6+:1) para texto; en el uploader deshabilitado mantener el texto de ayuda sin opacidad.

---

## TRV-BUG-04 — Listas de definición (`<dl>`) con estructura inválida en la propuesta pública y el micrositio

**Severity:** LOW
**Priority:** P3
**Status:** Open
**Type:** UX ISSUE (semántica para lectores de pantalla; axe `definition-list` + `dlitem` serious)
**Module:** quotes (página pública), guests (micrositio)
**Role:** Clienta / invitada
**Environment:** TEST — build local :3206, base ivonne_rosa_e2e_l6, commit f26b1a1
**Reproducible:** Sí (2/2, determinista)
**Test:** [A11Y-007] [A11Y-010] `tests/e2e/accessibility/a11y.spec.ts` · Evidencia: `test-results/l6-evidence/TRV-BUG-04/A11Y-007-a11y-axe.json`, `A11Y-010-a11y-axe.json`

### Steps to reproduce
Abrir `/cotizacion/demo-quote-lucia-2026-4fq8m2zp` o `/e/cumple-sofia/demo-guest-sofia-camila-2026` y ejecutar axe.

### Expected
`<dt>/<dd>` como hijos directos de `<dl>` (o de un `<div>` hijo directo de `<dl>`).

### Actual
`DetailTile` envuelve `dt/dd` en `<div><span icono/><div><dt/><dd/></div></div>` dentro del `<dl>` → axe reporta `definition-list` (×1–2) y `dlitem` (×10–12 nodos: "Fecha", "Hora de inicio", "Cuándo", "Horario"…).

### Suspected Root Cause
`src/app/(experience)/cotizacion/[token]/page.tsx:73` (`DetailTile`: `<div><span icono/><div><dt/><dd/></div></div>`) y `src/features/guests/components/microsite-view.tsx:116` (`<dl>` de Cuándo/Horario/Dónde con la misma estructura).

### Recommended Fix
Hacer que el `div` hijo del `dl` contenga directamente `dt` y `dd` (mover el ícono dentro del `dt` o como `aria-hidden` dentro del mismo div sin otro contenedor).

---

## TRV-BUG-05 — Al cerrar el diálogo "Aceptar propuesta" el foco se pierde (va a `<body>`)

**Severity:** LOW
**Priority:** P3
**Status:** Open
**Type:** UX ISSUE (WCAG 2.4.3 orden del foco)
**Module:** quotes (página pública)
**Role:** Clienta
**Environment:** TEST — build local :3206, base ivonne_rosa_e2e_l6, commit f26b1a1
**Reproducible:** Sí (2/2 + corrida final)
**Test:** [A11Y-028] `tests/e2e/accessibility/a11y.spec.ts` · Evidencia: `test-results/l6-evidence/TRV-BUG-05/` (screenshot, trace, anotación "foco tras cerrar: body …")

### Steps to reproduce
1. `/cotizacion/demo-quote-lucia-2026-4fq8m2zp`, enfocar "Aceptar propuesta" con teclado y pulsar Enter.
2. Pulsar Escape.

### Expected
El foco vuelve al botón "Aceptar propuesta".

### Actual
El diálogo se cierra (bien) y el foco atrapado dentro funciona (bien), pero `document.activeElement` queda en `<body>` (anotación "foco tras cerrar: body …"): una usuaria de teclado/lector vuelve al inicio de la página.

### Suspected Root Cause
`src/features/quotes/components/public/accept-quote.tsx`: el `Dialog` es controlado (`open`/`setOpen`) y se abre desde dos botones distintos (inline y barra móvil) sin `DialogTrigger`, por lo que Radix no tiene a quién devolver el foco.

### Recommended Fix
Guardar el botón que abrió el diálogo (ref) y devolverle el foco en `onCloseAutoFocus`, o usar `DialogTrigger asChild` en el botón principal.

---

## ENV-01 (infraestructura E2E compartida, NO es bug de la app) — La caché de datos de Next es compartida entre carriles con bases distintas

**Tipo:** ENVIRONMENT ISSUE · **Afecta:** cualquier prueba que use `/crear-experiencia` (configurador) o `/experiencias/[slug]` en carriles paralelos (paquete 2 incluido).

- `scripts/e2e-server.mjs` arranca todos los carriles con `NEXT_DIST_DIR=.next-e2e`; Next guarda las entradas de `unstable_cache` en `.next-e2e/cache/fetch-cache/` (una sola carpeta para todos).
- `getConfiguratorCatalog` (`src/features/configurator/server/queries.ts:117`, revalidate 60 s) y `getExperienceDetail` (`src/features/marketing/server/queries.ts:396`, 300 s) cachean **IDs (cuid)** que cambian en cada re-siembra y son distintos en cada base de carril.
- Síntomas observados: el configurador muestra experiencias de otra base y el envío falla con "Esa experiencia ya no está disponible. Elige otra, por favor." (primer intento de CRIT-001); el detalle de experiencia envía `VIEW_EXPERIENCE` con un `experienceId` ajeno y `/api/analytics/track` responde **422** (SMK-012).
- Mitigación aplicada SÓLO en mis pruebas (sin tocar fixtures compartidos): `ensureConfiguratorCatalogMatchesDb` espera (recargando, hasta 150 s) a que el HTML traiga IDs de la base del carril y si no ocurre marca la prueba **BLOCKED**; `toleratesStaleExperienceCache` tolera el 422 del beacon **sólo** cuando verifica que el id servido no existe en la base (anotación `environment`).
- Corrección recomendada (orquestador/infra): un `distDir`/caché por carril (p. ej. copiar `.next-e2e` a `.next-e2e-l<n>` antes de `next start`, o `cacheHandler` en memoria para E2E / `cacheMaxMemorySize` sin flush a disco), y limpiar `fetch-cache` tras re-sembrar.

---

## ENV-02 (entorno de la máquina, NO es bug de la app) — Firefox de Playwright no arranca

- `browserType.launch: spawn UNKNOWN` para `C:\Users\luisc\AppData\Local\ms-playwright\firefox-1543\firefox\firefox.exe`; al ejecutarlo directo Windows responde "No se pudo iniciar la aplicación; la configuración en paralelo no es correcta" (error SxS: falta/no coincide el runtime de Visual C++ o la instalación quedó incompleta; instalada hoy 00:18).
- Efecto: todas las pruebas `@P0` del proyecto `firefox` fallan al lanzar el navegador antes de ejecutar código de prueba ⇒ se reportan **BLOCKED** (no hay resultado funcional de Firefox).
- Corrección sugerida (requiere permiso del usuario, no la apliqué): reinstalar `pnpm exec playwright install firefox` y/o instalar el Visual C++ Redistributable x64; después re-correr `E2E_LANE=6 E2E_CROSS_BROWSER=1 … --project=firefox`.
- Nota para el consolidado: `quality-gate.mjs` cuenta estos 30 errores de lanzamiento como **FAIL** (no BLOCKED) porque Playwright los registra como `unexpected`; en la matriz de cobertura se reportan como BLOCKED (ENV-02).

## Observaciones (no son bugs)

- **REQUIREMENT AMBIGUITY — rechazo de propuesta:** al rechazar por token el lead se queda en `QUOTED` (sólo se registra actividad SYSTEM y aviso al equipo). CRIT-003 valida el comportamiento actual; confirmar con negocio si debería pasar a `LOST` o quedar para re-cotizar.
- **notFound() en el portal staff:** `/staff/events/<id ajeno>` muestra "No encontramos este evento" (barrera correcta). El código HTTP se anota en CRIT-005 (con `loading.tsx` Next puede responder 200 en streaming); el paquete de seguridad (carril 1) evalúa el status.
- **Notificación STAFF_ASSIGNED:** el código actual genera la ruta correcta `/staff/events/<id>` (verificado en CRIT-005); la ruta `/staff/eventos/…` sólo existe en la notificación sembrada (dato del seed).
- **Teléfonos** se normalizan a `+52XXXXXXXXXX` en lead y clienta (configurador) — correcto, documentado en CRIT-001.
- **Radix RadioGroup (configurador):** las flechas mueven y seleccionan como dicta el patrón WAI-ARIA siempre que la tecla se sostenga como lo hace una persona; con `press` instantáneo de Playwright no selecciona (artefacto de prueba corregido en A11Y-021, no es bug).
- **Rendimiento:** el recorrido CRIT-002 completo (≈10 pantallas, 3 actores) tarda ~25–35 s en build de producción local; ninguna página superó 5 s de carga en las pruebas.
- **Moderate/minor de axe:** se listan como anotación `a11y-observación` en cada prueba A11Y (ver `results.json`).
