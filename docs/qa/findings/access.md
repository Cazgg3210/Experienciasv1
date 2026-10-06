# Paquete 1 — Acceso y seguridad · Hallazgos

**Fecha:** 2026-10-06 · **Commit:** f26b1a1 · **Modo:** FULL (paquete 1/6) · **Carril:** E2E_LANE=1 (:3201, base `ivonne_rosa_e2e_l1`) + suite `ratelimit` (carril 9, :3209)
**Entorno:** TEST — build de producción local (`.next-e2e`), base local `*_e2e` re-sembrada por corrida, proveedores mock, S3 local (RustFS).
**Specs:** `tests/e2e/auth/`, `tests/e2e/permissions/`, `tests/e2e/navigation/`, `tests/e2e/api/` (+ `*.ratelimit.spec.ts`).

Resumen por severidad (IDs provisionales, reproducidos 2/2 o más con `--repeat-each=2 --retries=0`):

| ID | Severidad | Título |
|---|---|---|
| ACC-BUG-01 | CRITICAL | "Cerrar sesión" no cierra la sesión si hay requests del panel en vuelo: la cookie se re-emite y la sesión revive |
| ACC-BUG-02 | HIGH | La sesión JWT no se invalida en el servidor: la cookie copiada antes del logout sigue dando acceso (12 h, renovable) |
| ACC-BUG-03 | HIGH | `callbackUrl` con caracteres de control (`/\t/evil.example`) evade `safeCallback`: el router intenta navegar a `http://evil.example/` y la app cae en "Application error" |
| ACC-BUG-04 | LOW | Soft-404 público: `/experiencias/<slug inexistente>` responde HTTP 200 |
| ACC-BUG-05 | LOW | Seed DEMO: notificaciones con `actionUrl` a rutas inexistentes (`/admin/eventos/…`, `/staff/eventos/…`) → 404 |

Además: **ENV-01** (ENVIRONMENT ISSUE de la infraestructura paralela) y observaciones UX/a11y/seguridad al final.

---

## ACC-BUG-01 — "Cerrar sesión" no cierra la sesión si hay requests del panel en vuelo (la sesión revive)

**Severity:** CRITICAL
**Priority:** P0
**Status:** Open
**Type:** POTENTIAL SECURITY ISSUE
**Module:** auth (logout) / middleware
**Role:** OWNER (aplica a cualquier rol del equipo: SUPER_ADMIN, OWNER, STAFF)
**Environment:** TEST — build de producción local :3201, base ivonne_rosa_e2e_l1, commit f26b1a1
**Reproducible:** Sí (7/7 con la prueba determinista [3 + 2 de reproducción + 2 de la corrida final]; la variante natural de una pestaña falló 3 de 6 logouts)
**Test:** [AUTH-032] tests/e2e/auth/session.spec.ts (también visto en la variante natural de [AUTH-020]/[AUTH-021]/[AUTH-025] antes de esperar `networkidle`)

### Preconditions
Usuaria del equipo con sesión iniciada; el panel tiene requests en curso (navegación/prefetch del router de Next, otra pestaña del panel abierta, etc.). Es lo normal: el sidebar dispara ~20 prefetch RSC al cargar cada página.

### Steps to reproduce
1. Iniciar sesión como OWNER y abrir `/admin/leads` en dos pestañas.
2. En la pestaña 2 hay navegación/prefetch del panel en curso (la prueba lo hace con `fetch('/admin/customers', {headers:{RSC:'1'}})` consecutivos durante 4 s).
3. En la pestaña 1 pulsar **Cerrar sesión** (sidebar).
4. Ir a `/admin/customers`.

Variante natural (una pestaña): entrar a `/admin/leads` y pulsar **Cerrar sesión** antes de que terminen los prefetch del sidebar/listado → en ~50 % de los intentos el navegador termina de nuevo en `/admin` (el `/login` detecta sesión y redirige) o queda en `/login` con la cookie de sesión presente.

### Expected result
Tras "Cerrar sesión" no queda cookie de sesión válida y cualquier página privada redirige a `/login`.

### Actual result
`POST /api/auth/signout` responde `Set-Cookie: authjs.session-token=; Max-Age=0`, pero las respuestas de requests que salieron ANTES del logout llegan después con `Set-Cookie: authjs.session-token=<JWT nuevo>` (el middleware de Auth.js re-emite la cookie en cada request). El navegador guarda la cookie re-emitida: la sesión revive y `/admin/customers` carga con datos (200). La persona cree haber cerrado sesión; quien use ese navegador después entra al panel con su rol.

### Evidence
- trace/screenshot/video: `test-results/l1/artifacts/auth-session-Logout-y-sesi-ead15-o-la-sesión-NO-debe-revivir-chromium/` (y `…-retry1/`)
- Variante natural (una pestaña, sin manipulación) — red extraída del trace de la corrida exploratoria de [AUTH-020] (el artefacto se reemplazó en corridas posteriores; extracto): `07:01:25.178 POST /api/auth/signout 200 set-cookie: authjs.session-token=; Max-Age=0` → `GET /admin/leads/<id>?_rsc=… 200 set-cookie: authjs.session-token=eyJhbGciOiJkaXIi…` (prefetch que salió antes del logout) → `GET /login 200` → `GET /?_rsc=… 200 set-cookie: authjs.session-token=eyJ…` (ya en `/login`, con la sesión revivida). En [AUTH-025] la misma carrera llevó a la persona de `/login` de vuelta a `/admin`.
- Anotaciones de la corrida final: "pestaña 2: 105 requests; estados tras el logout: 200" y "cookie de sesión tras logout: PRESENTE (sesión revivida)"; `page.goto('/admin/customers')` → URL final `/admin/customers` (esperado `/login`).
- Base: `select active, role from "User" where email='<cuenta de prueba>'` → `true | OWNER` (no hay ningún estado de sesión en servidor que el logout pueda invalidar).

### Console errors
Ninguno.

### Network errors
Ninguno (todas las respuestas 200; el problema es el `Set-Cookie` tardío).

### Technical analysis
- `src/middleware.ts:16` envuelve todo con `auth((req) => …)` de Auth.js v5: con estrategia JWT cada request que coincide con el matcher (incluidos los prefetch `?_rsc=`) devuelve la cookie de sesión re-codificada (renovación deslizante).
- `src/components/admin/admin-shell.tsx:161` y `src/components/staff/staff-shell.tsx:38` cierran sesión desde el cliente (`signOut` de `next-auth/react`) sin cancelar ni invalidar los requests en curso.
- `src/server/auth/session.ts:21-31` (`getCurrentUser`) revalida `active` y `role`, pero no existe ninguna marca de "sesión revocada": cualquier JWT válido firmado antes del logout se acepta.

### Suspected root cause
Sesión 100 % stateless (JWT 12 h, `src/auth.config.ts:12`) + re-emisión de la cookie en cada respuesta del middleware ⇒ el logout sólo borra la cookie del navegador y cualquier respuesta tardía la vuelve a escribir.

### Recommended fix
1. Revocación en servidor: agregar a `User` un `sessionVersion` (o `sessionsValidAfter`), incluirlo en el JWT en el callback `jwt` y compararlo en `getCurrentUser` (y en el middleware si se quiere cortar antes). Cerrar sesión = incrementar la versión en servidor (Server Action `logoutAction`) + borrar cookie. Requiere cambio de `prisma/schema.prisma` (coordinar).
2. Mientras tanto (mitigación parcial): no re-emitir la cookie en requests de prefetch/RSC, y hacer el logout con navegación completa a un endpoint de servidor que responda `Clear-Site-Data: "cookies"` y redirija a `/login`.
3. Mantener [AUTH-032] como prueba `@regression`.

---

## ACC-BUG-02 — La sesión no se invalida en el servidor: la cookie copiada antes del logout sigue dando acceso

**Severity:** HIGH
**Priority:** P1
**Status:** Open
**Type:** POTENTIAL SECURITY ISSUE
**Module:** auth (sesión)
**Role:** OWNER (cualquier rol del equipo)
**Environment:** TEST — build de producción local :3201, base ivonne_rosa_e2e_l1, commit f26b1a1
**Reproducible:** Sí (≥ 4/4: 2 de reproducción + 2 de la corrida final con reintento)
**Test:** [AUTH-025] tests/e2e/auth/session.spec.ts

### Preconditions
Usuaria del equipo con sesión iniciada; alguien obtuvo una copia de su cookie `authjs.session-token` (equipo compartido, extensión maliciosa, respaldo del perfil del navegador, etc.).

### Steps to reproduce
1. Login como OWNER (cuenta propia de la prueba) y copiar el valor de `authjs.session-token`.
2. Pulsar **Cerrar sesión** (se espera `networkidle` para descartar ACC-BUG-01): la cookie desaparece del navegador.
3. Desde otro cliente: `GET /admin/customers` con `Cookie: authjs.session-token=<valor copiado>`.

### Expected result
307 a `/login` (la sesión cerrada ya no autoriza; OWASP ASVS 3.3.1).

### Actual result
`200` con el listado de clientas. La cookie sigue válida hasta 12 h y, como el middleware la renueva en cada request, puede mantenerse indefinidamente mientras se use. Sólo la desactivación y el cambio de rol cortan el acceso de una sesión abierta ([AUTH-027]/[AUTH-028] en PASS). Por el mismo diseño es previsible que un restablecimiento de contraseña tampoco cierre las sesiones abiertas (inferido del código, NOT TESTED).

### Evidence
- `test-results/l1/artifacts/auth-session-Logout-y-sesi-5b4d6-ie-anterior-deja-de-servir--chromium/` (trace, screenshot, video) y `…-retry1/`.
- Anotación: `GET /admin/customers con cookie previa al logout → 200`.

### Console errors
Ninguno.

### Network errors
Ninguno.

### Technical analysis
`src/auth.config.ts:12` (`strategy: "jwt", maxAge: 12 h`), `src/server/auth/session.ts:21-31` (sin verificación de revocación). El logout (`signOut` cliente) sólo expira la cookie local.

### Suspected root cause
Misma causa raíz que ACC-BUG-01 (sin estado de sesión en servidor).

### Recommended fix
La misma revocación por `sessionVersion` de ACC-BUG-01; incrementarla también al restablecer contraseña (`src/features/users/server/user-service.ts` `resetUserPassword`, `src/features/staff/server/staff-service.ts` `resetStaffPassword`) y al desactivar.

---

## ACC-BUG-03 — `callbackUrl` con caracteres de control evade `safeCallback`: navegación a origen externo intentada y "Application error"

**Severity:** HIGH
**Priority:** P1
**Status:** Open
**Type:** POTENTIAL SECURITY ISSUE (bypass del filtro anti open-redirect)
**Module:** auth (login)
**Role:** cualquier persona del equipo que abra un enlace de login manipulado
**Environment:** TEST — build de producción local :3201, base ivonne_rosa_e2e_l1, commit f26b1a1
**Reproducible:** Sí (≥ 4/4 en Chromium: 2 de reproducción + 2 de la corrida final; también en WebKit)
**Test:** [AUTH-049] tests/e2e/auth/callback.spec.ts

### Preconditions
Cuenta del equipo válida. El atacante envía el enlace `/login?callbackUrl=%2F%09%2Fevil.example`.

### Steps to reproduce
1. Abrir `/login?callbackUrl=%2F%09%2Fevil.example` (`/` + TAB + `/evil.example`).
2. Iniciar sesión con credenciales válidas.

### Expected result
El `callbackUrl` se descarta (no es una ruta interna limpia) y la persona llega a `/admin`.

### Actual result
`safeCallback` lo acepta (empieza con `/` y el 2.º carácter es TAB). El servidor responde `x-action-redirect: http://localhost:3201/<TAB>/evil.example;push`; el navegador elimina el TAB al parsear la URL ⇒ ruta `//evil.example` (protocol-relative). El router de Next intenta `history.pushState('http://evil.example/')`; Chromium/WebKit lo bloquean con `SecurityError` y la app queda en **"Application error: a client-side exception has occurred"** (la sesión sí se creó). No se observó navegación efectiva a `evil.example` en Chromium ni WebKit: la protección final es del navegador, no de la app.

### Evidence
- `test-results/l1/artifacts/auth-callback-callbackUrl--caacc-no-redirige-fuera-de-la-app-chromium/` (trace, screenshot, video) y `…-retry1/`.
- Red: `POST /login?callbackUrl=%2F%09%2Fevil.example 303 x-action-redirect: http://localhost:3201/	/evil.example;push`.

### Console errors
`SecurityError: Failed to execute 'pushState' on 'History': A history state object with URL 'http://evil.example/' cannot be created in a document with origin 'http://localhost:3201'…`

### Network errors
Ninguno.

### Technical analysis
`src/features/auth/server/actions.ts:17-22` sólo rechaza `//` y `/\` literales; los navegadores eliminan TAB/CR/LF de las URL (WHATWG URL), así que `/\t/x` se convierte en `//x`. El `redirect` por defecto de Auth.js también lo acepta (empieza con `/`).

### Suspected root cause
Validación por prefijo de cadena en lugar de normalizar la URL.

### Recommended fix
En `safeCallback`: rechazar cualquier carácter de control o espacio (`/[\u0000-\u001F\u007F\s\\]/`), y validar con `const u = new URL(url, "http://x"); if (u.origin !== "http://x" || u.pathname.startsWith("//")) return null; return u.pathname + u.search;`. Agregar `callbacks.redirect` en `src/auth.config.ts` con la misma regla (defensa en profundidad).

---

## ACC-BUG-04 — Soft-404 en el sitio público: `/experiencias/<slug inexistente>` responde HTTP 200

**Severity:** LOW
**Priority:** P3
**Status:** Open
**Type:** APPLICATION BUG (SEO)
**Module:** public (catálogo)
**Role:** Anónimo
**Environment:** TEST — build de producción local :3201, base ivonne_rosa_e2e_l1, commit f26b1a1
**Reproducible:** Sí (≥ 4/4: 2 de reproducción + 2 de la corrida final con reintento)
**Test:** [NAV-002] tests/e2e/navigation/not-found.spec.ts

### Preconditions
Ninguna.

### Steps to reproduce
`curl -i http://localhost:3201/experiencias/no-existe-e2e`

### Expected result
HTTP 404 con la página "Esta mesa ya no está puesta".

### Actual result
HTTP 200 con el contenido 404 (y 3 `<meta name="robots" content="noindex">` duplicados). Para buscadores/monitoreo es un soft-404. Las rutas por token (`/cotizacion`, `/mi-evento`, `/e`, `/memory`, `/pago`) y las rutas sin match sí responden 404 real.

### Evidence
- `test-results/l1/artifacts/navigation-not-found-404-N-2cb36-404-y-HTTP-404-no-soft-404--chromium/` y `…-retry1/`; anotación `HTTP 200 para /experiencias/no-existe-e2e`.

### Console errors
Ninguno.

### Network errors
Ninguno.

### Technical analysis / Suspected root cause
`src/app/(public)/experiencias/[slug]/loading.tsx` envuelve la página en Suspense: el `notFound()` de `page.tsx:62` (y de `generateMetadata`, `page.tsx:46`) ocurre después de iniciar el streaming, cuando el status 200 ya se envió (comportamiento conocido de Next 15.5).

### Recommended fix
Resolver la existencia del slug antes del límite de Suspense (quitar `loading.tsx` de ese segmento o mover la consulta + `notFound()` a un `layout.tsx` del segmento sin Suspense).

---

## ACC-BUG-05 — Seed DEMO: notificaciones con enlaces a rutas inexistentes (`/admin/eventos/…`, `/staff/eventos/…`)

**Severity:** LOW
**Priority:** P3
**Status:** Open
**Type:** DATA ISSUE (seed de la app)
**Module:** notifications (bandeja mock) / seed
**Role:** Owner (bandeja) · Staff (enlace de WhatsApp)
**Environment:** TEST — build de producción local :3201, base ivonne_rosa_e2e_l1, commit f26b1a1
**Reproducible:** Sí (≥ 4/4: 2 de reproducción + 2 de la corrida final con reintento)
**Test:** [NAV-015] tests/e2e/navigation/links.spec.ts

### Steps to reproduce
1. `select type, "actionUrl" from "NotificationLog" where "actionUrl" like '%/eventos/%'` → 2 filas: `QUOTE_ACCEPTED http://localhost:3000/admin/eventos/<id>` y `STAFF_ASSIGNED http://localhost:3000/staff/eventos/<id>`.
2. Abrir esas rutas con la sesión correspondiente.

### Expected result
Los enlaces de acción de la bandeja abren el evento.

### Actual result
404 en ambas (las rutas reales son `/admin/events/<id>` y `/staff/events/<id>`). El código de la app genera bien sus enlaces (`src/features/operations/server/assignment-service.ts:167` usa `/staff/events/`); sólo el seed está mal. Además el `actionUrl` del seed usa el host de `APP_URL` del seed (`localhost:3000`).

### Evidence
`test-results/l1/artifacts/navigation-links-Enlaces-i-9d72f--apuntan-a-rutas-existentes-chromium/` (resultado: `QUOTE_ACCEPTED → 404 /admin/eventos/…`, `STAFF_ASSIGNED → 404 /staff/eventos/…`).

### Suspected root cause / Recommended fix
`prisma/seed-data/demo-activity.ts:85` y `:102`: cambiar `eventos` por `events`.

---

## ENV-01 — (ENVIRONMENT ISSUE) La Data Cache de Next se comparte entre carriles y sobrevive a la re-siembra

**Type:** ENVIRONMENT ISSUE (infraestructura del gate paralelo) · **Impacto en este paquete:** [NAV-010] (anotado y tolerado: 422 del beacon de analítica).

`unstable_cache` (catálogo del configurador `configurator-catalog-v1` revalidate 60 s; catálogo/ficha de experiencias `marketing:*` revalidate 300 s) se guarda en `.next-e2e/cache/fetch-cache`, **compartido por todos los carriles** (cada uno con su base y sus IDs) y no se limpia al re-sembrar. Observado: `/experiencias/bridal-brunch` en el carril 1 sirve `experienceId = cmuwcuctk006fqmz0t3sck5gd` (de otra base/siembra) mientras la base del carril tiene `cmuwc4w2s006fqmtcbxr6lhl0` ⇒ el beacon `/api/analytics/track` responde 422 `unknown_experience` (2/2).
**Riesgo para otros paquetes:** el configurador (carril 2) puede recibir IDs de experiencia/add-ons de otra base y fallar al estimar o enviar. **Corrección sugerida (infra):** dist/cache por carril (copiar `.next-e2e` a `.next-e2e-l<n>` o `cacheHandler` con directorio por carril) o borrar `fetch-cache` en el arranque de cada carril y no correr carriles en paralelo sobre la misma caché.

---

## Observaciones (no son bug) — UX, accesibilidad, seguridad y rendimiento

**Seguridad / diseño**
- Superficie expuesta por co-ubicación de acciones: la página pública `/memory/[token]` incluye las 7 acciones de administración de la cápsula y `/staff/events/[id]` las 6 de administración de staff (Next agrega todas las exportaciones del módulo `"use server"`). Hoy las frena el RBAC de cada acción ([PERM-121..127], [PERM-130..138] en PASS), pero conviene separar acciones públicas y de admin en módulos distintos.
- `src/server/action.ts:71-74`: la validación Zod corre ANTES de la autorización ⇒ un anónimo que llama una acción protegida con datos inválidos recibe `VALIDATION_ERROR` con los mensajes de campo (revela el esquema). Recomendación: autenticar/autorizar antes de validar en `protectedAction`.
- Rate limit de login sólo por correo (`src/auth.ts:39`): cualquiera puede bloquear 15 min una cuenta conocida con 9 intentos ([AUTH-061]). Considerar límite combinado correo+IP y desbloqueo por admin.
- `clientIp()` (`src/lib/rate-limit.ts:55`) confía en `X-Real-Ip` si llega: correcto detrás de Traefik (que la sobreescribe), pero si la app se expone sin proxy los límites por IP se evaden variando esa cabecera. Documentar el requisito en DEPLOY.
- Documentación desalineada: `docs/SECURITY.md` dice `Referrer-Policy: no-referrer` en páginas por token; el middleware envía `same-origin` ([PERM-170] PASS) y `/cotizacion/[token]` además declara `<meta name="referrer" content="no-referrer">` (`page.tsx:43`), que en el documento anula la cabecera; el comentario del middleware advierte que `no-referrer` puede dejar `Origin: null` en los POST de Server Actions. El paquete 2 debe confirmar que aceptar/rechazar cotización funciona en todos los navegadores.
- Con sesión abierta, `/login?callbackUrl=/admin/leads` ignora el `callbackUrl` y lleva al inicio del rol (UX menor).
- CSRF en Server Actions ([PERM-159] PASS): con `Origin` ajeno Next rechaza la acción (no escribe), pero responde **HTTP 500** con `digest` en lugar de un 4xx (comportamiento de Next 15.5; ensucia logs/alertas de 5xx).
- STAFF promovida a OWNER con sesión abierta sigue en `/staff` hasta re-login (el middleware usa el rol del JWT) — sin riesgo (menos privilegio), sólo UX ([AUTH-029]).

**Accesibilidad / UX**
- `/admin/quotes/[id]/print`: la vista de impresión no tiene ningún encabezado (`h1`–`h6`); el título del documento es un `<p>`.
- Not-found de lead (`/admin/leads/<id inexistente>`): el único encabezado es un `h3` ("Este lead no existe"); falta `h1`.
- Una URL inexistente dentro de `/admin` muestra el 404 raíz sin el shell del panel ([NAV-003]); sólo los `notFound()` de detalle usan el 404 del panel.
- `notFound()` en detalles del panel responde HTTP 200 (streaming bajo `loading.tsx`) — panel con sesión y `noindex`, sin impacto de seguridad ([NAV-004], comportamiento conocido).
- Páginas 404 con 3 `<meta name="robots">` duplicados.

**Rendimiento**
- Sin observaciones > 5 s. Las 83 páginas de la matriz cargan con el rol principal en ~1–2 s cada una en el build local.

**Infraestructura compartida (para el orquestador)**
- `tests/e2e/fixtures/guard.ts`: la lista `BENIGN` no cubre el ruido de WebKit al cancelar prefetch (`Load failed`, `Fetch API cannot load … due to access control checks`, `Failed to fetch RSC payload … Falling back to browser navigation`) ⇒ en `E2E_CROSS_BROWSER=1` cualquier prueba que navegue rápido en el panel falla en WebKit por ruido.
- Firefox no arranca en esta máquina (`browserType.launch: spawn UNKNOWN`) ⇒ cross-browser en Firefox BLOCKED (ENVIRONMENT ISSUE).
- `--reporter=line` en la CLI reemplaza los reporters del config y NO se escribe `results.json`: conviene advertirlo en el runbook.
- El scratchpad de la sesión es compartido entre carriles (otros agentes escriben `run.log`, `pw.sh`…); usé `scratchpad/l1/`.
