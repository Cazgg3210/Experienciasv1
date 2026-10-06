# Triage, bugs, matrices, informe y Quality Gate

Contenido: [Estados](#estados-de-resultado) · [Clasificación](#clasificación-de-fallos) · [Severidad](#severidad) · [Reproducción](#reproducción-y-evidencia) · [BUG_REPORT](#bug_reportmd) · [Mapa](#application_test_mapmd) · [Matriz de roles](#role_permission_matrixmd) · [Cobertura](#test_coverage_matrixmd) · [Informe](#e2e_test_reportmd) · [Gate](#quality-gate)

## Estados de resultado

Sólo se reportan: **TESTED — PASS**, **TESTED — FAIL**, **BLOCKED**, **NOT TESTED**, **NOT APPLICABLE**. Además el gate distingue **FLAKY** (falló y pasó al reintentar ⇒ *POTENTIAL FLAKY TEST*, nunca PASS). No existe "parcialmente probado" ni "debería funcionar".

## Clasificación de fallos

Antes de llamar "bug" a un FAIL, clasifícalo:

| Tipo | Cuándo | Qué hacer |
|---|---|---|
| APPLICATION BUG | La app no cumple el comportamiento esperado (código/requisito) | BUG en `BUG_REPORT.md` |
| TEST BUG | El locator, el dato o la espera de la prueba están mal | Corrige la prueba; no cuenta como bug |
| ENVIRONMENT ISSUE | Docker/Postgres/S3/puerto/build | Recupera el entorno; pruebas afectadas BLOCKED |
| DATA ISSUE | Seed o datos de prueba incoherentes | Corrige factory/helper; si es el seed de la app, BUG LOW/MEDIUM |
| REQUIREMENT AMBIGUITY | Código y docs no definen el comportamiento | Documenta la interpretación en el informe; pregunta sólo si es fundamental |
| INTEGRATION ISSUE | Proveedor (mock) o contrato entre módulos | BUG con módulo origen y destino |
| POTENTIAL SECURITY ISSUE | Fuga de datos, autorización, CSRF, open redirect, IDOR, enumeración | BUG con severidad ≥ HIGH (CRITICAL si expone datos de terceros o permite escalar privilegios) |
| UX ISSUE | Funciona pero confunde, no es accesible o rompe en móvil | BUG MEDIUM/LOW |
| PERFORMANCE OBSERVATION | Lentitud notable (> 5 s de carga, consultas repetidas) | Observación en el informe (BUG si bloquea el uso) |

## Severidad

- **BLOCKER** — impide continuar pruebas o usar el sistema (login roto, build no arranca, base inaccesible por la app).
- **CRITICAL** — seguridad, corrupción/pérdida de datos o un recorrido crítico P0 roto.
- **HIGH** — funcionalidad principal defectuosa (con o sin alternativa incómoda).
- **MEDIUM** — función secundaria incorrecta.
- **LOW** — menor o cosmético.

Prioridad del bug (P0–P3) = urgencia de corrección; normalmente sigue a la prioridad del escenario afectado.

## Reproducción y evidencia

1. Reproduce **dos veces** (`--repeat-each=2 --retries=0` o manual guiado con Playwright). Si sólo falla a veces, es FLAKY: investiga antes de declarar bug.
2. Evidencia obligatoria en cada FAIL: screenshot y/o trace (`test-results/.../trace.zip`), video si aplica, `console-network.json` (guard), estado de la base (consulta y resultado), request/response relevante.
3. Análisis técnico: ubica el código responsable (archivo:línea) y la causa probable. Propón la corrección, **no la apliques** durante la auditoría.

## BUG_REPORT.md

Encabezado del documento: fecha, commit, modo, resumen por severidad. Luego un bloque por bug, numeración continua (`BUG-001`…), del más severo al menos severo:

```markdown
## BUG-001 — Staff puede marcar tareas de un evento no asignado

**Severity:** CRITICAL
**Priority:** P0
**Status:** Open
**Type:** POTENTIAL SECURITY ISSUE
**Module:** operations / staff
**Role:** STAFF (staff@ivonne-rosa.test)
**Environment:** TEST — build de producción local :3201, base ivonne_rosa_e2e_l1, commit b8b942e
**Reproducible:** Sí (2/2)
**Test:** [PERM-045] tests/e2e/permissions/staff-idor.spec.ts

### Preconditions
### Steps to reproduce
1. …
### Expected result
### Actual result
### Evidence
- trace: test-results/l1/artifacts/…/trace.zip · screenshot: … · consulta: `select … ` → …
### Console errors
### Network errors
### Technical analysis
### Suspected root cause
`src/features/staff/server/actions.ts:120` no verifica …
### Recommended fix
```

`Status` permitidos: `Open`, `Fixed` (corregido, falta verificar), `Verified` (prueba de reproducción + regresión en PASS), `Won't fix`, `Duplicate`, `Not a bug`. El gate cuenta como abiertos todos salvo Fixed/Verified/Closed/Won't fix/Duplicate/Not a bug — **Fixed sin verificar sí cuenta como cerrado sólo después de re-ejecutar la prueba**; si no se re-ejecutó, déjalo Open.

Hallazgos por carril (`docs/qa/findings/<paquete>.md`) usan el mismo formato con IDs provisionales `<PAQUETE>-BUG-01`; el consolidado los re-numera y deduplica.

## APPLICATION_TEST_MAP.md

```markdown
# Application Test Map
Fuente: inventario <fecha> (commit …). Prioridades: P0 crítico · P1 principal · P2 secundario · P3 menor.

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad |
|---|---|---|---|---|---|---|
| MAP-001 | Configurador | /crear-experiencia | Anónimo | Enviar configuración completa | Lead NEW + clienta + notificación; confirmación visible | P0 |
```
Cubre cada página del inventario y cada acción relevante (las 169 Server Actions se agrupan por flujo; las de lectura trivial se pueden agrupar).

## ROLE_PERMISSION_MATRIX.md

Dos tablas: **páginas** (ruta × Anónimo/Staff/Owner/SuperAdmin) y **acciones/APIs** (acción × rol). Cada celda: `esperado / observado` con símbolos `✅ permitido`, `↪ login`, `↪ /staff`, `⛔ sin-acceso`, `404`, `🔒 denegado (backend)`, y el ID de la prueba. Divergencias en negrita con su BUG. Incluye la sección de tokens (cotización, portal, invitación, cápsula: válido / inválido / de otro evento / rotado).

## TEST_COVERAGE_MATRIX.md

```markdown
| ID | Módulo | Escenario | Rol | Priority | Automated | Result |
|---|---|---|---|---|---|---|
| LEAD-003 | Leads | Crear lead manual persiste tras recargar | Owner | P1 | ✅ tests/e2e/leads/leads.spec.ts | PASS |
```
`Automated`: ✅ ruta del spec · ❌ manual (explica por qué) · —. `Result`: PASS / FAIL (BUG-xxx) / FLAKY / BLOCKED / NOT TESTED / NOT APPLICABLE. Totales por módulo y prioridad al final (deben coincidir con `gate.json`).

## E2E_TEST_REPORT.md

Usa exactamente estos encabezados:

```markdown
# E2E QUALITY REPORT
## Executive Summary
## Test Environment
## Build / Commit Tested
## Test Date
## Architecture Detected
## Modules Tested
## Roles Tested
## Critical User Journeys
## Test Results
(Total / Pass / Fail / Blocked / Not Tested — de gate.json)
## P0 Results
## P1 Results
## Authentication Results
## Authorization Results
## Functional Results
## Responsive Results
## Cross-browser Results
## API Results
## Console / Network Issues
## Bugs
(Blocker / Critical / High / Medium / Low — con enlace a cada BUG)
## Areas Not Tested
## Known Risks
## Recommendations
## Final Quality Gate
```
El Executive Summary va primero en lenguaje de negocio (qué funciona, qué no, qué riesgo hay) en ≤ 10 líneas. **Final Quality Gate** pega el bloque de `runs/<…>/gate.md` sin editar números, y debajo la justificación en 3–6 líneas. Incluye también UX, accesibilidad, observaciones técnicas y de rendimiento dentro de las secciones correspondientes.

## Quality Gate

Lo calcula `scripts/quality-gate.mjs` (no a mano) con: Critical Flow Pass Rate, Overall Pass Rate, P0 y P1 Pass Rate, fallidas, bloqueadas, sin probar, inestables y bugs abiertos por severidad.

| Veredicto | Condición |
|---|---|
| 🔴 BLOCKED | Blocker abierto · infraestructura/sesiones fallan · sin pruebas evaluables · algún recorrido crítico FAIL/BLOCKED |
| 🟠 NOT RECOMMENDED | Critical abierto · P0 < 100 % · alguna prueba de autorización FAIL · ≥ 3 High abiertos |
| 🟡 READY WITH CONDITIONS | Recorridos críticos funcionan y no hay Blocker/Critical, pero hay High/Medium abiertos, FLAKY en P0/P1, P1 < 95 %, P0/P1 sin probar o pruebas sin prioridad |
| 🟢 READY | P0 100 %, recorridos críticos 100 %, P1 ≥ 95 %, sin Blocker/Critical/High abiertos ni FLAKY P0/P1 |

No suavices el resultado: si el script dice 🟠, el informe dice 🟠. Si crees que el script se equivoca, explica por qué en el informe, pero no cambies el veredicto a mano.
