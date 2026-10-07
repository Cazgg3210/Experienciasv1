# BUG REPORT — Ivonne & Rosa (auditoría FULL E2E)

- **Fecha:** auditoría 2026-10-06 · estado final 2026-10-07
- **Auditoría inicial:** commit `f26b1a1` (FULL; sin cambios de código de la app durante la auditoría). La infraestructura del gate (ENV-01, ENV-02) se corrigió en `8020b91`.
- **Correcciones verificadas en main:** `8020b91..b47437b` (61 commits)
  - Ronda 1 (16 bugs, cada uno en un worktree aislado con revisión adversarial): merges `d144ce7`, `be74647`, `880e40b`, `3964907`, `a1ece90` y `41db385`, más `86b60de` (contratos de integración devops/CSRF y sello del build E2E con archivos sin seguimiento).
  - Endurecimiento (menores de las revisiones; BUG-017, BUG-018, BUG-020, BUG-022, BUG-023 y la parte de la cápsula de BUG-021): merges `f8797e0`, `f0cb1b1`, `e21eb66` y `c3ba279`.
  - Formularios antes de hidratar: `e2f3699` (el resto de BUG-021), `d96a82a` (BUG-019) y `b47437b` (ajuste de tiempos de CONF-025).
- **Modo:** FULL (6 paquetes: acceso y seguridad · venta pública · comercial admin · eventos y experiencia · operación y back-office · transversal)
- **Entorno:** TEST — build de producción local (`.next-e2e`, `next start`, Next 15.5.27), proveedores mock (pagos, email, WhatsApp, IA), S3 local (RustFS `:9000`), Windows 11.
  - Auditoría: 6 carriles paralelos (`E2E_LANE=1..6`, servidores `:3201`–`:3206`, bases `ivonne_rosa_e2e_l1`…`_l6` re-sembradas en cada invocación; suites especiales `global` y `ratelimit` en `:3209`). Navegadores: Chromium, mobile-chrome y WebKit; Firefox BLOCKED (ENV-02).
  - Correcciones: cada worktree usó su propio carril; la verificación de formularios usó además los carriles 7 y 8.
  - Regresión final: carriles en secuencia (ENV-03), con Firefox.
- **Fuentes:** `docs/qa/findings/{access,sales,commercial,events,operations,transversal}.md` (31 hallazgos provisionales y sus secciones «Resolution/Fix/Corrección/Seguimiento»), mapa `docs/qa/.bug-map.json` y los journals de los workflows de corrección (ronda 1 `wf_8b97ab93-ecc`, endurecimiento `wf_4e68bc69-ce5`, formularios `wf_df44b95a-fe8` y `wf_06aaa044-1a2`). La evidencia citada como `test-results/l<n>-evidence/…` está en el worktree de cada corrección (`.claude/worktrees/wf_…/`, no versionada).

> **Estado final.** Los **23 bugs** (16 de la auditoría y 7 encontrados y corregidos durante las correcciones) están **Verified**: la prueba de reproducción falló antes de corregir y pasa después (repeticiones con `--retries=0`), y la regresión relacionada está en verde. BUG-006 queda **Verified (mitigado)**: el defecto está en el React que trae Next 15.5 y la app lo esquiva hasta actualizar a Next ≥ 16.3.0. **Bugs abiertos: 0.**
> Regresión intermedia: 1 286 de 1 298 PASS. Regresión final, secuencial y con todos los navegadores: carriles 1, 2, 3 y 6 al 100 %. En los carriles 4 y 5 quedan inestabilidades de Firefox/WebKit (última corrida registrada: EVT-005, PUR-002, PUR-005 y STF-003 en Firefox; FIN-006 y STF-021 en WebKit) que se están corrigiendo en paralelo y todavía no están clasificadas; si alguna resulta un defecto de la app se registrará como bug nuevo. El veredicto lo calcula `scripts/quality-gate.mjs`, no este documento.

## Resumen por severidad

| Severidad | Encontrados | Abiertos | Bugs |
|---|---|---|---|
| BLOCKER | 0 | 0 | — |
| CRITICAL | 3 | 0 | BUG-001, BUG-002, BUG-003 |
| HIGH | 4 | 0 | BUG-004, BUG-005, BUG-006 (mitigado), BUG-017 |
| MEDIUM | 9 | 0 | BUG-007, BUG-008, BUG-009, BUG-010, BUG-011, BUG-018, BUG-019, BUG-020, BUG-024 |
| LOW | 8 | 0 | BUG-012, BUG-013, BUG-014, BUG-015, BUG-016, BUG-021, BUG-022, BUG-023 |
| **Total** | **24** | **0** | 16 de la auditoría (31 IDs provisionales de 6 carriles, deduplicados) + 8 nuevos (BUG-017…BUG-024) |

| BUG | Severidad | Prioridad | Estado | Título | Módulo | Corrección |
|---|---|---|---|---|---|---|
| BUG-001 | CRITICAL | P0 | Verified | «Cerrar sesión» no es definitivo: las respuestas en vuelo re-emiten la cookie y no hay revocación en servidor | auth | `b24c695`, `28fb8d3` |
| BUG-002 | CRITICAL | P0 | Verified | Un checkout de anticipo abierto se puede cobrar después de cancelar el evento | events / payments | `78573ad`, `568d92d`, `445645c` |
| BUG-003 | CRITICAL | P0 | Verified | Link general de invitación: el nombre de otra invitada sobrescribe su RSVP y entrega su link personal | guests | `e8165ae`, `760e7d2` |
| BUG-004 | HIGH | P1 | Verified | Una cookie copiada antes del logout sigue dando acceso | auth | `b24c695`, `28fb8d3`, `ebb5fac` |
| BUG-005 | HIGH | P1 | Verified | `callbackUrl` con caracteres de control evade `safeCallback` | auth | `ee67039`, `28fb8d3` |
| BUG-006 | HIGH | P0 | Verified (mitigado) | Navegación a la misma ruta / `router.refresh()` colgada (filtros, paginación, calendario, contenido, bandeja, RSVP) | transversal (App Router) | `5fc2435`, `b15324a`, `be55029`, `d87814d` |
| BUG-007 | MEDIUM | P2 | Verified | Checkout concurrente crea dos pagos PENDING | payments | `0f4ef49`, `568d92d`, `445645c` |
| BUG-008 | MEDIUM | P2 | Verified | Teléfonos con formatos distintos duplican a la clienta | leads / customers | `75085d4`, `fcef8a7`, `fe9f23a` |
| BUG-009 | MEDIUM | P2 | Verified | Contraste insuficiente (warning/info, taupe, atenuados) | UI compartida | `cf3e12d`, `50d2903` |
| BUG-010 | MEDIUM | P2 | Verified | `<dl>` inválidas en propuesta pública y micrositio | quotes / guests | `7173e13` |
| BUG-011 | MEDIUM | P2 | Verified | `aria-controls` de «Agregar nota» apunta a un id inexistente | staff | `e813c1c` |
| BUG-012 | LOW | P3 | Verified | El diálogo «Aceptar propuesta» no devuelve el foco | quotes | `f35fb04` |
| BUG-013 | LOW | P3 | Verified | Soft-404 en `/experiencias/[slug]` | public | `a8ca093`, `4a7a780` |
| BUG-014 | LOW | P3 | Verified | Lead manual con «Origen» ≠ «Captura manual» envía avisos | leads | `cf05a32` |
| BUG-015 | LOW | P3 | Verified | El encabezado del evento no muestra «Cerrado» | finance / events | `d38e91e` |
| BUG-016 | LOW | P3 | Verified | Seed DEMO con enlaces a `/…/eventos/…` (404) | notifications / seed | `af52434` |
| BUG-017 | HIGH | P1 | Verified | Una captura pública escribía el contacto de la visitante en una clienta existente (sus enlaces privados podían llegarle a otra persona) | leads / customers | `fe9f23a` |
| BUG-018 | MEDIUM | P1 | Verified | Eliminar una ficha de staff desactivaba la cuenta ligada sin las reglas de Usuarios | staff / users | `ebb5fac` |
| BUG-019 | MEDIUM | P1 | Verified | Formularios públicos y por token enviables por GET antes de hidratar, con datos personales en la URL | guests / portal / configurator | `d96a82a`, `b47437b` |
| BUG-020 | MEDIUM | P1 | Verified | Firefox: error de hidratación React #418 cuando el chunk de `error.tsx` llega tarde | layouts (transversal) | `a3309b7` |
| BUG-021 | LOW | P2 | Verified | Lo escrito antes de hidratar se borraba en formularios públicos y del portal | memory / marketing / guests / portal / ai-designer | `0e35e58`, `e2f3699` |
| BUG-022 | LOW | P3 | Verified | Restablecer la propia contraseña desde Staff revocaba la sesión en silencio | staff | `ebb5fac` |
| BUG-023 | LOW | P3 | Verified | `GET /api/auth/session` re-emitía la cookie de sesión (latente) | auth | `28fb8d3` |
| BUG-024 | MEDIUM | P2 | Verified | Firefox: etiquetas, descripciones y `aria-controls` desligados cuando el `useId` del cliente difiere del HTML del servidor | formularios (transversal) | `4b79477`, `412c035` |

**Criterios de consolidación (auditoría).** Cuando dos carriles vieron el mismo defecto se conserva la severidad más alta justificada por la regla del gate (seguridad o datos de terceros ⇒ CRITICAL; cobro indebido ⇒ CRITICAL). Reclasificaciones respecto a los IDs provisionales: SAL-BUG-03 (HIGH) y TRV-BUG-06 (HIGH) suben a CRITICAL al fusionarse con EVX-BUG-01 y ACC-BUG-01; COM-BUG-03 y OPX-BUG-02 (MEDIUM) se integran en BUG-006 (HIGH); SAL-BUG-04 (LOW) se integra en BUG-009 (MEDIUM); EVX-BUG-05 y TRV-BUG-04 (LOW) se integran en BUG-010 (MEDIUM). La parte de contraste de OPX-BUG-05 se documenta en BUG-009; el ID se asigna a BUG-011 según el mapa.

**Criterios para los bugs nuevos (BUG-017…BUG-023).** Se registran como bug propio los defectos reales que ya existían en `f26b1a1` o que una corrección introdujo y que tienen causa raíz distinta de su bug padre; los que una corrección introdujo y su revisión detectó dentro del mismo mecanismo se documentan en el «Fix» del bug padre. Así:
- **Bugs propios:** la fuga de contacto en capturas públicas (BUG-017, existía en `f26b1a1`; la búsqueda tolerante de BUG-008 sólo la ampliaba), `deleteStaffMember` (BUG-018), el envío por GET (BUG-019), el #418 de Firefox (BUG-020), el borrado antes de hidratar (BUG-021, antes sólo una observación), el auto-reset de Staff (BUG-022, lo introdujo la corrección de BUG-004 pero en otro flujo) y `/api/auth/session` (BUG-023).
- **Dentro del bug padre:**
  - BUG-002: la carrera webhook↔cancelación que introdujo su primera corrección, y las sesiones de proveedores reales pagables tras cancelar (ya descritas en el «Actual result» original).
  - BUG-007: el candado retenido durante la llamada al proveedor.
  - BUG-008: `normalizePhone` con longitudes equivocadas, el normalizador duplicado, las búsquedas por teléfono y la carrera de capturas simultáneas.
  - BUG-003: el criterio de «Posible duplicado», el canal lateral de tiempo y el flujo de la anfitriona.
  - BUG-006: el esqueleto infinito al volver con Atrás, que introdujo su primera mitigación.
  - BUG-009: el contraste restante.
  - BUG-013: el contrato del 404.

---

## BUG-001 — «Cerrar sesión» no es definitivo: las respuestas en vuelo re-emiten la cookie y no hay revocación en servidor

**Severity:** CRITICAL
**Priority:** P0
**Status:** Verified
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

### Fix

**Causa raíz final.** Sesión JWT 100 % stateless y re-emisión de `Set-Cookie: authjs.session-token` por el envoltorio `auth()` del middleware en **cada** respuesta autenticada, incluidos los prefetch RSC y las Server Actions. Una respuesta en vuelo que llegaba después de `POST /api/auth/signout` volvía a escribir la cookie borrada y, sin estado en el servidor, esa cookie era plenamente válida.

**Corrección.**
1. **Revocación en servidor.** Se agregó `User.sessionVersion Int @default(0)` con la migración aditiva `prisma/migrations/20261006140000_user_session_version` (`ADD COLUMN … NOT NULL DEFAULT 0`). Los JWT emitidos antes del despliegue cuentan como versión 0, así que nadie pierde la sesión al desplegar.
   - `authorize` guarda la versión en el JWT y `getCurrentUser` (`src/server/auth/session.ts`) la compara con la base.
   - El logout incrementa la versión desde el evento `events.signOut` de Auth.js (`src/auth.ts`). Ese evento corre en `/api/auth/signout`, el endpoint que ya usan los botones de `admin-shell` y `staff-shell`.
   - El incremento es un comparar-e-incrementar atómico (`src/features/auth/server/session-service.ts`): una cookie ya revocada no puede cerrar sesiones más nuevas.
2. **Fin de la «resurrección».** `src/middleware.ts` ya no deja pasar la re-emisión de la cookie. Sólo renueva el JWT en `GET` cuando tiene al menos `session.updateAge` (1 h), y conserva los borrados. Las reglas puras están en `src/features/auth/domain/session.ts`, con pruebas unitarias.
3. **Desviación del diseño sugerido.** No se usó una Server Action de logout: su POST pasa por el middleware, Next re-renderiza la página con la cookie vieja y la navegación suave dejaría payloads privados en el caché del router (lo que vigila [AUTH-021]).
4. **Endurecimiento** (revisión adversarial):
   - `revokeSessionsOnSignOut` registra `auth.logout_revocation_failed` con nivel error y propaga el error.
   - La renovación tiene cobertura automatizada con JWT forjados (`tests/e2e/auth/session-renewal.spec.ts`).
   - `GET /api/auth/session` dejó de re-emitir la cookie (BUG-023).

**Commits.** `b24c695` (merge `d144ce7`); endurecimiento `28fb8d3` (merge `c3ba279`).

**Pruebas @regression.**
- [AUTH-032] tests/e2e/auth/session.spec.ts.
- [CRIT-014] y [CRIT-012] tests/e2e/critical/access.spec.ts.
- [AUTH-053], [AUTH-054], [AUTH-055], [AUTH-056] y [AUTH-058] tests/e2e/auth/session-renewal.spec.ts. [AUTH-057] cubre la cookie inválida, sin etiqueta.
- CRIT-009/011/012/014 usan ahora cuentas propias porque el logout revoca todas las sesiones de la cuenta.
- En CRIT-014, la precondición «el servidor re-emite la cookie» pasó a ser el assert de la corrección. Además verifica que la cookie anterior al logout, si reapareciera, ya no abre el portal.

**Verificación.**
- **Antes** (carril 1): AUTH-032 y CRIT-014 FAIL. CRIT-012 pasó en esa corrida porque su carrera es probabilística. Evidencia en `test-results/l1-evidence/BUG-001/`.
- **Después:** AUTH-032, CRIT-014 y CRIT-012 pasan 3/3 con `--repeat-each=3 --retries=0` en Chromium. También pasan 3/3 CRIT-014 y AUTH-032 en WebKit y CRIT-012 en mobile-chrome. La repetición cross-browser dio 47/47.
- **Regresión del carril 1** (auth, permissions, critical/access, staff-admin y settings): 228 PASS y 2 FLAKY ajenos. SET-001 corresponde a BUG-006; SET-017 era un TEST BUG, corregido en `96bf311` y luego 3/3. Suite global 14/14 y ratelimit 9/9.
- **Endurecimiento** (carril 4): AUTH-053…059 pasan 5/5 con `--repeat-each=5 --retries=0`. Una mutación del middleware sin renovación hace fallar AUTH-053/054.

**Riesgos residuales y decisiones.**
- **Decisión de producto pendiente:** cerrar sesión revoca **todas las sesiones de la cuenta en todos los dispositivos**, porque la versión es por usuaria. Si Rosa cierra sesión en el celular, también pierde la de la laptop y lo que no haya guardado. Ningún texto de la UI lo avisa. La alternativa por dispositivo es revocar por `jti`/`sid` con una lista de revocadas hasta `exp` y dejar `sessionVersion` para reset, desactivación y cambio de rol. Requiere un cambio de esquema y la decisión del usuario.
- **El logout «falla abierto» si la base falla.** Auth.js registra el error y borra la cookie de todos modos. Ahora queda un log de error alertable, pero una cookie copiada seguiría válida hasta 12 h. Hacer que el logout falle exigiría reemplazar el flujo `/api/auth/signout` de Auth.js.
- **Renovación deslizante con granularidad de 1 h** (hasta 12 h de inactividad). Un GET con un JWT de 1 h o más todavía puede re-escribir la cookie después del logout, pero esa cookie ya está revocada en el servidor.
- **Cuentas DEMO en E2E:** ya no sirven para probar el logout, porque sus sesiones compartidas (`storageState`) morirían.

---

## BUG-002 — Un checkout de anticipo abierto se puede cobrar después de cancelar el evento

**Severity:** CRITICAL
**Priority:** P0
**Status:** Verified
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

### Fix

**Causa raíz final.** La cancelación no formaba parte del ciclo de vida de los pagos:
- `cancelEvent` no tocaba el `Payment` `PENDING`.
- `checkoutLinkState`, la página mock y `mockCheckoutAction` ignoraban `booking.cancelledAt` y `event.status`.
- `applyPaymentSucceeded` marcaba el pago `PAID` y `runPaymentSuccessEffects` enviaba «Recibimos tu pago».

**Corrección.**
1. **Anulación al cancelar.** `cancelEvent` llama, dentro de su transacción y con el candado de la reserva (orden reserva → evento), a `voidOpenCheckoutsForCancelledBooking`. Los pagos `DEPOSIT`, `BALANCE` y `FULL` en `PENDING` pasan a `FAILED` con el motivo «Evento cancelado.»; los `REFUND` no se tocan. La auditoría `event.cancelled` incluye `voidedPayments`.
2. **Enlace no pagable.**
   - `checkoutLinkState` (`domain/amounts.ts`) tiene un estado `cancelled`.
   - `/pago/mock/[checkoutId]` muestra «Esta reserva fue cancelada» sin botón de pago.
   - `mockCheckoutAction` responde `EVENT_CANCELLED` y no emite el webhook.
   - `startCheckout` y `recordManualPayment` vuelven a verificar la cancelación dentro del candado.
3. **Cobro tardío de un proveedor real.**
   - Se registra `PAID`, para poder reembolsarlo, **sin reconfirmar el evento**.
   - Lleva la nota «Reembolso requerido: …», la auditoría `payment.collected_after_cancellation` y `note: "cancelled_booking"` en `WebhookEvent.error`.
   - El equipo recibe un aviso deduplicado (`notifyTeamPaymentAnomaly`). La clienta no recibe `PAYMENT_RECEIVED`.
   - `/pago/resultado` y el panel de pagos lo muestran como «Reembolso requerido».
4. **Carrera que introdujo la primera corrección** (cambio exigido por la revisión, `568d92d`).
   - El problema: `applyPaymentSucceeded` leía el estado del pago antes de tomar el candado. Un webhook que leía `PENDING` mientras la cancelación anulaba el pago terminaba en `concurrent_update` y respondía 200, así que el proveedor no reintentaba. El cobro real quedaba `FAILED` sin nota, auditoría ni aviso.
   - Ahora `applyPaymentSucceeded` y `applyPaymentFailed` leen el estado **después** de `lockBooking`.
   - `handlePaymentWebhook` trata `concurrent_update` como reintentable: revierte la transacción, no marca `processedAt` y responde 500.
5. **Lo que ve la clienta.** `paymentStatusView`, compartida por `/pago/resultado` y `getPaymentStatusAction`, promete el reembolso sólo según la nota del propio pago (`collectedAfterCancellation`), no según el estado del evento.
   - Un checkout anulado dice «Este pago se anuló… si alcanzaste a completar el cobro, te lo reembolsaremos».
   - «Intentar de nuevo» se oculta, también si la cancelación ocurre mientras la página consulta el estado.
6. **Sesiones del proveedor.** Se agregó el método opcional `PaymentProvider.expireCheckout`:
   - Stripe: `POST /v1/checkout/sessions/{id}/expire`.
   - Mercado Pago: `PUT /checkout/preferences/{id}` con `expiration_date_to` igual a ahora.
   - Mock: no hace nada, porque su página ya revisa la cancelación.
   - Se llama best-effort después de confirmar la cancelación (límite de 10 s) y nunca hace fallar la cancelación. Con el checkout en dos fases (`445645c`, ver BUG-007) también expira la sesión que la pasarela abre después de que la cancelación anuló el lugar reservado.
7. **Casos históricos.** `scripts/report-cancelled-booking-payments.ts`, de sólo lectura (`pnpm exec tsx scripts/report-cancelled-booking-payments.ts [--json]`), lista los cobros con `paidAt` posterior a la cancelación. Contra la base de desarrollo no encontró filas.

**Commits.** `78573ad`, `568d92d` (merge `be74647`); endurecimiento `445645c` (merge `e21eb66`).

**Pruebas @regression.**
- [EVT-024] tests/e2e/events/event-status.spec.ts.
- [PAY-021], [PAY-023], [PAY-024] y [PAY-025] tests/e2e/payments/payments.spec.ts. [PAY-008] verifica la forma exacta de la respuesta, sin etiqueta.
- Integración `tests/integration/payments.test.ts`:
  - anulación al cancelar;
  - cancelación contra checkout y contra pago manual;
  - webhook tardío seguido de reembolso;
  - las dos órdenes de la carrera webhook↔cancelación, y `concurrent_update` reintentable;
  - expiración best-effort, y cancelación mientras se abre la sesión.

**Verificación.**
- **Antes de la ronda 1:** EVT-024 y PAY-021 FAIL (pago `PAID` en un evento `CANCELLED`).
- **Antes de `568d92d`:** también fallaban PAY-024 y PAY-025, la integración de la carrera (`applied:false`, `concurrent_update`, pago `FAILED`) y la de reintento (200 en lugar de 500).
- **Después:**
  - PAY-008, PAY-021, PAY-023, PAY-024, PAY-025 y EVT-024 pasan 3/3 en el carril 2 (`--repeat-each=3 --retries=0`) y 5/5 en el carril 3 tras el endurecimiento.
  - `payments.test.ts` pasa 40/40 (el subconjunto de carreras, 4 corridas seguidas) y 44/44 después de `445645c`.
  - `pnpm test:integration`: 324/324.
- **Regresión del carril 2** (payments, events, quote-public, portal y critical/sales; 101 pruebas): 95 PASS.
  - 4 FAIL de otros bugs entonces abiertos (BUG-009, BUG-010 y BUG-012).
  - 2 FLAKY ajenos: EVT-038 (BUG-006) y PAY-003, una caída del worker de Windows que aislada pasó 3/3.
  - `@mobile` 10/10 y `payments-flag.global` 1/1.
- **Carril 3, tras el endurecimiento:** 231/231 sin flaky.

**Riesgos residuales y decisiones.**
- **Reembolsos manuales:** el equipo reembolsa desde el panel después del aviso. El reembolso automático de cobros tardíos queda a decisión del usuario.
- `expireCheckout` sólo se probó con un `fetch` simulado, nunca contra las API reales de Stripe o Mercado Pago. Si falla, aplica la regla «Reembolso requerido».
- Una sesión que queda obsoleta por un cambio de saldo (por ejemplo, un pago manual mientras la clienta tiene abierta la pasarela) sigue cobrable hasta que vence, a la hora. El excedente se registra y se avisa al equipo.
- Después del despliegue conviene correr el script de casos históricos contra producción: los cobros anteriores a la corrección no llevan la nota.

---

## BUG-003 — Link general de invitación: escribir el nombre de otra invitada sobrescribe su RSVP y entrega su link personal

**Severity:** CRITICAL
**Priority:** P0
**Status:** Verified
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

### Fix

**Causa raíz final.** El link general re-identificaba invitadas por nombre normalizado o por email sin ningún factor de posesión (`findMatchingGuest`). Después actualizaba ese registro con el formulario del tercero y devolvía su token (`personalPath`).

**Corrección.**
- **El link general nunca toma, modifica ni revela a una invitada existente.** Cada respuesta crea una invitada `SELF_RSVP` con token propio y sólo recibe su propio link. El token personal sigue actualizando únicamente a su invitada. Se elimina `findMatchingGuest`.
- **Sin enumeración.** La respuesta es idéntica haya o no coincidencia. También desaparece el oráculo anterior, en el que con el cupo lleno un nombre coincidente sí pasaba.
- **Marca de «Posible duplicado».** Las coincidencias por nombre o email se marcan en el admin y en el portal de la anfitriona. Es una marca derivada, sin cambio de esquema. Quedan la auditoría `guest.possible_duplicate` (ids e IP) y `possibleDuplicate` en analytics.
- **Cupo y rate limit.** El cupo de 60 aplica a toda respuesta con el link general, dentro del `pg_advisory_xact_lock` del evento. El rate limit (10 por IP cada 10 min) se mantiene.
- **Aviso en el micrositio.** Con el link general, el micrositio pide a quien ya tiene link personal que responda desde ahí.
- **Endurecimiento** (`760e7d2`):
  - Se marcan los dos lados de la coincidencia, con «Coincide con «…»». Antes, si una impostora se registraba primero, la marcada era la legítima.
  - Cuando la coincidencia es un pendiente que agregó la anfitriona, el portal le indica que lo quite (`hostDuplicateHint`).
  - La auditoría se escribe dentro de la transacción, lo que reduce el canal lateral de tiempo a un INSERT en la conexión ya abierta.
  - La etiqueta y el tono viven en `@/lib/labels`.
  - [GST-024] vacía su cubeta de rate limit al empezar.

**Commits.** `e8165ae` (merge `3964907`); endurecimiento `760e7d2` (merge `e21eb66`).

**Pruebas @regression.**
- [GST-014], [GST-023] y [GST-025] tests/e2e/guests/rsvp.spec.ts.
- [GST-024] tests/e2e/guests/rsvp.ratelimit.spec.ts, en la suite `ratelimit` y sin etiqueta.
- Unitarias en `rsvp.test.ts`.
- Integración en `tests/integration/portal-rsvp.test.ts`. Las 3 pruebas que exigían la re-identificación ahora exigen lo contrario: es un cambio de requisito causado por el bug, no una prueba debilitada.

**Verificación.**
- **Antes:** GST-014 FAIL 3/3 (`--repeat-each=3 --retries=0`, carril 4).
- **Después:** GST-014 y GST-023 pasan 3/3 y GST-024 pasa. La regresión de guests, portal, critical/experience y permissions/public-actions-idor no tuvo fallas nuevas: sólo BUG-006 y BUG-010, entonces abiertos, y PORT-020, que también era intermitente en la base. `portal-rsvp`: 21/21.
- **Endurecimiento** (carril 3): GST-023 y GST-025 pasan 5/5 con `--repeat-each=5 --retries=0`. GST-024 pasa 3 veces seguidas en el mismo servidor. `portal-rsvp`: 22/22. Chromium: 231/231.

**Riesgos residuales y decisiones.**
- **Registros duplicados.** Una invitada real que ignora su link personal y responde por el general queda como un segundo registro marcado. Los conteos la cuentan dos veces hasta que la anfitriona o el equipo quitan uno.
- **Recordatorios.** No se omiten automáticamente para esos pendientes. Es una decisión: si se omitieran, quien conozca un nombre podría silenciar los recordatorios de otra invitada.
- **Texto de `hostDuplicateHint`.** Pide quitar el registro que agregó la anfitriona, que es el confiable y tiene contacto, y conservar el auto-registro. Si el auto-registro fuera una suplantación, la invitada real perdería su link. La revisión sugiere pedir antes «confírmalo con ella».
- **Canal lateral de tiempo.** Queda uno mínimo (un INSERT), acotado por el rate limit, el cupo y el registro visible.
- **Decisiones de producto pendientes:** un tope de auto-registros relativo a `guestCount` y una forma segura de recuperar un link personal perdido (enviarlo al contacto registrado). Con CGNAT, varias invitadas pueden compartir IP y cubeta.

---

## BUG-004 — La sesión no se invalida en el servidor: una cookie copiada antes del logout sigue dando acceso

**Severity:** HIGH
**Priority:** P1
**Status:** Verified
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

### Fix

**Causa raíz final.** La misma de BUG-001: no había estado de sesión en el servidor. Una copia del JWT seguía válida hasta 12 h y se renovaba, y restablecer la contraseña tampoco cerraba sesiones.

**Corrección.**
- **Más eventos revocan.** La revocación por `sessionVersion` de BUG-001 también se incrementa, en el mismo `update` que el cambio, en estos casos:
  - restablecer la contraseña (`resetUserPassword`, `resetStaffPassword`);
  - desactivar (`setUserActive`, `setStaffAccessActive` y `deleteStaffMember` con cuenta ligada);
  - cambiar el rol (`changeUserRole`).
- **Reactivar no revive** los JWT anteriores.
- **Reset propio en Usuarios.** Borra también la cookie actual (`signOut({ redirect: false })`) y la UI navega a `/login` con un texto explícito (`user-row-actions.tsx`).
- **Endurecimiento:** cobertura de integración de la revocación en los servicios y el mismo flujo de reset propio en Staff (BUG-022).

**Commits.** `b24c695` (merge `d144ce7`); endurecimiento `28fb8d3` y `ebb5fac` (merge `c3ba279`).

**Pruebas @regression.**
- [AUTH-025], [AUTH-033], [AUTH-034], [AUTH-035], [AUTH-036] y [AUTH-037] tests/e2e/auth/session.spec.ts.
- [AUTH-038], sin etiqueta: una cookie revocada no puede cerrar sesiones nuevas.
- Integración `tests/integration/settings-notifications.test.ts`:
  - reset, desactivar/reactivar, cambio de rol e intentos rechazados;
  - reset propio;
  - `revokeSessionsOnSignOut` con token vigente, viejo, sin versión y malformado, y dos cierres simultáneos de los que sólo uno incrementa.
- Integración `tests/integration/operations-staff.test.ts`.

**Verificación.**
- **Antes:** AUTH-025 FAIL (la cookie copiada recibía 200; se esperaba 307).
- **Después:**
  - AUTH-025 pasa 3/3 (`--repeat-each=3 --retries=0`).
  - AUTH-033…038 pasan 5/5. Hubo una caída del worker de Windows (`0xC0000409`) antes de ejecutar código de prueba, que no se repitió en 5 corridas más.
  - La regresión de BUG-001 (228 PASS) incluye STF-020/021 y SET-014/015/016.
- **Endurecimiento:** `pnpm test:integration` 318/318 (carril 4).

**Riesgos residuales y decisiones.**
- Los mismos de BUG-001: la revocación es por cuenta y no por dispositivo, y el logout falla abierto si la base cae.
- **`/api/auth/session` con una cookie revocada.** Todavía la decodifica y devuelve nombre, correo y rol de esa cuenta, porque Auth.js no conoce `sessionVersion`. La app no llama ese endpoint y toda autorización pasa por `getCurrentUser`. Cerrarlo exigiría un callback `jwt` con consulta a la base.
- **STF-021 en WebKit.** En la última corrida de la regresión final del carril 5, [STF-021] (desactivar el acceso bloquea el login y la sesión abierta) agotó el tiempo en WebKit. Está dentro de la corrección de inestabilidades en curso y no está clasificado; en Chromium pasa.

---

## BUG-005 — `callbackUrl` con caracteres de control evade `safeCallback`

**Severity:** HIGH
**Priority:** P1
**Status:** Verified
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

### Fix

**Causa raíz final.** `safeCallback` validaba por prefijo de cadena. Los navegadores eliminan TAB, CR y LF de las URL y tratan `\` como `/`, así que `/\t/evil.example` pasaba el filtro y se convertía en `//evil.example`.

**Corrección.**
- **Nueva función pura `safeCallbackPath`** (`src/features/auth/domain/callback-url.ts`, 38 pruebas unitarias):
  - rechaza caracteres de control (C0, DEL y C1), cualquier espacio y `\`;
  - normaliza con `new URL(url, origen ficticio)` y exige el mismo origen;
  - descarta rutas que, ya normalizadas, empiezan con `//`;
  - devuelve `pathname + search + hash`.
- **Dónde se usa:**
  - en `loginAction`;
  - en la página `/login`, cuyo campo oculto sólo lleva una ruta válida;
  - en el callback `redirect` de Auth.js (`safeRedirectUrl`), como defensa en profundidad.
- **Endurecimiento.** AUTH-043…050 ya no ejercitaban la validación propia de `loginAction`, porque la página la filtra antes. [AUTH-065]…[AUTH-072] alteran el campo oculto antes de enviar y exigen que `x-action-redirect` sea del mismo origen.

**Commits.** `ee67039` (merge `d144ce7`); endurecimiento `28fb8d3` (merge `c3ba279`).

**Pruebas @regression.** [AUTH-049] y [AUTH-071] (el valor TAB, por la página y por `loginAction`) en tests/e2e/auth/callback.spec.ts. Las demás variantes de AUTH-040…051 y AUTH-065…072 pasan sin etiqueta.

**Verificación.**
- **Antes:** AUTH-049 FAIL («Application error» y `SecurityError` en `pushState`).
- **Después:** AUTH-049 pasa 3/3; la carpeta auth, 58/58; ratelimit, 9/9.
- **Endurecimiento:**
  - Con `loginAction` mutado a un filtro por prefijo, AUTH-043…050 seguían pasando y el valor TAB (AUTH-071) fallaba.
  - Ya separadas, AUTH-065…072 pasan 24/24 en Chromium, Firefox y WebKit con `--retries=0`, y 5/5 con repeticiones en Chromium.

**Riesgos residuales.** Ninguno conocido. Sigue la observación previa: con sesión abierta, `/login?callbackUrl=…` ignora el `callbackUrl`.

---

## BUG-006 — Navegaciones a la misma ruta y `router.refresh()` dentro de transiciones se quedan colgadas

**Severity:** HIGH
**Priority:** P0 (afecta la confirmación visible del recorrido crítico de RSVP [CRIT-004]; los datos sí se guardan)
**Status:** Verified (mitigado)
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

### Fix

**Por qué es una mitigación y no una corrección de raíz.** El defecto está en el reconciliador de React `19.2.0-canary-0bdb9206-20250818`, el que Next 15.5.27 trae incluido para el App Router; no está en la app ni en la red. La app no puede cambiar ese React: subir sólo `react`/`react-dom` no sirve con Next 15.5. Por eso esquiva el disparador hasta que se actualice Next.

**Causa raíz final** (confirmada en el carril 5):
1. Una transición del router renderiza un payload RSC que todavía llega por streaming.
2. React se suspende en un lazy de Flight dentro de un Suspense ya visible: el de `loading.tsx`, con key `__PAGE__` sin searchParams. React cede el hilo.
3. Si la fila llega en ese intervalo, el chunk queda en `resolved_model`.
4. Al desenrollar (`RootSuspendedWithDelay`), `attachPingListener` llama `chunk.then()`, que resuelve **de forma síncrona en plena fase de render**.
5. `pingSuspendedRoot` descarta ese ping. La raíz queda con `pendingLanes = suspendedLanes`, `pingedLanes = 0` y sin callback: la URL y la UI no cambian y `useTransition` queda pendiente.

**Por qué sólo en la misma ruta.** El `<Link>` o `router.push` a `?month=` o `?page=` reutiliza, por alias de pathname, el prefetch de la página actual (sólo en producción). Eso dispara un lazy fetch durante la transición. `router.refresh()` y las Server Actions que revalidan siguen el mismo mecanismo.

**Hipótesis descartadas.** El `Set-Cookie` de `auth()`, la compresión o el chunked, los efectos con `router.*` y un artefacto de Playwright (en `next dev` no se reproduce: 24/24). `force-dynamic` + `loading.tsx` es la condición, no la causa, y `useTransition` pendiente es el síntoma.

**Defecto secundario de Next** hallado al corregir: `serverPatchReducer` aplica el `SERVER_PATCH` de un lazy fetch sin comparar `previousTree`. Eso producía la URL de «Precios» con el contenido de «Negocio» (efecto 10, SET-001).

**Corrección de raíz upstream.** Es facebook/react#36134 «Fix useDeferredValue getting stuck» (commit `c0d218f0f3e0`, 2026-03-24; cierra #35821): el ping que llega en fase de render se registra en `workInProgressRootPingedLanes`.
- **La traen:** Next 16.3.0 o posterior (React `19.3.0-canary-cbb046ab-20260731`), Next 16.4.0 y `react-dom` 19.3.0.
- **No la traen:** Next 15.5.27, Next 16.2.x y `react-dom` 19.2.8.

**Mitigación** (sin dependencias nuevas ni cambio de versión):
- **Instalación.** `src/instrumentation-client.ts`, el hook oficial de Next que carga antes de hidratar, instala `src/components/navigation/navigation-guard.ts` (el único módulo con efectos globales) y le reenvía `onRouterTransitionStart`. La lógica pura está en `src/lib/rsc-response-buffer.ts` y `src/lib/navigation-guard.ts`. `<NavigationGuardBridge />`, en el layout raíz, entrega `router.refresh()`.
- **A — respuestas RSC completas.** `window.fetch` entrega a React las respuestas `text/x-component` ya completas y conserva status, cabeceras, `url` y `redirected`. Con todo el payload, Flight resuelve todas las filas antes del render y la carrera no ocurre. Cubre navegación, prefetch, refresh y Server Actions.
- **B — lazy fetch obsoletos.** Si un lazy fetch (GET RSC con `refetch` debajo de la raíz) termina después de que empezó otra navegación a otra URL, se entrega un payload RSC válido y vacío (`{b: buildId, f: []}`), que Next aplica sin cambios.
- **Red de seguridad.**
  - Cuándo actúa: un push o replace hacia otra URL que no se confirma después de 5 s de red en reposo. «En reposo» significa sin peticiones RSC en curso y sin `<script>` ni hojas de estilo cargando en `<head>`; los `noModule` se ignoran.
  - Qué hace: recurre a `location.assign` o `location.replace` y registra `console.error`. El guard de E2E convierte ese error en fallo, así que no puede ocultar una regresión.
  - Qué cubre: el disparador residual de los chunks de módulos cliente (`resolved_module`) y cuelgues no previstos.
  - Qué no vigila: la misma URL, el hash, Atrás/Adelante, `router.refresh()` ni las Server Actions.

**Regresión que introdujo la primera mitigación: el esqueleto infinito al volver con Atrás.** Se documenta aquí y no como bug aparte.
- **Qué pasaba.** La revisión adversarial de `5fc2435` detectó que la parte B ampliaba el esqueleto infinito al volver con Atrás/Adelante.
  - Next sólo descarta un parche cuando su ruta ya no coincide; B descartaba también parches que sí coincidían (rutas hermanas o la misma URL).
  - El nodo quedaba en el caché del router con `rsc = null` y `lazyData` resuelto, y `restoreReducer` lo reutilizaba: `use(unresolvedThenable)` para siempre.
  - Ejemplo: en Ajustes, «Negocio» → «Precios» rápido → Atrás.
  - La primera nota lo atribuía a Next («riesgo no introducido»), y eso no era exacto.
- **Por qué queda dentro de BUG-006:** nació de su mitigación, no existía en `f26b1a1` ni en ninguna versión publicada, y comparte causa y verificación. Además se cerró antes del estado final con su propia prueba de reproducción: [SET-023] falla sobre `86b60de` y pasa con la recuperación de `be55029`.
- **Recuperación.** Cada lazy fetch descartado se anota (`onDiscard`, por URL, máximo 50). Un `traverse` hacia esa URL programa `router.refresh()`, o una carga completa si el puente no está montado, y lo registra con `console.warn`.

**Commits.** `5fc2435` y `b15324a` (merge `a1ece90`); endurecimiento `be55029`, `d87814d` y `ae846ec` (merge `f8797e0`).

**Pruebas @regression.**
- [CAL-002] tests/e2e/calendar/calendar.spec.ts.
- [EVT-038] tests/e2e/events/events.spec.ts.
- [LEAD-037] tests/e2e/leads/leads-list.spec.ts.
- [INV-025] tests/e2e/inventory/inventory.spec.ts.
- [CNT-022], [CNT-023] y [CNT-024] tests/e2e/content/content.global.spec.ts.
- [NOT-002] tests/e2e/notifications/inbox.spec.ts.
- [GST-011], [GST-012] y [GST-015] tests/e2e/guests/rsvp.spec.ts.
- [CRIT-004] tests/e2e/critical/experience.spec.ts.
- [SET-001] y [SET-023] tests/e2e/settings/settings.spec.ts, con [SET-024] como control.
- Unitarias: `src/lib/rsc-response-buffer.test.ts` (20), `src/lib/navigation-guard.test.ts` (13) y `src/components/navigation/navigation-guard.test.ts` (9).

**Verificación.**
- **Antes** (`8020b91`, carril 5, `--retries=0`): CAL-002, EVT-038, LEAD-037, INV-025, GST-012 y GST-015 FAIL.
- **Primera versión, sólo A:** 35/38; SET-001 FAIL 3/3 por el parche obsoleto, y por eso se agregó B.
- **Versión final A+B** (carril 5, `--repeat-each=5 --retries=0`):
  - 70/70 en Chromium y mobile-chrome; CNT-022…024 15/15; GST-011 y CRIT-004 en Firefox y WebKit 8/8.
  - Regresión de 10 carpetas: 225 PASS y 9 FAIL. 7 FAIL eran otros bugs entonces abiertos. LEAD-021 era un TEST BUG que la corrección expuso, ya corregido, y SMK-023 dependía de los datos.
  - Global: 25/25.
- **Endurecimiento** (carril 1, builds `be55029` y `d87814d`):
  - Las 10 pruebas de BUG-006 más SET-023/024 (12 pruebas × 5): 60/60 con `--repeat-each=5 --retries=0`.
  - GST-011 y CRIT-004 en Firefox, WebKit y mobile-chrome: 30/30.
  - Carpetas calendar, leads, events, guests, inventory, settings, notifications y smoke: 187/187 sin flaky y sin que se disparara la red de seguridad.
  - Global 18/18; unitarias 884/884.

**Riesgos residuales y criterio de retiro.**
- **Criterio de retiro (decisión del usuario): actualizar a Next ≥ 16.3.0.** Es un cambio de versión mayor y no se hizo. Después habría que:
  1. quitar `installNavigationGuard` de `src/instrumentation-client.ts` y `<NavigationGuardBridge />` del layout raíz;
  2. correr CAL-002, EVT-038, LEAD-037, INV-025, GST-011/012/015, CNT-022…024, NOT-002, SET-001, SET-023/024 y CRIT-004 con `--repeat-each=5 --retries=0`, más NAV-037…039 de BUG-020 en Firefox.
- **Costo aceptado.** Las navegaciones del cliente, `router.refresh()` y las Server Actions ya no pintan por partes: los Suspense internos, como `PaymentsPanel`, esperan la respuesta completa. El HTML inicial sigue en streaming. El envoltorio de `window.fetch` aplica a todo el sitio. Conviene medir en producción el tiempo hasta el contenido en páginas lentas.
- **Lazy fetch de un layout.** La recuperación se busca por URL. Un lazy fetch descartado de un **layout** (raro) dejaría el esqueleto bajo ese layout y **no tiene recuperación automática**: la red de seguridad no vigila Atrás/Adelante y, con push, la URL sí cambia. Sólo se resuelve recargando. `docs/qa/findings/events.md` › Endurecimiento › 2 todavía atribuye ese caso a la red de seguridad, y no es exacto.
- **Obsolescencia por URL, no implementada a propósito.** Si React renderiza un estado ya superado después de que empezó otra navegación, se aplica el parche obsoleto. Es el comportamiento de Next sin la mitigación, así que no hay regresión.
- **Falso positivo latente de la red de seguridad.** Una redirección HTTP que vuelve a la misma URL (por ejemplo, una STAFF en `/staff` que sigue un enlace a `/admin/*`) se tomaría por un cuelgue: recarga innecesaria y `console.error`. Hoy no es alcanzable en la app.
- **Refresh redundante.** Un push confirmado a una URL de la lista de descartadas no la quita de la lista: un Atrás posterior hace un `router.refresh()` de más (una petición extra, sin daño).
- **Sin cambio:** `OrderButtons` sigue etiquetando por posición («Subir imagen 2»), el agravante de UX de este bug (ver «Observaciones»).

---

## BUG-007 — Dos solicitudes simultáneas de checkout crean dos pagos PENDING del mismo anticipo

**Severity:** MEDIUM
**Priority:** P2
**Status:** Verified
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

### Fix

**Causa raíz final.** `startCheckout` hacía check-then-insert sin serialización. Además, la hora de la regla de reutilización se tomaba **antes** de esperar el candado, así que el pago recién creado por la otra solicitud parecía «futuro» y no se reutilizaba. Lo detectó la nueva prueba de integración con 3 solicitudes simultáneas.

**Corrección.**
- **Ronda 1.**
  - `startCheckout` corre en `prisma.$transaction` con `lockBooking` (`SELECT … FOR UPDATE` sobre la reserva). La segunda solicitud espera y reutiliza el `checkoutUrl`.
  - `track(START_PAYMENT)` sólo se registra para pagos nuevos, después del commit.
  - Sin cambio de esquema: no se agregó el índice parcial único.
- **Revisión.** Retener el candado durante la llamada HTTP al proveedor (hasta 15 s) hacía que la cancelación, los webhooks, los pagos manuales y los reembolsos de esa reserva esperaran o fallaran por el timeout de 5 s de Prisma, y podía agotar el pool. Primero se puso `BOOKING_LOCK_TX_OPTIONS` (30 s) y una nota de pool en `docs/DEPLOY_DOKPLOY.md`.
- **Endurecimiento: checkout en dos fases** (`445645c`).
  1. Una transacción corta con candado reserva el pago (`PENDING` sin URL).
  2. La llamada al proveedor ocurre fuera de cualquier transacción.
  3. La URL se publica con candado sólo si el pago sigue reservado y la reserva sigue viva.
  - Una solicitud simultánea ve el lugar reservado (`checkoutOpeningState`), espera fuera del candado y reutiliza la URL.
  - Las reservas sin URL de más de 20 s se dan por abandonadas.
  - `BOOKING_LOCK_TX_OPTIONS` vuelve a 15 s y ya no se exige un pool mínimo.

**Commits.** `0f4ef49` y `568d92d` (merge `be74647`); endurecimiento `445645c` (merge `e21eb66`).

**Pruebas @regression.**
- [PAY-019] tests/e2e/payments/payments.spec.ts: exactamente un `Payment`, con el monto del anticipo.
- Integración `payments.test.ts`:
  - 3 `startCheckout` simultáneos → 1 pago, 1 URL y 1 `START_PAYMENT`;
  - la reserva no queda bloqueada mientras responde la pasarela (`FOR UPDATE NOWAIT`);
  - si la pasarela falla → `FAILED` y `CHECKOUT_FAILED`;
  - un lugar abandonado → `FAILED`.
- [PAY-006], la reutilización secuencial, sigue en PASS.

**Verificación.**
- **Antes:** PAY-019 FAIL 1/1 (2 pagos `PENDING` de 1 032 500 centavos y 2 URLs).
- **Después:**
  - 3/3 en el carril 2 (`--repeat-each=3 --retries=0`) y 5/5 en el carril 3 tras el endurecimiento.
  - La prueba de integración fue estable en 4 corridas; `payments.test.ts` 44/44.
  - La regresión es la misma que en BUG-002.

**Riesgos residuales.** Ambos casos son raros y ninguno reabre BUG-002 ni BUG-007.
- **Proceso muerto entre reservar y publicar.** Queda un `PENDING` sin URL hasta que otro `startCheckout` de la misma reserva lo marca abandonado; no hay cron que lo limpie.
- **Commit ambiguo al publicar.** Si falla de forma ambigua, la sesión se expira aunque la URL pudiera haberse guardado, y esa URL se reutilizaría durante su hora de vigencia.
- **Sugerencia de la revisión:** que el cron de expiración cierre esos `PENDING` y que se re-lea el pago antes de expirar la sesión.

---

## BUG-008 — La misma clienta se duplica porque el teléfono se guarda con formatos distintos

**Severity:** MEDIUM
**Priority:** P2
**Status:** Verified
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

### Fix

**Causa raíz final.** No existía una forma canónica del teléfono:
- el configurador guardaba `+52` y 10 dígitos;
- contacto, diseñador IA y captura manual guardaban los dígitos como llegaban;
- el perfil, la «Clienta nueva» de cotización y de evento y el seed guardaban el texto tal cual.

La regla «busca o crea clienta» (en la captura y en una copia en `event-service`) comparaba por igualdad exacta.

**Corrección.**
- **Forma canónica.** `src/lib/phone.ts`, pura y con `phone.test.ts`:
  - `normalizePhone` produce E.164: `+52` y 10 dígitos para México. Acepta 10 dígitos, `+52`, `52`, el prefijo legado `521` y separadores; otros países quedan como `+lada…`.
  - Agrega `mxNationalNumber`, `isValidPhone`, `samePhone`, `phoneMatchKeys` y `phoneSearchDigits`.
  - Los esquemas Zod de clientas, leads, contacto, diseñador IA, cotizaciones y eventos validan con la misma función.
- **Escrituras y búsqueda.**
  - Todas las escrituras guardan la forma canónica (`phoneForStorage`, `src/features/customers/server/customer-contact.ts`).
  - Hay una sola regla de búsqueda, `findCustomerByContact` (primero correo y luego teléfono), en captura, eventos y cotizaciones; las cotizaciones ahora también reutilizan por teléfono.
  - Un mismo número escrito con otro formato no se registra como cambio.
- **Datos existentes: búsqueda tolerante en lugar de migración.** `findCustomerByPhone` compara sólo los dígitos contra las formas 10, 52+10 y 521+10. No reescribe datos de clientas ni cambia el esquema, y cada edición deja el dato canónico. El seed ya es canónico (`demo-setup.ts`, `demo-sales.ts`).
- **Endurecimiento** (`fcef8a7`, `fe9f23a`):
  - `normalizePhone` rechaza la lada 52 con longitud equivocada, ya no toma `+` seguido de 10 dígitos como número nacional y rechaza números nacionales que empiezan con 0 o 1.
  - Hay un solo normalizador: `whatsappDigits` reemplaza a `normalizeMxPhone` en wa.me y en los avisos.
  - La búsqueda por teléfono tolera formatos en Clientas, Eventos, Cotizaciones y los selectores (`customerPhoneSearchFilter`), incluidas filas antiguas y WhatsApp.
  - `findCustomerByPhone` considera WhatsApp y prueba primero la forma canónica exacta, que usa el índice.
  - `lockCustomerContact` (advisory lock por correo y número) evita que capturas simultáneas creen dos clientas.
  - «Clienta nueva» en cotización y evento: el mismo teléfono con otro correo es otra persona. Antes, la cotización se ligaba a otra clienta y el correo escrito se perdía.
  - La fuga de contacto en capturas públicas que encontró la revisión se registra aparte, como BUG-017.

**Commits.** `75085d4` (merge `880e40b`); endurecimiento `fcef8a7` y `fe9f23a` (merge `e21eb66`).

**Pruebas @regression.**
- [CONF-022] tests/e2e/configurator/server.spec.ts.
- [CUST-016] tests/e2e/customers/customers.spec.ts.
- [EVT-039] tests/e2e/events/events.spec.ts: búsqueda por teléfono en Eventos y Cotizaciones.
- Unitarias: `src/lib/phone.test.ts` y `tests/unit/libs.test.ts`.
- Integración `leads-customers`, `quotes` y `public-site`:
  - el formato heredado se reconoce sin modificarlo;
  - otra lada no se confunde;
  - se reconoce el WhatsApp heredado;
  - 3 capturas simultáneas producen 1 clienta.

**Verificación.**
- **Antes** (carril 3, `--repeat-each=2 --retries=0`): CONF-022 y CUST-016 FAIL 2/2.
- **Después:** 3/3 cada una. Las carpetas customers, leads, configurator, public, ai-designer (más la suite global), events, quotes y critical/sales no tuvieron fallas nuevas. Las que quedaron eran bugs entonces abiertos, y QUO-018 salió FLAKY por un locator ambiguo (TEST BUG corregido en `baca565`).
- **Endurecimiento** (carril 3): EVT-039, CONF-021 y PUB-048 pasan 5/5 con `--repeat-each=5 --retries=0`. Chromium: 231/231. `pnpm test:integration`: 324/324.

**Riesgos residuales y decisiones.**
- **Validación más estricta.** Un teléfono guardado antes con un formato que la regla rechaza (`044…`, `045…`, `01…`, o `+52` con dígitos de más o de menos) impide guardar ese perfil o lead hasta corregirlo. Está documentado en `docs/DOMAIN.md`.
- **Recorrido de la tabla.** El respaldo por dígitos sigue recorriendo `Customer` cuando el número no existe en forma canónica. Una columna normalizada e indexada, o normalizar los datos existentes, requiere una decisión de esquema o de migración.
- **Clienta que regresa con otro correo.** Si vuelve a escribir con el mismo teléfono y **otro** correo, se crea como clienta nueva sin marca de posible duplicado. Es el costo de la regla anti-suplantación.
- **Truncado de la búsqueda.** `customerPhoneSearchFilter` corta en silencio a 500 ids cuando se buscan pocos dígitos.
- **CSV.** Todo teléfono nuevo se guarda como `+52…`, así que la protección anti-fórmulas del CSV (`'+52…`) aplica ahora a todos (ver «Requisitos ambiguos»).

---

## BUG-009 — Contraste insuficiente (WCAG 1.4.3) en tonos warning/info, taupe y textos atenuados

**Severity:** MEDIUM
**Priority:** P2
**Status:** Verified
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

### Fix

**Causa raíz final.**
- Los tokens `--warning` (`#9a6a1f`) e `--info` (`#4b6577`) se usaban como color de texto sobre su propio fondo al 10 % (3.77–4.47:1).
- `--brand-taupe` (`#a48f7e`, unos 2.8:1) se usaba como color de texto.
- Varios textos se atenuaban con opacidad: `text-ivory/80` sobre olive, días fuera de mes, la ayuda del `MediaUploader` deshabilitado, el eje X, contadores, filas inactivas, la propuesta aceptada o expirada y las pestañas inactivas.
- El mismo patrón quedaba en el detalle «· N × $precio» del configurador, en `lead-timeline`, en los hovers a `/20` y en `--destructive` del modo oscuro preparado.

**Corrección.**
- **Tokens en `globals.css`:** warning `#7d5619`, info `#486173`, success `#4c6639` y destructive `#a03e2b`. Conservan la tonalidad y dan al menos 4.6:1 sobre el tono al 10 % en todas las superficies.
- **Taupe.** Nuevo `--brand-taupe-deep` (`#776354`, 5.1:1), que se usa como `text-taupe-deep` para texto; el taupe de marca queda decorativo.
- **Atenuados.** Los textos dejan la opacidad o usan fondo `muted` en su lugar. `StatusBadge` no necesitó cambios de clases.
- **Endurecimiento:**
  - `estimate-summary` y `lead-timeline` sin opacidad;
  - hovers de `/20` a `/15`;
  - en `.dark`, `--destructive` `#eab0a4` y `--destructive-foreground` `#1f1d1b`;
  - `refund-dialog` usa `text-destructive-foreground`.
- La paleta clara no cambia.

**Commits.** `cf3e12d` (merge `41db385`); endurecimiento `50d2903` (merge `c3ba279`).

**Pruebas @regression.**
- [PAY-022] tests/e2e/payments/payments.spec.ts.
- [EVT-037] tests/e2e/events/event-experience.spec.ts.
- [CAL-007] tests/e2e/calendar/calendar.spec.ts.
- [MEM-019] tests/e2e/memory/memory-public.spec.ts.
- [A11Y-008], [A11Y-009], [A11Y-011], [A11Y-012], [A11Y-013], [A11Y-014], [A11Y-015] y [A11Y-018] tests/e2e/accessibility/a11y.spec.ts.
- [STF-024] tests/e2e/staff/staff-portal.spec.ts.
- [CONF-024] tests/e2e/configurator/wizard.spec.ts.
- Contratos unitarios:
  - `tests/unit/design-tokens-contrast.test.ts`, que falla con los valores anteriores;
  - `tests/unit/ui-contrast-classes.test.ts`, que recorre las clases reales de `src/**`, incluidas las variantes `hover:`, `[a]:hover:` y `dark:`.

**Verificación.**
- **Antes:** las pruebas E2E listadas FAIL por `color-contrast` serious (2.63–4.47:1).
- **Después:**
  - Cada una pasa 3/3 (`--repeat-each=3 --retries=0`, carril 6).
  - Un barrido axe temporal de 78 páginas a 1440 y 390 px no encontró ningún `color-contrast`.
  - Las carpetas accessibility, responsive, smoke, quote-public, navigation, public, finance, staff-portal, memory y notifications pasan 198/198.
- **Endurecimiento** (carril 4): CONF-024 pasa 5/5. Revertir `estimate-summary` o el hover hace fallar los contratos. Accessibility: 32/32.

**Riesgos residuales.**
- **Excepciones por archivo.** `DIMMED_TEXT_EXEMPT` exime por archivo y clase, así que podría ocultar un texto atenuado nuevo en esos archivos. La revisión sugiere fijar el número de ocurrencias.
- **Modo oscuro.** El modo oscuro preparado (no activo) todavía tiene componentes con fondos claros fijos.
- **Correo.** Fuera de alcance y sin corregir: la plantilla de correo usa `#A48F7E` como color de texto (ver «Observaciones › Hallazgos nuevos sin triage»).

---

## BUG-010 — Listas de definición (`<dl>`) inválidas en la propuesta pública y el micrositio

**Severity:** MEDIUM
**Priority:** P2
**Status:** Verified
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

### Fix

**Causa raíz final.** Había envoltorios visuales (ícono y contenedor) entre `<dl>` y sus `dt`/`dd` en:
- `DetailTile` (`/cotizacion/[token]`);
- `DetailCard` (micrositio);
- el bloque de anticipo y saldo.

El barrido encontró lo mismo en la ficha del lead: el botón «Copiar» era hijo del `<div>` del `<dl>`.

**Corrección.**
- Cada `<div>` hijo del `<dl>` contiene sólo `<dt>` y `<dd>`. El ícono decorativo va dentro del `<dt>`, con `aria-hidden`, y el diseño no cambia.
- El anticipo y el saldo tienen su propio `<dl>`.
- En `lead-contact-card`, el botón va dentro del `<dd>`.

**Commits.** `7173e13` (merge `41db385`).

**Pruebas @regression.** [QPUB-014] tests/e2e/quote-public/quote-public.spec.ts · [GST-022] tests/e2e/guests/rsvp.spec.ts · [A11Y-007] y [A11Y-010] tests/e2e/accessibility/a11y.spec.ts.

**Verificación.**
- **Antes:** las 4 FAIL (`definition-list` y `dlitem`).
- **Después:** cada una pasa 3/3. El barrido axe ya no encuentra `definition-list` en `/admin/leads/[id]`. La regresión de BUG-009 (198/198) y el `@mobile` de quote-public y guests no tuvieron fallas propias.

**Riesgos residuales.** Ninguno conocido.

---

## BUG-011 — Portal staff: `aria-controls` de «Agregar nota» apunta a un id inexistente

**Severity:** MEDIUM
**Priority:** P2
**Status:** Verified
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

### Fix

**Causa raíz final.** `aria-controls="notas-<id>"` apuntaba al `<Textarea>`, que sólo se monta con el panel abierto (el botón se reemplaza por el panel). Además, el foco caía en `<body>` al abrir y al cerrar.

**Corrección.**
- Se quitó `aria-controls`: no es un disclosure, porque el botón desaparece.
- El foco se gestiona: al abrir pasa a «Nota para coordinación» y al cancelar o guardar vuelve al botón.
- El guardado no cambia.

**Commits.** `e813c1c` (merge `41db385`).

**Pruebas @regression.** [STF-024] y [STF-025] tests/e2e/staff/staff-portal.spec.ts.

**Verificación.**
- **Antes:** STF-024 FAIL (`aria-valid-attr-value` critical y contraste).
- **Después:** STF-024 y la nueva STF-025 pasan 3/3. STF-025 comprueba que no queden referencias ARIA colgantes, que Enter lleve el foco al campo, que al cancelar vuelva al botón y que la nota no se guarde. staff-portal completo y su `@mobile` pasan.

**Riesgos residuales.** Ninguno.

---

## BUG-012 — El diálogo «Aceptar propuesta» no devuelve el foco al cerrarse

**Severity:** LOW
**Priority:** P3
**Status:** Verified
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

### Fix

**Causa raíz final.** Un `Dialog` controlado se abría desde dos botones (el CTA y la barra fija móvil) sin `DialogTrigger`, así que Radix no tenía a quién devolver el foco.

**Corrección.**
- Se recuerda el botón que abrió el diálogo (`e.currentTarget`).
- `onCloseAutoFocus` le devuelve el foco si sigue conectado. Después de aceptar, la vista cambia y queda el comportamiento por defecto.
- La acción de aceptar no cambia.

**Commits.** `f35fb04` (merge `41db385`).

**Pruebas @regression.** [QPUB-015] tests/e2e/quote-public/quote-public.spec.ts · [A11Y-028] tests/e2e/accessibility/a11y.spec.ts.

**Verificación.**
- **Antes:** ambas FAIL (el foco quedaba en `body`).
- **Después:** cada una pasa 3/3, y quote-public completo y su `@mobile` pasan.

**Riesgos residuales.** Ninguno.

---

## BUG-013 — Soft-404: `/experiencias/[slug]` inexistente o inactivo responde HTTP 200

**Severity:** LOW
**Priority:** P3
**Status:** Verified
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

### Fix

**Causa raíz final.** `(public)/loading.tsx` y `experiencias/loading.tsx` envolvían en Suspense todo el sitio público. El `notFound()` de `experiencias/[slug]/page.tsx` llegaba cuando el shell ya se había enviado con HTTP 200.

**Corrección.**
- **Layout guardián.** Nuevo `experiencias/[slug]/layout.tsx`: valida que el slug exista y esté activo, y llama `notFound()` antes de cualquier límite de carga (el patrón de `cotizacion/[token]/layout.tsx`).
- **Esqueletos y not-found.** Los esqueletos del inicio y del catálogo pasan a los grupos `(inicio)` y `(catalogo)`, sin cambiar URLs. El not-found pasa a `experiencias/not-found.tsx`.
- **Revisión del patrón.** Se revisó en las demás rutas públicas y por token: todas validan en su layout. La tabla está en `docs/qa/findings/sales.md` › SAL-BUG-07.
- **Endurecimiento.**
  - El contrato `tests/unit/route-not-found-contract.test.ts` falla si un layout guardián de `(public)`, `(experience)` o `(auth)` queda dentro de un `loading.*` o de un `<Suspense>` ancestro.
  - La restricción está comentada en `(public)/layout.tsx` y `(experience)/layout.tsx`.
  - El inventario QA se regeneró (`2fbe8d4`).

**Commits.** `a8ca093` (merge `41db385`); endurecimiento `4a7a780` y `2fbe8d4` (merge `c3ba279`).

**Pruebas @regression.**
- [NAV-002] y [NAV-034] tests/e2e/navigation/not-found.spec.ts. NAV-034 exige HTTP 404 real en 8 rutas públicas y por token.
- [PUB-016] tests/e2e/public/site.spec.ts, que ahora exige 404 para un slug inexistente, inválido o inactivo.

**Verificación.**
- **Antes:** NAV-002 FAIL (HTTP 200).
- **Después:** NAV-002 y PUB-016 pasan 3/3; navigation y public completos pasan, igual que A11Y-001/002/003.
- **Endurecimiento:** NAV-034 pasa 5/5. Crear `(public)/loading.tsx` o `(experience)/loading.tsx` hace fallar el contrato.

**Riesgos residuales.**
- **Soft-404 interno.** Las rutas con sesión `/admin/**/[id]` (19) y `/staff/events/[id]` siguen respondiendo 200 con `noindex` y «No encontramos…». No afecta SEO ni seguridad; es una mejora opcional.
- **Navegación a una ficha.** En el cliente, ahora espera la consulta del layout (en caché) antes de mostrar el esqueleto.
- **ID duplicado — resuelto.** La prueba de hidratación de BUG-020 que también se llamaba NAV-034 ahora es [NAV-037]. NAV-034 queda sólo para este 404 real (ver «Notas de reporters y ejecución», nota 10).
- **Meta robots duplicado.** No se verificó por separado en las páginas 404: PUB-016 usa `.first()`.

---

## BUG-014 — Un lead capturado a mano con «Origen» ≠ «Captura manual» dispara los avisos de lead entrante

**Severity:** LOW
**Priority:** P3
**Status:** Verified
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

### Fix

**Causa raíz final.** `createInboundLead` decidía los avisos con `input.source !== "MANUAL"`: usaba el origen comercial del lead como si fuera el canal de captura.

**Corrección.**
- `createInboundLead` exige `ctx.channel: "public" | "team"`, y sólo `"public"` dispara `LEAD_RECEIVED` y «Nuevo lead». La regla es la función pura `notifiesInboundLead` (`src/features/leads/domain/lead-workflow.ts`), con prueba unitaria.
- Configurador, diseñador IA y contacto declaran `"public"`; `createManualLead` declara `"team"`.
- No se usa `ctx.actor` como señal porque las acciones públicas también lo reciben cuando quien las usa tiene sesión.

**Commits.** `cf05a32` (merge `880e40b`).

**Pruebas @regression.**
- [LEAD-036] y [LEAD-035] (control) tests/e2e/leads/leads-detail.spec.ts.
- Integración `leads-customers`: una captura del equipo con origen Instagram genera 0 avisos; el contacto público genera `LEAD_RECEIVED` y el aviso al equipo.

**Verificación.**
- **Antes:** LEAD-036 FAIL 2/2 (`--repeat-each=2 --retries=0`, carril 3); LEAD-035 pasa.
- **Después:** ambas pasan 3/3. Las capturas públicas siguen avisando: contacto, configurador, diseñador IA, CRIT-001 y CRIT-010 pasan.

**Riesgos residuales.** No hay una opción para avisar a la clienta en una captura manual; si se quisiera, tendría que ser explícita en el formulario.

---

## BUG-015 — El encabezado del evento no indica que el evento está cerrado

**Severity:** LOW
**Priority:** P3
**Status:** Verified
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

### Fix

**Causa raíz final.** `getEventHeader` no seleccionaba `closedAt`.

**Corrección.**
- `getEventHeader` selecciona `closedAt`.
- `EventHeader` muestra la insignia neutral «Cerrado», con candado, junto al estado, como en `/admin/finance`.
- La pestaña Finanzas deja de repetir su propia insignia y conserva «Evento cerrado el …».

**Commits.** `d38e91e` (merge `41db385`).

**Pruebas @regression.** [FIN-007] tests/e2e/finance/finance.spec.ts.

**Verificación.**
- **Antes:** FIN-007 FAIL.
- **Después:** pasa 3/3; finance completo pasa y events y operations no tienen fallas propias.

**Riesgos residuales.** Ninguno.

---

## BUG-016 — Seed DEMO: notificaciones con enlaces a rutas inexistentes

**Severity:** LOW
**Priority:** P3
**Status:** Verified
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

### Fix

**Causa raíz final.** `prisma/seed-data/demo-activity.ts` construía `actionUrl` con rutas en español que no existen (`/admin/eventos/<id>`, `/staff/eventos/<id>`) y usaba rutas de analytics obsoletas (`/configurador`, `/disena-con-ia`).

**Corrección.**
- `actionUrl` apunta a `/admin/events/<id>` y `/staff/events/<id>`.
- Las rutas de `AnalyticsEvent` se alinearon con la app (`/crear-experiencia?experiencia=…`, `/crear-experiencia/ai`).
- Se revisaron los demás enlaces del seed: todos existen.

**Commits.** `af52434` (merge `41db385`). `976aaec` aisló los datos de NAV-015.

**Pruebas @regression.** [NAV-015] tests/e2e/navigation/links.spec.ts · [NOT-007] tests/e2e/notifications/inbox.spec.ts.

**Verificación.**
- **Antes:** ambas FAIL (404).
- **Después:** ambas pasan 3/3. NAV-015 se endureció (sólo avisos de eventos asignados a la cuenta staff, orden determinista y al menos un enlace staff) y pasa también con la base contaminada por otras carpetas.

**Riesgos residuales.**
- **Bases existentes.** Las bases de desarrollo y demo conservan los enlaces rotos hasta re-sembrar con `pnpm db:setup`. Producción usa el seed BASE y no se afecta.
- **Cobertura.** NAV-015 ya no abre los enlaces `/staff/events/<id>` de eventos no asignados a la cuenta de prueba, así que la cobertura es algo más estrecha.

---

## BUG-017 — Una captura pública escribía el contacto de la visitante en una clienta existente: sus enlaces privados podían llegarle a otra persona

**Severity:** HIGH
**Priority:** P1
**Status:** Verified
**Type:** POTENTIAL SECURITY ISSUE (desvío de enlaces privados de una tercera; integridad del perfil de la clienta)
**Module:** leads (`createInboundLead` › `findOrCreateCustomer`) / customers — capturas públicas (contacto, configurador, diseñador IA)
**Role:** Anónimo (conoce el teléfono o el correo de una clienta registrada) · Clienta afectada
**Environment:** TEST — build de producción local `:3203`, base `ivonne_rosa_e2e_l3`, sobre `86b60de`; Chromium. El defecto existía desde `f26b1a1`.
**Reproducible:** Sí, determinista. Antes de corregir, [CONF-021] afirmaba el comportamiento vulnerable, y pasaba: el perfil de la clienta encontrada por teléfono tomaba el correo escrito en el sitio. Lo confirman las pruebas de integración del canal público.
**Test:** [PUB-048] tests/e2e/public/contact.spec.ts · [CONF-021] tests/e2e/configurator/server.spec.ts
**Fuentes:** revisión adversarial de BUG-008 (ronda 1, hallazgo menor 1: «riesgo de seguridad que ya existía y que ahora alcanza a más clientas») → endurecimiento del carril 3 (`fe9f23a`)

### Preconditions
Una clienta registrada **sin correo** (por ejemplo, creada por teléfono o WhatsApp), o sin teléfono. Quien ataca conoce su teléfono (o su correo).

### Steps to reproduce
1. Enviar el formulario de contacto, el configurador o el diseñador IA con el **teléfono** de la clienta y un **correo propio**.
2. Consultar el perfil: `select email, phone from "Customer" where id = '<id de la clienta>'`.
3. Consecuencia: cuando el equipo envía después una cotización, el portal o un enlace de pago a esa clienta, `notifyCustomer` usa el correo del perfil.

Variante: con el correo de una clienta sin teléfono y un teléfono propio, ese teléfono queda en el perfil y los avisos por WhatsApp le llegan a quien lo escribió.

### Expected result
Una captura del sitio nunca modifica los datos de contacto de una clienta existente. El lead se liga a ella, lo escrito queda en el lead y el equipo decide si lo confirma.

### Actual result
- `findOrCreateCustomer` hacía `email: customer.email ?? input.email`, y lo mismo con el teléfono. El correo de la visitante quedaba en el perfil de la clienta.
- Los avisos con enlaces privados por token se enviaban a la visitante: cotización, portal (con la lista de invitadas y la dirección) y pagos.
- La búsqueda tolerante de BUG-008 ampliaba el alcance a las filas guardadas con separadores.

### Evidence
- **E2E:** [CONF-021], en su versión anterior, exigía que el perfil tomara el correo escrito; ahora exige lo contrario. [PUB-048] cubre el formulario de contacto.
- **Integración** en `tests/integration/leads-customers.test.ts`: canal público frente a equipo, y mismo teléfono con otro correo.
- **Integración** en `tests/integration/quotes.test.ts`: «Clienta nueva» con el teléfono de otra clienta.
- Corridas en `.claude/worktrees/wf_0695ec9a-980-3/test-results/l3-evidence/minors/` (no versionada).

### Console errors
Ninguno.

### Network errors
Ninguno. Las acciones públicas responden 200 `ok: true` y no devuelven `customerId`.

### Technical analysis
- `src/features/leads/server/lead-intake.ts` (`findOrCreateCustomer`, antes de `fe9f23a`) rellenaba `email`/`phone` de la clienta encontrada con lo que se escribió en una captura pública.
- `notifyCustomer` toma el destino del perfil de la clienta (`quote-service`, `booking-service`).
- La captura pública es anónima: no exige demostrar que el contacto es de quien escribe.
- **Severidad.** Se registra como HIGH por la regla del gate (seguridad ⇒ al menos HIGH). No es CRITICAL porque la exposición no es inmediata: requiere una clienta a la que le falte ese dato de contacto y un envío posterior del equipo. Además, el envío a la tercera no se reprodujo de punta a punta. Los agentes de corrección lo anotaron como «menor» dentro de la revisión de BUG-008.

### Suspected root cause
La política de fusión de contacto no distinguía el canal: lo que escribía una visitante anónima se trataba como dato confiable del perfil.

### Recommended fix
Recomendación de la revisión: con `channel === "public"`, no completar `email` ni `whatsapp` de una clienta encontrada sólo por teléfono, o dejarlo pendiente de revisión del equipo. Cualquier relleno de contacto debe quedar en el timeline o en la auditoría.

### Fix

**Causa raíz final.** La de arriba: relleno de contacto desde el canal público sin verificación.

**Corrección.**
- **Nada del canal público se escribe en una clienta existente.** `contactUpdateForExisting` (pura, en `src/features/customers/domain/contact-merge.ts`, con pruebas) lo garantiza. Los datos quedan en el lead y la entrada `CREATED` del timeline pide al equipo confirmarlos. Las capturas del equipo sí completan campos vacíos.
- **Reutilización por teléfono acotada.** `findCustomerByContact` sólo reutiliza una coincidencia por teléfono cuando no se escribió correo o la clienta no tiene correo. El mismo teléfono con otro correo es otra persona, así que ningún lead ni cotización se liga a otra clienta.

**Commits.** `fe9f23a` (merge `e21eb66`).

**Pruebas @regression.**
- [PUB-048] tests/e2e/public/contact.spec.ts.
- [CONF-021] tests/e2e/configurator/server.spec.ts. Pasó de afirmar el relleno a afirmar el comportamiento seguro: es un cambio de requisito, no una prueba debilitada.
- Unitarias en `contact-merge.test.ts`; integración en `leads-customers` y `quotes`.

**Verificación.**
- PUB-048 y CONF-021 pasan 5/5 con `--repeat-each=5 --retries=0` (carril 3).
- Chromium: 231/231 en customers, leads, configurator, public, guests, portal, payments, events y critical.
- `pnpm test:integration`: 324/324.
- La revisión del endurecimiento (approve) volvió a correr la integración de payments, portal-rsvp, leads-customers y quotes: 118/118.

**Riesgos residuales.**
- **Sin corregir, encontrado en la revisión del endurecimiento:** `findOrCreateCustomer` todavía hace `marketingOptIn: customer.marketingOptIn || !!input.marketingOptIn` en el canal público. Quien conozca el teléfono o el correo de una clienta puede suscribirla a marketing; es un consentimiento dado por un tercero. Ver «Observaciones › Hallazgos nuevos sin triage».
- **Duplicados.** Una clienta que regresa con otro correo queda duplicada y sin marca (costo aceptado; ver BUG-008).

---

## BUG-018 — Eliminar una ficha de staff desactivaba la cuenta ligada sin aplicar las reglas de Usuarios

**Severity:** MEDIUM
**Priority:** P1
**Status:** Verified
**Type:** POTENTIAL SECURITY ISSUE (autorización: desactivar cuentas protegidas por una vía lateral)
**Module:** staff (`deleteStaffMember`) / users (reglas de activación)
**Role:** OWNER con `staff:write`, frente a una SUPER_ADMIN o a sí misma
**Environment:** TEST — integración contra base efímera y carril 4 (`:3204`, `ivonne_rosa_e2e_l4`), sobre `86b60de`. El defecto existía desde `f26b1a1` (`src/features/staff/server/staff-service.ts:85`).
**Reproducible:** Sí: 1/1 con una prueba de integración temporal, hoy cubierta de forma permanente en `operations-staff.test.ts`.
**Test:** integración `tests/integration/operations-staff.test.ts`. No tiene prueba E2E @regression propia; permissions y staff E2E pasan.
**Fuentes:** endurecimiento de BUG-001/BUG-004/BUG-005 (carril 4, hallazgo nuevo)

### Preconditions
Una ficha de staff ligada a la cuenta de una SUPER_ADMIN, o a la de la propia OWNER, sin eventos en su historial. Si tiene eventos, la eliminación ya se rechazaba con CONFLICT.

### Steps to reproduce
1. Como OWNER, abrir `/admin/staff/<id>` de esa ficha.
2. Pulsar «Eliminar integrante» (`deleteStaffMember`).
3. Consultar `select active from "User" where id = '<cuenta ligada>'`.

### Expected result
Las mismas reglas que `setUserActive` en Ajustes › Usuarios: una OWNER no puede desactivar a una SUPER_ADMIN (FORBIDDEN) ni a sí misma (CONFLICT), y no se borra nada.

### Actual result
La ficha se borraba y la cuenta ligada quedaba con `active = false` (y, después de BUG-004, con sus sesiones revocadas). Una OWNER podía dejar fuera a una SUPER_ADMIN o bloquearse a sí misma.

### Evidence
- Prueba de integración temporal del carril 4 (1/1). La cobertura permanente en `operations-staff.test.ts` comprueba:
  - OWNER → SUPER_ADMIN: Forbidden;
  - sobre sí misma: Conflict;
  - en ambos casos nada cambia;
  - una SUPER_ADMIN sí puede.
- Código en `f26b1a1` (`src/features/staff/server/staff-service.ts:85`): `if (member.userId) await tx.user.update({ where: { id: member.userId }, data: { active: false } })`, sin verificar rol ni actor.

### Console errors
Ninguno.

### Network errors
Ninguno.

### Technical analysis
- `deleteStaffMember` (`src/features/staff/server/staff-service.ts:72-88` en `f26b1a1`) sólo exigía `staff:write`.
- Desactivaba la cuenta ligada dentro de su transacción sin las reglas de `setUserActive` (`src/features/users/server/user-service.ts`) ni el candado de super admins.
- OWNER tiene `staff:write` y `users:manage`, así que no hay escalada desde fuera: es una vía lateral entre cuentas privilegiadas. Se mantiene MEDIUM, como lo clasificó el carril.

### Suspected root cause
La regla de negocio de activación estaba duplicada, de forma parcial, en el módulo de staff.

### Recommended fix
Evaluar dentro de la transacción las mismas reglas que `setUserActive`, con el candado de super admins, y rechazar sin borrar. No ofrecer «Eliminar integrante» sobre la propia ficha.

### Fix

**Causa raíz final.** La de arriba.

**Corrección.**
- `checkLinkedAccountDeactivation` (`user-service`) aplica dentro de la transacción las reglas de `setUserActive`, con el candado de super admins, y rechaza con FORBIDDEN o CONFLICT sin borrar nada.
- La página ya no ofrece «Eliminar integrante» ni «Desactivar acceso» sobre la propia ficha.

**Commits.** `ebb5fac` (merge `c3ba279`).

**Pruebas.** Integración en `tests/integration/operations-staff.test.ts`:
- en el caso permitido, `deleteStaffMember` sube `sessionVersion` en 1 y deja `active: false`;
- OWNER → SUPER_ADMIN: Forbidden;
- sobre la propia ficha: Conflict.

No tiene E2E @regression propia.

**Verificación.**
- `pnpm test:integration`: 318/318 (carril 4).
- E2E de auth, navigation, permissions y api: 271/271. Staff y settings (Chromium y mobile-chrome): 47/47.
- STF-016/017 y PERM-126 no cambian.

**Riesgos residuales.**
- **UX.** Una OWNER todavía ve «Eliminar integrante» en una ficha ligada a una SUPER_ADMIN, y el servidor siempre la rechaza. Convendría ocultar o explicar el botón.
- **Cobertura.** Falta una prueba E2E @regression del rechazo.

---

## BUG-019 — Formularios públicos y por token se enviaban por GET antes de hidratar, con datos personales en la URL

**Severity:** MEDIUM
**Priority:** P1
**Status:** Verified
**Type:** POTENTIAL SECURITY ISSUE (privacidad: datos personales en la URL, el historial, los logs y el `Referer`) + UX ISSUE (se pierde lo escrito)
**Module:** guests (RSVP) · portal (acceso por correo, mensajes, opinión, dirección) · configurator («Siguiente»)
**Role:** Invitada (link personal o general), Clienta (portal) y Anónimo (configurador)
**Environment:** TEST — build de producción local, carril 7, sobre `e2f3699`; Chromium, mobile-chrome, Firefox y WebKit
**Reproducible:** Sí. Sin la corrección, las 5 pruebas nuevas fallan 17/17 en los cuatro proyectos. La revisión independiente lo confirmó: 7/7 en Chromium y mobile-chrome con el build anterior en `:3207`.
**Test:** [GST-028] tests/e2e/guests/rsvp.spec.ts · [PORT-023], [PORT-024], [PORT-025] tests/e2e/portal/portal.spec.ts · [CONF-025] tests/e2e/configurator/wizard.spec.ts
**Fuentes:** pendiente que se reportó al corregir BUG-021 (`e2f3699`), confirmado por su revisión («minor · privacidad, ya existía y no está registrado»)

### Preconditions
Una página servida y visible antes de que su JS hidrate: red móvil lenta o, en las pruebas, el chunk de la página retenido con `holdPageChunk`.

### Steps to reproduce
1. Abrir `/e/<slug>/<token>`, o bien `/mi-evento`, `/mi-evento/<token>` (con la dirección abierta, mensajes u opinión) o `/crear-experiencia`.
2. Antes de que hidrate, escribir los datos y pulsar «Enviar» o Enter.

### Expected result
Nada se envía antes de hidratar: el botón está deshabilitado, el formulario usa POST, lo escrito se conserva y el envío normal funciona después.

### Actual result
El navegador envía el `<form>` nativo por GET a la misma URL y los datos quedan en la query string, por ejemplo:
- `GET /e/<slug>/<token>?name=Valeria+…&email=valeria-…%40e2e.ivonne-rosa.test`, incluidas las restricciones y alergias;
- `GET /mi-evento?email=…`;
- `GET /mi-evento/<token>?addressLine=Durango+…&neighborhood=Roma+Norte…`;
- `GET /mi-evento/<token>?comment=…`.

Lo escrito se pierde. En `/crear-experiencia`, «Siguiente» recargaba la página y perdía la experiencia de partida. Contacto, el diseñador IA y el libro de visitas ya lo evitaban con `method="post"` y el botón deshabilitado hasta hidratar.

### Evidence
- Corrida «antes» (build sin la corrección y pruebas finales): 17/17 FAIL en chromium, firefox, webkit y mobile-chrome, con las URL anteriores en las anotaciones.
- Revisión independiente: build anterior en `:3207`, 7/7 FAIL en Chromium y mobile-chrome, con los datos personales en la URL.

### Console errors
Ninguno.

### Network errors
Ninguno: el defecto es la navegación GET que lleva datos personales en la query.

### Technical analysis
`rsvp-panel.tsx`, `portal/access-form.tsx`, `message-thread.tsx`, `review-form.tsx`, `address-editor.tsx` y el paso de `configurator-wizard.tsx` renderizan en el HTML del servidor un `<form>` sin `method` (GET por defecto) con su botón `type="submit"` habilitado. El `onSubmit` de react-hook-form sólo existe después de hidratar.

### Suspected root cause
Los formularios dependían del JS para interceptar el envío y no bloqueaban el envío nativo antes de hidratar.

### Recommended fix
`method="post"` y el botón deshabilitado hasta hidratar, como en contacto y la cápsula (sugerencia de la revisión de `e2f3699`).

### Fix

**Causa raíz final.** La de arriba.

**Corrección.**
- **Los seis formularios.** El botón queda deshabilitado y con `aria-busy` hasta hidratar, así que ni el clic ni Enter disparan el envío nativo. El `<form>` lleva `method="post"` sin `action`. Un `<noscript>` explica por qué el botón no se activa sin JavaScript.
- **Mecanismo compartido** en `src/components/forms/`:
  - `submit-button.tsx`, con la opción `waitForHydration`;
  - `use-hydrated.ts`, un solo hook que reemplaza las copias de inventario y de la cápsula (compras y proveedores ahora lo importan de ahí);
  - `noscript-notice.tsx`.
- **Formularios ya protegidos.** Contacto, el diseñador IA y el libro de visitas adoptan el mismo botón y ganan `aria-busy`; su comportamiento no cambia.
- **Sin cambio, porque no hay riesgo:** los filtros del catálogo (GET intencional, sin datos personales), el login (Server Action por POST) y los formularios que sólo existen después de un clic.

**Commits.** `d96a82a`; `b47437b` (TEST BUG de tiempos que detectó la revisión: CONF-025 espera a que el paso sea visible antes de intentar enviar sin hidratar).

**Pruebas @regression.** Todas son @P1. Intentan enviar con Enter y con clic antes de hidratar y exigen tres cosas: que ninguna URL lleve los datos, que lo escrito siga ahí y que el envío normal se guarde.
- [GST-028] (@mobile) tests/e2e/guests/rsvp.spec.ts.
- [PORT-023] (@mobile), [PORT-024] y [PORT-025] tests/e2e/portal/portal.spec.ts.
- [CONF-025] tests/e2e/configurator/wizard.spec.ts.

**Verificación.**
- **Pruebas nuevas, `--repeat-each=5 --retries=0`:** chromium + firefox 50/50 y mobile-chrome + webkit 35/35.
- **Carril 7 completo** (8 carpetas, todos los proyectos): 263 PASS, 1 omitida y 1 FAIL.
  - La omitida es MEM-021 en WebKit.
  - El FAIL es A11Y-022, un defecto previo de la prueba que se corrigió; después pasó 12/12 y accessibility 27/27.
- **Compras:** 20/20.
- **Revisión independiente:** Firefox y WebKit 20/20 (`--repeat-each=2`); responsive RESP-004/005/010…013 18/18; carpetas relacionadas 104/104.
- **CONF-025** falló una vez por tiempos: el botón medía 0×0 con el esqueleto aún visible. Se ajustó en `b47437b`.

**Riesgos residuales.**
- **Firefox y WebKit.** Las pruebas son @P1 y la configuración normal sólo corre @P0 en esos motores, así que el envío con Enter ahí no se vigila de rutina.
- **WebKit.** El formulario sigue oculto hasta que llega el JS. Ahí las pruebas verifican el estado del HTML: botón deshabilitado, `aria-busy` y `method="post"`.
- **Accesibilidad.** Antes de hidratar sólo se ve el botón atenuado, sin texto de «Cargando…» (mismo criterio que contacto).
- **Panel admin.** Sus formularios no se revisaron con este criterio (ver «Pendientes que requieren decisión del usuario»).

---

## BUG-020 — Firefox: error de hidratación React #418 cuando el chunk de `error.tsx` llega tarde (React descarta el HTML del servidor)

**Severity:** MEDIUM
**Priority:** P1
**Status:** Verified
**Type:** APPLICATION BUG (hidratación; lo dispara un defecto del React 19.2 canary que incluye Next 15.5.27)
**Module:** transversal — layouts con `error.tsx` hermano: `pago`, `(public)`, `admin` (`AdminShell`), `admin/catalog`, `admin/content`, `admin/events/[id]` y `admin/settings`
**Role:** Clienta (checkout), Anónimo (sitio público) y OWNER (panel)
**Environment:** TEST — build de producción local; carril 2 (`:3202`, `ivonne_rosa_e2e_l2`) y carril 3 (`:3203`); Firefox. Existía antes de las correcciones (se reprodujo sobre `86b60de`). En la auditoría Firefox estaba BLOCKED (ENV-02) y por eso no se detectó. En la regresión intermedia ya aparecía [PAY-001] FLAKY con este error.
**Reproducible:**
- Intermitente en el flujo natural: PAY-001 en Firefox 3/5, y el diagnóstico `/cotizacion` → clic → `/pago/mock` 8/12.
- Sobre la base `86b60de`: EVT-024 2/5 y PAY-001 7/15.
- Determinista con el chunk de `error.tsx` retrasado: 4/4 en pago, 4/4 en el sitio público y 3/3 en el panel.

**Test:** [NAV-037], [NAV-038], [NAV-039] tests/e2e/navigation/hydration.spec.ts (describe `@regression`; antes NAV-034…036, renumeradas por la colisión con el NAV-034 de BUG-013) · [PAY-001] tests/e2e/payments/payments.spec.ts · [EVT-024] tests/e2e/events/event-status.spec.ts
**Fuentes:** endurecimiento cross-browser (carril 2, punto 4a) y hallazgo del carril 3 al endurecer pagos

### Preconditions
Firefox. Navegar a una página cuyo layout pinta `children` dentro de un elemento HTML y tiene `error.tsx` hermano, con el resto de los chunks en caché y el de `error.tsx` todavía pendiente (por ejemplo, de `/cotizacion/<token>` a `/pago/mock/<checkout>`).

### Steps to reproduce
1. En Firefox, aceptar una cotización y pulsar pagar (carga de `/pago/mock/<checkoutId>`).
2. Revisar la consola o los `pageerror`.

### Expected result
La hidratación termina sin errores y React conserva el HTML del servidor.

### Actual result
`pageerror`: «Minified React error #418» (hydration mismatch, «HTML»). React descarta el HTML del servidor y re-pinta todo en el cliente: parpadeo, pérdida de foco y de estado, y trabajo extra en celulares. El guard hacía fallar PAY-001 y EVT-024 aunque todos sus asserts pasaban.

### Evidence
- Sin la corrección: NAV-037…039 (entonces NAV-034…036) FAIL 3/3 en Firefox (`test-results/l2-evidence/HYDRATION-418/`, worktree del carril 2).
- Sobre la base `86b60de`: `test-results/l3-evidence/minors/{xb-fail,xb-repeat-artifacts,pay001-firefox-artifacts,base-86b60de-firefox}` (worktree del carril 3).
- Instrumentación temporal de `react-dom` (una copia del chunk, después restaurada y comparada con `cmp`): el fallo sale de `replaySuspendedUnitOfWork` → `beginWork(HostComponent)`.

### Console errors
`Minified React error #418` (pageerror), sólo en Firefox.

### Network errors
Ninguno.

### Technical analysis
- Next pasa el componente de `error.tsx` **por valor** (`"error":"$10"`) al router del segmento.
- Si su chunk llega tarde, el hijo del `<div>` que envuelve `children` en el layout suspende.
- Al reintentarlo, React vuelve a reclamar el mismo nodo del DOM con el cursor de hidratación ya adentro, y eso produce el #418.
- Sólo pasa en Firefox, por el orden en que carga los chunks en caché. No se reproduce con `next dev` (4/4) ni en Chromium o WebKit. No viene de fechas, horas ni `Intl`.

### Suspected root cause
Un defecto de React `19.2.0-canary-0bdb9206` (incluido en Next 15.5.27) al reintentar un elemento HTML suspendido durante la hidratación, disparado por la estructura de los layouts.

### Recommended fix
Evitar que el hijo directo del elemento HTML sea el nodo perezoso del router, con un envoltorio sin DOM y key constante. Al actualizar Next, verificar sin el envoltorio.

### Fix

**Causa raíz final.** La de arriba.

**Corrección.** Nuevo `src/components/layout/segment-children.tsx`: un Fragment con key constante, sin DOM.
- Se aplica a los 7 layouts que tienen `error.tsx` hermano y pintan `children` dentro de un elemento HTML: `pago`, `(public)`, `admin`, `catalog`, `content`, `events/[id]` y `settings`.
- Los layouts por token de `(experience)` devuelven `children` directo, y `staff` no tiene `error.tsx`.

**Commits.** `a3309b7` (merge `f0cb1b1`).

**Pruebas @regression.** [NAV-037], [NAV-038] y [NAV-039] tests/e2e/navigation/hydration.spec.ts (`@P0`; antes NAV-034…036). Retrasan sólo el chunk de `error.tsx` y exigen cero `pageerror` y que `<main id="contenido">` sea el mismo nodo que llegó del servidor.

**Verificación.**
- Sin la corrección, NAV-037…039 FAIL 3/3 en Firefox. Con ella pasan en Firefox, WebKit y Chromium con `--repeat-each=5`.
- PAY-001 en Firefox: 5/5 (antes fallaba 3 de 5). Diagnóstico por clic: 0/12 con error (antes 8/12).
- Carpetas requeridas con `E2E_CROSS_BROWSER=1`: 355 PASS, 1 FLAKY (QUO-018, corregido después) y 1 omitida.
- Carpetas relacionadas: 234/234. Suites globales: 24/24.

**Riesgos residuales y decisiones.**
- **Al actualizar Next** (ver BUG-006): comprobar NAV-037…039 en Firefox **sin** el envoltorio antes de quitarlo.
- **Convención para layouts nuevos.** Todo layout nuevo con `error.tsx` hermano que pinte `children` dentro de un elemento HTML debe usar `<SegmentChildren>`. Conviene anotarlo en CLAUDE.md, que no se editó.
- **ID duplicado — resuelto.** Estas pruebas pasaron de NAV-034…036 a NAV-037…039, porque NAV-034 ya era el 404 real de BUG-013. NAV-035 y NAV-036 quedan retirados y no se reutilizan.

---

## BUG-021 — Lo escrito antes de hidratar se borraba en formularios públicos y del portal

**Severity:** LOW
**Priority:** P2
**Status:** Verified
**Type:** UX ISSUE (se pierde lo escrito en celulares lentos)
**Module:** memory-capsule (libro de visitas y subida) · marketing (contacto) · guests (RSVP) · portal (acceso, mensajes, opinión, dirección) · ai-designer
**Role:** Invitada, Clienta y Anónimo
**Environment:** TEST — build de producción local; carril 2 (`:3202`) para la cápsula y carril 7 para el resto; Chromium, mobile-chrome, Firefox y WebKit
**Reproducible:** Sí.
- [CRIT-008] en WebKit, intermitente en el flujo natural.
- Con el JS de la página retenido, las regresiones nuevas fallan sin la corrección: 4 de 4 en chromium y mobile-chrome, y 3 de 3 en firefox y webkit. MEM-021 falla en chromium y firefox.
- [CRIT-010] fallaba 3 de 5 en WebKit por la misma causa: el nombre quedaba vacío.

**Test:** [MEM-021] tests/e2e/memory/memory-public.spec.ts · [PUB-049] tests/e2e/public/contact.spec.ts · [GST-026], [GST-027] tests/e2e/guests/rsvp.spec.ts · [PORT-021], [PORT-022] tests/e2e/portal/portal.spec.ts · [CRIT-008] tests/e2e/critical/experience.spec.ts
**Fuentes:**
- Endurecimiento cross-browser: CRIT-008 en WebKit (`0e35e58`).
- Revisión del carril 3: «CRIT-010 oculta un problema UX real».
- Revisión cross-browser: «el mismo patrón sigue en otros formularios públicos».
- Observación previa «Carrera de hidratación en formularios con react-hook-form» (carriles 3, 4 y 5).

### Preconditions
Un formulario público o del portal que se ve en el HTML del servidor antes de que su JS hidrate (red móvil lenta).

### Steps to reproduce
1. Abrir `/memory/<token>` (o `/contacto`, `/e/<slug>/<token>`, `/mi-evento`, los mensajes del portal…) y escribir en «Tu nombre» antes de que la página hidrate.
2. Esperar a que hidrate y enviar.

### Expected result
Lo escrito se conserva y llega completo.

### Actual result
Con `defaultValues { name: "" }`, react-hook-form escribe `""` en el DOM al registrar el campo durante la hidratación y borra lo escrito. El envío falla por un campo obligatorio vacío («Escribe tu correo.», «Escribe tu mensaje.»), o la persona tiene que volver a escribir.

### Evidence
- CRIT-008 en WebKit: el snapshot muestra «Tu nombre» vacío e inválido y el mensaje intacto.
- Revisión de `e2f3699`: al interceptar el chunk de producción con los `defaultValues` vacíos de antes, el nombre escrito antes de hidratar queda vacío en el RSVP (link general) y en `/contacto`.

### Console errors
Ninguno.

### Network errors
Ninguno.

### Technical analysis
- react-hook-form 7.89 (`updateValidAndValue`) escribe el valor por defecto en el DOM cuando está definido. Sin valor por defecto, lee lo que ya hay en el DOM.
- Formularios afectados: `guestbook-form.tsx`, `guest-upload-form.tsx`, `contact-form.tsx`, `rsvp-panel.tsx`, `access-form.tsx`, `message-thread.tsx`, `address-editor.tsx` (llega abierto cuando no hay dirección), `review-form.tsx` y `designer-form.tsx`.

### Suspected root cause
`defaultValues` con cadenas vacías en formularios que se ven desde el HTML del servidor.

### Recommended fix
Quitar de `defaultValues` los campos de texto vacíos (o leer el DOM al montar) y agregar regresiones al estilo de MEM-021.

### Fix

**Causa raíz final.** La de arriba.

**Corrección.**
- **Cápsula** (`0e35e58`): sin esos `defaultValues` en `guestbook-form` y `guest-upload-form`.
- **Resto** (`e2f3699`):
  - **Contacto:** sólo conserva `{ consent: false }`.
  - **Acceso y mensajes:** sin `defaultValues`; `reset({ email: "" })` y `reset({ body: "" })` siguen limpiando.
  - **RSVP:** los valores guardados pasan a `defaultValue` del propio campo, así el nombre se ve desde el HTML y RHF lo lee del DOM. Sólo conservan su valor por defecto los campos que pueden empezar ocultos: el acompañante y las notas para la cocina después de «No podré ir».
  - **Dirección:** el mismo esquema, y `reset(initial)` al cancelar.
  - **Opinión:** sin `comment: ""`.
  - **Diseñadora:** sin valores por defecto en perfil, edad y gustos.
- **Sin cambio:**
  - los campos controlados (Select, Checkbox, radios) y la validación Zod;
  - los formularios que sólo existen después de un clic (agregar invitada, aceptar o rechazar propuesta, preferencias…), que no lo necesitan.
- **Ayudantes de prueba:** `holdPageChunk` y `fillBeforeHydration`, en `tests/e2e/events/_helpers.ts`.

**Commits.** `0e35e58` (merge `f0cb1b1`); `e2f3699`.

**Pruebas @regression.**
- [MEM-021] (@P0 @mobile) tests/e2e/memory/memory-public.spec.ts.
- [PUB-049] (@P0) tests/e2e/public/contact.spec.ts.
- [GST-026] (@P0) y [GST-027] (@P1, protege el valor por defecto condicional de las notas) tests/e2e/guests/rsvp.spec.ts.
- [PORT-021] (@P1) y [PORT-022] (@P0) tests/e2e/portal/portal.spec.ts.

**Verificación.**
- **CRIT-008** en WebKit: 5/5.
- **MEM-021:** chromium y mobile-chrome 10/10, firefox 5/5. Memory y critical completos pasan en los 3 navegadores.
- **Regresiones nuevas** con `--repeat-each=5 --retries=0`: chromium + firefox 35/35 y mobile-chrome + webkit 35/35.
- **Carril 7** (public, guests, portal, memory y critical; 4 navegadores): 190 PASS, 1 omitida (MEM-021 en WebKit) y 1 FLAKY ajeno (CRIT-007 en Firefox, `NS_BINDING_ABORTED`). Unitarias: 922.
- **Revisión independiente** (carril 8): 15/15 sin reintentos. Confirmó que GST-026 y PUB-049 fallarían sin la corrección.

**Riesgos residuales.**
- **Textarea con un valor guardado.** Si se edita antes de hidratar, vuelve a ese valor al hidratar. Es comportamiento de React (`initTextarea`) y sólo afecta notas que puso la anfitriona.
- **Dirección (teórico).** Si `initial` de `address-editor` cambia con el formulario abierto, React muestra el valor nuevo en los campos no tocados, pero RHF guardaría el anterior.
- **Diseñadora.** Si el perfil se escribe antes de hidratar, el contador queda en «0/240» hasta la siguiente tecla, y ese contador es el `aria-describedby` del campo. Sin corregir; ver «Hallazgos nuevos sin triage».
- **Cobertura de las pruebas:**
  - GST-026, PORT-021 y PORT-022 no comprueban que el campo siga sin hidratar al escribir (PUB-049 y MEM-021 sí).
  - Opinión, dirección y diseñadora no tienen regresión propia.
  - El commit dice 35/35 para chromium + firefox, pero con 5 repeticiones serían 40: GST-027 no entró en esa repetición.
  - MEM-021 seguía omitida en WebKit. **Resuelto:** ahora corre ahí con `fillBeforeHydration` (ver «Notas de reporters y ejecución», nota 11).
- **Pendiente de decisión:** los formularios del panel admin conservan el mismo patrón de `defaultValues` vacíos (observación de los carriles 3, 4 y 5).

---

## BUG-022 — Restablecer la propia contraseña desde Staff revocaba la sesión en silencio

**Severity:** LOW
**Priority:** P3
**Status:** Verified
**Type:** APPLICATION BUG (sesión / UX)
**Module:** staff (`resetStaffPassword`, `/admin/staff/[id]`)
**Role:** OWNER o SUPER_ADMIN con una ficha de staff ligada a su propia cuenta
**Environment:** TEST — build de producción local `:3204`, base `ivonne_rosa_e2e_l4`, sobre `86b60de`; Chromium
**Reproducible:** Sí: por revisión de código de `b24c695` y por la prueba [AUTH-064].
**Test:** [AUTH-064] tests/e2e/auth/session.spec.ts
**Fuentes:** revisión adversarial de BUG-001/004/005 (ronda 1, menor 6) → endurecimiento del carril 4. Lo introdujo la corrección de BUG-004 (`b24c695`), que hizo que `resetStaffPassword` incrementara `sessionVersion`; en `f26b1a1` el reset no revocaba nada.

### Preconditions
Una fundadora con ficha de staff ligada a su propia cuenta.

### Steps to reproduce
1. En `/admin/staff/<su ficha>`, pulsar «Restablecer contraseña» y poner una nueva.
2. Seguir usando el panel.

### Expected result
Lo mismo que en Ajustes › Usuarios: un aviso explícito («Se cerrarán todas tus sesiones, incluida ésta»), cierre de la sesión actual y navegación a `/login` para entrar con la contraseña nueva.

### Actual result
La versión de sesión se incrementaba, y con eso la sesión quedaba revocada, pero no había `signOut` ni redirección. En el siguiente request la persona era enviada a `/login` sin explicación.

### Evidence
- Revisión de `b24c695`: `canAssignRole` permite el auto-reset desde `/admin/staff/[id]`, y `resetStaffPassword` no distinguía `user.id === actor.id`.
- [AUTH-064] exige ahora:
  - el flujo en la UI;
  - la cookie borrada;
  - la auditoría con `self: true`;
  - la cookie anterior revocada;
  - la entrada con la contraseña nueva.

### Console errors
Ninguno.

### Network errors
Ninguno.

### Technical analysis
`src/features/staff/server/staff-service.ts` (`resetStaffPassword`) y `src/features/staff/server/actions.ts` no tenían rama para el propio usuario, a diferencia de `resetUserPasswordAction`.

### Suspected root cause
Al corregir BUG-004, el flujo de reset propio sólo se implementó en Usuarios.

### Recommended fix
Replicar `resetUserPasswordAction`: devolver `signedOut`/`self`, llamar `signOut({ redirect: false })` y hacer una navegación completa a `/login`. Otra opción es bloquear el auto-reset en Staff.

### Fix

**Causa raíz final.** La de arriba.

**Corrección.**
- El servicio devuelve `self` y lo audita en la misma transacción (`self: true`).
- La acción hace `signOut({ redirect: false })` y la UI navega a `/login` con el aviso «Se cerrarán todas tus sesiones, incluida ésta».
- Sobre la propia ficha ya no se ofrece «Desactivar acceso».

**Commits.** `ebb5fac` (merge `c3ba279`).

**Pruebas @regression.** [AUTH-064] tests/e2e/auth/session.spec.ts · integración en `operations-staff.test.ts`.

**Verificación.**
- AUTH-064 pasa, y 5/5 con `--repeat-each=5 --retries=0`.
- Staff y settings: 47/47.
- `pnpm test:integration`: 318/318.

**Riesgos residuales.** En el auto-reset, el campo sigue rotulado «Contraseña temporal». El toast de éxito se pierde con la navegación inmediata y `/login` no muestra confirmación.

---

## BUG-023 — `GET /api/auth/session` re-emitía la cookie de sesión (latente)

**Severity:** LOW
**Priority:** P3
**Status:** Verified
**Type:** APPLICATION BUG (latente: la app no llama ese endpoint)
**Module:** auth (`src/app/api/auth/[...nextauth]/route.ts`)
**Role:** cualquier persona del equipo con sesión
**Environment:** TEST — build de producción local `:3204`, base `ivonne_rosa_e2e_l4`, sobre `86b60de`; Chromium
**Reproducible:** Sí. [AUTH-059] falla con el handler original (mutación) y pasa con la corrección.
**Test:** [AUTH-059] tests/e2e/auth/session-renewal.spec.ts
**Fuentes:** revisión adversarial de BUG-001 (ronda 1, menor 7) → endurecimiento del carril 4

### Preconditions
Una sesión iniciada y algo que llame `GET /api/auth/session`. Hoy nada lo llama: no hay `SessionProvider` ni `useSession`.

### Steps to reproduce
1. Con una sesión reciente, llamar `GET /api/auth/session`.
2. Revisar el `Set-Cookie` de la respuesta.

### Expected result
Ningún `Set-Cookie` de renovación; los borrados sí se conservan.

### Actual result
El matcher del middleware excluye `/api`, así que el handler de Auth.js re-codificaba y re-emitía `authjs.session-token` en cada llamada. Si un cambio futuro usara `useSession`, una petición en vuelo durante el logout volvería a escribir la cookie. La revocación de BUG-001 seguiría bloqueando el acceso, pero se perdería en silencio la garantía de que el logout es definitivo en el navegador.

### Evidence
[AUTH-059] FAIL con el handler original (mutación temporal). [API-050] no cambia.

### Console errors
Ninguno.

### Network errors
Ninguno.

### Technical analysis
- `src/middleware.ts`: su matcher no incluye `/api`.
- `src/app/api/auth/[...nextauth]/route.ts`: los handlers de Auth.js no tenían el filtro `withoutSessionCookieRenewal` que usa el middleware.

### Suspected root cause
La corrección de BUG-001 sólo filtró la re-emisión en el middleware.

### Recommended fix
Envolver el GET de `/session` con el mismo filtro, o prohibir `SessionProvider`/`useSession` con una regla de lint.

### Fix

**Causa raíz final.** La de arriba.

**Corrección.** `src/app/api/auth/[...nextauth]/route.ts` envuelve el GET de `/session` con `withoutSessionCookieRenewal`: nunca re-emite la cookie y conserva los borrados.

**Commits.** `28fb8d3` (merge `c3ba279`).

**Pruebas @regression.** [AUTH-059] tests/e2e/auth/session-renewal.spec.ts.

**Verificación.** AUTH-059 pasa, y 5/5 con `--repeat-each=5 --retries=0`. Auth, navigation, permissions y api: 271/271.

**Riesgos residuales.** El endpoint todavía decodifica una cookie revocada y devuelve nombre, correo y rol (ver BUG-004).

---

## BUG-024 — Firefox: etiquetas, descripciones y `aria-controls` desligados cuando el `useId` del cliente difiere del HTML del servidor

**Severity:** MEDIUM
**Priority:** P2
**Status:** Verified
**Type:** APPLICATION BUG (accesibilidad; desencadenado por un defecto de React 19.2-canary incluido en Next 15.5.27)
**Module:** formularios compartidos (`Field`, `FieldGroup`, `ChipFrame`, `NpsScale`, `CustomerPicker`) y alta de evento
**Role:** OWNER/SUPER_ADMIN (panel), clienta (portal), visitante (diseñadora IA)
**Environment:** TEST — build de producción local, carriles 3–5; Firefox (~10 % de las cargas); reproducible de forma determinista en Chromium simulando la divergencia
**Reproducible:** Sí. [EVT-005] en Firefox 1/8 («Nombre» sin etiqueta); [CUST-017] 0/2 con el build anterior
**Test:** [EVT-040] tests/e2e/events/events.spec.ts · [CUST-017] tests/e2e/customers/customers.spec.ts
**Fuentes:** inestabilidad de [EVT-005] en la regresión final (Firefox) → corrección de inestables

### Preconditions
Firefox; una página del panel, del portal o de la diseñadora IA cuya hidratación todavía encuentra pendiente un hijo lazy de RSC.

### Steps to reproduce
1. Abrir `/admin/events/new` en Firefox. También se puede simular la divergencia reescribiendo los `for`/`id` del HTML antes de hidratar, como hacen EVT-040 y CUST-017.
2. Elegir «Nueva clienta», o provocar un error de validación en un campo con descripción.
3. Revisar el nombre accesible de «Nombre» y la descripción accesible del campo con error.

### Expected result
Cada campo conserva su etiqueta (`<label for>` = `id` del input), su descripción y su error en `aria-describedby`, y `aria-controls` apunta a la lista correcta.

### Actual result
- «Nombre» queda sin etiqueta asociada: un lector de pantalla lo anuncia sin nombre y el clic en la etiqueta no lo enfoca.
- Al aparecer un error, la descripción deja de anunciarse.
- En `CustomerPicker`, `aria-controls` apunta a un id inexistente.

Medido: 30 de 32 atributos de id de `/admin/events/new` difieren entre servidor y cliente.

### Evidence
Commits `4b79477` y `412c035` (mensajes con la medición). EVT-005 en Firefox: 1/8 antes. CUST-017: 0/2 antes y 4/4 después. EVT-040: 16/16 después.

### Console errors
Ninguno: React no avisa, porque no reescribe atributos ya pintados.

### Network errors
Ninguno.

### Technical analysis
Ocurre en el React 19.2.0-canary-0bdb9206 que trae Next 15.5.27:
1. Durante la hidratación, una fibra que no es función (Provider, Fragment o host) e hija de un arreglo se suspende al reconciliar un hijo lazy de RSC.
2. `replayBeginWork` la reinicia con `resetWorkInProgress`. La máscara borra el flag *Forked*, así que `beginWork` ya no llama a `pushTreeId`.
3. Todo el subárbol calcula otros `useId`. React conserva los atributos ya pintados, pero usa SU id en lo que monta o actualiza después.

`OuterLayoutRouter` de Next devuelve justo ese arreglo de `TemplateContext.Provider`, y la app no lo controla. Es la misma familia de defecto que BUG-020 (`SegmentChildren`).

### Suspected root cause
Defecto de React/Next: el replay de una fibra suspendida durante la hidratación pierde el árbol de ids. La app no puede corregirlo en su origen.

### Recommended fix
Mitigar en la app: si el id con el que el servidor pintó el grupo difiere del generado, adoptarlo.

### Fix

**Corrección.**
- `4b79477`: cada variante del bloque «Clienta» de `new-event-form.tsx` lleva su `key`, así que al cambiar de modo se montan campos nuevos con label e input del mismo id.
- `412c035`: hook `usePaintedId(generated, ref, { attr, suffix })` en `src/components/forms/use-painted-id.ts`. Al hidratar lee el id pintado por el servidor y, si difiere, lo adopta para todo el grupo; en un montaje normal no hace nada. Se aplicó a `Field` (etiqueta), `FieldGroup` y `ChipFrame` (descripción), `NpsScale` (pista) y `CustomerPicker` (`aria-controls`).

**Pruebas @regression.** [EVT-040] (@a11y) y [CUST-017] (@a11y, @P2). Las dos simulan la divergencia de forma determinista y exigen etiqueta, descripción + error, `aria-invalid` y foco por la etiqueta.

**Verificación.** CUST-017 pasa de 0/2 a 4/4. EVT-040: 16/16. EVT-005 sin fallos de etiqueta en 16 corridas. Revisión adversarial: *approve*, sin problemas blocker ni major.

**Riesgos residuales.**
- Radix: `aria-controls` de Dialog/Select/Popover y el nombre de los paneles de Tabs/Accordion montados después no se pueden fijar sin envolver la librería (severidad baja).
- Se revisaron más de 15 consumidores directos de `useId` y hoy no se rompen: son pares estáticos o se montan en el cliente. Un componente nuevo que mezcle una descripción pintada por el servidor con un error condicional debe usar `usePaintedId` (regla en `CLAUDE.md`).
- **Criterio de retiro:** quitar el hook cuando Next incluya un React que conserve *Forked* al reiniciar una fibra durante la hidratación y CUST-017 y EVT-040 pasen en Firefox sin él.

---

## Mapa de IDs provisionales

Los 31 IDs provisionales de los carriles de la auditoría (fuente: `docs/qa/.bug-map.json`). Todos los bugs finales están en estado **Verified**; BUG-006, **Verified (mitigado)**. Cada hallazgo de `docs/qa/findings/*.md` lleva una sección «Resolution», «Fix», «Corrección» o «Seguimiento» con su detalle.

| ID provisional | BUG final | Estado | Carril | Prueba(s) |
|---|---|---|---|---|
| ACC-BUG-01 | BUG-001 | Verified | 1 — Acceso y seguridad | [AUTH-032] tests/e2e/auth/session.spec.ts (+ variante natural [AUTH-020], [AUTH-021], [AUTH-025]) |
| ACC-BUG-02 | BUG-004 | Verified | 1 — Acceso y seguridad | [AUTH-025] tests/e2e/auth/session.spec.ts |
| ACC-BUG-03 | BUG-005 | Verified | 1 — Acceso y seguridad | [AUTH-049] tests/e2e/auth/callback.spec.ts |
| ACC-BUG-04 | BUG-013 | Verified | 1 — Acceso y seguridad | [NAV-002] tests/e2e/navigation/not-found.spec.ts |
| ACC-BUG-05 | BUG-016 | Verified | 1 — Acceso y seguridad | [NAV-015] tests/e2e/navigation/links.spec.ts |
| SAL-BUG-01 | BUG-007 | Verified | 2 — Venta pública | [PAY-019] tests/e2e/payments/payments.spec.ts |
| SAL-BUG-02 | BUG-008 | Verified | 2 — Venta pública | [CONF-022] tests/e2e/configurator/server.spec.ts |
| SAL-BUG-03 | BUG-002 | Verified | 2 — Venta pública | [PAY-021] tests/e2e/payments/payments.spec.ts |
| SAL-BUG-04 | BUG-009 | Verified | 2 — Venta pública | [PAY-022] tests/e2e/payments/payments.spec.ts |
| SAL-BUG-05 | BUG-012 | Verified | 2 — Venta pública | [QPUB-015] tests/e2e/quote-public/quote-public.spec.ts |
| SAL-BUG-06 | BUG-010 | Verified | 2 — Venta pública | [QPUB-014] tests/e2e/quote-public/quote-public.spec.ts |
| SAL-BUG-07 | BUG-013 | Verified | 2 — Venta pública | [PUB-016] tests/e2e/public/site.spec.ts |
| COM-BUG-01 | BUG-014 | Verified | 3 — Comercial admin | [LEAD-036] tests/e2e/leads/leads-detail.spec.ts (control [LEAD-035]) |
| COM-BUG-02 | BUG-008 | Verified | 3 — Comercial admin | [CUST-016] tests/e2e/customers/customers.spec.ts |
| COM-BUG-03 | BUG-006 | Verified (mitigado) | 3 — Comercial admin | [LEAD-037], [LEAD-011] tests/e2e/leads/leads-list.spec.ts |
| EVX-BUG-01 | BUG-002 | Verified | 4 — Eventos y experiencia | [EVT-024] tests/e2e/events/event-status.spec.ts |
| EVX-BUG-02 | BUG-006 | Verified (mitigado) | 4 — Eventos y experiencia | [CAL-002] tests/e2e/calendar/calendar.spec.ts · [EVT-038] tests/e2e/events/events.spec.ts · [GST-011], [GST-012], [GST-015] tests/e2e/guests/rsvp.spec.ts |
| EVX-BUG-03 | BUG-003 | Verified | 4 — Eventos y experiencia | [GST-014] tests/e2e/guests/rsvp.spec.ts |
| EVX-BUG-04 | BUG-009 | Verified | 4 — Eventos y experiencia | [EVT-037] tests/e2e/events/event-experience.spec.ts · [CAL-007] tests/e2e/calendar/calendar.spec.ts · [MEM-019] tests/e2e/memory/memory-public.spec.ts |
| EVX-BUG-05 | BUG-010 | Verified | 4 — Eventos y experiencia | [GST-022] tests/e2e/guests/rsvp.spec.ts |
| OPX-BUG-01 | BUG-006 | Verified (mitigado) | 5 — Operación y back-office | [INV-025] tests/e2e/inventory/inventory.spec.ts |
| OPX-BUG-02 | BUG-006 | Verified (mitigado) | 5 — Operación y back-office | [CNT-022], [CNT-023], [CNT-024] tests/e2e/content/content.global.spec.ts · [NOT-002] tests/e2e/notifications/inbox.spec.ts (relacionado: [SET-001] tests/e2e/settings/settings.spec.ts) |
| OPX-BUG-03 | BUG-015 | Verified | 5 — Operación y back-office | [FIN-007] tests/e2e/finance/finance.spec.ts |
| OPX-BUG-04 | BUG-016 | Verified | 5 — Operación y back-office | [NOT-007] tests/e2e/notifications/inbox.spec.ts |
| OPX-BUG-05 | BUG-011 | Verified | 5 — Operación y back-office | [STF-024] tests/e2e/staff/staff-portal.spec.ts (su parte de contraste se documenta en BUG-009) |
| TRV-BUG-01 | BUG-006 | Verified (mitigado) | 6 — Transversal | [CRIT-004] tests/e2e/critical/experience.spec.ts |
| TRV-BUG-02 | BUG-009 | Verified | 6 — Transversal | [A11Y-009], [A11Y-012], [A11Y-013], [A11Y-014], [A11Y-015], [A11Y-018] tests/e2e/accessibility/a11y.spec.ts |
| TRV-BUG-03 | BUG-009 | Verified | 6 — Transversal | [A11Y-008], [A11Y-011] tests/e2e/accessibility/a11y.spec.ts |
| TRV-BUG-04 | BUG-010 | Verified | 6 — Transversal | [A11Y-007], [A11Y-010] tests/e2e/accessibility/a11y.spec.ts |
| TRV-BUG-05 | BUG-012 | Verified | 6 — Transversal | [A11Y-028] tests/e2e/accessibility/a11y.spec.ts |
| TRV-BUG-06 | BUG-001 | Verified | 6 — Transversal | [CRIT-014], [CRIT-012] tests/e2e/critical/access.spec.ts |

**Bugs nuevos sin ID provisional.** Se encontraron durante las correcciones y no están en `.bug-map.json`, que sólo mapea los IDs de la auditoría.

| BUG | Origen (workflow · agente) | Dónde está documentado | Prueba(s) |
|---|---|---|---|
| BUG-017 | Revisión de BUG-008 (ronda 1) → endurecimiento del carril 3 | `findings/commercial.md` › COM-BUG-02 › Resolution («Riesgo real corregido») | [PUB-048], [CONF-021] |
| BUG-018 | Endurecimiento de sesión y login (carril 4), hallazgo nuevo | `findings/access.md` › Seguimiento de BUG-001/004/005 («Hallazgo nuevo») | integración `operations-staff.test.ts` |
| BUG-019 | Pendiente de `e2f3699` y su revisión | Sólo en este documento y en el commit `d96a82a` (no se actualizó `findings/`) | [GST-028], [PORT-023], [PORT-024], [PORT-025], [CONF-025] |
| BUG-020 | Endurecimiento cross-browser (carril 2) y carril 3 | `findings/sales.md` › SAL-BUG-01 › Revisión adversarial propia (todavía figura como «hallazgo abierto»; se corrigió en `a3309b7`) | [NAV-037]…[NAV-039] (hydration.spec.ts; antes NAV-034…036) |
| BUG-021 | Endurecimiento cross-browser (CRIT-008) y `e2f3699` | Sólo en este documento y en los commits `0e35e58` y `e2f3699` | [MEM-021], [PUB-049], [GST-026], [GST-027], [PORT-021], [PORT-022] |
| BUG-022 | Revisión de BUG-004 (ronda 1) → endurecimiento del carril 4 | `findings/access.md` › Seguimiento de BUG-001/004/005 | [AUTH-064] |
| BUG-023 | Revisión de BUG-001 (ronda 1) → endurecimiento del carril 4 | `findings/access.md` › Seguimiento de BUG-001/004/005 | [AUTH-059] |

---

## Observaciones (no son bugs)

Consolidadas de los 6 carriles de la auditoría y deduplicadas. No cuentan para el gate; se listan con su prueba o evidencia. Cada observación lleva su estado tras las correcciones: **[Resuelta]** (con el bug o la prueba que la resolvió), **[Parcial]**, **[Decidida]** (el requisito ya quedó definido), **[Sin cambio]**, **[Sin verificar]**, **[Vigente]** (comportamiento correcto que se mantiene) o **[Nota]**. Al final se agregan los hallazgos nuevos sin triage que se vieron durante las correcciones.

### Seguridad y diseño
- **[Sin cambio]** **Superficie expuesta por co-ubicación de Server Actions:** la página pública `/memory/[token]` incluye las 7 acciones de administración de la cápsula y `/staff/events/[id]` las 6 de administración de staff (Next agrega todas las exportaciones del módulo `"use server"`). Hoy las frena el RBAC de cada acción ([PERM-121..127], [PERM-130..138] PASS); conviene separar acciones públicas y de admin en módulos distintos. *(carril 1)*
- **[Sin cambio]** **Validación antes de autorización:** `src/server/action.ts:71-74` corre Zod antes de autorizar ⇒ un anónimo que llama una acción protegida con datos inválidos recibe `VALIDATION_ERROR` con los mensajes de campo (revela el esquema). Autenticar/autorizar antes de validar en `protectedAction`. *(carril 1)*
- **[Sin cambio]** **Rate limit de login sólo por correo** (`src/auth.ts:40`): cualquiera puede bloquear 15 min una cuenta conocida con 9 intentos ([AUTH-061], suite `ratelimit` en `:3209`). Considerar límite combinado correo+IP y desbloqueo por admin. *(carril 1)*
- **[Sin cambio]** **`clientIp()` confía en `X-Real-Ip`** (`src/lib/rate-limit.ts:55`): correcto detrás de Traefik (que la sobreescribe), pero sin proxy los límites por IP se evaden variando esa cabecera. Documentar el requisito en DEPLOY. *(carril 1)*
- **[Sin cambio]** **Documentación de `Referrer-Policy` desalineada:** `docs/SECURITY.md` dice `no-referrer` en páginas por token; el middleware envía `same-origin` ([PERM-170] PASS) y `/cotizacion/[token]` además declara `<meta name="referrer" content="no-referrer">` (`page.tsx:43`), que en el documento anula la cabecera; el comentario del middleware advierte que `no-referrer` puede dejar `Origin: null` en los POST de Server Actions. Conviene alinear la doc y confirmar aceptar/rechazar en todos los navegadores. *(carril 1)*
- **[Sin cambio]** **CSRF en Server Actions:** con `Origin` ajeno Next rechaza la acción (no escribe) pero responde **HTTP 500** con `digest` en lugar de un 4xx ([PERM-159] PASS; comportamiento de Next 15.5 que ensucia logs/alertas de 5xx). *(carril 1)*
- **[Sin cambio — por diseño]** **Disponibilidad pública** expone `remaining` (lugares restantes por día): por diseño; no expone datos de otros eventos ([CONF-016]). *(carril 2)*

### UX y funcionalidad
- **[Parcial]** **Carrera de hidratación en formularios con `react-hook-form`:** lo que se escribe o selecciona antes de que React hidrate se descarta en silencio (un `select` nativo cambia en el DOM pero el formulario no lo ve; alta/edición de evento, filtros, «Transporte y montaje»: la salida de bodega no se guardó en la primera versión de [OPS-016]). En celulares lentos el staff o la fundadora podrían perder lo tecleado. Sugerencia: deshabilitar campos/botón hasta hidratar, como ya hacen compras/proveedores con `useHydrated`. Las pruebas esperan la hidratación (`gotoReady()`). *(carriles 3, 4 y 5)* **Actualización:** en los formularios públicos y del portal pasó a bug y se corrigió: BUG-021 (lo escrito se borraba) y BUG-019 (envío por GET antes de hidratar). En el panel admin sigue igual: ver «Pendientes que requieren decisión del usuario». `gotoReady()` espera ahora la hidratación real (`waitForHydration()`, `ae351f7`).
- **[Sin cambio, documentada]** **`notFound()` responde HTTP 200 en zonas privadas** (streaming bajo `loading.tsx`): `/admin/events/<id inexistente>` (anotación `http-status: 200` de [EVT-004]), detalles del panel ([NAV-004]) y `/staff/events/<id ajeno>` ([CRIT-005]; la barrera «No encontramos este evento» es correcta). Zonas con sesión y `noindex`, sin impacto de seguridad; misma causa que BUG-013. *(carriles 1, 4 y 6)* **Actualización:** la lista completa (19 rutas `/admin/**/[id]` y `/staff/events/[id]`) está en `docs/qa/findings/sales.md` › SAL-BUG-07 › «Revisión del patrón». Corregirlo es una mejora opcional (ver «Pendientes»).
- **[Sin cambio]** **404 dentro de `/admin`:** una URL inexistente muestra el 404 raíz sin el shell del panel ([NAV-003]); sólo los `notFound()` de detalle usan el 404 del panel. *(carril 1)*
- **[Sin verificar]** **`<meta name="robots" content="noindex">` duplicado** (2–3 veces) en las páginas 404 (incluida «Esta mesa ya no está puesta»); se corrige junto con BUG-013. *(carriles 1 y 2)* **Actualización:** BUG-013 dio el HTTP 404 real, pero la deduplicación no se verificó por separado: [PUB-016] usa `.first()`.
- **[Sin cambio]** **`callbackUrl` con sesión abierta:** `/login?callbackUrl=/admin/leads` ignora el `callbackUrl` y lleva al inicio del rol (menor). *(carril 1)*
- **[Resuelta por BUG-004]** **Cambio de rol con sesión abierta:** STAFF promovida a OWNER sigue en `/staff` hasta re-login (el middleware usa el rol del JWT) — sin riesgo (menos privilegio), sólo UX ([AUTH-029]). *(carril 1)* **Actualización:** un cambio de rol hecho desde la app (`changeUserRole`) revoca la sesión abierta y, al volver a entrar, aplica el rol nuevo ([AUTH-035]). [AUTH-029], que cambia el rol directamente en la base, sigue registrando el comportamiento anterior como anotación.
- **[Sin cambio]** **Formulario de contacto:** al salir de un campo inválido (modo `onTouched`) aparece su error y desplaza el layout; un clic inmediato en la casilla de consentimiento puede caer en el enlace «aviso de privacidad» del label (abre otra pestaña y no marca la casilla). No envolver el enlace dentro del área clicable o reservar espacio para el error. *(carril 2)*
- **[Sin cambio]** **Desbordamiento horizontal transitorio** de 14 px a 390 px en `/crear-experiencia`, medido justo al cargar; desaparece al asentarse hidratación/transiciones (0 px después). Posible «salto» visual en móviles lentos; [PUB-021] ahora mide tras asentar animaciones. *(carril 2)*
- **[Resuelta como TEST BUG]** **Contraste transitorio** del botón «Enviar mensaje» mientras pasa de deshabilitado a habilitado (axe a mitad de la transición: 2.32:1); estable después. *(carril 2)* **Actualización:** `axeCheck` espera a que terminen las animaciones finitas antes de medir, y [A11Y-005] quedó estable (endurecimiento, carril 4).
- **[Sin cambio]** **Metadatos en `<body>`:** Next 15.5 transmite title/description/OG al final del documento para navegadores y Googlebot; los rastreadores sin JS (facebookexternalhit, Twitterbot, WhatsApp, Slackbot) sí los reciben en `<head>` ([PUB-018], verificado con ese UA). Vigilar herramientas SEO que no ejecutan JS. *(carril 2)*
- **[Sin cambio]** **Cotizaciones en fechas no disponibles:** el admin puede crear/enviar cotizaciones en fechas bloqueadas o sin capacidad; por diseño (DOMAIN.md §Disponibilidad) se valida al aceptar. Sugerencia: aviso en «Cálculo en vivo» para no enviar propuestas que la clienta no podrá aceptar. *(carril 3)*
- **[Sin cambio]** **Descuento ≥ subtotal:** se limita al subtotal y deja la cotización en $0, que luego no se puede enviar («La cotización no tiene conceptos con precio»); el mensaje no menciona el descuento como causa ([QUO-013]). *(carril 3)*
- **[Sin cambio]** **Auditoría de inventario incompleta:** `addReservation` no deja entrada de auditoría, mientras editar cantidad, liberar y mermas sí. Considerar `inventory.reservation_added`. *(carril 5)*
- **[Sin cambio]** **Margen con 1 decimal** (7025 bps → «70.3 %») frente a 70.25 en el CSV: consistente, conviene documentarlo. *(carril 5)*
- **[Sin cambio]** **Historial de compras:** lista los campos cambiados en orden de `jsonb` («notas, concepto»), no en el orden del formulario. *(carril 5)*
- **[Sin cambio]** **`OrderButtons` etiqueta por posición** («Subir imagen 2»): ambiguo para lector de pantalla y frágil (agravante de BUG-006). *(carril 5)* No se corrigió con BUG-006, porque es otro problema de UX.

### Requisitos ambiguos (REQUIREMENT AMBIGUITY)
- **[Sin cambio; ahora afecta a todos los teléfonos]** **Teléfonos en CSV:** `toCsv` (`src/lib/csv.ts:6`) antepone `'` a valores que empiezan con `+`, `=`, `-`, `@`, así que los teléfonos internacionales salen como `'+525512345678` en leads ([LEAD-030]) e invitadas ([GST-006]). Protege contra inyección de fórmulas, pero altera datos de contacto; decidir si exportar el teléfono sin `+` o en columna de texto. *(carriles 3 y 4)* **Actualización:** desde BUG-008 todo teléfono se guarda como `+52…`, así que todos salen con `'` en el CSV.
- **[Decidida]** **Unicidad del teléfono:** sólo el correo es único (`Customer.email @unique`); dos clientas pueden compartir teléfono sin aviso ([CUST-009]), lo que vuelve ambigua la búsqueda por teléfono de la captura única (`findFirst`). Decidir si debe advertirse (relacionado con BUG-008). *(carril 3)* **Actualización:** regla adoptada en `fe9f23a` y documentada en `docs/DOMAIN.md`. El mismo teléfono con otro correo es otra persona. El teléfono sólo reutiliza a una clienta cuando no se escribió correo o ella no tiene. Se busca primero la forma canónica exacta, y un advisory lock evita duplicados por capturas simultáneas.
- **[Sin cambio]** **Rechazo de propuesta por token:** el lead se queda en `QUOTED` (sólo se registra actividad SYSTEM y aviso al equipo); [CRIT-003] valida el comportamiento actual. Confirmar con negocio si debe pasar a `LOST` o quedar para re-cotizar. *(carril 6)*
- **[Sin cambio]** **Cambios de invitadas/experiencia en eventos con reserva:** no recalculan el total de la reserva (`updateEvent` sólo audita). No se probó el recálculo porque no hay requisito documentado (NOT TESTED); riesgo para el paquete comercial. *(carril 4)*
- **[Resuelta por BUG-014]** **Avisos en captura manual de leads:** se trató como bug (BUG-014) porque la intención del código es no notificar capturas manuales, pero no hay requisito escrito. *(carril 3)* **Actualización:** la regla es explícita: sólo el canal `public` avisa.

### Accesibilidad
- **[Sin cambio]** `/admin/quotes/[id]/print`: la vista de impresión no tiene ningún encabezado (`h1`–`h6`); el título del documento es un `<p>`. *(carril 1)*
- **[Sin cambio]** Not-found de lead (`/admin/leads/<id inexistente>`): el único encabezado es un `h3` («Este lead no existe»); falta `h1`. *(carril 1)*
- **[Sin cambio]** `Section` (`src/components/layout/page-header.tsx:46-73`) renderiza `<section>` sin nombre accesible, así que no es landmark/region (p. ej. «Compras», «Staff», «Costos manuales» en Finanzas). Agregar `aria-labelledby` al `h2`. *(carril 5)*
- **[Sin cambio]** `StatCard` (`src/components/data/stat-card.tsx`): etiqueta y valor son `span/div` sin relación semántica (sin `dt/dd` ni `aria-labelledby`); un lector de pantalla los lee sueltos. *(carril 3)*
- **[Nota]** Calificación de testimonios: radios `sr-only` cuyo ícono intercepta el puntero; funciona con clic en la estrella (label) y con teclado. Sólo se anota. *(carril 5)*
- **[Nota]** Violaciones axe *moderate*/*minor*: no cuentan como fallo; se registran como anotación `a11y-observación` en cada prueba A11Y y en el adjunto `a11y-axe.json` de [STF-024] (`test-results/l6/results.json`, `test-results/l5/results.json`). *(carriles 5 y 6)*
- **[Positivo]** radiogroups del configurador navegables con flechas/espacio, foco al abrir diálogos, labels asociados en todos los formularios probados y `aria-invalid` en errores. Con Radix RadioGroup las flechas mueven y seleccionan según WAI-ARIA; el `press` instantáneo de Playwright no seleccionaba (artefacto de prueba corregido en [A11Y-021], no es bug). *(carriles 2 y 6)*

### Rendimiento
- Ninguna página superó 5 s de carga en ningún carril. Las 83 páginas de la matriz cargan con el rol principal en ~1–2 s (carril 1); páginas públicas < 2 s; páginas de eventos/calendario/portal < 2 s; acciones de inventario/compras < 1 s con 3 workers. *(carriles 1, 2, 4 y 5)*
- Recorridos: configurador completo (10 pasos + envío + revisión admin) ~11 s; pago mock completo (checkout → webhook → resultado) ~3 s; [CRIT-002] (≈10 pantallas, 3 actores) ~25–35 s en build de producción local. *(carriles 2 y 6)*
- **Payload RSC grande:** `/admin/leads` sin filtros devuelve ~176 KB de RSC con ~200 leads en base (tabla de 25 filas + opciones del formulario «Nuevo lead»). Observación para bases grandes. *(carril 3)*
- **Nuevo, costo de la mitigación de BUG-006.** Las navegaciones del cliente, `router.refresh()` y las Server Actions esperan la respuesta RSC completa, así que los Suspense internos ya no pintan por partes en navegaciones del cliente. Conviene medir en producción el tiempo hasta el contenido en páginas lentas.

### Comportamientos verificados correctos (referencia)
- **[Vigente]** Pagos manuales sobre eventos cancelados: bloqueados (`EVENT_CANCELLED`, [EVT-027]); el hueco es sólo el checkout en línea (BUG-002). *(carril 4)* El checkout en línea (BUG-002) ya está corregido.
- **[Vigente]** Recordatorios RSVP: deduplicación diaria por invitada y canal correcta ([GST-007]); la coincidencia con la llave del programador (`/api/cron/notifications`) quedó NOT TESTED en el carril 4. *(carril 4)*
- **[Vigente]** Teléfonos del configurador normalizados a `+52XXXXXXXXXX` en lead y clienta ([CRIT-001]). *(carril 6)* Desde BUG-008 todas las escrituras usan esa forma.
- **[Vigente]** La notificación `STAFF_ASSIGNED` generada por la app usa `/staff/events/<id>` ([OPS-010], [CRIT-005]); `/staff/eventos/…` sólo existe en el seed (BUG-016). *(carriles 5 y 6)* El seed ya también la usa (BUG-016).

### Hallazgos nuevos sin triage (vistos durante las correcciones; no cuentan para el gate)
Los agentes de corrección los vieron en barridos temporales o en revisión de código y **no los corrigieron**. No se reprodujeron dos veces con una prueba versionada, así que todavía no se clasifican como bugs. Si se confirman, serían bugs nuevos abiertos.
1. **axe `link-name` (serious) en todo `/admin` a menos de 640 px.** El enlace «Ver sitio» de `src/components/admin/admin-shell.tsx:128` oculta su texto con `hidden sm:inline` y en móvil se queda sin nombre accesible. Barrido temporal de la corrección de UI de la ronda 1.
2. **axe `scrollable-region-focusable` (serious) a 390 px.** Contenedores `overflow-x-auto` no enfocables: las tablas de `/admin/events/[id]/operations` y `/admin/analytics`, el `<pre>` de `/admin/settings/integrations` y la tabla de `/mi-evento/[token]/resumen`. Mismo barrido.
3. **Plantilla de correo con taupe de marca como texto.** `src/features/notifications/domain/templates.ts:153` usa `color:#A48F7E` (unos 2.8:1). axe no cubre los correos; es la misma causa que BUG-009.
4. **`marketingOptIn` desde el canal público.** `findOrCreateCustomer` (`src/features/leads/server/lead-intake.ts:75`) todavía suscribe a marketing a una clienta existente si quien escribe en el sitio marca la casilla: es un consentimiento dado por un tercero. Lo encontró la revisión del endurecimiento de BUG-008/BUG-017.
5. **Número de WhatsApp del negocio en Ajustes.** Se valida sólo con `/^\d{10,15}$/`, mientras la app usa `whatsappDigits()` (regla estricta). Con un valor como `0445512345678`, los botones públicos «Escríbenos por WhatsApp» generan `wa.me/?text=…` sin destinatario. Revisión del endurecimiento de BUG-008.
6. **Contador de la diseñadora IA.** Si el perfil se escribe antes de hidratar, queda en «0/240» hasta la siguiente tecla, y ese contador es el `aria-describedby` del campo. Revisión de `e2f3699`.

---

### Observaciones de la última ronda (revisión adversarial)
- **Next 15.5 + Firefox: navegar mientras sigue en vuelo un `router.refresh()`.** Firefox aborta el fetch y Next cae a «Falling back to browser navigation» hacia la URL actual, lo que anula la navegación de la usuaria. En las pruebas ([PUR-005], [STF-003], [OPS-010]) se sincroniza con `routerRefreshed()` (TEST BUG), pero el mecanismo puede afectar a una usuaria real en Firefox. Es una observación de baja prioridad del framework y se retira con la actualización de Next (ver BUG-006).
- **Login antes de hidratar:** [STF-021] ahora espera la hidratación antes de pulsar «Entrar». El envío nativo antes de hidratar sigue cubierto por las pruebas de AUTH.

## Pendientes que requieren decisión del usuario

| # | Decisión | Contexto | Bug |
|---|---|---|---|
| 1 | **Actualizar a Next ≥ 16.3.0** (cambio mayor) para retirar la mitigación de navegación | facebook/react#36134 sólo llega con el React que incluye Next 16.3.0 o posterior; subir `react`/`react-dom` no sirve con Next 15.5. Después: quitar `installNavigationGuard` y `<NavigationGuardBridge />`, correr las pruebas de BUG-006 con `--repeat-each=5 --retries=0` y verificar NAV-034…036 en Firefox sin `<SegmentChildren>` | BUG-006, BUG-020 |
| 2 | **Revocación por dispositivo en lugar de por cuenta** | Hoy «Cerrar sesión» cierra todas las sesiones de la cuenta en todos los dispositivos, y ningún texto lo avisa. La alternativa es revocar por `jti`/`sid` con una lista de revocadas hasta `exp` y dejar `sessionVersion` para reset, desactivación y rol. Requiere cambio de esquema | BUG-001, BUG-004 |
| 3 | **Formularios del panel admin con el mismo patrón de antes de hidratar** | Siguen con `defaultValues` vacíos (registrado en la observación de los carriles 3, 4 y 5 y en el pendiente de `e2f3699`). Decidir si se aplica el mismo tratamiento que en BUG-021 (y el de envío de BUG-019) o se acepta, porque son usuarias del equipo con sesión. En la regresión final, EVT-005 y PUR-002 agotaron `locator.fill` en Firefox (carriles 4 y 5); su causa está en análisis por las inestabilidades en curso y no está atribuida a este patrón | BUG-021, BUG-019 |
| 4 | Reembolso automático de cobros tardíos sobre reservas canceladas | Hoy el equipo reembolsa desde el panel después del aviso | BUG-002 |
| 5 | Columna de teléfono normalizada e indexada, o normalizar los datos existentes | Quitaría el recorrido de `Customer` en el respaldo por dígitos; requiere `schema.prisma` o una migración de datos | BUG-008 |
| 6 | Tope de auto-registros por evento relativo a `guestCount`, y recuperación segura de un link personal perdido | Hoy sólo hay un cupo de 60 por evento y 10 por IP cada 10 min | BUG-003 |
| 7 | Copia del aviso para la anfitriona ante un posible duplicado | Hoy le pide quitar su registro pendiente (el confiable); la revisión sugiere pedirle antes «confírmalo con ella» | BUG-003 |
| 8 | Expirar la sesión del proveedor cuando un pago manual cambia el saldo | Hoy esa sesión sigue cobrable hasta que vence a la hora, y el excedente se avisa al equipo | BUG-002 |
| 9 | Convención en CLAUDE.md: los layouts con `error.tsx` hermano que pinten `children` dentro de un elemento HTML deben usar `<SegmentChildren>` | CLAUDE.md no se editó | BUG-020 |
| 10 | Soft-404 de las rutas internas `/admin/**/[id]` y `/staff/events/[id]` | Es una mejora opcional; hoy responden 200 con `noindex` | BUG-013 |
| 11 | Re-sembrar las bases de desarrollo y demo (`pnpm db:setup`) | Hace falta para que lleguen los enlaces corregidos del seed | BUG-016 |

---

## Problemas de entorno detectados

No son bugs de la app; afectan la ejecución de las pruebas. ENV-01 y ENV-02 se corrigieron en `8020b91`; ENV-03 se resolvió cambiando la forma de ejecutar el gate.

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
- **Después de la auditoría:** las correcciones y la regresión final incluyen Firefox. Ahí apareció BUG-020 (hidratación #418, sólo en Firefox), que la auditoría no podía ver.

### ENV-03 — Saturación de Docker/WSL con 6 carriles en paralelo — RESUELTA (carriles en secuencia)

- **Tipo:** ENVIRONMENT ISSUE (capacidad de la máquina: Windows 11 + Docker Desktop/WSL). **Detectado en:** la regresión con todos los navegadores después de las correcciones.
- **Descripción.** Con 6 carriles × 3 workers y cross-browser en paralelo se satura la red de Docker/WSL.
- **Síntomas.**
  - `Can't reach database server at localhost:5432` intermitente.
  - Timeouts generalizados.
  - Corridas 5–10 veces más lentas.
- **Efecto.** Fallas sin relación con el código que no deben clasificarse como bugs ni como pruebas inestables.
- **Resolución.** La regresión final se corrió **con los carriles en secuencia**. El runbook (`.claude/skills/e2e-quality-gate/references/runbook.md`, «Límite de paralelismo en esta máquina») recomienda como máximo 3 carriles a la vez, o carriles uno tras otro con `E2E_WORKERS=4`, y repetir un carril afectado solo antes de clasificar una falla. También anota que cada commit reconstruye el build E2E, porque el sello incluye `git HEAD`.

### ENV-04 — Firefox de Playwright se congela con varias páginas abiertas a la vez — MITIGADA

- **Tipo:** ENVIRONMENT ISSUE (Windows 11 + Playwright 1.63 / Firefox 1543). **Detectado en:** la regresión final, donde EVT-005/017, PUR-002/005, STF-003 y SET-015 eran inestables sólo en Firefox.
- **Descripción.** Con varias páginas de Firefox abiertas a la vez (en uno o en varios navegadores), todas dejan de producir frames y de atender a Playwright y a la red al mismo tiempo durante 6–270 s.
- **Reproducción aislada, sin la app** (página mínima servida por un http de Node):
  - dos Firefox en paralelo: congelamiento en 6/6 corridas;
  - un Firefox con dos páginas: 3/3;
  - un Firefox con una página: 0 en 4,900 llamadas;
  - Chromium: 0 en 4,900.
- **Mitigación.** `playwright.config.ts` limita el proyecto firefox a **1 worker** (`E2E_FIREFOX_WORKERS`, `3823a75`), lo que bajó los fallos de 22/48 a 3/48. El límite es por invocación, así que **no corras carriles con `E2E_CROSS_BROWSER=1` en paralelo**: dos Firefox separados se congelan juntos.
- **Efecto en el gate.** Un FLAKY de Firefox se clasifica como ENVIRONMENT, y no como bug de la app, sólo si su traza muestra la ausencia total de frames.
- **Endurecimiento posterior.**
  - `ready()` (`tests/e2e/operations/_helpers.ts`) compite la espera dentro de la página con un temporizador de Node que vence en el tope (15 s) + 1 s. Si la página se congela, falla con «la página no respondió» en vez de consumir los 90 s de la prueba.
  - `playwright.config.ts` valida `E2E_FIREFOX_WORKERS` igual que `E2E_LANE`: entero ≥ 1 o error explícito.
  - La regla y la forma de clasificar quedaron en `references/runbook.md` › Notas operativas.

### Otras notas de entorno vistas durante las correcciones
- **WebKit en Windows hidrata muy lento algunos formularios del panel.** «Agregar costo» de [FIN-006] tarda 20–25 s en hidratar en WebKit, más que el tope de 15 s de `ready()`; la medición (MessageChannel a ~33 ms por salto) apunta al entorno. FIN-006 en WebKit queda como **inestabilidad abierta clasificada como ENVIRONMENT**. No se subió el tope sin evidencia versionada. Al verificar el `ready()` con temporizador de Node (ENV-04), FIN-006 en WebKit pasó 3/3 con `--retries=0`, sin subir el tope; la clasificación no cambia.
- **Caídas del worker de Node en Windows** (`0xC0000409` / `3221226505`) antes de ejecutar código de prueba, a 0 ms: AUTH-035 una vez y PAY-003 una vez. No se repitieron al correrlas aisladas; son ENVIRONMENT.
- **Sello del build E2E con archivos sin seguimiento.** `scripts/e2e-server.mjs` no detectaba cambios en archivos nuevos sin commit y reutilizaba un build viejo. Se corrigió en `86b60de`.
- **Contratos de integración.** `devops.test.ts` esperaba `output: "standalone"` literal, y `memory-capsule.test.ts` esperaba 403 en la prueba CSRF del upload. Fallaban en todas las ramas de la ronda 1 y se alinearon en `86b60de`; después, `pnpm test:integration` pasó 318/318 y 324/324.
- **`next dev` con `NEXT_DIST_DIR=.next-<x>`** agrega `.next-<x>/types/**/*.ts` a `tsconfig.json`. Hay que revertirlo al terminar.
- **El `.next-e2e` es compartido entre carriles.** Una verificación que reconstruye el build en un commit distinto deja ese build para el siguiente carril; la próxima corrida lo reconstruye sola.

### Notas del guard de consola/red (`tests/e2e/fixtures/guard.ts`)

1. **Ruido de WebKit al cancelar prefetch** (`Load failed`, `Fetch API cannot load … due to access control checks`, `Failed to fetch RSC payload … Falling back to browser navigation`) no estaba en `BENIGN` ⇒ con `E2E_CROSS_BROWSER=1` cualquier prueba que navegara rápido en el panel fallaba en WebKit. **Aplicado:** patrones agregados (`guard.ts:18-21`). Pendiente de revisión (carril 2): el patrón `Failed to fetch RSC payload … Falling back to browser navigation` también silencia ese aviso en Chromium. *(carriles 1 y 2)*
2. **4xx esperados como violación y sin URL:** Chromium duplica cada respuesta 4xx como `console.error` («Failed to load resource: … status of 4xx») sin la URL en el texto, así que toda prueba con un 4xx esperado necesitaba `guard.allow(/404/)` o un patrón por código de estado (p. ej. [CAT-013] 422, [QUO-025] 404). **Aplicado:** el texto incluye `[url de origen]` y esos mensajes se clasifican como `http4xx` (observación), no como violación (`guard.ts:34-40`; documentado en `references/test-design.md`). *(carriles 2, 3 y 5)*
3. **`net::ERR_ABORTED` es benigno por diseño**, que es justo como se manifiesta BUG-006: el guard no puede detectarlo y las pruebas deben afirmar el resultado (URL/contenido), como hacen CAL-002 y EVT-038. *(carril 4)* **Actualización:** la red de seguridad de BUG-006 registra `console.error`, y el guard lo convierte en fallo, así que una regresión ya no puede pasar en silencio.
4. **`getByRole("alert")` es ambiguo:** el anunciador de rutas de Next tiene `role="alert"`; acotar a `page.getByRole("main")` o filtrar por texto (documentado en el runbook). *(carril 2)*
5. **`replayServerAction.classify`** trataba cualquier `ok:false` con código `NOT_FOUND` como «denied», mezclando autorización con recurso inexistente (el carril 4 usó su propio `callAction`). `references/test-design.md` distingue ahora `wasDenied` / `wasForbidden` / `wasBlocked`. *(carril 4)*
6. **`mode: "serial"` en `*.global.spec.ts`:** un fallo dejaba el resto del archivo sin ejecutar (6 NOT TESTED en la primera corrida global del carril 5). Con `E2E_SUITE=global` ya hay 1 worker; `references/test-design.md` indica ahora no usar `serial`. *(carril 5)*
7. **Fuente abortada en Firefox** (`downloadable font … status=2152398850` = `NS_BINDING_ABORTED`) después de la redirección del login. Se agregó un patrón `BENIGN` acotado a ese código y a `/_next/static/media/*.woff2` (`7dbe8a1`). Pendiente, menor: la expresión acepta cualquier origen, aunque el comentario dice que otro origen sigue siendo un error. Conviene anclar el host o corregir el comentario. *(carril 2, endurecimiento)* **Resuelta:** el patrón exige `source: http(s)://localhost` o `127.0.0.1`, con puerto opcional, antes de `/_next/static/media/*.woff2`; una fuente de otro origen (incluido `localhost.otro-dominio`) sigue siendo violación. Comentario de `guard.ts` y `references/test-design.md` actualizados.

### Notas de reporters y ejecución

1. **`--reporter` en la CLI** (p. ej. `--reporter=line`) reemplaza los reporters del config (`list` + `html` en `playwright-report/<carril>` + `json` en `test-results/<carril>/results.json`, `playwright.config.ts:99-103`) y **no se escribe `results.json`**, del que depende `quality-gate.mjs`. Documentado en el runbook. *(carril 1)*
2. **`pnpm.cmd exec playwright … -g "A|B"`** se rompe en Windows (cmd.exe interpreta `|`); usar `node node_modules/@playwright/test/cli.js test … -g "A|B"`. Documentado en el runbook. *(carriles 2, 3 y 4)*
3. **Cada invocación sobrescribe `test-results/<carril>/artifacts`:** parte de la evidencia previa se perdió (exploración de [AUTH-020]; [EVT-038], [GST-012], [GST-015]). Copiar la evidencia de cada bug a `test-results/<carril>-evidence/<BUG>/` antes de volver a correr (el carril 6 lo hizo en `test-results/l6-evidence/`; el carril 4 en `test-results/l4/evidence/`). Documentado en el runbook. *(carriles 1, 4 y 6)*
4. **Respuestas RSC de Server Actions sin `charset`:** `Response.text()`/`body()` del navegador en Playwright las decodifica como latin1 (acentos rotos); `APIRequestContext` sí decodifica UTF-8. Comparar contra la base en lugar del texto capturado. *(carril 2)*
5. **Datos con varios workers:** los conteos globales en la base no sirven en paralelo ([CONF-005]/[CONF-018], TEST BUG corregido) y las altas de eventos pueden chocar por fecha ([EVT-006] FLAKY previo, corregido con `pickFreeDate` por `TEST_PARALLEL_INDEX`). Acotar las aserciones a los datos de la prueba. *(carriles 2 y 4)* **Actualización:** también se aislaron o se hicieron deterministas [SET-017], [NAV-015], [SMK-023], [CRIT-006], [MEM-001], [QUO-018] y [GST-024].
6. **Scratchpad compartido entre agentes de todos los carriles** (scripts que desaparecen a mitad de corrida): usar `scratchpad/l<n>/`. Documentado en el runbook. *(carriles 1 y 2)*
7. **Hidratación:** interactuar antes de hidratar pierde el cambio; conviene un helper compartido tipo `gotoReady()` (espera red en reposo) en los fixtures. *(carriles 3, 4 y 5)* **Actualización:** `gotoReady()` espera ahora la hidratación real (`waitForHydration()`: `<main>` y los controles con `__reactProps$`) en lugar de `networkidle`, que no es confiable en Firefox ([QUO-019], `ae351f7`). En los formularios públicos, interactuar antes de hidratar resultó ser un bug de la app (BUG-021).
8. **WebKit en Windows guarda la cookie sin SameSite** y `context.cookies()` devuelve `None`. [AUTH-001]…[AUTH-005] verifican ahora `HttpOnly`, `SameSite=Lax` y `Path=/` en el `Set-Cookie` real del login (`682b043`).
9. **`page.reload` después de un `router.refresh()` en Firefox** termina en `NS_BINDING_ABORTED`. Hay que esperar el cuerpo completo del refresh antes de recargar (`routerRefreshed()`, [OPS-010], `b453d6f`). El mismo síntoma aparece en las inestabilidades de la regresión final (STF-003 y PUR-005 en Firefox), que se están corrigiendo en paralelo.
10. **ID de prueba duplicado: [NAV-034].** Existe en `tests/e2e/navigation/not-found.spec.ts:36` (404 real, BUG-013) y en `tests/e2e/navigation/hydration.spec.ts:56` (hidratación de `/pago/mock`, BUG-020). Las dos ramas de endurecimiento lo asignaron en paralelo. **Resuelta:** las pruebas de hidratación pasaron a NAV-037 (`/pago/mock`), NAV-038 (sitio público) y NAV-039 (panel). NAV-034 queda para el 404 real; NAV-035 y NAV-036 quedan retirados. Se actualizaron `docs/qa`, `references/{project-profile,test-design}.md` y el comentario de `segment-children.tsx`. Con `playwright test --list` de las tres suites (sin `E2E_SUITE`, `global` y `ratelimit`, incluidos los títulos generados en bucles) no queda ningún otro ID duplicado. El comando de `references/test-design.md` ahora también cubre `A11Y` y los títulos entre comillas simples o backticks.
11. **MEM-021 sigue omitida en WebKit** (NOT APPLICABLE con anotación). `fillBeforeHydration` (`e2f3699`) ya permitiría correrla ahí. **Resuelta:** MEM-021 corre ahora en WebKit con `holdPageChunk` + `fillBeforeHydration` y locators `includeHidden`, igual que GST-026 y PORT-022, y sin el `skip`. En WebKit, la prueba anota que asignó los valores en el DOM. Verificación: `tests/e2e/memory` en WebKit 4/4 (las @P0), y MEM-021 ×3 sin reintentos en chromium, mobile-chrome, firefox y webkit, 12/12. Mutación: con `defaultValues: { name: "", body: "" }` en `guestbook-form.tsx`, MEM-021 falla en WebKit y en Chromium («Tu nombre» queda vacío); restaurado.
12. **[CNT-010] FLAKY en chromium por una carrera de la prueba (TEST BUG, corregido).** `finalizeGalleryUpload` escribe la auditoría `media.uploaded` después de fijar `sortOrder`. La prueba leía la auditoría una sola vez, justo después de ver el `sortOrder`, y a veces encontraba 0. Ahora la espera con `expect.poll`; secuencial, 6/6. Riesgo conocido: CNT-010 compara con la galería global (`before.length + 1`, `maxOrder + 1`), así que con `--repeat-each` y varios workers dos copias chocan entre sí. Repítela con `E2E_WORKERS=1`.
