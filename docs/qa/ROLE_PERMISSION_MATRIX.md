# ROLE_PERMISSION_MATRIX — Ivonne & Rosa

**Auditoría:** FULL E2E · 2026-10-06 · corridas por carril sobre el commit `f26b1a1` (resultado consolidado en `8020b91`) · build de producción local, una base `*_e2e` por carril, proveedores mock.
**Esperado:** `src/server/auth/permissions.ts` (RBAC), `src/middleware.ts` (barrera por zona), `src/server/auth/session.ts` (`requirePagePermission` / `requirePermission`) e inventario `docs/qa/.discovery/inventory.json` (2026-10-06T06:45Z: 83 páginas, 13 route handlers, 169 Server Actions = 148 protegidas + 21 públicas, además de `loginAction`).
**Observado:** `docs/qa/findings/access-role-matrix.md` (carril 1: `tests/e2e/permissions/*`, `tests/e2e/auth/*`, `tests/e2e/api/*`) y las pruebas de autorización de los carriles 2 a 6 (`docs/qa/findings/*-coverage.md`).
**Navegador:** la matriz se midió en Chromium (carril 1). Los recorridos críticos de acceso se repitieron en WebKit y en móvil a 390 px (carril 6). Firefox quedó BLOCKED porque no arranca en esta máquina (ENV-02).
**IDs de bug:** consolidados según `docs/qa/.bug-map.json`; el ID provisional del carril va entre paréntesis.

**Leyenda.** Cada celda indica **esperado / observado**.

- ✅ permitido (200).
- ↪ login: 307 a `/login?callbackUrl=<ruta>`.
- ↪ /staff: 307 al portal staff.
- ↪ /admin: 307 al inicio del rol.
- ⛔: redirección a `/sin-acceso`.
- 404: no encontrado genérico.
- 🔒: denegado por el backend (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, 401/403 o redirect del middleware) **y la base no cambió**.
- —: no aplica, o no hubo replay individual para ese rol (ver la nota de §3.1).

Las divergencias van en **negrita** con su BUG.

## Resumen

- **Páginas:** 83 rutas × 4 roles = **332 celdas**. En las 332 lo observado coincide con lo esperado (**0 divergencias**). PERM-001…083 y PERM-090 están en PASS.
- **Backend:** el replay de acciones sensibles por rol, las acciones de administración expuestas en páginas públicas o del portal y los 13 route handlers coinciden con el RBAC. Pruebas: PERM-110…159, PERM-120…138 y API-001…081, todas en PASS.
- **Tokens:** las familias cotización, portal, invitación general, invitación personal, cápsula y pago se probaron como válido, inválido, de otro evento, de otro tipo y rotado, y pasaron (PERM-160…188 y carriles 2 y 4). La excepción es el link general de invitación (**BUG-003**).
- **Divergencias:** 4, todas de seguridad: **BUG-001** (CRITICAL), **BUG-003** (CRITICAL), **BUG-004** (HIGH) y **BUG-005** (HIGH). Hay 5 escenarios en FAIL: AUTH-032, CRIT-014, GST-014, AUTH-025 y AUTH-049.
- **Controles que pasaron:** escalada OWNER→SUPER_ADMIN, IDOR de staff, tokens, CSRF y webhooks (§5.2).
- **Impacto en el gate:** hay bugs CRITICAL abiertos y pruebas de autorización en FAIL, que es la condición 🟠 de la plantilla. El veredicto oficial lo calcula `scripts/quality-gate.mjs`.

---

## 1. Roles y permisos

### 1.1 Roles

| Rol | Permisos RBAC | Autenticación | Zona / inicio | Alcance y reglas |
|---|---|---|---|---|
| **SUPER_ADMIN** | 48 de 48 (todos) | Login del equipo (Credentials + JWT de 12 h) | `/admin` | Es el único rol con `roles:assign_super_admin`: crea, promueve y modifica cuentas SUPER_ADMIN. No se puede desactivar ni degradar al último SUPER_ADMIN activo (`src/features/users/domain/user-rules.ts`, con lock consultivo en `user-service.ts`). |
| **OWNER** | 47 de 48: todos excepto `roles:assign_super_admin` | Login del equipo | `/admin` | Panel completo. Administra cuentas OWNER y STAFF (`users:manage`). Con cuentas SUPER_ADMIN la UI oculta las acciones y el backend responde FORBIDDEN. Cambiar precios del catálogo exige `pricing:write` y aplicar descuentos `quotes:discount` (ambos verificados en el servicio). |
| **STAFF** | 4: `events:read_assigned`, `checklists:update_assigned`, `media:upload`, `inventory:read` | Login del equipo | `/staff` (el middleware manda `/admin*` → `/staff`) | Ve sólo sus eventos asignados que no estén cancelados, sin montos. Marca únicamente sus propias tareas y no puede omitirlas. Sube evidencias sólo de eventos asignados. |
| **CUSTOMER** | 0 | No puede iniciar sesión: `authorize` la rechaza (AUTH-011 PASS) y `getCurrentUser` la trata como sin sesión | — (con sesión, el middleware la mandaría a ⛔) | Sus accesos son por token (cotización y portal). En las matrices equivale a **Anónimo**. |
| **Anónimo por token** | Sin rol RBAC. Autoriza la posesión de un token de 256 bits (`generateToken`). Se valida con `isPlausibleToken` antes de consultar y responde 404 genérico si no es válido. | Ninguna | `/cotizacion`, `/mi-evento`, `/e`, `/memory`, `/pago` (con `noindex` y `Referrer-Policy: same-origin`) | Tokens: `Quote.publicToken` (cotización), `Event.portalToken` (portal de la anfitriona), `Event.inviteToken` (invitación general), `EventGuest.token` (invitación personal), `MemoryCapsule.shareToken` (cápsula), id del checkout mock y firma HMAC de `/pago/resultado`. Cada token sólo alcanza su evento y su tipo. |

### 1.2 Permisos por rol (`src/server/auth/permissions.ts`)

| Permisos | SUPER_ADMIN | OWNER | STAFF | CUSTOMER |
|---|---|---|---|---|
| 43 de backoffice: `dashboard:view`, `leads:read/write`, `customers:read/write`, `catalog:read/write`, `pricing:write`, `quotes:read/write/discount/send`, `bookings:read`, `payments:read/manual`, `events:read_all/write/cancel/close`, `guests:read/write`, `availability:write`, `operations:read`, `checklists:write`, `inventory:write`, `vendors:read/write`, `purchases:read/write`, `staff:read/write`, `financials:read`, `costs:write`, `media:moderate`, `memory:write`, `content:write`, `analytics:read`, `notifications:read`, `settings:read/write`, `users:manage`, `audit:read`, `ai:use` | ✅ | ✅ | — | — |
| 4 compartidos con STAFF: `events:read_assigned`, `checklists:update_assigned`, `media:upload`, `inventory:read` | ✅ | ✅ | ✅ | — |
| `roles:assign_super_admin` | ✅ | — | — | — |

### 1.3 Dónde se hace cumplir

1. **Middleware edge** (`src/middleware.ts`):
   - `/admin*` sólo admite SUPER_ADMIN y OWNER; `/staff*` admite además STAFF.
   - Sin sesión → ↪ login con `callbackUrl`. STAFF en `/admin` → ↪ /staff. Cualquier otro rol → ⛔.
   - En las rutas por token agrega `X-Robots-Tag: noindex, nofollow` y `Referrer-Policy: same-origin`.
   - El matcher excluye `/api`: los route handlers se autorizan por su cuenta.
2. **Página:** `requirePagePermission(perm)`. Sin sesión → login; sin permiso → ⛔. En cada request `getCurrentUser` revalida `active` y `role` contra la base.
3. **Server Action:**
   - `protectedAction({ permission })` responde `UNAUTHORIZED` o `FORBIDDEN`.
   - `publicAction({ rateLimit })` aplica el límite de frecuencia.
   - Next rechaza las Server Actions con un `Origin` ajeno.
4. **Servicio:**
   - `pricing:write` y `quotes:discount` se verifican en `quote-service.ts:484-498` y `catalog-common.ts:39`.
   - `checklists:update_assigned` se verifica junto con la asignación en `checklist-service.ts:193`.
   - Las reglas de SUPER_ADMIN viven en `user-rules.ts:31-42`.
   - El alcance de cada token se limita a su evento.
5. **Route handlers:** `requirePermission`, `isSameOrigin`, firma HMAC del webhook o secreto de cron, según el caso.

---

## 2. Matriz de páginas (83)

Cada celda es el código HTTP, sin seguir redirects, con la sesión del rol (`tests/e2e/permissions/page-matrix.spec.ts`, Chromium, carril 1). Las rutas con token se probaron con tokens válidos del seed (Lucía, Sofía y Valeria); los tokens inválidos están en §4. Además, cada fila valida la UI con el rol principal de su zona (admin → Owner, staff → Staff, resto → Anónimo): sin redirección, con encabezado visible, sin pantalla de error y sin errores de consola ni de red.

**Prueba** es el ID de la fila. **Complementarias** son otras pruebas de autorización sobre la misma ruta, tomadas de todos los carriles.

| Prueba | Ruta | Zona | Permiso (inventario) | Anónimo ¹ | Staff | Owner | SuperAdmin | Resultado | Complementarias |
|---|---|---|---|---|---|---|---|---|---|
| PERM-001 | `/` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-002 | `/admin` | admin | dashboard:view | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | NAV-020, NAV-021, CRIT-009, CRIT-011, CRIT-012 |
| PERM-003 | `/admin/analytics` | admin | analytics:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-004 | `/admin/calendar` | admin | events:read_all | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-005 | `/admin/catalog` | admin | catalog:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-006 | `/admin/catalog/addons` | admin | catalog:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-007 | `/admin/catalog/addons/[id]` | admin | catalog:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-008 | `/admin/catalog/addons/new` | admin | catalog:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-009 | `/admin/catalog/areas` | admin | catalog:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-010 | `/admin/catalog/budgets` | admin | catalog:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-011 | `/admin/catalog/experiences/[id]` | admin | catalog:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-012 | `/admin/catalog/experiences/new` | admin | catalog:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-013 | `/admin/catalog/menus` | admin | catalog:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-014 | `/admin/catalog/menus/[id]` | admin | catalog:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-015 | `/admin/catalog/menus/new` | admin | catalog:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-016 | `/admin/catalog/styles` | admin | catalog:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-017 | `/admin/content` | admin | content:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-018 | `/admin/content/faq` | admin | content:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-019 | `/admin/content/gallery` | admin | content:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-020 | `/admin/customers` | admin | customers:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-021 | `/admin/customers/[id]` | admin | customers:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-022 | `/admin/events` | admin | events:read_all | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-023 | `/admin/events/[id]` | admin | events:read_all | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | PERM-150, PERM-153, PERM-155, PERM-159, EVT-031 |
| PERM-024 | `/admin/events/[id]/financials` | admin | financials:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | PERM-154, FIN-006 |
| PERM-025 | `/admin/events/[id]/guests` | admin | guests:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | GST-010, API-071 |
| PERM-026 | `/admin/events/[id]/memory` | admin | memory:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | MEM-011, MEM-012 |
| PERM-027 | `/admin/events/[id]/operations` | admin | operations:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-028 | `/admin/events/new` | admin | events:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-029 | `/admin/finance` | admin | financials:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | API-072, FIN-011 |
| PERM-030 | `/admin/inventory` | admin | inventory:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff ² | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-031 | `/admin/inventory/[id]` | admin | inventory:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff ² | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-032 | `/admin/inventory/conflicts` | admin | inventory:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff ² | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-033 | `/admin/inventory/events` | admin | inventory:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff ² | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-034 | `/admin/inventory/events/[eventId]` | admin | inventory:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff ² | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-035 | `/admin/leads` | admin | leads:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | API-070 |
| PERM-036 | `/admin/leads/[id]` | admin | leads:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-037 | `/admin/notifications` | admin | notifications:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | AUTH-027 |
| PERM-038 | `/admin/operations` | admin | operations:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-039 | `/admin/operations/templates` | admin | operations:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-040 | `/admin/operations/templates/[id]` | admin | operations:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-041 | `/admin/purchases` | admin | purchases:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-042 | `/admin/purchases/[id]` | admin | purchases:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-043 | `/admin/purchases/new` | admin | purchases:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-044 | `/admin/quotes` | admin | quotes:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-045 | `/admin/quotes/[id]` | admin | quotes:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | PERM-152, QUO-014 |
| PERM-046 | `/admin/quotes/[id]/print` | admin | quotes:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-047 | `/admin/quotes/new` | admin | quotes:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-048 | `/admin/settings` | admin | settings:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | PERM-157 |
| PERM-049 | `/admin/settings/audit` | admin | audit:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-050 | `/admin/settings/availability` | admin | settings:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-051 | `/admin/settings/flags` | admin | settings:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | PERM-157 |
| PERM-052 | `/admin/settings/integrations` | admin | settings:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-053 | `/admin/settings/notifications` | admin | settings:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-054 | `/admin/settings/pricing` | admin | settings:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | PERM-157 |
| PERM-055 | `/admin/settings/users` | admin | users:manage | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | PERM-140…143, PERM-156, AUTH-028, SET-013…018 |
| PERM-056 | `/admin/staff` | admin | staff:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-057 | `/admin/staff/[id]` | admin | staff:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | STF-018…021 |
| PERM-058 | `/admin/staff/new` | admin | staff:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-059 | `/admin/vendors` | admin | vendors:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-060 | `/admin/vendors/[id]` | admin | vendors:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-061 | `/admin/vendors/[id]/edit` | admin | vendors:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-062 | `/admin/vendors/new` | admin | vendors:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-063 | `/como-funciona` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-064 | `/contacto` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-065 | `/cotizacion/[token]` | experience | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | PERM-160, PERM-161, PERM-164, PERM-187, QPUB-010 |
| PERM-066 | `/crear-experiencia` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-067 | `/crear-experiencia/ai` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-068 | `/e/[slug]/[token]` | experience | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | PERM-162, PERM-163, PERM-165, PERM-167, PERM-181, PERM-182, GST-017; **GST-014 FAIL (BUG-003)** |
| PERM-069 | `/experiencias` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-070 | `/experiencias/[slug]` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | NAV-002 (soft-404, BUG-013: no es de permisos) |
| PERM-071 | `/login` | auth | — | ✅ / ✅ | ↪ /staff / ↪ /staff | ↪ /admin / ↪ /admin | ↪ /admin / ↪ /admin | PASS | AUTH-001…017, AUTH-040…051; **AUTH-049 FAIL (BUG-005)** |
| PERM-072 | `/memory/[token]` | experience | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | PERM-130…138, PERM-166, PERM-186, PERM-188 |
| PERM-073 | `/mi-evento` | experience | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | PORT-005, PORT-006 |
| PERM-074 | `/mi-evento/[token]` | experience | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | PERM-165, PERM-180, PERM-183…185, PORT-003, PORT-015 |
| PERM-075 | `/mi-evento/[token]/resumen` | experience | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-076 | `/nuestra-historia` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-077 | `/pago/mock/[checkoutId]` | experience | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | PERM-169, PAY-004 |
| PERM-078 | `/pago/resultado` | experience | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | PERM-168, PAY-008 |
| PERM-079 | `/privacidad` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-080 | `/sin-acceso` | root | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | AUTH-031 |
| PERM-081 | `/staff` | staff | events:read_assigned | ↪ login / ↪ login | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | PERM-100, PERM-102, PERM-103, STF-001, STF-002, CRIT-005, CRIT-012, AUTH-030 |
| PERM-082 | `/staff/events/[id]` | staff | events:read_assigned | ↪ login / ↪ login | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | PERM-101, PERM-104, PERM-105, PERM-110…127, STF-006, STF-008, STF-023 |
| PERM-083 | `/terminos` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | — |

**Totales:**

- 83 filas y 332 celdas: en las 332 lo esperado coincide con lo observado (**0 divergencias**).
- 83 de 83 filas en PASS.
- Por zona: admin 61 · public 10 · experience 8 · staff 2 · auth 1 · root 1.
- PERM-090 (PASS) comprueba que las 83 páginas del inventario tienen fila. Los permisos de la columna coinciden con los del inventario en las 83 rutas.

**Notas:**

1. **Anónimo tras cerrar sesión.** La matriz se midió con contextos limpios. Para alguien que **acaba de cerrar sesión**, la columna Anónimo no se cumple de forma fiable: una respuesta en vuelo puede revivir la sesión (**BUG-001**) y una cookie copiada antes del logout sigue autorizando (**BUG-004**). Ver §5.
2. **STAFF y `inventory:read`.** STAFF tiene `inventory:read`, que es el permiso que exigen las 5 páginas `/admin/inventory*`, pero el middleware le cierra todo `/admin`. Lo esperado según CLAUDE.md (el panel es sólo para SUPER_ADMIN y OWNER) es ↪ /staff, y eso fue lo observado. El permiso queda latente; ver §6.

- **`/login` con sesión** lleva al inicio del rol e ignora el `callbackUrl` (detalle menor de UX).
- **CUSTOMER** no aplica en esta matriz: no puede iniciar sesión (AUTH-011).
- **Visibilidad por rol dentro de las páginas** (todas en PASS):
  - STAFF ve sólo sus eventos asignados, sin montos (PERM-100…105, STF-001, STF-002, STF-008, STF-009, STF-023, CRIT-005).
  - SuperAdmin ve las 17 secciones y STAFF no ve el panel (NAV-021).
  - Ninguna página del panel queda en caché (`Cache-Control: no-store`, AUTH-022).

---

## 3. Acciones y APIs sensibles × rol (backend)

### 3.1 Server Actions protegidas, por permiso

**Método:** la prueba captura el `Next-Action` real desde la UI y lo reenvía (replay) con la cookie de cada rol o sin cookie. Para marcar 🔒 se exige la respuesta de denegación **y** que la base no haya cambiado. Las barreras se aplican en este orden: middleware → `protectedAction` (sesión revalidada contra la base + permiso) → reglas del servicio (IDOR y asignación).

**Nota del guion (—):**

- En las columnas Anónimo y Staff, «🔒 / —» indica que el grupo no tuvo replay negativo propio. Su barrera es la común (middleware + `protectedAction`), que sí está verificada en PERM-150…159 y PERM-120…138.
- En la columna Owner, el ✅ observado proviene de los carriles funcionales.

| Permiso | Acciones (n) | Acciones con replay negativo | Anónimo | Staff | Owner | SuperAdmin | Pruebas | Resultado |
|---|---|---|---|---|---|---|---|---|
| `roles:assign_super_admin` (regla de servicio, no de wrapper) | 4 acciones de `users:manage` cuando el destino es SUPER_ADMIN | `createUserAction` con role=SUPER_ADMIN; `changeUserRoleAction` → SUPER_ADMIN; rol, estado y contraseña de una cuenta SUPER_ADMIN | 🔒 / 🔒 ↪ login | 🔒 / 🔒 ↪ /staff | 🔒 / 🔒 FORBIDDEN (la UI oculta las acciones) | ✅ / ✅ | PERM-140, PERM-141, PERM-142, PERM-156 | PASS |
| `users:manage` | 7 | `changeUserRoleAction` (anónimo y staff); `resetStaffPasswordAction`, `setStaffAccessActiveAction` y `createStaffAccessAction` (staff desde `/staff/events/[id]`) | 🔒 / 🔒 ↪ login | 🔒 / 🔒 FORBIDDEN | ✅ / ✅ auditado (cuentas OWNER y STAFF) | ✅ / ✅ | PERM-121…123, PERM-143, PERM-156, SET-013…018, SET-022, STF-018…021 | PASS |
| `staff:write` | 7 | `createStaffMemberAction`, `updateStaffMemberAction` y `deleteStaffMemberAction` (staff desde el portal) | 🔒 / — | 🔒 / 🔒 FORBIDDEN | ✅ / ✅ (control positivo desde la misma página) | ✅ / — | PERM-124…127, OPS-010…015, STF-013…017 | PASS |
| `payments:manual` | 2 | `recordManualPaymentAction`, `refundPaymentAction` | 🔒 / 🔒 ↪ login | 🔒 / 🔒 ↪ /staff | ✅ / ✅ pago PAID + auditoría | ✅ / — | PERM-150, PERM-151, EVT-025, CRIT-006 | PASS |
| `quotes:write` (+ `quotes:discount` y `pricing:write` en servicio) | 10 | `saveQuotePricingAction` con 10 % de descuento | 🔒 / 🔒 | 🔒 / 🔒 | ✅ / ✅ `quote.discount_applied` | ✅ / — | PERM-152, QUO-014, QUO-* | PASS |
| `quotes:send` | 1 | — | 🔒 / — | 🔒 / — | ✅ / ✅ | ✅ / — | CRIT-002, QUO-* | PASS (Owner) |
| `events:cancel` | 1 | `cancelEventAction`, también enviado por otra página y con `Origin` ajeno | 🔒 / 🔒 | 🔒 / 🔒 | ✅ / ✅ CANCELLED + auditoría | ✅ / — | PERM-153, PERM-158, PERM-159 | PASS |
| `events:close` | 1 | `closeEventAction` | 🔒 / 🔒 | 🔒 / 🔒 | ✅ / ✅ snapshot congelado y auditado | ✅ / — | PERM-154, FIN-006, CRIT-007 | PASS |
| `events:write` | 10 | `rotateEventTokenAction` | 🔒 / 🔒 | 🔒 / 🔒 | ✅ / ✅: el token viejo pasa a 404. IDOR del programa (momento de otro evento) → rechazado | ✅ / — | PERM-155, PERM-165, EVT-031, EVT-034 | PASS |
| `events:read_all` | 1 | — | 🔒 / — | 🔒 / — | ✅ / ✅ | ✅ / — | EVT-007, EVT-020 | PASS (Owner) |
| `settings:write` | 9 | `updateBusinessSettingsAction`, `updatePricingSettingsAction`, `setFeatureFlagAction` | 🔒 / 🔒 | 🔒 / 🔒 | ✅ / ✅ auditado (suite global) | ✅ / ✅ | PERM-157, SET-001…012 | PASS |
| `guests:write` | 4 | gestión de invitadas forzada por request | 🔒 / 🔒 | 🔒 / 🔒 | ✅ / ✅ (el IDOR de invitada se rechaza) | ✅ / — | GST-010, GST-001…009, GST-005 | PASS |
| `memory:write` | 4 | las 4, desde la página pública `/memory/[token]` | 🔒 / 🔒 UNAUTHORIZED | 🔒 / 🔒 FORBIDDEN | ✅ / ✅ (control positivo desde la página pública) | ✅ / — | PERM-130…133, PERM-137, PERM-138, MEM-001…004 | PASS |
| `media:moderate` | 3 | las 3, desde `/memory/[token]` | 🔒 / 🔒 UNAUTHORIZED | 🔒 / 🔒 FORBIDDEN | ✅ / ✅ (foto o mensaje de otro evento → no encontrado) | ✅ / — | PERM-134…136, MEM-005…012 | PASS |
| `checklists:update_assigned` (+ asignación en servicio) | 1 | `staffUpdateChecklistItemAction` (ver §3.2) | 🔒 / 🔒 ↪ login | ✅ sólo tareas propias de eventos asignados / ✅ | — (usa `checklists:write` en el admin) | — | PERM-110…115, STF-003…007, STF-010, CRIT-005 | PASS |
| `checklists:write` | 10 | — | 🔒 / — | 🔒 / — | ✅ / ✅ | ✅ / — | OPS-002…009, OPS-023…029 | PASS (Owner) |
| `notifications:read` | 2 | `markAllNotificationsReadAction` con usuaria desactivada | — | — | 🔒 / 🔒 UNAUTHORIZED (desactivada) | — | AUTH-027 | PASS |
| `catalog:write` (+ `pricing:write` en servicio) | 26 | — | 🔒 / — | 🔒 / — | ✅ / ✅ | ✅ / — | CAT-* | PASS (Owner) |
| `catalog:read` | 1 | — | 🔒 / — | 🔒 / — | ✅ / ✅ | ✅ / — | CAT-003, CAT-004 | PASS (Owner) |
| `content:write` | 13 | — | 🔒 / — | 🔒 / — | ✅ / ✅ auditado | ✅ / — | CNT-* | PASS (Owner) |
| `leads:write` | 5 | — | 🔒 / — | 🔒 / — | ✅ / ✅ | ✅ / ✅ | LEAD-* (LEAD-022 con SuperAdmin) | PASS |
| `customers:write` | 2 | — | 🔒 / — | 🔒 / — | ✅ / ✅ | ✅ / ✅ | CUST-* (CUST-012 con SuperAdmin) | PASS |
| `inventory:write` | 11 | — | 🔒 / — | 🔒 / — (STAFF sólo tiene `inventory:read`) | ✅ / ✅ | ✅ / — | INV-* | PASS (Owner) |
| `purchases:write` | 8 | — | 🔒 / — | 🔒 / — | ✅ / ✅ | ✅ / — | PUR-001…014 | PASS (Owner) |
| `vendors:write` | 3 | — | 🔒 / — | 🔒 / — | ✅ / ✅ | ✅ / — | PUR-020…025 | PASS (Owner) |
| `costs:write` | 3 | — | 🔒 / — | 🔒 / — | ✅ / ✅ | ✅ / — | FIN-001…004 | PASS (Owner) |
| `availability:write` | 3 | — | 🔒 / — | 🔒 / — | ✅ / ✅ | ✅ / — | CAL-008, CAL-010 | PASS (Owner) |

**Suma:** 148 acciones protegidas, contadas por el permiso del wrapper. Las 39 que el inventario lista sin permiso estático (catálogo y contenido) usan las constantes `catalog:write` y `content:write` (`src/features/catalog/server/actions.ts:61`, `src/features/content/server/actions.ts:47`).

### 3.2 Controles transversales de backend

| Control | Escenario | Anónimo | Staff | Owner | SuperAdmin | Pruebas | Resultado |
|---|---|---|---|---|---|---|---|
| Escalada OWNER→SUPER_ADMIN | crear una cuenta SUPER_ADMIN (request forzado) | — | — | 🔒 / 🔒 FORBIDDEN | ✅ / ✅ | PERM-140 | PASS |
| Escalada OWNER→SUPER_ADMIN | promover a SUPER_ADMIN | 🔒 / 🔒 ↪ login | 🔒 / 🔒 ↪ /staff | 🔒 / 🔒 FORBIDDEN | ✅ / ✅ | PERM-141, PERM-156 | PASS |
| Escalada OWNER→SUPER_ADMIN | modificar una cuenta SUPER_ADMIN (rol, estado o contraseña) | — | — | 🔒 / 🔒 FORBIDDEN, la UI oculta las acciones | ✅ / ✅ | PERM-142 | PASS |
| Control positivo | OWNER administra cuentas OWNER y STAFF (no queda sobre-restringida) | — | — | ✅ / ✅ auditado | — | PERM-143 | PASS |
| Cuenta propia | cambiar el rol propio o desactivarse | — | — | — | 🔒 / 🔒 | SET-018 | PASS |
| IDOR de staff | «Empezar tarea» con el id de una tarea de un evento **no asignado** | 🔒 / 🔒 ↪ login | 🔒 / 🔒 FORBIDDEN, base intacta | — | — | PERM-110, PERM-113, PERM-115 | PASS |
| IDOR de staff | tarea de otra persona, SKIPPED o evidencia subida por otra persona | — | 🔒 / 🔒 | — | — | PERM-111, PERM-112, PERM-114, STF-006 | PASS |
| IDOR de staff | `/staff/events/[id]` de un evento no asignado, inexistente o cancelado | — | 404 / 404 sin datos del evento | ✅ / ✅ vista staff sin montos | ✅ / ✅ | PERM-101…105, STF-008, STF-023 | PASS |
| IDOR de staff | evidencia (`POST /api/media/upload`) de un evento no asignado o con otro propósito | 401 / 401 | 403 / 403 (✅ / ✅ para eventos asignados) | ✅ / ✅ | — | API-067 | PASS |
| Superficie expuesta | 6 acciones de administración de staff incluidas en `/staff/events/[id]` | — | 🔒 / 🔒 FORBIDDEN | ✅ / ✅ | — | PERM-120…127 | PASS |
| Superficie expuesta | 7 acciones de administración de la cápsula incluidas en `/memory/[token]` | 🔒 / 🔒 UNAUTHORIZED | 🔒 / 🔒 FORBIDDEN | ✅ / ✅ | — | PERM-130…138 | PASS |
| Ruta alterna | acción de admin enviada a `/staff/events/[id]` o a `/` | no se ejecuta / no se ejecuta | no se ejecuta / no se ejecuta | — | — | PERM-158 | PASS |
| CSRF | Server Action con cookie válida y `Origin: https://evil.example` | — | — | 🔒 / 🔒 rechazada, sin escritura | — | PERM-159 | PASS |
| Revalidación de sesión | usuaria desactivada con sesión abierta | — | 🔒 / 🔒 | 🔒 / 🔒 UNAUTHORIZED (páginas y acciones) | — | AUTH-027, STF-021 | PASS |
| Revalidación de sesión | OWNER degradada a STAFF con el JWT viejo | — | — | 🔒 / 🔒 FORBIDDEN | — | AUTH-028 | PASS |
| Revalidación de sesión | STAFF promovida a OWNER | — | ✅ en el siguiente request / ✅ | — | — | AUTH-029 | PASS |

### 3.3 Sesión y autenticación

| Escenario | Roles | Esperado | Observado | Pruebas | Resultado |
|---|---|---|---|---|---|
| Login válido | las 5 cuentas demo | inicio del rol; cookie httpOnly / Lax | igual | AUTH-001…005 | PASS |
| Contraseña incorrecta frente a usuario inexistente | Anónimo | mismo mensaje y mismo DOM (sin enumeración) | igual | AUTH-006, AUTH-007 | PASS |
| Cuenta desactivada, rol CUSTOMER o cuenta sin contraseña | Anónimo | mensaje genérico, sin sesión | igual | AUTH-010…012 | PASS |
| Cookie manipulada o falsificada; request sin cookies | Anónimo | ↪ login | igual | AUTH-023, AUTH-024 | PASS |
| Logout sin requests en vuelo, con dos pestañas, desde el portal staff | Owner, Staff, SuperAdmin | se elimina la cookie y las páginas privadas → ↪ login | igual | AUTH-020, AUTH-021, AUTH-026, AUTH-030, CRIT-009, CRIT-011, CRIT-012 | PASS |
| **Logout con requests en vuelo** | todos los del equipo (reproducido con Owner y Staff) | sesión cerrada | **la sesión revive (Set-Cookie tardío)** | AUTH-032, CRIT-014 | **FAIL (BUG-001)** |
| **Cookie copiada antes del logout** | todos los del equipo | rechazada (↪ login) | **200 con datos** | AUTH-025 | **FAIL (BUG-004)** |
| `callbackUrl` interno; STAFF que pide `/admin` | Owner, Staff, Anónimo | se respeta / → `/staff` | igual | AUTH-040…042, AUTH-051, CRIT-013 | PASS |
| `callbackUrl` externos: `https://`, `//`, `/\`, `\\`, `javascript:`, `/%2F%2F`, `user@host` | Owner | no sale del origen | igual | AUTH-043…048, AUTH-050 | PASS |
| **`callbackUrl` `/\t/evil.example`** | cualquiera del equipo | se descarta → inicio del rol | **se acepta: navegación a `evil.example` intentada + «Application error»** | AUTH-049 | **FAIL (BUG-005)** |
| Fuerza bruta en el login | Anónimo | bloqueo de 15 min tras el 8.º fallo, por cuenta, normalizado y sin enumeración | igual | AUTH-060…063 | PASS |

### 3.4 Route handlers (API)

| Endpoint | Barrera (inventario / código) | Anónimo | Staff | Owner | Otras comprobaciones | Pruebas | Resultado |
|---|---|---|---|---|---|---|---|
| `GET /api/admin/leads-export` | `requirePermission("leads:read")` | 401 / 401 | 403 / 403 | 200 CSV / 200 | BOM, fórmulas neutralizadas, auditoría `leads.exported` | API-070 | PASS |
| `GET /api/events/[id]/guests.csv` | `guests:read` | 401 / 401 | 403 / 403 (también en su propio evento) | 200 / 200 (404 si el evento no existe) | fórmulas neutralizadas, `guests.exported` | API-071, GST-006 | PASS |
| `GET /admin/finance/export` | middleware + `financials:read` | ↪ login / ↪ login | ↪ /staff / ↪ /staff | 200 / 200 | `finance.exported` | API-072, FIN-011 | PASS |
| `POST /api/media/upload` | sesión + `media:upload` + `isSameOrigin` + límite de frecuencia | 401 / 401 | 403 / 403, salvo evidencia de un evento asignado | 200 / 200 | `Origin` ajeno o ausente → 403; magic bytes falsos, SVG o HTML → rechazo; exceso de tamaño → rechazo | API-062…067 | PASS |
| `GET /api/media/[id]` | URL firmada para archivos privados | privado: 403 sin firma o con firma inválida, ajena o vencida; firma vigente → redirect | igual | igual | archivo público: libre; id inválido → 404 | API-060, API-061, MEM-008 | PASS |
| `POST /api/memory/[token]/upload` | token de cápsula + `isSameOrigin` + consentimiento + límite de frecuencia | `Origin` ajeno → 403; sin consentimiento → 400; cápsula no publicada → 403; token inexistente → 404; válida → 201 privada y pendiente de revisión | — | — | token rotado → rechazo | API-068, PERM-188, MEM-014, MEM-015 | PASS |
| `POST /api/analytics/track` | `isSameOrigin` + límite de frecuencia | sin `Origin`, `Origin` ajeno o `Sec-Fetch-Site: cross-site` → 403 | — | — | cuerpo inválido → 400; más de 4 KB → 413 | API-040…042 | PASS |
| `GET` y `POST /api/cron/notifications` | secreto Bearer | sin secreto o incorrecto → 401 | — | — | secreto correcto → 200 e idempotente | API-020…022 | PASS |
| `POST /api/webhooks/payments/[provider]` | firma HMAC (ventana de 300 s) + idempotencia por `WebhookEvent` ³ | sin firma, inválida, con otro secreto, malformada o vencida → 400 sin efecto | — | — | evento repetido → `duplicate:true` (un solo efecto); proveedor desconocido → 404; más de 256 KB → 413 | API-030…035, PAY-009…013 | PASS |
| `/api/auth/*` | Auth.js (CSRF propio) | session `null`; un callback sin token CSRF no crea sesión | — | session sin hash | `providers` sólo expone credenciales | API-050…052 | PASS |
| `/api/health`, `/api/health/db` | públicos | 200 sin datos sensibles; métodos no permitidos → 405 | — | — | — | API-001…012 | PASS |
| `GET /e/[slug]/[token]/calendar.ics` | token | ver §4 | — | — | — | PERM-171, GST-016 | PASS |

³ El inventario estático marca `checksSignature=false` porque la firma se verifica dentro de `handlePaymentWebhook` (`webhook-service`), no en el archivo de la ruta. La prueba dinámica la confirma.

### 3.5 Acciones públicas (21, `publicAction`)

| Familia | Acciones | Barrera verificada | Pruebas | Resultado |
|---|---|---|---|---|
| Configurador, contacto e IA | `submitConfiguratorAction`, `estimateAction`, `getAvailabilityAction`, `trackConfiguratorAction`, `submitContactForm`, `generateDesignAction`, `convertDesignToLeadAction` | El 6.º envío responde RATE_LIMITED. El servidor recalcula el precio e ignora el enviado. El navegador no recibe costos internos. Las fechas bloqueadas se rechazan aunque se fuerce el request. Con el flag de IA apagado, el backend rechaza. | API-080, API-081, CONF-013…015, CONF-017, AI-009 | PASS |
| Cotización | `acceptQuoteAction`, `rejectQuoteAction` | Token inexistente o de otro tipo → NOT_FOUND sin reserva. Una versión reemplazada se rechaza. Aceptar sólo devuelve el token del portal. | PERM-187, QPUB-006…010, QPUB-013 | PASS |
| Portal de la anfitriona | `updatePreferencesAction`, `updateAddressAction`, `sendHostMessageAction`, `addHostGuestAction`, `removeHostGuestAction`, `submitReviewAction`, `requestPortalAccessAction` | Token de otro evento, rotado o de otro tipo → NOT_FOUND con la base intacta. Sólo se pueden quitar invitadas pendientes propias. «Solicitar acceso» no permite enumerar correos. | PERM-180, PERM-183…185, PORT-005, PORT-013, PORT-015 | PASS |
| RSVP | `submitRsvpAction` | Token personal o general de otro evento → NOT_FOUND. **Con el link general y el nombre de otra invitada, sobrescribe su RSVP y entrega su token.** | PERM-181, PERM-182 · **GST-014** | PASS · **FAIL (BUG-003)** |
| Libro de visitas | `submitGuestbookMessageAction` | Cápsula no publicada o token inexistente → NOT_FOUND. El HTML se escapa. | PERM-186, MEM-016 | PASS |
| Pagos | `startCheckoutAction`, `getPaymentStatusAction`, `mockCheckoutAction` | Token sin reserva o inexistente → rechazo. El estado sólo se consulta con la firma del enlace. Un checkout inexistente no procede. | PAY-004, PAY-007, PAY-008, PAY-017 | PASS (relacionado: BUG-002, en §4) |

---

## 4. Accesos por token

| Token (ruta) | Campo | Válido | Inválido (inexistente / malformado) | De otro evento | De otro tipo | Rotado / revocado | Pruebas | Resultado |
|---|---|---|---|---|---|---|---|---|
| **Cotización** `/cotizacion/[token]` | `Quote.publicToken` | 200: propuesta SENT, sin costos internos | 404 genérico / 404 | N/A: la cotización no pertenece a un evento. Un borrador → 404 (QPUB-010) | 404 (portal, invitación) | No se rota. Una nueva versión deja el enlace en 404 hasta reenviarla (QUO-025); una pestaña con la versión vieja no puede aceptar (QPUB-008) | PERM-065, PERM-160, PERM-161, PERM-164, PERM-187, QPUB-001, QPUB-008, QPUB-010, QUO-025 | PASS |
| **Portal** `/mi-evento/[token]` y `/resumen` | `Event.portalToken` | 200 | 404 / 404 | Acciones sobre invitadas de otro evento → NOT_FOUND, base intacta (PERM-180, PORT-015) | 404 (invitación, invitada, cotización, cápsula). Acciones con un token de otro tipo → NOT_FOUND (PERM-184, PERM-185) | Token viejo → 404 y el nuevo → 200. Acciones con el token rotado → NOT_FOUND (PERM-183) | PERM-074, PERM-075, PERM-160, PERM-161, PERM-164, PERM-165, PERM-180, PERM-183…185, PORT-003, PORT-015, EVT-031 | PASS |
| **Invitación general** `/e/[slug]/[token]` | `Event.inviteToken` | 200. Una invitada nueva se registra y recibe su link personal (GST-013); máximo 60 (GST-021) | 404 / 404 | Slug de A + token de B → 404 (PERM-162). RSVP con la invitación de B → NOT_FOUND sin crear invitada (PERM-182) | 404 (portal, cotización) | Token viejo → 404 y los links personales siguen vigentes (PERM-165). Micrositio apagado → 404 (PERM-167) | PERM-068, PERM-160…165, PERM-167, PERM-182, GST-013, GST-017, GST-021 · **GST-014** | PASS · **FAIL (BUG-003): permite tomar el RSVP de otra invitada escribiendo su nombre** |
| **Invitación personal** `/e/[slug]/[token]` | `EventGuest.token` | 200. La dirección exacta sólo aparece tras confirmar; no se ven datos de otras invitadas (GST-018) | 404 / 404 | Slug de A + token personal de B → 404 (PERM-163). RSVP con el token personal de B → NOT_FOUND, su RSVP intacto (PERM-181) | 404 | No tiene rotación individual. Al eliminar a la invitada, su link se desactiva (GST-003) | PERM-163, PERM-164, PERM-181, GST-003, GST-011, GST-018, CRIT-004 | PASS. **Un tercero puede obtener este token por BUG-003** |
| Calendario `/e/[slug]/[token]/calendar.ics` | invitación o invitada | 200 `text/calendar`; la dirección sólo para quien confirmó | 404 / 404 | 404 | — | 404 | PERM-171, GST-016 | PASS |
| **Cápsula** `/memory/[token]` | `MemoryCapsule.shareToken` | 200. Si no está publicada: vista borrador sin fotos ni mensajes (PERM-166) | 404 / 404 | La moderación con ids de otro evento → no encontrado (MEM-012) | 404 (portal) | Token viejo → 404 y el nuevo → 200 (PERM-166, MEM-004). Subir foto o firmar el libro con token rotado o cápsula no publicada → rechazo (PERM-186, PERM-188) | PERM-072, PERM-160, PERM-164, PERM-166, PERM-186, PERM-188, API-068, MEM-004, MEM-012, MEM-015…017, MEM-020 | PASS |
| **Pago: checkout** `/pago/mock/[checkoutId]` | id del checkout mock (`mock_cs_…`) | 200 | 404 / 404 | — | — | Un enlace de más de 1 h expira (PAY-015). Si el saldo cambió, el enlace viejo deja de valer (PAY-016). Una reserva cancelada no acepta pagos (PAY-017) | PERM-077, PERM-169, PAY-004, PAY-015…017 | PASS. Relacionado: **BUG-002** (EVX-BUG-01 / SAL-BUG-03), ver la nota debajo de la tabla |
| **Pago: resultado** `/pago/resultado?p&s` | firma HMAC del pago | 200 con firma válida | 404 sin firma / 404 con firma alterada | 404 con la firma de otro pago | — | — | PERM-078, PERM-168, PAY-008, PAY-014 | PASS |
| Portal sin token `/mi-evento` | — | «Solicitar acceso» da una respuesta neutral; el enlace sólo se envía a correos registrados | formato inválido rechazado en el formulario y en el backend | — | — | — | PORT-005, PORT-006 | PASS |

Cabeceras y formato:

- Todas las rutas por token, válidas o inválidas, envían `X-Robots-Tag: noindex, nofollow` y `Referrer-Policy: same-origin`. El sitio público usa `strict-origin-when-cross-origin`, sin `X-Robots-Tag` (PERM-170, PUB-019).
- Los tokens malformados (cortos, con traversal, con inyección o con unicode) responden 404 sin error 500 (PERM-161).

**BUG-002 (relacionado):** un checkout abierto antes de cancelar el evento todavía se puede cobrar (PAY-021 y EVT-024 en FAIL). Es un defecto del ciclo de vida del pago, no un bypass del token.

---

## 5. Divergencias y controles

### 5.1 Divergencias (4)

| Bug | Severidad / prioridad | Control | Roles | Esperado | Observado | Pruebas en FAIL | Reproducibilidad | Provisional |
|---|---|---|---|---|---|---|---|---|
| **BUG-001** | CRITICAL / P0 | Logout (revocación de sesión) | Todos los del equipo (reproducido con OWNER y STAFF) | Tras «Cerrar sesión» no queda ninguna cookie válida y las páginas privadas → ↪ login | **Las respuestas de requests que salieron antes del `POST /api/auth/signout` (prefetch RSC, otra pestaña) llegan después con `Set-Cookie: authjs.session-token=<JWT nuevo>`. La sesión revive y `/admin/customers` o `/staff` cargan con datos.** | AUTH-032 (Chromium), CRIT-014 (Chromium y WebKit) | AUTH-032: 7/7. CRIT-014: 8/8. De forma natural: CRIT-012 en móvil 1 de 7; la variante de AUTH-020 en ~50 % de los logouts | ACC-BUG-01, TRV-BUG-06 |
| **BUG-004** | HIGH / P1 | Invalidación de la sesión en el servidor | Todos los del equipo | Una cookie copiada antes del logout → 307 a `/login` (OWASP ASVS 3.3.1) | **`GET /admin/customers` con la cookie previa → 200 con datos. El JWT vale 12 h y se renueva en cada request.** | AUTH-025 | ≥ 4/4 | ACC-BUG-02 |
| **BUG-005** | HIGH / P1 | Filtro anti open-redirect del `callbackUrl` | Quien abra un enlace de login manipulado | `/login?callbackUrl=%2F%09%2Fevil.example` se descarta → inicio del rol | **`safeCallback` lo acepta. `x-action-redirect` lleva `/<TAB>/evil.example`, que el navegador normaliza a `//evil.example`. El navegador bloquea el `pushState` (SecurityError) y la app cae en «Application error» con la sesión ya creada. No se observó una navegación efectiva: la protección final la pone el navegador, no la app.** | AUTH-049 | ≥ 4/4 en Chromium; también en WebKit | ACC-BUG-03 |
| **BUG-003** | CRITICAL / P0 | Autorización por token: link general de invitación | Invitada anónima con el link general | Una respuesta hecha con el link general no puede modificar a una invitada existente sin verificar que es ella, y nunca devuelve el token personal de otra | **Basta escribir el nombre de otra invitada, sin email, para sobrescribir su RSVP (asistencia, restricciones, nota de alergia y comentario). Además redirige a su link personal, con sus datos precargados y editables; si responde «Asiste», muestra la dirección exacta.** | GST-014 | 5/5 | EVX-BUG-03 |

#### Causa y corrección sugerida

**BUG-001 y BUG-004 (misma causa raíz).** La sesión es 100 % JWT y no existe revocación en el servidor.

Código responsable:

- `src/middleware.ts:16`: `auth()` re-emite la cookie en cada respuesta, incluidos los prefetch `?_rsc=`.
- `src/auth.config.ts:12`: JWT de 12 h, sin estado en el servidor.
- `src/components/admin/admin-shell.tsx:161` y `src/components/staff/staff-shell.tsx:38`: `signOut` sólo actúa en el cliente.
- `src/server/auth/session.ts:21-31`: `getCurrentUser` revalida `active` y `role`, pero no tiene ninguna marca de revocación.

Corrección:

1. Agregar `sessionVersion` (o `sessionsValidAfter`) a `User`, incluirlo en el JWT y compararlo en `getCurrentUser` y en el middleware. Requiere cambiar `prisma/schema.prisma`, así que hay que coordinarlo.
2. Hacer el logout en el servidor: incrementar la versión y responder con `Clear-Site-Data: "cookies"`.
3. Incrementar la versión también al restablecer la contraseña o al desactivar la cuenta.
4. Mitigación mientras tanto: no re-emitir la cookie en respuestas de prefetch o RSC.

Riesgo inferido del código, sin probar: restablecer la contraseña tampoco cierra las sesiones abiertas (NOT TESTED).

**BUG-005.** `src/features/auth/server/actions.ts:17-22` valida por prefijo de cadena y sólo rechaza `//` y `/\` literales. Corrección:

1. Rechazar los caracteres de control y los espacios (`/[\u0000-\u001F\u007F\s\\]/`).
2. Normalizar con `new URL(url, "http://x")` y exigir el mismo origen y un `pathname` que no empiece por `//`.
3. Agregar `callbacks.redirect` en `src/auth.config.ts` con la misma regla (defensa en profundidad).

Las otras 8 variantes maliciosas pasan.

**BUG-003.** La re-identificación es por nombre, sin ningún factor de posesión. Código responsable:

- `src/features/guests/domain/rsvp.ts:58-75`: `findMatchingGuest` empata por nombre normalizado cuando no hay email.
- `src/features/guests/server/rsvp-service.ts:72-96`: actualiza a esa invitada y devuelve su `token`.
- `src/features/guests/server/actions.ts:17-24`: arma `personalPath` con ese token.

Corrección: con el link general, no actualizar ni devolver el token de una invitada que ya respondió o que tiene contacto. En su lugar, crear una invitada `SELF_RSVP` marcada como posible duplicado, o pedir verificación (el email registrado, o reenviarle su link personal por correo o WhatsApp). El empate por nombre sólo debería aplicar a invitadas `PENDING` sin contacto.

### 5.2 Controles que pasaron

| Control | Qué se verificó | Pruebas | Resultado |
|---|---|---|---|
| **Escalada OWNER→SUPER_ADMIN** | Con request forzado, OWNER no puede crear ni promover cuentas SUPER_ADMIN ni modificar el rol, estado o contraseña de una existente (FORBIDDEN, base intacta), y la UI oculta esas acciones. SUPER_ADMIN sí puede. OWNER administra cuentas OWNER y STAFF sin sobre-restricción. Nadie cambia su propio rol ni se desactiva. | PERM-140…143, PERM-156, SET-013…018 | **PASS** |
| **IDOR de staff** | STAFF sólo ve sus eventos asignados no cancelados. Un evento ajeno abierto por URL → 404 sin datos. El replay sobre tareas de eventos no asignados, de otra persona, SKIPPED o con evidencia ajena → FORBIDDEN con la base intacta, y staff2 no puede reutilizar los requests de staff. Las evidencias sólo se suben a eventos asignados. Las 6 acciones de admin expuestas en el portal → FORBIDDEN. El portal no muestra montos. | PERM-100…127, API-067, STF-001, STF-002, STF-006, STF-008, STF-009, STF-023, CRIT-005 | **PASS** |
| **Tokens** | Tokens inexistentes o malformados → 404 genérico sin error 500. Se probaron otro evento u otro slug, otro tipo y tokens rotados (portal, invitación y cápsula): el viejo → 404 y el nuevo funciona. Las acciones públicas con token ajeno, rotado o de otro tipo → NOT_FOUND sin escritura. También se verificaron la firma de `/pago/resultado`, el micrositio apagado y las cabeceras `noindex` y `Referrer-Policy`. | PERM-160…171, PERM-180…188, PORT-003, PORT-015, QPUB-010, GST-016, GST-017, MEM-012, MEM-017, PAY-004, PAY-007, PAY-008 | **PASS** (excepción: BUG-003, que no es un fallo de validación del token sino una re-identificación por nombre dentro del token general) |
| **CSRF** | Una Server Action con cookie válida y `Origin` ajeno se rechaza sin escribir. `/api/media/upload` y `/api/memory/[token]/upload` sin `Origin` o con `Origin` ajeno → 403. `/api/analytics/track` sin `Origin`, con `Origin` ajeno o con `Sec-Fetch-Site: cross-site` → 403. El callback de Auth.js sin token CSRF no crea sesión. | PERM-159, API-040, API-051, API-062, API-068, MEM-015 | **PASS** (la Server Action rechazada responde HTTP 500; ver §6) |
| **Webhooks** | Firma ausente, inválida, con otro secreto, malformada o vencida (más de 300 s) → 400 sin efecto. El mismo evento repetido se aplica una sola vez (`duplicate:true`). Proveedor desconocido → 404; más de 256 KB → 413. Un pago inexistente se registra sin efectos. `payment.failed`, los reembolsos y los cobros por debajo del monto llevan a estados correctos e idempotentes. | API-030…035, PAY-009…013 | **PASS** |
| Otros controles en PASS | Secreto de cron (API-020…022). Revalidación de la sesión por estado o rol (AUTH-027…029, STF-021). Cookie falsificada (AUTH-024). Límite de intentos de login (AUTH-060…063). Límite de frecuencia en acciones públicas (API-080, API-081). URLs firmadas de media (API-060, API-061). Exportaciones CSV por rol (API-070…072). 8 de 9 variantes de `callbackUrl` (AUTH-043…048, AUTH-050). | — | **PASS** |

---

## 6. Observaciones (no son divergencias)

- **Permiso latente de STAFF.** STAFF tiene `inventory:read`, que habilita las 5 páginas `/admin/inventory*`, pero el middleware le cierra `/admin`. Hoy no hay impacto. Conviene decidir si se quita el permiso o si se documenta que es intencional (REQUIREMENT AMBIGUITY): si alguien relajara el middleware, STAFF vería el inventario completo.
- **Validación antes de autorizar.** En `protectedAction`, Zod valida antes de autorizar (`src/server/action.ts:71-74`). Un anónimo que llama a una acción protegida con datos inválidos recibe `VALIDATION_ERROR` con los mensajes de campo, lo que revela el esquema. Se recomienda autenticar y autorizar antes de validar.
- **Acciones co-ubicadas.** `/memory/[token]` incluye las 7 acciones de administración de la cápsula y `/staff/events/[id]` las 6 de administración de staff. Hoy el RBAC las frena (PASS), pero conviene separar las acciones públicas y las de admin en módulos distintos.
- **CSRF con HTTP 500.** Next 15.5 rechaza la Server Action con `Origin` ajeno respondiendo **HTTP 500** con `digest` en lugar de un 4xx, lo que ensucia las alertas de 5xx.
- **Bloqueo de cuentas ajenas.** El límite de login es sólo por correo (`src/auth.ts:39`): cualquiera puede bloquear 15 min una cuenta conocida. Considerar un límite combinado de correo + IP y un desbloqueo por admin.
- **Confianza en `X-Real-Ip`.** `clientIp()` (`src/lib/rate-limit.ts:55`) confía en `X-Real-Ip`. Es correcto detrás de Traefik; sin proxy, los límites por IP se evaden. Hay que documentarlo en el despliegue.
- **Promoción con sesión abierta.** Una STAFF promovida a OWNER sigue en `/staff` hasta volver a iniciar sesión, porque el middleware usa el rol del JWT. Es un detalle de UX sin riesgo (AUTH-029).
- **Documentación desalineada.** `docs/SECURITY.md` dice `Referrer-Policy: no-referrer` en las páginas por token, pero el middleware envía `same-origin`, y `/cotizacion/[token]` además declara `<meta name="referrer" content="no-referrer">`.
- **Cobertura de replay.** No todas las acciones protegidas tuvieron replay negativo individual. 13 de los 26 grupos de permiso (87 de 148 acciones) se sostienen con la evidencia positiva de Owner y la barrera común verificada, sin replay negativo propio (§3.1). Para regresión conviene generar el replay negativo por acción desde el inventario.

## 7. Trazabilidad

| Carril | Pruebas de permisos y autorización | Resultado |
|---|---|---|
| 1 · Acceso (`access-coverage.md`) | PERM: 148 (83 de páginas + PERM-090 + 64 de backend y tokens) · AUTH: 46 · API: 41 | PERM 148/148 PASS · AUTH 43 PASS y 3 FAIL (AUTH-025 → BUG-004, AUTH-032 → BUG-001, AUTH-049 → BUG-005) · API 41/41 PASS |
| 2 · Ventas (`sales-coverage.md`) | QPUB-006…010, QPUB-013, CONF-014, CONF-015, CONF-017, AI-009, PAY-004, PAY-007…017 | PASS (PAY-021 FAIL → BUG-002, de ciclo de vida, no de permisos) |
| 3 · Comercial (`commercial-coverage.md`) | QUO-014, QUO-027, LEAD-022, CUST-011, CUST-012, CAT-020 | PASS |
| 4 · Eventos (`events-coverage.md`) | GST-003, GST-005, GST-006, GST-010, GST-013, GST-016…018, GST-021, EVT-031, EVT-034, MEM-004, MEM-011, MEM-012, MEM-015…017, MEM-020, PORT-003, PORT-005, PORT-013, PORT-015 | PASS · **GST-014 FAIL → BUG-003** |
| 5 · Operaciones (`operations-coverage.md`) | STF-001…009, STF-018…021, STF-023, SET-013…018, SET-022, FIN-011 | PASS |
| 6 · Transversal (`transversal-coverage.md`) | CRIT-005, CRIT-009, CRIT-011, CRIT-012, CRIT-013, CRIT-014, SMK-035 | PASS · **CRIT-014 FAIL → BUG-001** (Chromium y WebKit) · Firefox BLOCKED (ENV-02) |
