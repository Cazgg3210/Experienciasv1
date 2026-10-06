# QA End-to-End — Ivonne & Rosa

Documentos generados por la skill **`e2e-quality-gate`** (`.claude/skills/e2e-quality-gate/`), ejecutada por el agente **`qa-e2e-engineer`** (`.claude/agents/qa-e2e-engineer.md`).

| Documento | Contenido |
|---|---|
| `APPLICATION_TEST_MAP.md` | Mapa funcional: página/flujo × rol × acción × resultado esperado × prioridad |
| `ROLE_PERMISSION_MATRIX.md` | Permisos esperados vs. observados (UI y backend), incluidos accesos por token |
| `TEST_COVERAGE_MATRIX.md` | Escenario ↔ prueba automatizada ↔ resultado |
| `BUG_REPORT.md` | Defectos reproducidos con evidencia, severidad y corrección sugerida |
| `E2E_TEST_REPORT.md` | Informe ejecutivo y técnico + Final Quality Gate |
| `runs/<fecha>-<modo>/gate.{json,md}` | Veredicto calculado por `quality-gate.mjs` en cada corrida |
| `findings/<paquete>.md` | Hallazgos crudos por carril antes de consolidar |
| `.discovery/inventory.json` | Inventario de rutas, APIs, acciones y permisos (drift entre corridas) |

## Cómo se ejecuta

En Claude Code: `/e2e-quality-gate [full|smoke|critical|auth|permissions|regression|module <nombre>]` (sin argumento = `full`).

A mano:
```bash
pnpm qa:preflight          # entorno seguro (sólo base local *_e2e, nunca producción)
pnpm qa:discover           # inventario + drift
pnpm e2e:infra             # autoverificación de la infraestructura
pnpm e2e:smoke             # / e2e:critical / e2e:auth / e2e:permissions / e2e:regression
pnpm qa:gate -- --mode smoke
pnpm e2e:report            # abre el reporte HTML de Playwright
```
Suites especiales: `E2E_SUITE=global` (pruebas que cambian ajustes globales, 1 worker) y `E2E_SUITE=ratelimit` (servidor con rate limit, carril 9). Carriles paralelos: `E2E_LANE=1..9`.
