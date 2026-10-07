# Runbook — E2E Quality Gate

Contenido: [Fases 0–9](#fases-09) · [FULL: 17 pasos](#full-17-pasos) · [Modos](#qué-corre-cada-modo) · [Paquetes y carriles](#paquetes-de-trabajo-y-carriles-paralelos) · [Comandos](#comandos) · [Checkpoints](#checkpoints) · [Cuando algo bloquea](#cuando-algo-bloquea)

## Fases 0–9

### Phase 0 — Discovery
Objetivo: entender antes de probar. Nada de tests todavía.
1. `node .claude/skills/e2e-quality-gate/scripts/preflight.mjs [--cross-browser]` → entorno seguro y apto. Clasifica el entorno (LOCAL / DEVELOPMENT / TEST / STAGING / PRODUCTION / UNKNOWN). El gate normal es **TEST** (build de producción local + base `*_e2e`).
2. `node .claude/skills/e2e-quality-gate/scripts/discover.mjs` → inventario de páginas, APIs, Server Actions, permisos, modelos, pruebas existentes y *drift* desde la corrida anterior.
3. Lee `CLAUDE.md`, `references/project-profile.md`, `docs/ARCHITECTURE.md`, `docs/DOMAIN.md`, `docs/SECURITY.md` y, para cada módulo en alcance, `src/features/<m>/server/actions.ts`, `*-service.ts`, `domain/*-status.ts` y `schemas.ts`. **El código y los requisitos documentados mandan sobre las suposiciones.**
4. `pnpm e2e:infra` (o con `E2E_LANE`) → la infraestructura funciona. Si falla: ENVIRONMENT ISSUE, todo queda BLOCKED hasta resolverlo.

### Phase 1 — Test inventory
Escribe/actualiza `docs/qa/APPLICATION_TEST_MAP.md` (ver plantilla en triage-and-reporting): cada página, flujo y acción relevante por rol con resultado esperado y prioridad P0–P3. Usa el inventario como checklist para que no falte ninguna ruta. Después `ROLE_PERMISSION_MATRIX.md` con el esperado de `src/server/auth/permissions.ts` (UI **y** backend).

### Phase 2 — Smoke
Un recorrido mínimo que prueba que vale la pena seguir: health, login de cada rol, home de cada portal, páginas públicas principales, una lectura por módulo admin, un enlace por token. Etiqueta `@smoke`. Si el smoke cae en algo transversal (login, base, build), es BLOCKER y se reporta antes de seguir.

### Phase 3 — P0 Critical Journeys
Los recorridos de los que vive el negocio (lista en project-profile §Recorridos críticos), de punta a punta y verificando la base en cada paso. Etiquetas `@P0 @critical`. Corren también en mobile (`@mobile`) cuando la clienta los usa desde el celular, y en Firefox/WebKit (`E2E_CROSS_BROWSER=1`).

### Phase 4 — Authentication & Authorization
- Autenticación (`@auth`): login válido/inválido, usuario inexistente, contraseña incorrecta, usuario desactivado, logout, URL privada tras logout (UI **y** request directo), redirect con `callbackUrl` (incluido intento de open redirect), refresh, múltiples pestañas, sesión invalidada en servidor (rol cambiado/usuario desactivado mientras tiene sesión).
- Autorización (`@permissions`): matriz rol × página, acciones ocultas vs. bloqueadas en backend, replay de Server Actions con rol sin permiso, IDs de otros (staff → evento no asignado), tokens de otros eventos, APIs restringidas sin sesión / con rol insuficiente. Ver patrones en test-design §Autorización.

### Phase 5 — Functional
Por módulo: happy path CRUD completo (crear → mensaje → aparece → recargar → persiste → editar → buscar/filtrar → eliminar/archivar → no reaparece), máquinas de estado, reglas de negocio (dinero en centavos, IVA/bps, disponibilidad, inventario, RSVP), formularios (requeridos, validación front y back, límites, mensajes, loading/disabled, doble submit, cancelar), navegación (menús, tabs, breadcrumbs, enlaces rotos, 404, atrás/adelante), estado y persistencia (refresh, logout/login, cookies/localStorage donde aplique).

### Phase 6 — Negative Testing
Campos vacíos, formatos inválidos, límites, caracteres especiales/HTML, duplicados, IDs inexistentes, URLs manipuladas, recursos eliminados, sesión inválida, sin permisos, doble click/envío repetido, refresh y atrás durante una operación, fallo de API cuando se pueda simular (route.abort / route.fulfill sobre llamadas del cliente), y códigos 400/401/403/404/409/422/500 **donde el sistema realmente los produce** (no forzar códigos). Determina cuáles aplican y documenta los que no.

### Phase 7 — Responsive & Cross-browser (+ accesibilidad)
- Viewports: 1440×900, 1366×768, 768×1024, 390×844 (patrón en test-design §Responsive). Sin scroll horizontal, navegación usable, CTA visible, tablas/menús adaptados.
- Cross-browser: P0 en Chromium, Firefox y WebKit.
- Accesibilidad: `scanA11y` (axe WCAG 2.1 AA) en páginas clave + teclado/foco/labels en formularios críticos.

### Phase 8 — Regression
Suite completa en un solo carril, con `E2E_RETRIES=1` para detectar inestables. Cada bug corregido deja una prueba `@regression` que lo reproduce.

### Phase 9 — Reporting
Consolida `findings/*.md` en `BUG_REPORT.md` (re-numera BUG-001…), completa `TEST_COVERAGE_MATRIX.md`, corre `quality-gate.mjs` y escribe `E2E_TEST_REPORT.md` con el bloque del gate tal cual lo calculó el script.

## FULL: 17 pasos

| # | Paso | Fase | Salida |
|---|---|---|---|
| 1 | Discovery + preflight + `@infra` | 0 | inventario, entorno clasificado |
| 2 | Application Test Map | 1 | `APPLICATION_TEST_MAP.md` |
| 3 | Role Permission Matrix (esperado) | 1 | `ROLE_PERMISSION_MATRIX.md` |
| 4 | Smoke | 2 | `tests/e2e/smoke/` |
| 5 | P0 Critical Journeys | 3 | `tests/e2e/critical/` |
| 6 | Authentication | 4 | `tests/e2e/auth/` |
| 7 | Authorization (UI + backend + replay + IDOR) | 4 | `tests/e2e/permissions/`, matriz observada |
| 8 | Functional por módulo | 5 | `tests/e2e/<módulo>/` |
| 9 | Negative | 6 | dentro de cada módulo (`@negative`) |
| 10 | API (route handlers, webhooks, cron, CSV, media) | 5–6 | `tests/e2e/api/` |
| 11 | Persistencia (DB ↔ UI ↔ refresh) | 5 | asserts de `db` en cada prueba de escritura |
| 12 | Responsive | 7 | `tests/e2e/responsive/` + `@mobile` |
| 13 | Cross-browser | 7 | proyectos firefox/webkit sobre `@P0` |
| 14 | Accesibilidad | 7 | `tests/e2e/accessibility/` |
| 15 | Regression (suite completa, carril 0) | 8 | `test-results/results.json` |
| 16 | Consolidación de bugs (reproducidos, clasificados) | 9 | `BUG_REPORT.md` |
| 17 | Quality Gate + informe | 9 | `runs/…/gate.*`, `E2E_TEST_REPORT.md` |

Estructura de carpetas (se crean sólo las que tengan pruebas reales):
`tests/e2e/{smoke,critical,auth,permissions,navigation,public,configurator,leads,customers,catalog,quotes,payments,events,portal,guests,memory,operations,staff,inventory,purchasing,finance,settings,content,notifications,api,responsive,accessibility,regression}/`

## Qué corre cada modo

| Modo | Fases | Comando base | Gate sobre |
|---|---|---|---|
| smoke | 0, 2, 9 | `pnpm e2e:smoke` | `@smoke` |
| critical | 0, 3, 7 (cross-browser), 9 | `E2E_CROSS_BROWSER=1 pnpm e2e:critical` | `@P0` |
| auth | 0, 4 (auth), 9 | `pnpm e2e:auth` | `@auth` |
| permissions | 0, 1 (matriz), 4 (authz), 9 | `pnpm e2e:permissions` | `@permissions` |
| module <m> | 0, 1 (filas del módulo), 3–6 del módulo, 9 | `playwright test --grep @module:<m>` | `@module:<m>` |
| regression | 0, 8, 9 | `pnpm e2e:regression` + módulos del drift | `@P0\|@regression` + módulos |
| full | 0–9 | todo | toda la suite |

En modos parciales, si faltan pruebas para el alcance pedido, escríbelas primero (con las mismas convenciones) y luego ejecuta. Actualiza sólo las secciones de los documentos que correspondan y deja constancia del modo en el informe.

## Paquetes de trabajo y carriles paralelos

Una corrida FULL completa es grande. Se divide en paquetes **independientes** que corren en paralelo, cada uno en su carril `E2E_LANE=n` (puerto `3200+n`, base `ivonne_rosa_e2e_l<n>`, sesiones `tests/e2e/.auth/l<n>/`, resultados `test-results/l<n>/`). Los carriles comparten el build `.next-e2e`; por eso el código de la app **no cambia** mientras corren (la primera auditoría no corrige).

| Carril | Paquete | Prefijo ID | Contenido |
|---|---|---|---|
| 1 | Acceso y seguridad | `AUTH`, `PERM`, `NAV`, `API` | login/logout/sesión, matriz rol × página (todas las rutas del inventario), replay de acciones, IDOR staff/tokens, APIs (health, media, CSV, cron, webhooks, analytics), 404 y enlaces rotos |
| 2 | Venta pública | `PUB`, `CONF`, `AI`, `QUO-C`, `PAY` | sitio público, contacto, configurador (disponibilidad, estimación, envío → lead), diseñador IA (flag), cotización por token (aceptar/rechazar), pago mock y resultado, webhooks de pago |
| 3 | Comercial admin | `LEAD`, `CUST`, `CAT`, `QUO` | leads (crear, estados, asignar, actividad, export), clientas, catálogo completo, cotizaciones (crear, precios, descuento, enviar, versión, duplicar, vencer, imprimir) |
| 4 | Eventos y experiencia | `EVT`, `CAL`, `PORT`, `GST`, `MEM` | eventos (crear, estados, cancelar, cerrar, token), calendario/disponibilidad, portal de la clienta, invitados/RSVP/micrositio/ICS, cápsula de recuerdos (subidas, moderación, libro de visitas) |
| 5 | Operación y back-office | `OPS`, `STF`, `INV`, `PUR`, `FIN`, `SET`, `CNT`, `NOT` | checklists/plantillas/asignaciones, portal staff, inventario/reservas, compras/proveedores, finanzas/costos/cierre, ajustes/flags/usuarios/auditoría, contenido, notificaciones |
| 0 | Consolidación | — | responsive y accesibilidad transversales, suite completa, cross-browser P0, gate |

Reglas de convivencia entre carriles:
- Cada paquete escribe sólo en sus carpetas `tests/e2e/<área>/` y en `docs/qa/findings/<paquete>.md`. Los fixtures compartidos (`tests/e2e/fixtures/*`, `playwright.config.ts`) no se editan en paralelo: si hace falta un helper, va en `tests/e2e/<área>/_helpers.ts`; si un fixture compartido tiene un defecto, se reporta al orquestador.
- Ejecuta sólo tu carpeta: `E2E_LANE=<n> pnpm exec playwright test tests/e2e/<área> --project=chromium` (y `--project=mobile-chrome` para `@mobile`).
- La base del carril se re-siembra al inicio de cada corrida de Playwright: las pruebas no dependen del orden y crean sus propios datos.

## Comandos

```bash
node .claude/skills/e2e-quality-gate/scripts/preflight.mjs --cross-browser
node .claude/skills/e2e-quality-gate/scripts/discover.mjs
pnpm e2e:infra                                     # autoverificación (carril 0)
E2E_LANE=2 pnpm exec playwright test tests/e2e/configurator --project=chromium
E2E_LANE=2 pnpm exec playwright test tests/e2e/configurator -g "CONF-004" --repeat-each=3 --retries=0   # reproducir / detectar flaky
E2E_SKIP_SEED=1 ...                                # depurar sin re-sembrar
E2E_WORKERS=4 E2E_CROSS_BROWSER=1 pnpm exec playwright test   # suite completa (carril 0)
node .claude/skills/e2e-quality-gate/scripts/quality-gate.mjs --mode full [--results a.json,b.json]
pnpm exec playwright show-trace test-results/<...>/trace.zip
```

Notas operativas (aprendidas en la primera corrida FULL):
- En Windows usa Git Bash. `pnpm.cmd exec playwright … -g "A|B"` se rompe porque cmd.exe interpreta el `|`: usa `node node_modules/@playwright/test/cli.js test … -g "A|B"`.
- No pases `--reporter` en la línea de comandos para corridas que alimentan el gate: reemplaza los reporters del config y no se escribe `results.json`.
- Cada invocación sobrescribe `test-results/<carril>/artifacts`: copia la evidencia de un bug (trace/screenshot) a `test-results/<carril>-evidence/<BUG>/` antes de volver a correr.
- El scratchpad es compartido entre agentes: usa una subcarpeta por carril (`scratchpad/l<n>/`) y carpetas nuevas por extracción; nunca `rm -rf` con rutas relativas o globs (dispara confirmaciones al usuario).
- La caché de datos de Next en E2E es sólo en memoria (`NEXT_ISR_FLUSH_TO_DISK=false` en el servidor E2E) y `fetch-cache` se limpia al arrancar: los carriles no se contaminan entre sí.
- Firefox: si no arranca desde `%LOCALAPPDATA%` (error "configuración en paralelo"/`spawn UNKNOWN`), copia `ms-playwright/firefox-<ver>/firefox` a otra unidad y define `E2E_FIREFOX_EXECUTABLE` en `.env`. Un navegador que no arranca cuenta como BLOCKED (entorno), no como FAIL.
- **Límite de paralelismo en esta máquina (Windows + Docker Desktop/WSL):** 6 carriles × 3 workers con cross-browser saturan la red de Docker/WSL. Síntomas: `Can't reach database server at localhost:5432` intermitente, timeouts generalizados y corridas 5–10× más lentas. Es un ENVIRONMENT ISSUE: no se reporta como bug. Para la corrida que alimenta el gate, usa como máximo 3 carriles a la vez, o corre los carriles uno tras otro con `E2E_WORKERS=4`. Si aparece el síntoma, repite el carril afectado solo antes de clasificar ninguna falla.
- **Firefox se congela con varias páginas abiertas (ENV-04, Windows 11 + Playwright 1.63 / Firefox 1543).** Con dos o más páginas de Firefox a la vez, en uno o en varios navegadores, todas dejan de pintar frames, de atender a Playwright y de usar la red durante 6–270 s. Se reproduce sin la app; con una sola página no aparece.
  - El proyecto `firefox` corre con **1 worker** (`E2E_FIREFOX_WORKERS`, entero ≥ 1, default 1). No lo subas para ganar tiempo.
  - El tope es por invocación: **no corras carriles con `E2E_CROSS_BROWSER=1` en paralelo**, porque dos Firefox separados se congelan juntos. Las corridas cross-browser van una tras otra.
  - Aun con 1 worker siguen expuestas las pruebas que abren una segunda página en el mismo Firefox (otro rol, o `anonPage` además de `rolePage`): con 1 worker fallaron 3 de 48, las 3 por eso.
  - Clasificar un FLAKY o FAIL **sólo de Firefox**: abre la traza. Es ENVIRONMENT (ENV-04), no bug ni FLAKY de la app, sólo si durante la llamada que vence **ninguna** página produjo frames (la película de la traza se detiene y la red queda quieta) y luego todo sigue normal. `ready()` lo reporta como «la página no respondió». Repite la prueba sola con `--retries=0 --repeat-each=5`: si falla sin congelamiento, o igual en Chromium o WebKit, se investiga como cualquier otra falla.
- **Cada commit reconstruye el build E2E** (el sello incluye `git HEAD`), aunque sólo cambien pruebas. Haz el primer build antes de lanzar carriles, o deja que el candado de build haga esperar al resto.
- Next 15.5 agrega un anunciador de rutas con `role="alert"`: acota `getByRole("alert")` a `page.getByRole("main")` o usa el texto.

## Checkpoints

Mensajes breves, uno por hito; el detalle va a `docs/qa/` y a los artefactos:
```
[QA] Discovery complete — 83 páginas, 169 acciones, 13 APIs, drift: ninguno
[QA] Smoke: 9/10 PASS
[QA] BUG-004 HIGH discovered — staff puede ver checklist de evento no asignado
[QA] Authorization: 120/121 PASS
[QA] Final gate: 🟠 NOT RECOMMENDED
```

## Cuando algo bloquea

- Un BLOCKER en un área (p. ej. el upload a S3 cae) se documenta, las pruebas dependientes se marcan BLOCKED con `test.skip(true, …)` + anotación `blocked`, y se sigue con las áreas independientes.
- Entorno caído a mitad de corrida (Docker, Postgres): ENVIRONMENT ISSUE; recupera sin destruir datos y repite lo afectado. Nunca `prisma migrate reset` ni borrar volúmenes sin permiso explícito del usuario.
- Requisito ambiguo: decide la interpretación más razonable según código + docs, prueba eso, y registra REQUIREMENT AMBIGUITY en el informe. Sólo pregunta si es fundamental.
