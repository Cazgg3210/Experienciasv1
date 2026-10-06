---
name: e2e-quality-gate
description: Estándar permanente de QA End-to-End de Ivonne & Rosa. Descubre la aplicación, diseña y ejecuta pruebas Playwright reales (UI → backend → autenticación → autorización → reglas de negocio → persistencia en PostgreSQL), documenta bugs con evidencia y emite un veredicto de Quality Gate (🟢 READY / 🟡 READY WITH CONDITIONS / 🟠 NOT RECOMMENDED / 🔴 BLOCKED). Úsala SIEMPRE que el usuario pida probar, testear, hacer QA, smoke test, pruebas E2E, regresión, revisar permisos o roles, validar un módulo, "ver si todo funciona", "¿está listo para producción / para deploy?", auditar calidad antes de un release o después de cambios grandes, aunque no mencione "quality gate". Modos - smoke, critical, auth, permissions, regression, module <nombre>, full.
argument-hint: "[full|smoke|critical|auth|permissions|regression|module <nombre>]"
---

# E2E Quality Gate — Ivonne & Rosa

Esta skill es el estándar de QA End-to-End del proyecto. Responde con evidencia a una sola pregunta: **¿los recorridos que importan funcionan de punta a punta, para cada rol, sin romper permisos ni datos?** La respuesta termina en un veredicto que nadie maquilla.

Una prueba sólo es PASS cuando se validó el resultado completo: lo que muestra la UI, lo que respondió el backend, que la sesión y el rol fueran los correctos, que se respetaran las reglas de negocio y que el cambio **quedó en la base** (y se ve tras recargar, buscar o abrir el detalle). Ver un toast verde no es evidencia suficiente.

## Delegación de ejecución

Para cualquier ejecución de esta skill, utiliza el subagent: `qa-e2e-engineer`.

El subagent debe encargarse de la ejecución técnica del Quality Gate, incluyendo discovery, navegación, Playwright, pruebas funcionales, autenticación, autorización, API, persistencia, responsive, regresión y generación de evidencias.

Modo solicitado: $ARGUMENTS

Si no se proporciona argumento, utiliza `full`.

Delega la ejecución al agente `qa-e2e-engineer` pasándole el modo solicitado y todo el contexto necesario del proyecto.

## Cómo orquestar (contexto principal)

Tú, en el contexto principal, eres quien coordina: preparas el terreno, delegas, consolidas y comunicas el veredicto. El trabajo técnico lo hace `qa-e2e-engineer`.

1. **Modo.** Toma el modo de los argumentos (`$ARGUMENTS`); vacío ⇒ `full`. Valores: `smoke`, `critical`, `auth`, `permissions`, `regression`, `module <nombre>`, `full`. Un modo desconocido no se adivina: pregunta.
2. **Preflight** (seguridad + entorno): `node ${CLAUDE_SKILL_DIR}/scripts/preflight.mjs` (agrega `--cross-browser` en `full` y `critical`). Si devuelve BLOQUEADO es un ENVIRONMENT ISSUE: intenta resolverlo sin destruir nada (p. ej. `docker compose up -d db storage`) y repite; si no se puede, repórtalo y detente. Nunca se apunta el gate a producción.
3. **Discovery**: `node ${CLAUDE_SKILL_DIR}/scripts/discover.mjs` → `docs/qa/.discovery/inventory.json` y avisos de *drift* (rutas, acciones o permisos nuevos desde la corrida anterior). El drift dice qué documentos y pruebas hay que actualizar.
4. **Build previo** si hubo cambios de código (`node scripts/e2e-server.mjs` lo hace solo; con varios carriles conviene que el primero termine el build antes de lanzar el resto — ver runbook §Carriles).
5. **Delegar** con la herramienta Agent, `subagent_type: "qa-e2e-engineer"`, usando la plantilla de abajo.
   - `smoke`, `critical`, `auth`, `permissions`, `module`: **una** instancia.
   - `full` y `regression` amplias: divide en paquetes de trabajo independientes (tabla en `references/runbook.md` §Paquetes) y lanza varias instancias **en paralelo**, cada una en su propio carril `E2E_LANE=1..5` (puerto, base y sesiones aisladas: no se pisan). Después, una instancia final (carril 0) corre la suite completa, consolida y calcula el gate.
6. **Consolidar**: verifica que existan y estén al día los 5 documentos de `docs/qa/`, que cada FAIL tenga evidencia y BUG asociado, y que el gate salga del script (`node ${CLAUDE_SKILL_DIR}/scripts/quality-gate.mjs --mode <modo>`), no de una estimación.
7. **Comunicar**: checkpoints breves (`[QA] Smoke: 9/10 PASS`, `[QA] BUG-004 HIGH discovered`) y al final el veredicto, los números del gate, los bugs Blocker/Critical/High y lo que quedó sin probar. Sin suavizar.

Si `qa-e2e-engineer` no aparece entre los agentes disponibles (p. ej. la sesión empezó antes de crear el archivo), usa `subagent_type: "general-purpose"` e indícale que su manual de operación es `.claude/agents/qa-e2e-engineer.md` (debe leerlo completo primero). Sin herramienta Agent, ejecuta tú mismo `references/runbook.md`.

### Plantilla de delegación

```
Modo: <modo> [<módulo>]   ·   Carril: E2E_LANE=<n>   ·   Paquete: <nombre o "completo">
Proyecto: D:\Claude\Catering (Next.js 15.5 + Prisma 6 + Auth.js v5; reglas en CLAUDE.md)
Skill: .claude/skills/e2e-quality-gate — lee SKILL.md y references/{runbook,project-profile,test-design,triage-and-reporting}.md
Inventario: docs/qa/.discovery/inventory.json (drift: <resumen o "ninguno">)
Preflight: <resultado>   ·   Commit: <sha> (+cambios sin commit: sí/no)
Alcance: <rutas/módulos/roles/etiquetas de este paquete>   ·   Prefijo de IDs: <p. ej. AUTH>   ·   Meta orientativa: <n> pruebas
Entrega: specs en tests/e2e/<área>/, hallazgos en docs/qa/findings/<paquete>.md (formato BUG del triage),
         filas para TEST_COVERAGE_MATRIX, resultados en test-results/l<n>/results.json
Restricciones: QA sin corregir código de la app; no editar fixtures compartidos (crea helpers en tu carpeta);
               nada destructivo fuera de la base *_e2e; sin waitForTimeout; FLAKY ≠ PASS.
```

## Modos

| Modo | Qué cubre | Selección | Documentos que actualiza |
|---|---|---|---|
| `smoke` | Arranque, login por rol, páginas clave sin errores, un camino feliz por módulo | `@smoke` (chromium) | E2E_TEST_REPORT (sección smoke) + gate |
| `critical` | Recorridos P0 de negocio de punta a punta + cross-browser | `@P0` en chromium, mobile, firefox, webkit | Coverage, report, gate |
| `auth` | Login/logout, sesiones, expiración, URLs protegidas tras logout, usuario inactivo, redirecciones | `@auth` | Role matrix (sección auth), report, gate |
| `permissions` | Matriz rol × página × acción × API, manipulación de URL/IDs, replay de Server Actions, IDOR por token | `@permissions` | ROLE_PERMISSION_MATRIX, report, gate |
| `module <nombre>` | Todo lo de un módulo (CRUD, negativas, reglas, persistencia, permisos del módulo) | `@module:<nombre>` | Filas del módulo en mapa/cobertura, report, gate |
| `regression` | P0 + pruebas marcadas `@regression` (bugs corregidos) + módulos tocados por el diff | `@P0\|@regression` + módulos del drift | Coverage, report, gate |
| `full` | Fases 0–9 completas (17 pasos del runbook) | todas | Los 5 documentos + gate |

Los scripts de `package.json` ya existen: `pnpm e2e:infra`, `e2e:smoke`, `e2e:critical`, `e2e:auth`, `e2e:permissions`, `e2e:regression`, `e2e:report`, `qa:discover`, `qa:preflight`, `qa:gate`.

## Infraestructura existente (reutilízala, no la reinventes)

| Pieza | Dónde | Para qué |
|---|---|---|
| Configuración Playwright | `playwright.config.ts` | Proyectos `setup`, `chromium` 1440×900, `mobile-chrome` 390×844 (`@mobile`), `firefox`/`webkit` (`E2E_CROSS_BROWSER=1`, `@P0`), carriles `E2E_LANE` |
| Servidor E2E | `scripts/e2e-server.mjs` | Build de producción en `.next-e2e`, :3200(+carril), base `*_e2e`, rate limit desactivado, candado de build |
| Base E2E | `tests/e2e/global-setup.ts` | Crea base del carril, migra y re-siembra DEMO en cada corrida (sólo bases locales "e2e") |
| Sesiones por rol | `tests/e2e/setup/auth.setup.ts` | superadmin, owner, owner2, staff, staff2 → `tests/e2e/.auth/` |
| Fixtures | `tests/e2e/fixtures/` | `test`/`expect`, `db`, `rolePage`, `anonPage`, `apiAs`, `evidence`, guard de consola/red, replay de Server Actions, factories, `scanA11y` |
| Autoverificación | `tests/e2e/_infra/harness.spec.ts` (`@infra`) | Si falla, el entorno no es confiable: todo lo demás queda BLOCKED |
| Scripts de la skill | `scripts/{preflight,discover,quality-gate}.mjs` | Seguridad del entorno, inventario + drift, cálculo del veredicto |

## Reglas que no se negocian (y por qué)

- **Nunca nada destructivo sobre PRODUCCIÓN ni sobre la base de desarrollo.** El gate corre contra una build local y una base `*_e2e` que se re-siembra; los candados de `preflight`, `global-setup` y `e2e-server` existen para que un error de configuración no borre datos reales. Entorno UNKNOWN + prueba riesgosa ⇒ detente y pregunta.
- **Primera auditoría = QA, no corrección.** No arregles en silencio lo que encuentres: el valor del gate está en reportar el estado real. Se corrige sólo cuando el usuario lo pide, y después se re-ejecuta la reproducción + la regresión relacionada.
- **No hay bug sin reproducción** (dos veces, mismo resultado) **ni FAIL sin evidencia** (screenshot/trace/video, consola, red, estado de la base).
- **Una prueba que pasa sólo al reintentar es POTENTIAL FLAKY TEST, no PASS.** El gate la cuenta aparte.
- **Integridad**: prohibido quitar asserts, subir timeouts sin causa, desactivar pruebas sin documentarlo, cambiar requisitos para que algo pase o marcar PASS a mano.
- **Nunca 🟢 READY con Blocker/Critical abiertos** en flujos principales. El veredicto lo calcula `quality-gate.mjs` con los resultados reales y `BUG_REPORT.md`.
- Pregunta sólo ante: riesgo de producción, credenciales faltantes, acciones destructivas, ambigüedad funcional fundamental, servicios externos de pago, entorno indeterminable. Todo lo demás, decide y documenta.

## Entregables

`docs/qa/` (español, Markdown):

- `APPLICATION_TEST_MAP.md` — qué existe y qué se debe probar (ID, módulo, página/flujo, rol, acción, resultado esperado, P0–P3)
- `ROLE_PERMISSION_MATRIX.md` — rol × recurso × acción, esperado vs. observado en UI **y** backend
- `TEST_COVERAGE_MATRIX.md` — escenario ↔ prueba automatizada ↔ resultado
- `BUG_REPORT.md` — un bloque `## BUG-XXX — Título` por defecto (plantilla en triage)
- `E2E_TEST_REPORT.md` — informe ejecutivo + técnico con el **Final Quality Gate**
- `runs/<fecha>-<modo>/gate.{json,md}` — salida del script del gate (histórico)
- `findings/<paquete>.md` — hallazgos crudos de cada carril antes de consolidar

Artefactos de Playwright: `test-results/` (trazas, videos, screenshots, `results.json`) y `playwright-report/`.

## Referencias (léelas según el paso)

- `references/runbook.md` — las fases 0–9 y los 17 pasos de FULL, paquetes de trabajo y carriles paralelos, qué hacer en cada modo. **Léelo siempre.**
- `references/project-profile.md` — roles y permisos, módulos y rutas, datos del seed (cuentas, tokens, eventos), proveedores mock, comportamientos conocidos de Next 15.5 que afectan a las pruebas.
- `references/test-design.md` — convenciones (IDs, etiquetas, locators, datos), patrones de autorización/replay/IDOR, persistencia, negativas, API, responsive, accesibilidad, con ejemplos.
- `references/triage-and-reporting.md` — clasificación de fallos, severidad, plantillas de BUG / matrices / informe, reglas del gate.
