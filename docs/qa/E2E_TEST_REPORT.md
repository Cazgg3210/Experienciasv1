# E2E QUALITY REPORT

Ivonne & Rosa — auditoría FULL de punta a punta (skill `e2e-quality-gate`, agente `qa-e2e-engineer`). Línea base del 2026-10-06 sobre `f26b1a1` y gate final del 2026-10-07 (ver «Build / Commit Tested»). Documentos de soporte: [BUG_REPORT.md](BUG_REPORT.md), [APPLICATION_TEST_MAP.md](APPLICATION_TEST_MAP.md), [ROLE_PERMISSION_MATRIX.md](ROLE_PERMISSION_MATRIX.md), [TEST_COVERAGE_MATRIX.md](TEST_COVERAGE_MATRIX.md) y `runs/20261007-2318-full/gate.{md,json}`.

## Executive Summary

- **Qué se probó.** Toda la plataforma: sitio público, configurador, cotización y pago, panel de las fundadoras, portal de la clienta, invitadas, Memory Capsule y portal staff. Según el caso, las pruebas validan la pantalla, los permisos y lo que quedó guardado en la base. La auditoría inicial cubrió **836 escenarios**. La corrida final cubrió **888 escenarios en 1,377 ejecuciones** en Chromium; Firefox y WebKit, que es el motor de Safari, sólo en las pruebas `@P0`, y Chromium móvil sólo en `@mobile`.
- **Qué se encontró y corrigió.** **24 bugs**, de ellos **3 CRITICAL**: cerrar sesión no era definitivo, se podía cobrar el anticipo de un evento ya cancelado y el enlace general de invitación dejaba sobrescribir la respuesta de otra invitada y obtener su enlace personal. Los 24 están verificados con su prueba de reproducción. BUG-006 queda **mitigado** dentro de la app hasta actualizar Next.
- **Veredicto.** Línea base **🔴 BLOCKED**, con recorridos críticos en FAIL y 3 bugs CRITICAL abiertos. Final **🟢 READY**: 1,377/1,377 ejecuciones, P0 y recorridos críticos al 100 %, 0 bugs abiertos y 0 FLAKY en el gate. El gate combina dos corridas: la primera completa (`539672d`) tuvo 1 FAIL y 5 FLAKY en los carriles 1, 2, 5 y 6 (TEST BUG o ENVIRONMENT). Se corrigieron 5 pruebas en `754e2c6`, sin tocar la app, y esos carriles se repitieron limpios. FIN-006 en WebKit sigue documentado como inestabilidad de entorno.
- **Pendiente de su decisión.**
  - Actualizar a Next ≥ 16.3 para retirar las mitigaciones de BUG-006 y BUG-020. La de BUG-024 tiene su propio criterio de retiro.
  - Decidir si «Cerrar sesión» cierra todos los dispositivos (comportamiento actual) o sólo el actual.
  - Decidir si los formularios del panel reciben el mismo tratamiento antes de hidratar.
  - Conectar pagos, correo y WhatsApp reales, primero en staging. Mientras los pagos sigan simulados, el flag «Pagos en línea» debe estar apagado en producción.

## Test Environment

- **Clasificación:** **TEST**. Build de producción local (`next build` en `.next-e2e` + `next start`, Next 15.5.27) contra bases `*_e2e` locales re-sembradas en cada invocación. Nunca dev ni producción. Los scripts de la corrida final (`.logs/final/run-final*.sh`) llaman a Playwright directamente, sin `E2E_BASE_URL` ni `E2E_ALLOW_REMOTE_DB`, así que aplican los candados de `global-setup.ts` y `e2e-server.mjs`: sólo una base local cuyo nombre contiene «e2e». `preflight.mjs` no forma parte de esos scripts.
- **Máquina:** Windows 11 Home, Docker Desktop/WSL con PostgreSQL 16 (`:5432`) y S3 local RustFS (`:9000`).
- **Proveedores:** todos en `mock` (pagos, email, WhatsApp e IA). Las notificaciones se verifican en `NotificationLog` (bandeja simulada).
- **Carriles:** `E2E_LANE=1..6`, cada uno con servidor `:320n` y base `ivonne_rosa_e2e_l<n>`.
  - Suites especiales: `E2E_SUITE=global` en los carriles 2–5 (1 worker) y `E2E_SUITE=ratelimit` en el carril 9 (`:3209`, limitador encendido).
- **Ejecución final:**
  - Carriles **en secuencia** (ENV-03), con `E2E_WORKERS=4` y `E2E_CROSS_BROWSER=1`.
  - Firefox con 1 worker (ENV-04).
  - Reintentos por defecto = 1. Una prueba que pasa sólo al reintentar cuenta como **FLAKY**, no como PASS.
- **Herramientas:** Playwright 1.63 (Chromium, Firefox 1543 vía `E2E_FIREFOX_EXECUTABLE` por ENV-02, WebKit y Pixel 7 emulado), axe-core 4.13 (WCAG 2.1 AA), guard de consola/red de `tests/e2e/fixtures` y verificación de base con Prisma.
- **Línea base:** 6 carriles **en paralelo** sobre `f26b1a1`. Firefox no arrancaba (ENV-02), así que sus pruebas quedaron BLOCKED.

## Build / Commit Tested

| Corrida | Commit | Qué se ejecutó | Resultado |
|---|---|---|---|
| Línea base (auditoría FULL) | `f26b1a1` (infra del gate corregida en `8020b91`) | 6 carriles en paralelo + global + ratelimit | 836 escenarios; gate parcial sin el carril 5: 🔴 BLOCKED |
| Regresión intermedia (tras la ronda 1) | `86b60de` | Todos los carriles, 4 navegadores | 1,286/1,298 PASS; 🔴 BLOCKED (6 ejecuciones críticas en FAIL) |
| **Gate final** | **`754e2c6`** (carriles 1, 2, 5 y 6) y **`539672d`** (carriles 3 y 4, suites global 2–5 y ratelimit) | Ver abajo | **1,377/1,377 PASS; 🟢 READY** |

**Por qué el gate final mezcla dos commits, y por qué eso no cambia el resultado:**

1. **Primera corrida final, completa, sobre `539672d`** (`.logs/final/final.status`).
   - Carriles 3 (136 passed) y 4 (174 passed): limpios.
   - Suites global (7, 7, 12 y 23 passed) y ratelimit (12 passed): limpias.
   - Carriles 1, 2, 5 y 6: **1 FAIL y 5 FLAKY**:
     - CRIT-007 FAIL en Firefox.
     - FLAKY: API-062 (Firefox), CONF-016 (Chromium), STF-014 (Chromium), INV-007 y OPS-002 (Firefox).
2. **Clasificación.** Ninguno fue un defecto de la app:
   - **TEST BUG:** CRIT-007, INV-007 y OPS-002 recargaban antes de que terminara el `router.refresh()` en Firefox. API-062 y STF-014 dependían de conteos globales en la base.
   - **ENVIRONMENT:** CONF-016 fue una caída del worker de Node en Windows (`exit 3221226505`) antes de ejecutar código de prueba. Es la nota de entorno ya registrada en BUG_REPORT; no requirió cambio.
3. **`754e2c6` sólo corrige pruebas.** `git diff --stat 539672d 754e2c6`: 5 archivos de `tests/e2e/` (`api/media-csv`, `critical/operations`, `inventory/inventory`, `operations/operations`, `staff/staff-admin`), 25 inserciones y 10 borrados. No toca `src/`, `prisma/`, `scripts/`, `next.config.ts` ni `package.json`, así que **el código de la app es idéntico** en los dos commits.
4. **Segunda corrida sobre `754e2c6`** (`.logs/final/final2.status`). Se repitieron completos los carriles 1, 2, 5 y 6 (571, 140, 179 y 171 passed), sin fallos ni inestables.
   - Los carriles 3 y 4, las suites global y ratelimit no ejecutan ninguno de los 5 archivos modificados. Global sólo corre `*.global.spec.ts` y ratelimit sólo `*.ratelimit.spec.ts`. Por eso sus resultados sobre `539672d` valen para `754e2c6`.
5. **Conciliación de conteos.** Los logs suman 1,432 «passed». Incluyen las 5 sesiones del proyecto `setup` (una por cuenta) en cada una de las 11 invocaciones (55 en total), que el gate no cuenta como escenarios: 1,432 − 55 = **1,377**.

**Historia entre la línea base y el gate final:** 78 commits (`git log --oneline f26b1a1..HEAD`), en este orden:

1. Auditoría y corrección de la infraestructura del gate (`8020b91`).
2. Ronda 1 de correcciones: 16 bugs en 6 worktrees aislados, agrupados por área (auth, pagos, clientas/leads, invitadas, navegación, y UI, accesibilidad y menores), con revisión adversarial (merges `d144ce7`…`41db385`, más `86b60de`).
3. Endurecimiento: merges `f8797e0`…`c3ba279`.
4. Formularios antes de hidratar: `e2f3699`, `d96a82a` y `b47437b`.
5. Inestabilidades cross-browser y BUG-024: `4b79477`…`e423125`.
6. Cierre: `539672d` y `754e2c6`.

## Test Date

| Hito | Fecha |
|---|---|
| Línea base (gate parcial) | 2026-10-06 13:42 UTC |
| Regresión intermedia | 2026-10-06 16:09 UTC |
| Commits finales | `539672d` 2026-10-07 16:20 (CDMX) · `754e2c6` 2026-10-07 16:55 (CDMX) |
| **Gate final** | **2026-10-07 23:18 UTC** (17:18 CDMX) |

## Architecture Detected

Fuente: `docs/qa/.discovery/inventory.json` (regenerado el 2026-10-07T04:02Z, sin drift desde la línea base).

- **Monolito modular en Next.js 15.5.27 (App Router).** `package.json` declara React 19.1.0. El App Router usa el React 19.2.0-canary que trae Next 15.5.27, y de ahí vienen BUG-006, BUG-020 y BUG-024.
- **Zonas:**
  - `(public)`: sitio y configurador.
  - `(experience)`: páginas por token (`/cotizacion`, `/pago`, `/mi-evento`, `/e`, `/memory`, todas con `noindex`).
  - `(admin)`: panel.
  - `(staff)`: portal staff.
  - `(auth)`: login.
  - `api/`: route handlers.
- **Módulos:** `src/features/<módulo>` con `domain/` puro, `server/` (servicios, queries y Server Actions con `protectedAction`/`publicAction`), `components/` y `schemas.ts` (Zod).
- **Autenticación y autorización:**
  - Auth.js v5 beta (5.0.0-beta.32), Credentials + JWT de 12 h, revocable en servidor con `User.sessionVersion`.
  - El middleware protege `/admin` y `/staff` y marca los prefijos por token.
  - RBAC: 4 roles (SUPER_ADMIN, OWNER, STAFF, CUSTOMER) y 48 permisos en `src/server/auth/permissions.ts`.
- **Datos:** Prisma 6.19.3 sobre PostgreSQL 16: 50 modelos y 43 enums. Archivos en S3 con URLs firmadas.
- **Integraciones:** pagos, email, WhatsApp e IA detrás de `@/server/providers`.
- **Superficie inventariada:**

| Elemento | Cantidad |
|---|---|
| Páginas | 83 (admin 61 · public 10 · experience 8 · staff 2 · auth 1 · root 1) |
| Route handlers | 13 |
| Server Actions | 169 (148 protegidas + 21 públicas) + `loginAction` |
| Archivos de prueba | 73 specs E2E · 77 unitarios · 15 de integración (en `754e2c6`; el inventario del 2026-10-07T04:02Z contaba 72 · 73 · 15) |

## Modules Tested

27 módulos. Un escenario es una prueba con ID; su resultado combina todos los navegadores donde corrió y manda el peor. Una ejecución es una prueba en un proyecto de Playwright.

| Módulo | Línea base: escenarios | PASS | FAIL | FLAKY | BLOCKED | Final: escenarios PASS/total | Final: ejecuciones (gate) |
|---|---:|---:|---:|---:|---:|---:|---:|
| ai | 9 | 9 | 0 | 0 | 0 | 9/9 | 11 |
| analytics | 3 | 2 | 1 | 0 | 0 | 3/3 | 3 |
| api | 42 | 41 | 0 | 0 | 1 | 42/42 | 68 |
| auth | 153 | 140 | 4 | 0 | 9 | 175/175 | 400 |
| calendar | 16 | 13 | 3 | 0 | 0 | 16/16 | 16 |
| catalog | 32 | 32 | 0 | 0 | 0 | 32/32 | 32 |
| configurator | 27 | 25 | 1 | 0 | 1 | 30/30 | 44 |
| content | 14 | 13 | 1 | 0 | 0 | 14/14 | 14 |
| customers | 16 | 15 | 1 | 0 | 0 | 17/17 | 17 |
| events | 41 | 38 | 3 | 0 | 0 | 43/43 | 59 |
| finance | 16 | 13 | 2 | 0 | 1 | 16/16 | 22 |
| guests | 27 | 21 | 3 | 1 | 2 | 33/33 | 49 |
| inventory | 26 | 25 | 1 | 0 | 0 | 26/26 | 28 |
| leads | 39 | 36 | 3 | 0 | 0 | 39/39 | 39 |
| memory | 33 | 29 | 2 | 0 | 2 | 34/34 | 65 |
| navigation | 23 | 21 | 2 | 0 | 0 | 24/24 | 26 |
| notifications | 7 | 5 | 1 | 1 | 0 | 7/7 | 7 |
| operations | 30 | 30 | 0 | 0 | 0 | 30/30 | 34 |
| payments | 25 | 20 | 4 | 0 | 1 | 29/29 | 38 |
| portal | 46 | 44 | 1 | 0 | 1 | 51/51 | 81 |
| public | 55 | 48 | 0 | 0 | 7 | 57/57 | 79 |
| purchases | 15 | 15 | 0 | 0 | 0 | 15/15 | 19 |
| quotes | 60 | 53 | 4 | 0 | 3 | 61/61 | 91 |
| settings | 16 | 16 | 0 | 0 | 0 | 18/18 | 18 |
| staff | 48 | 46 | 1 | 0 | 1 | 50/50 | 90 |
| users | 11 | 11 | 0 | 0 | 0 | 11/11 | 21 |
| vendors | 6 | 6 | 0 | 0 | 0 | 6/6 | 6 |
| **Total** | **836** | **767** | **38** | **2** | **29** | **888/888** | **1,377** |

**Cobertura del inventario** (APPLICATION_TEST_MAP): 83/83 páginas, 13/13 route handlers y 169/169 Server Actions mapeados en 528 filas (MAP-001…MAP-528).

## Roles Tested

| Rol (cuenta de prueba) | Escenarios finales donde es el rol principal | Notas |
|---|---:|---|
| SUPER_ADMIN (`superadmin@`) | 18 | Único rol con `roles:assign_super_admin` (PERM-140…142). Las reglas de «último SUPER_ADMIN» no tienen prueba E2E: se cubren con pruebas unitarias (`user-rules.test.ts`) y de integración (`settings-notifications.test.ts`, que verifica el caso sólo si la base tiene una única SUPER_ADMIN activa). |
| OWNER — Ivonne (`ivonne@`) | 499 | Panel completo. Rol principal de la mayoría de los flujos de back-office. |
| OWNER — Rosa (`rosa@`, `owner2`) | 4 | Login, sesión y flujos con dos fundadoras. |
| STAFF — Lupita (`staff@`) | 59 | Sólo eventos asignados, sin montos, y sólo sus propias tareas. |
| STAFF — Carlos (`staff2@`) | 5 | Aislamiento entre integrantes del staff (IDOR). |
| Anónimo (incluye Proveedor/Cron máquina a máquina) | 193 | Sitio público, login, webhooks, cron y route handlers. |
| Clienta (token de cotización, pago o portal) | 73 | Acceso por posesión del token, sin cuenta. |
| Invitada (token de micrositio o cápsula) | 37 | RSVP, libro de visitas y fotos. |
| CUSTOMER (cuenta) | — | No puede iniciar sesión: AUTH-011 PASS. En las matrices equivale a Anónimo. |

Total 888. Muchos escenarios cruzan roles, por ejemplo CRIT-002 (owner → clienta → pago).

## Critical User Journeys

Los recorridos críticos son las pruebas `@critical`.

| Corrida | Ejecuciones | PASS | FAIL | FLAKY | BLOCKED | Detalle |
|---|---:|---:|---:|---:|---:|---|
| Línea base (gate parcial) | 106 | 86 | 4 | 2 | 14 | 18 ejecuciones críticas en FAIL/BLOCKED: CRIT-001…014 BLOCKED en Firefox (ENV-02); AUTH-032, EVT-024 y CRIT-014 (Chromium y WebKit) en FAIL |
| Intermedia | 236 | 227 | 6 | 3 | 0 | 6 ejecuciones críticas en FAIL |
| **Final** | **239** | **239** | **0** | **0** | **0** | 100 % |

Recorridos de negocio completos (`tests/e2e/critical/*`):

| ID | Recorrido | Línea base | Final |
|---|---|---|---|
| CRIT-001 | Configurador anónimo → lead NEW con clienta, snapshot y aviso → la fundadora lo abre | BLOCKED (Firefox) | PASS (chromium, mobile-chrome, firefox, webkit) |
| CRIT-002 | Lead → cotización con precio del servidor → envío → la clienta acepta → anticipo → evento confirmado → portal | BLOCKED (Firefox) | PASS (4 proyectos) |
| CRIT-003 | La clienta rechaza la propuesta por token → REJECTED, sin reserva ni evento | BLOCKED (Firefox) | PASS (4 proyectos) |
| CRIT-004 | La anfitriona agrega una invitada → la invitada confirma RSVP → admin y portal lo ven | BLOCKED (Firefox) | PASS (4 proyectos) |
| CRIT-005 | Asignar staff → el staff ve sólo ese evento → marca su tarea → la fundadora la ve hecha | BLOCKED (Firefox) | PASS (4 proyectos) |
| CRIT-006 | Pago manual del saldo → saldo en cero, auditoría, aviso y portal liquidado | BLOCKED (Firefox) | PASS (chromium, firefox, webkit) |
| CRIT-007 | Cierre del evento con costos reales → snapshot congelado y margen correcto | BLOCKED (Firefox) | PASS (chromium, firefox, webkit) |
| CRIT-008 | Memory Capsule: mensaje y foto → aprobación → visible al público | BLOCKED (Firefox) | PASS (4 proyectos) |
| CRIT-009 | Owner: login → panel → logout → rutas privadas piden login (UI y request) | BLOCKED (Firefox) | PASS (chromium, firefox, webkit) |
| CRIT-010 | Contacto público → lead CONTACT_FORM + clienta + aviso → visible en admin | BLOCKED (Firefox) | PASS (4 proyectos) |
| CRIT-011 | SuperAdmin: login → panel → logout → rutas privadas piden login | BLOCKED (Firefox) | PASS (chromium, firefox, webkit) |
| CRIT-012 | Staff: login → `/staff`; `/admin` la regresa; logout cierra el portal | BLOCKED (Firefox) | PASS (4 proyectos) |
| CRIT-013 | Ruta privada → login con `callbackUrl` → regresa sólo a rutas internas | BLOCKED (Firefox) | PASS (chromium, firefox, webkit) |
| CRIT-014 | Logout definitivo: una respuesta en vuelo no revive la sesión | **FAIL** (BUG-001) | PASS (chromium, firefox, webkit) |

## Test Results

| Medida | Total | Pass | Fail | Flaky | Blocked | Not Tested |
|---|---:|---:|---:|---:|---:|---:|
| **Escenarios — línea base** (`f26b1a1`, `.logs/coverage-baseline.md`) | 836 | 767 | 38 | 2 | 29 | 0 |
| **Escenarios — final** (`TEST_COVERAGE_MATRIX.md`) | **888** | **888** | **0** | **0** | **0** | **0** |
| Ejecuciones — gate parcial de la línea base (sin el carril 5) | 770 | 704 | 34 | 2 | 30 | 0 |
| Ejecuciones — regresión intermedia (`86b60de`) | 1,298 | 1,286 | 8 | 4 | 0 | 0 |
| **Ejecuciones — gate final** (`gate.json`) | **1,377** | **1,377** | **0** | **0** | **0** | **0** |

- **Pass rate de ejecuciones:** 95.1 % en la línea base parcial, 99.1 % en la intermedia y **100 %** en la final. La cobertura final también es del **100 %**.
- **BLOCKED en la línea base.** Todos se deben a ENV-02: Firefox no arrancaba.
  - En escenarios son 29. En ejecuciones son 30, porque CRIT-014 estaba BLOCKED en Firefox pero cuenta como FAIL a nivel escenario (manda el peor resultado).
- **Crecimiento: 52 escenarios nuevos y ninguno retirado** entre la línea base y la final. Son las pruebas de reproducción y `@regression` de las correcciones, por ejemplo AUTH-033…038, AUTH-053…059, AUTH-064…072, GST-023…028, PORT-021…025, NAV-034, NAV-037…039, EVT-040 y CUST-017.
- **El gate parcial muestra «bugs registrados: 0»** porque se calculó antes de consolidar `BUG_REPORT.md`. Los 3 CRITICAL (BUG-001…003) se consolidaron después, y en la regresión intermedia todavía figuraban abiertos (Critical: 3).
- **Pruebas complementarias** (no entran en el gate E2E):
  - `pnpm test`: **931/931** unitarias.
  - `pnpm test:integration`: **330/330** en la última corrida completa. En el endurecimiento, las ramas reportaron 324/324 (carril 3) y 318/318 (carril 4).

## P0 Results

| Corrida | Ejecuciones P0 | PASS | FAIL | FLAKY | BLOCKED | Pass rate |
|---|---:|---:|---:|---:|---:|---:|
| Línea base (gate parcial) | 277 | 239 | 6 | 2 | 30 | 96.8 % (cobertura 89.2 %) |
| Intermedia | 652 | 641 | 8 | 3 | 0 | 98.3 % |
| **Final** | **704** | **704** | **0** | **0** | **0** | **100 %** |

En escenarios, la línea base tenía 212 P0: 177 PASS, 5 FAIL, 1 FLAKY y 29 BLOCKED. La final tiene **228/228 PASS**.

**P0 en FAIL en la línea base:**
- AUTH-032 y CRIT-014: BUG-001, la sesión revivía tras el logout.
- AUTH-049: BUG-005, open redirect.
- EVT-024: BUG-002, cobro tras la cancelación.
- GST-014: BUG-003, RSVP de terceros.

**Otros P0 que no pasaron en la línea base:**
- FLAKY: GST-011 (BUG-006).
- BLOCKED: CRIT-001…013 y 16 SMK, por Firefox (ENV-02).

Todos pasan en la final, en los tres motores de escritorio.

## P1 Results

| Corrida | Ejecuciones P1 | PASS | FAIL | FLAKY | Pass rate |
|---|---:|---:|---:|---:|---:|
| Línea base (gate parcial) | 277 | 274 | 3 | 0 | 98.9 % |
| Intermedia | 372 | 371 | 0 | 1 | 99.7 % |
| **Final** | **387** | **387** | **0** | **0** | **100 %** |

En escenarios, la línea base tenía 358 P1: 353 PASS, 4 FAIL y 1 FLAKY. La final tiene **378/378 PASS**.

**P1 que no pasaron en la línea base:**
- AUTH-025: BUG-004, la cookie seguía válida tras el logout.
- CAL-002 e INV-025: BUG-006, navegación colgada.
- PAY-021: BUG-002.
- FLAKY: NOT-002 (BUG-006).

**P2 y P3 en la final:** 246/246 y 40/40 ejecuciones, que son 242 y 40 escenarios. En la línea base había 23 FAIL en P2 (sobre todo accesibilidad: BUG-009 a BUG-012) y 6 FAIL en P3.

## Authentication Results

- **Módulo `auth`:** la línea base tenía 153 escenarios (140 PASS, 4 FAIL y 9 BLOCKED por Firefox). La final tiene **175/175** escenarios y **400/400** ejecuciones.
- **Verificado en la final** (TESTED — PASS):
  - **Login por rol.** Las 5 cuentas (AUTH-001…005) entran. El `Set-Cookie` real lleva `HttpOnly`, `SameSite=Lax` y `Path=/` en los tres motores.
  - **Credenciales inválidas.** Contraseña incorrecta y usuario inexistente reciben el mismo mensaje, sin enumeración. También se rechazan: usuaria desactivada, cuenta CUSTOMER, cuenta sin contraseña, campos vacíos y correo inválido (validados en servidor). El correo se normaliza.
  - **Logout definitivo.** Una respuesta en vuelo no revive la sesión (AUTH-032, CRIT-014, BUG-001). Tras el logout, «Atrás» no muestra datos del panel. Con dos pestañas, la otra pierde acceso. Las respuestas del panel van con `no-store`.
  - **Revocación en servidor (`sessionVersion`)** al cerrar sesión, restablecer la contraseña, cambiar el rol o desactivar la cuenta (AUTH-025, AUTH-027/028, AUTH-033…038, AUTH-064; BUG-004 y BUG-022). Eliminar una ficha de staff con acceso (BUG-018) está cubierto por la prueba de integración `operations-staff.test.ts`, no por E2E.
  - **Renovación del JWT** sólo en GET con ≥ 1 h. Un POST de Server Action no re-emite la cookie, y una cookie revocada sigue sin autorizar aunque se renueve (AUTH-053…058). `GET /api/auth/session` no re-emite la cookie (AUTH-059, BUG-023).
  - **`callbackUrl`:**
    - normalizado contra open redirect, incluidos caracteres de control (AUTH-049, BUG-005);
    - validado también dentro de `loginAction`, con 8 variantes maliciosas en tres motores (AUTH-065…072);
    - el recorrido completo de retorno a una ruta interna (CRIT-013).
  - **Límite de intentos de login** (suite ratelimit): el 9º intento se bloquea, incluso con la contraseña correcta. El bloqueo es por cuenta, también limita correos inexistentes sin enumeración y no se evade variando mayúsculas (AUTH-060…063).
- **Observaciones sin cambio** (ver BUG_REPORT › Observaciones):
  - El límite de login es sólo por correo, así que alguien puede bloquear 15 min una cuenta conocida.
  - Con sesión abierta, `/login?callbackUrl=` ignora el destino.
  - El logout cierra **todas** las sesiones de la cuenta (ver Known Risks).

## Authorization Results

- **`@permissions`:** la línea base parcial tenía 170 ejecuciones (169 PASS, 1 FAIL). La intermedia, 376/376. La final, **377/377**.
- **Matriz de páginas:** 83 rutas × 4 roles = 332 celdas, con **0 divergencias** entre lo esperado y lo observado (PERM-001…083 y PERM-090, que valida que el inventario cubra las 83 páginas). En la final, las pruebas @P0 de la matriz corren también en Firefox y WebKit.
- **Backend:**
  - Replay de Server Actions sensibles con rol insuficiente: denegadas y **la base no cambia** (PERM-110…159).
  - Acciones de administración co-ubicadas en páginas públicas o del portal: frenadas por RBAC (PERM-120…138).
  - IDOR entre integrantes de staff.
  - Escalada OWNER → SUPER_ADMIN bloqueada.
  - CSRF en Server Actions (PERM-159).
  - Los 13 route handlers responden de acuerdo con el RBAC.
- **Tokens** (cotización, portal, invitación general y personal, cápsula y pago): probados como válido, inexistente, de otro evento, de otro tipo y rotado (PERM-160…188). Un token inválido recibe 404 genérico real (NAV-034). Las rutas por token llevan `noindex` y `Referrer-Policy: same-origin`.
- **Divergencias de seguridad de la auditoría:** 4, todas corregidas y verificadas:
  - BUG-001 y BUG-003 (CRITICAL);
  - BUG-004 y BUG-005 (HIGH).
  - Además, BUG-017 (HIGH: desvío de enlaces privados de una tercera) y BUG-018 (MEDIUM: desactivar cuentas protegidas por una vía lateral) salieron en el endurecimiento y también están verificados.
- **Observaciones sin cambio:**
  - `protectedAction` valida con Zod antes de autorizar, así que un anónimo ve el esquema en `VALIDATION_ERROR`.
  - Next expone las Server Actions de admin co-ubicadas en páginas públicas o del portal (por ejemplo `/memory/[token]` y `/staff/events/[id]`). Hoy las frena el RBAC de cada acción.

## Functional Results

Todo lo funcional pasa en la final (888/888 escenarios). Por área de negocio:

- **Venta pública** (sitio, contacto, configurador, diseñadora IA, propuesta y pago simulado):
  - El lead se crea con clienta, snapshot, aviso y analytics.
  - El precio se calcula siempre en servidor y el público no ve costos ni márgenes.
  - La disponibilidad pública no expone otros eventos.
  - Hay límite de envíos en las acciones públicas (API-080/081).
- **Correcciones de venta pública:**
  - BUG-002 y BUG-007: cobro tras cancelar y checkouts duplicados.
  - BUG-008 y BUG-017: clientas duplicadas por formato de teléfono y contacto de la visitante escrito en una clienta existente.
  - BUG-013: soft-404.
  - BUG-019 y BUG-021: envío por GET antes de hidratar y borrado de lo escrito.
- **Comercial admin** (leads, clientas, catálogo, cotizaciones): CRUD completo con persistencia y recarga, transiciones con las máquinas de estado, descuentos en bps y auditoría. Corrección: BUG-014, avisos en la captura manual de leads.
- **Eventos y experiencia** (eventos, calendario, portal, invitadas, Memory Capsule):
  - Ciclo de vida y confirmación.
  - Pagos manuales bloqueados en eventos cancelados.
  - RSVP con deduplicación diaria de recordatorios.
  - Moderación de fotos.
  - Correcciones: BUG-003, BUG-006 (RSVP, calendario) y BUG-015.
- **Operación y back-office** (operaciones, staff, inventario, compras, finanzas, ajustes, contenido, notificaciones):
  - Montos en centavos.
  - Cierre financiero con snapshot congelado.
  - Inventario y reservas, checklists idempotentes y avisos registrados en `NotificationLog`.
  - Correcciones: BUG-006 (filtros, contenido, bandeja), BUG-016, BUG-018 y BUG-022.
- **Accesibilidad:**
  - Prefijo A11Y: 16/27 PASS en la línea base (11 FAIL) → **27/27** en la final.
  - axe WCAG 2.1 AA en las páginas clave, login y configurador sólo con teclado, foco visible y en diálogos, landmarks, `alt` y `prefers-reduced-motion`.
  - Correcciones: BUG-009 (contraste), BUG-010 (`<dl>`), BUG-011 (`aria-controls`), BUG-012 (foco) y BUG-024 (etiquetas en Firefox).
- **Smoke:** SMK 16/32 en la línea base (16 BLOCKED por Firefox) → **32/32**.
- **Rendimiento** (observación de la auditoría, no prueba de carga):
  - Ninguna página superó 5 s. Las 83 páginas cargan en ~1–2 s con su rol principal.
  - Configurador completo ~11 s. Pago mock completo ~3 s. CRIT-002 ~25–35 s.
  - `/admin/leads` sin filtros devuelve ~176 KB de RSC con ~200 leads.

## Responsive Results

- **RESP-001…020: 20/20 PASS** en la línea base y en la final.
  - 18 de las 20 pruebas evalúan 4 viewports (1440×900, 1366×768, 768×1024 y 390×844). Exigen que el documento no tenga scroll horizontal (tolerancia 1 px) y que el H1 se vea; 14 de ellas verifican además el CTA principal. RESP-007 y RESP-019 prueban los menús móviles a 390 y 768 px (RESP-007 comprueba además a 1440 px que no haya botón de menú).
  - Abarca: público, configurador, contacto, login, propuesta, pago, portal, RSVP, cápsula, dashboard, leads, evento, calendario, finanzas, portal staff y los menús móviles (RESP-007 y RESP-019).
- **Proyecto `mobile-chrome`** (Pixel 7, 390×844, pruebas `@mobile`):
  - línea base (gate parcial, sin el carril 5): 28 ejecuciones (27 PASS y 1 FLAKY);
  - intermedia 34/34;
  - **final 41/41**.
- **Observaciones sin cambio:**
  - Desbordamiento transitorio de 14 px a 390 px en `/crear-experiencia` justo al cargar (0 px al asentarse).
  - Dos hallazgos axe sin triage a anchos móviles (ver Known Risks).

## Cross-browser Results

| Proyecto | Alcance | Línea base (gate parcial) | Intermedia | Final |
|---|---|---|---|---|
| chromium | todo | 665: 631 PASS · 33 FAIL · 1 FLAKY | 812: 811 PASS · 1 FLAKY | **852/852** |
| firefox | `@P0` | 30: **30 BLOCKED** (ENV-02) | 208: 203 PASS · 3 FAIL · 2 FLAKY | **224/224** |
| webkit | `@P0` | 30: 29 PASS · 1 FAIL | 208: 202 PASS · 5 FAIL · 1 FLAKY | **224/224** |
| mobile-chrome | `@mobile` | 28: 27 PASS · 1 FLAKY | 34/34 | **41/41** |
| chromium-global | `*.global.spec.ts` | 11/11 | 29/29 | **29/29** |
| chromium-ratelimit | `*.ratelimit.spec.ts` | 6/6 | 7/7 | **7/7** |

- **Al desbloquear Firefox (ENV-02)** aparecieron defectos que la auditoría no podía ver:
  - **BUG-020:** React #418, hidratación descartada cuando el chunk de `error.tsx` llega tarde.
  - **BUG-024:** `useId` divergente, con etiquetas y descripciones desligadas.
  - **ENV-04:** congelamiento de Firefox con varias páginas.
  - Los dos bugs están corregidos y verificados (NAV-037…039, EVT-040 y CUST-017).
- **WebKit:** el ruido de prefetch cancelado está en la lista benigna del guard. La cookie se verifica en el `Set-Cookie` real (WebKit en Windows no reporta SameSite). FIN-006 se analizó por lentitud de hidratación (ver Known Risks).
- **Por diseño, Firefox y WebKit corren sólo `@P0`.** P1–P3 se ejecutan sólo en Chromium.

## API Results

- **Módulo `api`:** la línea base tenía 42 escenarios (41 PASS y 1 BLOCKED, SMK-001 en Firefox). La final, **42/42** escenarios y **68/68** ejecuciones. Los 13 route handlers están cubiertos.
- **Status codes reales verificados** (TESTED — PASS):
  - **Salud:** `/api/health` y `/api/health/db` (sin caché, con latencia). Los métodos no soportados responden 405 (API-003…012).
  - **Cron:** 401 con `WWW-Authenticate: Bearer` si falta el secreto o es incorrecto. Con el secreto correcto responde 200 y es idempotente (API-020…022).
  - **Webhook de pagos:**
    - sin firma, firma inválida, firma de otro secreto o vencida (> 300 s): 400, sin efectos;
    - repetido: se procesa una sola vez;
    - proveedor desconocido: 404;
    - cuerpo > 256 KB: 413; JSON roto: 400;
    - pago inexistente: 200 con nota (API-030…035).
  - **Analytics:**
    - Origin ajeno, ausente o cross-site: 403;
    - cuerpo válido: 204;
    - cuerpo inválido: 400; más de 4 KB: 413 (API-040…042).
  - **Media:**
    - URL privada sin firma, o con firma ajena o vencida: 403;
    - sin sesión: 401; Origin ajeno: 403 (CSRF);
    - se rechazan magic bytes falsos, SVG con script, HTML y archivos que superan el tamaño máximo;
    - staff sólo puede subir evidencias de eventos asignados (API-060…068).
  - **Exportaciones CSV** (leads, invitadas, finanzas): anónimo 401 o login, staff 403 o `/staff`, evento inexistente 404. Las fórmulas se neutralizan y la exportación se audita (API-070…072).
  - **`/api/auth/*`:** la sesión no expone datos sensibles y no se crea sesión sin token CSRF (API-050…052).
- **Server Actions:** 169 inventariadas (148 protegidas y 21 públicas) más `loginAction`. Se ejercitan por la UI y por replay directo (ver Authorization Results).
- **Observaciones:**
  - Una Server Action con `Origin` ajeno se rechaza sin escribir, pero Next 15.5 responde **HTTP 500** con `digest` en lugar de un 4xx.
  - En el CSV los teléfonos salen con `'` delante por la neutralización de fórmulas (REQUIREMENT AMBIGUITY).

## Console / Network Issues

- **Gate final:** ninguna de las 1,377 ejecuciones falló por el guard de consola y red. El guard falla la prueba ante `console.error`, `pageerror`, requests fallidos y 5xx no declarados; los 4xx quedan como observación `http4xx` con su URL.
- **Detectado por el guard durante el ciclo:**
  - **BUG-020:** `pageerror` React #418 en Firefox.
  - **ENV-01:** 422 del beacon de analytics por la caché de datos compartida entre carriles; resuelta.
  - **Red de seguridad de BUG-006:** registra `console.error("[navegación] …")` y el guard lo convierte en fallo. No se disparó en la corrida final.
- **Patrones benignos documentados** (`tests/e2e/fixtures/guard.ts`):
  - Ruido de WebKit al cancelar un prefetch. Queda pendiente de revisión: el patrón «Failed to fetch RSC payload … Falling back to browser navigation» también silencia ese aviso en Chromium.
  - Fuente abortada en Firefox (`NS_BINDING_ABORTED`), anclada a `localhost`/`127.0.0.1`.
  - `net::ERR_ABORTED`, benigno por diseño.
- **Comportamientos del framework que se ven en logs o alertas:**
  - **HTTP 500** de Next 15.5 cuando rechaza una Server Action por CSRF.
  - `notFound()` responde HTTP 200 en zonas privadas `/admin/**/[id]` y `/staff/events/[id]` (streaming bajo `loading.tsx`, con `noindex`).
  - En Firefox, navegar mientras sigue en vuelo un `router.refresh()` provoca «Falling back to browser navigation».

## Bugs

**24 registrados · 0 abiertos.** BLOCKER 0 · CRITICAL 3 · HIGH 4 · MEDIUM 9 · LOW 8. Todos están **Verified**: la prueba de reproducción fallaba antes de corregir y pasa después (repeticiones con `--retries=0`). Excepción: BUG-018 se reprodujo 1/1 con una prueba de integración temporal y se verifica en `tests/integration/operations-staff.test.ts`, sin E2E @regression propia. BUG-006 queda **Verified (mitigado)**.

**BLOCKER (0).** Ninguno.

**CRITICAL (3)**

| ID | Título | Módulo | Estado |
|---|---|---|---|
| [BUG-001](BUG_REPORT.md#bug-001--cerrar-sesión-no-es-definitivo-las-respuestas-en-vuelo-re-emiten-la-cookie-y-no-hay-revocación-en-servidor) | «Cerrar sesión» no era definitivo: respuestas en vuelo re-emitían la cookie y no había revocación en servidor | auth | Verified |
| [BUG-002](BUG_REPORT.md#bug-002--un-checkout-de-anticipo-abierto-se-puede-cobrar-después-de-cancelar-el-evento) | Un checkout de anticipo abierto se podía cobrar después de cancelar el evento | events / payments | Verified |
| [BUG-003](BUG_REPORT.md#bug-003--link-general-de-invitación-escribir-el-nombre-de-otra-invitada-sobrescribe-su-rsvp-y-entrega-su-link-personal) | Link general de invitación: el nombre de otra invitada sobrescribía su RSVP y entregaba su link personal | guests | Verified |

**HIGH (4)**

| ID | Título | Módulo | Estado |
|---|---|---|---|
| [BUG-004](BUG_REPORT.md#bug-004--la-sesión-no-se-invalida-en-el-servidor-una-cookie-copiada-antes-del-logout-sigue-dando-acceso) | Una cookie copiada antes del logout seguía dando acceso | auth | Verified |
| [BUG-005](BUG_REPORT.md#bug-005--callbackurl-con-caracteres-de-control-evade-safecallback) | `callbackUrl` con caracteres de control evadía `safeCallback` | auth | Verified |
| [BUG-006](BUG_REPORT.md#bug-006--navegaciones-a-la-misma-ruta-y-routerrefresh-dentro-de-transiciones-se-quedan-colgadas) | Navegación a la misma ruta y `router.refresh()` colgados (filtros, paginación, calendario, contenido, bandeja, RSVP) | transversal (App Router) | Verified (mitigado) |
| [BUG-017](BUG_REPORT.md#bug-017--una-captura-pública-escribía-el-contacto-de-la-visitante-en-una-clienta-existente-sus-enlaces-privados-podían-llegarle-a-otra-persona) | Una captura pública escribía el contacto de la visitante en una clienta existente | leads / customers | Verified |

**MEDIUM (9)**

| ID | Título | Módulo | Estado |
|---|---|---|---|
| [BUG-007](BUG_REPORT.md#bug-007--dos-solicitudes-simultáneas-de-checkout-crean-dos-pagos-pending-del-mismo-anticipo) | Checkout concurrente creaba dos pagos PENDING | payments | Verified |
| [BUG-008](BUG_REPORT.md#bug-008--la-misma-clienta-se-duplica-porque-el-teléfono-se-guarda-con-formatos-distintos) | Teléfonos con formatos distintos duplicaban a la clienta | leads / customers | Verified |
| [BUG-009](BUG_REPORT.md#bug-009--contraste-insuficiente-wcag-143-en-tonos-warninginfo-taupe-y-textos-atenuados) | Contraste insuficiente (warning/info, taupe, atenuados) | UI compartida | Verified |
| [BUG-010](BUG_REPORT.md#bug-010--listas-de-definición-dl-inválidas-en-la-propuesta-pública-y-el-micrositio) | `<dl>` inválidas en la propuesta pública y el micrositio | quotes / guests | Verified |
| [BUG-011](BUG_REPORT.md#bug-011--portal-staff-aria-controls-de-agregar-nota-apunta-a-un-id-inexistente) | `aria-controls` de «Agregar nota» apuntaba a un id inexistente | staff | Verified |
| [BUG-018](BUG_REPORT.md#bug-018--eliminar-una-ficha-de-staff-desactivaba-la-cuenta-ligada-sin-aplicar-las-reglas-de-usuarios) | Eliminar una ficha de staff desactivaba la cuenta ligada sin las reglas de Usuarios | staff / users | Verified |
| [BUG-019](BUG_REPORT.md#bug-019--formularios-públicos-y-por-token-se-enviaban-por-get-antes-de-hidratar-con-datos-personales-en-la-url) | Formularios públicos y por token se enviaban por GET antes de hidratar, con datos personales en la URL | guests / portal / configurator | Verified |
| [BUG-020](BUG_REPORT.md#bug-020--firefox-error-de-hidratación-react-418-cuando-el-chunk-de-errortsx-llega-tarde-react-descarta-el-html-del-servidor) | Firefox: React #418 cuando el chunk de `error.tsx` llega tarde | layouts (transversal) | Verified |
| [BUG-024](BUG_REPORT.md#bug-024--firefox-etiquetas-descripciones-y-aria-controls-desligados-cuando-el-useid-del-cliente-difiere-del-html-del-servidor) | Firefox: etiquetas, descripciones y `aria-controls` desligados por `useId` divergente | formularios (transversal) | Verified |

**LOW (8)**

| ID | Título | Módulo | Estado |
|---|---|---|---|
| [BUG-012](BUG_REPORT.md#bug-012--el-diálogo-aceptar-propuesta-no-devuelve-el-foco-al-cerrarse) | El diálogo «Aceptar propuesta» no devolvía el foco | quotes | Verified |
| [BUG-013](BUG_REPORT.md#bug-013--soft-404-experienciasslug-inexistente-o-inactivo-responde-http-200) | Soft-404 en `/experiencias/[slug]` | public | Verified |
| [BUG-014](BUG_REPORT.md#bug-014--un-lead-capturado-a-mano-con-origen--captura-manual-dispara-los-avisos-de-lead-entrante) | Un lead manual con «Origen» ≠ «Captura manual» enviaba avisos | leads | Verified |
| [BUG-015](BUG_REPORT.md#bug-015--el-encabezado-del-evento-no-indica-que-el-evento-está-cerrado) | El encabezado del evento no mostraba «Cerrado» | finance / events | Verified |
| [BUG-016](BUG_REPORT.md#bug-016--seed-demo-notificaciones-con-enlaces-a-rutas-inexistentes) | Seed DEMO con enlaces a rutas inexistentes | notifications / seed | Verified |
| [BUG-021](BUG_REPORT.md#bug-021--lo-escrito-antes-de-hidratar-se-borraba-en-formularios-públicos-y-del-portal) | Lo escrito antes de hidratar se borraba en formularios públicos y del portal | memory / marketing / guests / portal / ai | Verified |
| [BUG-022](BUG_REPORT.md#bug-022--restablecer-la-propia-contraseña-desde-staff-revocaba-la-sesión-en-silencio) | Restablecer la propia contraseña desde Staff revocaba la sesión en silencio | staff | Verified |
| [BUG-023](BUG_REPORT.md#bug-023--get-apiauthsession-re-emitía-la-cookie-de-sesión-latente) | `GET /api/auth/session` re-emitía la cookie de sesión (latente) | auth | Verified |

**Problemas de entorno (no son bugs de la app)**

| ID | Problema | Estado |
|---|---|---|
| [ENV-01](BUG_REPORT.md#env-01--caché-de-datos-de-next-compartida-entre-carriles--resuelta) | La caché de datos de Next se compartía entre carriles (IDs de otra base) | RESUELTA: caché sólo en memoria en E2E y limpieza al arrancar |
| [ENV-02](BUG_REPORT.md#env-02--firefox-de-playwright-no-arranca-desde-localappdata--resuelta) | Firefox de Playwright no arrancaba desde `%LOCALAPPDATA%` (error SxS) | RESUELTA: `E2E_FIREFOX_EXECUTABLE`; el gate clasifica los errores de lanzamiento como BLOCKED |
| [ENV-03](BUG_REPORT.md#env-03--saturación-de-dockerwsl-con-6-carriles-en-paralelo--resuelta-carriles-en-secuencia) | 6 carriles en paralelo saturaban Docker/WSL | RESUELTA: carriles en secuencia |
| [ENV-04](BUG_REPORT.md#env-04--firefox-de-playwright-se-congela-con-varias-páginas-abiertas-a-la-vez--mitigada) | Firefox de Playwright se congela con varias páginas abiertas a la vez (se reproduce sin la app) | MITIGADA: 1 worker de Firefox y `ready()` con tope |

## Areas Not Tested

Cada punto es **NOT TESTED** en esta auditoría:

- **Pasarelas reales Stripe y MercadoPago.** Son un servicio externo de pago, así que se probaron con el proveedor `mock` y webhooks firmados localmente. No se probó:
  - el cobro real;
  - los métodos OXXO, SPEI y MSI;
  - la expiración de la sesión del proveedor (pendiente 8 de BUG_REPORT);
  - los webhooks reales del proveedor.
- **Correo (Resend), WhatsApp Cloud API y proveedor de IA reales.** Sólo se verificó el registro en `NotificationLog` (bandeja simulada) y la diseñadora IA con el proveedor mock. Las plantillas de correo no pasan por axe: una usa taupe de marca como texto, de unos 2.8:1 de contraste (hallazgo sin triage).
- **Firefox y WebKit sólo en `@P0`, por diseño.** P1–P3 corren sólo en Chromium y el proyecto móvil sólo en `@mobile`.
- **Viewports de 375 y 1024 px de ancho.** CLAUDE.md los exige, pero las pruebas RESP usan 1440, 1366, 768 y 390 px.
- **Carga, concurrencia a escala y rendimiento.** Sólo hay observaciones de tiempos de carga en la auditoría; no hubo pruebas de carga ni de pool de conexiones con un proveedor lento.
- **Producción real y staging.** Todo corrió contra un build local (`next start` en Windows 11) con bases `*_e2e`. No se ejercitó la imagen Docker de Dokploy, Traefik (del que depende `X-Real-Ip`), el bucket de Spaces, el cron programado ni los respaldos. No se ejecutó ni siquiera un smoke de sólo lectura en producción.
- **No cubierto según BUG_REPORT:**
  - **Radix:** `aria-controls` de Dialog, Select y Popover, y el nombre de los paneles de Tabs y Accordion montados después, cuando el `useId` diverge. Es el riesgo residual de BUG-024 y no se puede fijar sin envolver la librería.
  - **Recálculo del total de la reserva** al cambiar invitadas o experiencia de un evento con reserva: no hay requisito escrito (REQUIREMENT AMBIGUITY).
  - **Recordatorios RSVP:** no se probó que coincidan con la llave del programador de `/api/cron/notifications`.
  - **`<meta name="robots">` duplicado en las 404:** sin verificar, porque PUB-016 usa `.first()`.
  - **6 hallazgos sin triage:**
    - axe `link-name` en `/admin` por debajo de 640 px;
    - axe `scrollable-region-focusable` a 390 px;
    - plantilla de correo con contraste bajo;
    - `marketingOptIn` otorgado por un tercero;
    - validación del número de WhatsApp en Ajustes;
    - contador de la diseñadora IA.

    No se reprodujeron con una prueba versionada, así que no cuentan para el gate.
- **Actualización a Next ≥ 16.3 y retiro de las mitigaciones:** no se ha intentado.

## Known Risks

1. **Mitigaciones de React/Next (BUG-006, BUG-020, BUG-024).** El defecto de raíz está en el React 19.2-canary que trae Next 15.5.27. La app lo esquiva con tres mecanismos:
   - **BUG-006:** navigation guard que entrega completas las respuestas RSC (`src/instrumentation-client.ts`, `rsc-response-buffer`, `navigation-guard`), con red de seguridad.
     - Costo aceptado: los Suspense internos ya no pintan por partes en navegaciones del cliente. El envoltorio de `window.fetch` aplica a todo el sitio.
     - Un lazy fetch descartado de un **layout** no tiene recuperación automática y requiere recargar.
     - Hay un falso positivo latente de la red de seguridad (hoy no alcanzable).
   - **BUG-020:** `<SegmentChildren>` en los 7 layouts con `error.tsx` hermano. Todo layout nuevo con `error.tsx` hermano que pinte `children` dentro de un elemento HTML debe usarlo (CLAUDE.md).
   - **BUG-024:** `usePaintedId` en los campos compartidos. Un componente nuevo que mezcle una descripción pintada por el servidor con un error condicional debe usarlo.
   - **Criterio de retiro:** BUG-006 y BUG-020, con Next ≥ 16.3.0: trae facebook/react#36134, que corrige BUG-006, y en esa actualización se comprueba BUG-020 sin el envoltorio. BUG-024 no depende de esa versión: se retira cuando el React que traiga Next conserve *Forked* al reiniciar una fibra durante la hidratación. Se mide sin el hook: los ids de `/admin/events/new` deben coincidir entre servidor y cliente en Firefox, y EVT-005 debe pasar `--repeat-each=8` sin campos sin etiqueta. CUST-017 no sirve como criterio, porque provoca la divergencia a propósito. Al actualizar:
     - quitar el guard y `<NavigationGuardBridge />`;
     - repetir las pruebas de BUG-006 con `--repeat-each=5 --retries=0`;
     - verificar NAV-037…039 en Firefox sin `<SegmentChildren>`;
     - medir la divergencia natural de ids en `/admin/events/new` sin el hook.

   Mientras tanto, la app depende de estas mitigaciones.
2. **El logout es por cuenta, no por dispositivo.** «Cerrar sesión» incrementa `sessionVersion` y cierra todas las sesiones de la cuenta en todos los dispositivos, y ningún texto lo avisa. Revocar por dispositivo requiere un cambio de esquema (pendiente 2).
3. **ENV-04 (Firefox).** Firefox de Playwright se congela con varias páginas abiertas en Windows. Está mitigado con 1 worker, así que **no se deben correr carriles con `E2E_CROSS_BROWSER=1` en paralelo**. Un FLAKY de Firefox sólo se clasifica como ENVIRONMENT si su traza muestra la ausencia total de frames.
4. **FIN-006 en WebKit sigue documentado como observación de entorno.** «Agregar costo» tarda 20–25 s en hidratar en WebKit sobre Windows, más que el tope de 15 s de `ready()`.
   - BUG_REPORT lo mantiene como inestabilidad clasificada ENVIRONMENT.
   - Pasó 3/3 con `--retries=0`, y en el gate final pasó en WebKit sin reintento.
   - Puede reaparecer en futuras corridas.
5. **Proveedores en mock en producción.** Con el proveedor de pagos `mock`, una clienta podría «pagar» sin dinero real (`docs/GUIA_PRODUCCION.md` §8). Hasta configurar el proveedor real:
   - apagar el flag «Pagos en línea» (`PAYMENTS_ENABLED`) y registrar los anticipos con «Pago manual»;
   - apagar WhatsApp y la diseñadora IA mientras sigan en mock.
6. **Formularios del panel admin antes de hidratar.** Siguen con `defaultValues` vacíos: lo escrito antes de que React hidrate puede perderse en equipos lentos (pendiente 3).
7. **Seguridad, observaciones sin cambio:**
   - el límite de login es sólo por correo (DoS de bloqueo de una cuenta conocida);
   - `clientIp()` confía en `X-Real-Ip`, lo que exige Traefik delante;
   - se valida antes de autorizar (revela el esquema);
   - hay acciones de admin co-ubicadas en páginas públicas, frenadas por RBAC;
   - el rechazo CSRF responde 500 (ensucia las alertas de 5xx);
   - la documentación de `Referrer-Policy` está desalineada.
8. **Estabilidad de la suite.** El gate final tiene 0 FLAKY, pero la primera corrida final tuvo 5 FLAKY y 1 FAIL, todos TEST BUG o ENVIRONMENT (ver «Build / Commit Tested»). Siguen documentadas caídas esporádicas del worker de Node en Windows (`0xC0000409`). Repetir un carril aislado antes de clasificar una falla.

## Recommendations

**Antes de abrir producción**

1. **Seguir `docs/GUIA_PRODUCCION.md` paso a paso:** producción nueva, el servidor actual como staging, integraciones en orden y la lista de verificación de §11 antes de abrir. Incluye el recorrido completo desde el celular y comprobar que llega el correo, que corre el cron y que existe el respaldo del día.
2. **Configurar los proveedores reales primero en staging** con llaves test/sandbox (pagos, Resend, WhatsApp Cloud API e IA con límite de gasto) y sólo después pasar a llaves live en producción (GUIA §8).
   - Mientras pagos siga en `mock`, **apagar «Pagos en línea»**.
   - Probar esas integraciones en staging con el recorrido de §11 y correr el gate en local (GUIA §14). Contra staging, `preflight.mjs` sólo permite un smoke de sólo lectura (`E2E_ALLOW_REMOTE=readonly`).
3. **Proteger `main`** (GUIA §13): PR obligatorio, CI en verde (`quality`, `integration`, `docker`), sin force push ni borrado.

**En cada cambio**

4. **Correr `/e2e-quality-gate regression` antes de cada PR a `main`**, con veredicto 🟢 READY o 🟡 READY WITH CONDITIONS (GUIA §14).
   - Correr los carriles en secuencia o con un máximo de 3 a la vez (ENV-03) y sin cross-browser en paralelo (ENV-04).
   - Usar `/e2e-quality-gate full` para cambios grandes.

**Corto plazo**

5. **Actualizar a Next ≥ 16.3 en una rama**, correr el gate `full` con `E2E_CROSS_BROWSER=1` en local y después desplegar a staging. Retirar las mitigaciones de BUG-006, BUG-020 y BUG-024 siguiendo sus criterios de retiro y medir antes de quitarlas.
6. **Decidir los pendientes de BUG_REPORT** (§ «Pendientes que requieren decisión del usuario»):
   - revocación por dispositivo (2);
   - formularios del panel antes de hidratar (3);
   - reembolso automático de cobros tardíos (4);
   - teléfono normalizado e indexado (5);
   - tope de auto-registros y recuperación de un link personal (6);
   - copia del aviso para la anfitriona (7);
   - expirar la sesión del proveedor tras un pago manual (8);
   - soft-404 en rutas internas (10);
   - re-sembrar las bases de desarrollo y demo (11).
7. **Atender las observaciones de seguridad sin cambio:**
   - autenticar y autorizar antes de validar en `protectedAction`;
   - límite de login combinado correo + IP, con desbloqueo por admin;
   - separar los módulos de Server Actions públicas y de admin;
   - documentar en DEPLOY que `X-Real-Ip` requiere Traefik;
   - alinear `docs/SECURITY.md` con la `Referrer-Policy` real.
8. **Hacer triage de los 6 hallazgos sin clasificar** con una prueba versionada cada uno. Dar prioridad a `marketingOptIn` otorgado por un tercero (consentimiento) y a la accesibilidad del panel por debajo de 640 px. Agregar viewports de 375 y 1024 px a `responsive.spec.ts`.

**Mantenimiento**

9. **En producción**, medir el tiempo hasta el contenido en páginas lentas (costo de la mitigación de BUG-006) y activar el monitoreo de `/api/health` y `/api/health/db` (GUIA §9).
10. **Alinear las notas de estado** de `BUG_REPORT.md` con este gate:
    - el encabezado todavía dice «23 bugs», cita `8020b91..b47437b (61 commits)` y dice que en los carriles 4 y 5 quedan inestabilidades «que se están corrigiendo en paralelo»;
    - el encabezado también dice que la ronda 1 usó un worktree por bug, pero fueron 6 worktrees agrupados por área (ver «Build / Commit Tested»);
    - `ROLE_PERMISSION_MATRIX.md` todavía cita STF-021 en WebKit;
    - `APPLICATION_TEST_MAP.md` (MAP-528) todavía marca MEM-021 como NOT APPLICABLE en WebKit.

    Todo eso quedó resuelto en la corrida final: 24 bugs, STF-021 y MEM-021 PASS en WebKit.

## Final Quality Gate

Contenido de `docs/qa/runs/20261007-2318-full/gate.md`, sin cambios salvo el nivel del título para no duplicar el encabezado de esta sección:

### Final Quality Gate — 🟢 READY

Modo: **full** · Commit: `754e2c6` · Fecha: 2026-10-07T23:18:56.803Z

- Sin condiciones pendientes.

| Grupo | Total | PASS | FAIL | FLAKY | BLOCKED | NOT TESTED | Pass rate | Cobertura |
|---|---|---|---|---|---|---|---|---|
| **Overall** | 1377 | 1377 | 0 | 0 | 0 | 0 | 100% | 100% |
| Recorridos críticos | 239 | 239 | 0 | 0 | 0 | 0 | 100% | 100% |
| P0 | 704 | 704 | 0 | 0 | 0 | 0 | 100% | 100% |
| P1 | 387 | 387 | 0 | 0 | 0 | 0 | 100% | 100% |
| P2 | 246 | 246 | 0 | 0 | 0 | 0 | 100% | 100% |
| P3 | 40 | 40 | 0 | 0 | 0 | 0 | 100% | 100% |
| Autorización (@permissions) | 377 | 377 | 0 | 0 | 0 | 0 | 100% | 100% |
| Navegador: chromium | 852 | 852 | 0 | 0 | 0 | 0 | 100% | 100% |
| Navegador: firefox | 224 | 224 | 0 | 0 | 0 | 0 | 100% | 100% |
| Navegador: webkit | 224 | 224 | 0 | 0 | 0 | 0 | 100% | 100% |
| Navegador: mobile-chrome | 41 | 41 | 0 | 0 | 0 | 0 | 100% | 100% |
| Navegador: chromium-global | 29 | 29 | 0 | 0 | 0 | 0 | 100% | 100% |
| Navegador: chromium-ratelimit | 7 | 7 | 0 | 0 | 0 | 0 | 100% | 100% |

Bugs abiertos — Blocker: 0 · Critical: 0 · High: 0 · Medium: 0 · Low: 0 (total registrados: 24)

### Por módulo
| Módulo | Total | PASS | FAIL | FLAKY | BLOCKED | NOT TESTED | Pass rate | Cobertura |
|---|---|---|---|---|---|---|---|---|
| ai | 11 | 11 | 0 | 0 | 0 | 0 | 100% | 100% |
| analytics | 3 | 3 | 0 | 0 | 0 | 0 | 100% | 100% |
| api | 68 | 68 | 0 | 0 | 0 | 0 | 100% | 100% |
| auth | 400 | 400 | 0 | 0 | 0 | 0 | 100% | 100% |
| calendar | 16 | 16 | 0 | 0 | 0 | 0 | 100% | 100% |
| catalog | 32 | 32 | 0 | 0 | 0 | 0 | 100% | 100% |
| configurator | 44 | 44 | 0 | 0 | 0 | 0 | 100% | 100% |
| content | 14 | 14 | 0 | 0 | 0 | 0 | 100% | 100% |
| customers | 17 | 17 | 0 | 0 | 0 | 0 | 100% | 100% |
| events | 59 | 59 | 0 | 0 | 0 | 0 | 100% | 100% |
| finance | 22 | 22 | 0 | 0 | 0 | 0 | 100% | 100% |
| guests | 49 | 49 | 0 | 0 | 0 | 0 | 100% | 100% |
| inventory | 28 | 28 | 0 | 0 | 0 | 0 | 100% | 100% |
| leads | 39 | 39 | 0 | 0 | 0 | 0 | 100% | 100% |
| memory | 65 | 65 | 0 | 0 | 0 | 0 | 100% | 100% |
| navigation | 26 | 26 | 0 | 0 | 0 | 0 | 100% | 100% |
| notifications | 7 | 7 | 0 | 0 | 0 | 0 | 100% | 100% |
| operations | 34 | 34 | 0 | 0 | 0 | 0 | 100% | 100% |
| payments | 38 | 38 | 0 | 0 | 0 | 0 | 100% | 100% |
| portal | 81 | 81 | 0 | 0 | 0 | 0 | 100% | 100% |
| public | 79 | 79 | 0 | 0 | 0 | 0 | 100% | 100% |
| purchases | 19 | 19 | 0 | 0 | 0 | 0 | 100% | 100% |
| quotes | 91 | 91 | 0 | 0 | 0 | 0 | 100% | 100% |
| settings | 18 | 18 | 0 | 0 | 0 | 0 | 100% | 100% |
| staff | 90 | 90 | 0 | 0 | 0 | 0 | 100% | 100% |
| users | 21 | 21 | 0 | 0 | 0 | 0 | 100% | 100% |
| vendors | 6 | 6 | 0 | 0 | 0 | 0 | 100% | 100% |

**Justificación.**
- `quality-gate.mjs` calcula 🟢 READY: P0 704/704, recorridos críticos 239/239, P1 387/387 (≥ 95 %), 0 FLAKY y ningún bug Blocker, Critical, High, Medium o Low abierto (24 registrados, todos Verified).
- La línea base era 🔴 BLOCKED: 18 ejecuciones críticas en FAIL/BLOCKED y 3 CRITICAL de seguridad e integridad de cobros. Los 14 BLOCKED eran Firefox sin arrancar (ENV-02, resuelto). Los 3 CRITICAL tienen pruebas de reproducción `@regression` y `@P0` (AUTH-032 y CRIT-014 para BUG-001, EVT-024 para BUG-002 y GST-014 para BUG-003) que pasan en Chromium, Firefox y WebKit.
- El gate mezcla `539672d` y `754e2c6`, pero el código de la app es idéntico entre los dos y los 5 archivos de prueba modificados se ejecutaron sobre `754e2c6`.
- El veredicto vale para el entorno TEST con proveedores simulados. No certifica pasarelas, correo ni WhatsApp reales, carga ni el entorno de producción (ver «Areas Not Tested»).
- BUG-006 y BUG-020 siguen siendo mitigaciones hasta Next ≥ 16.3. BUG-024 lo es hasta cumplir su propio criterio de retiro (ver Known Risks 1).
