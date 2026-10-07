# ROLE_PERMISSION_MATRIX — Ivonne & Rosa

**Auditoría:** FULL E2E · 2026-10-06 · corridas por carril sobre el commit `f26b1a1` (resultado consolidado en `8020b91`) · build de producción local, una base `*_e2e` por carril, proveedores mock.
**Estado final (2026-10-07, `b47437b`):** ronda 1 de correcciones (merges `d144ce7`…`41db385`), endurecimiento (merges `f8797e0`…`c3ba279`) y formularios antes de hidratar (`e2f3699`, `d96a82a`). Regresión final secuencial con todos los navegadores: el carril 1 (acceso: `permissions`, `auth`, `api`, `navigation`) dio **571/571** ejecuciones en PASS, sin fallos ni flaky (Chromium 276, Firefox 144, WebKit 144, móvil 2). La suite `ratelimit` dio 12/12 y los carriles 2, 3 y 6 quedaron al 100 %. En los carriles 4 y 5 quedan inestabilidades de Firefox y WebKit que se están corrigiendo; la única que toca autorización es STF-021 en WebKit (ver Resumen y la nota ³ de §3.2).
**Esperado:** `src/server/auth/permissions.ts` (RBAC), `src/middleware.ts` (barrera por zona y renovación del JWT), `src/server/auth/session.ts` (`requirePagePermission` / `requirePermission` y comparación de `sessionVersion`) e inventario `docs/qa/.discovery/inventory.json`. El inventario se regeneró el 2026-10-07T04:02Z (`2fbe8d4`) y no tiene drift: 83 páginas, 13 route handlers y 169 Server Actions (148 protegidas + 21 públicas), además de `loginAction`.
**Observado:** `docs/qa/findings/access-role-matrix.md` y `access.md` (carril 1: `tests/e2e/permissions/*`, `tests/e2e/auth/*`, `tests/e2e/api/*`), las pruebas de autorización de los carriles 2 a 6 (`docs/qa/findings/*-coverage.md`) y las secciones «Resolution» / «Corrección» de cada hallazgo.
**Navegador:** en la auditoría la matriz se midió en Chromium (carril 1) y Firefox quedó BLOCKED (ENV-02). En la regresión final el carril 1 también corre en Firefox y WebKit todas las pruebas @P0, entre ellas la matriz de páginas, el replay de acciones expuestas y los `callbackUrl` maliciosos. Los recorridos críticos de acceso corren en los 4 proyectos (carril 6).
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

Las divergencias van en **negrita** con su BUG. Las que ya se corrigieron llevan la marca ✔ y la prueba `@regression` que lo verifica.

## Resumen

- **Divergencias abiertas: 0.** Las 4 divergencias de seguridad de la auditoría están **corregidas y verificadas**:
  - **BUG-001** (CRITICAL): AUTH-032, CRIT-014 y CRIT-012.
  - **BUG-003** (CRITICAL): GST-014, más las nuevas GST-023 y GST-025.
  - **BUG-004** (HIGH): AUTH-025, más las nuevas AUTH-033…038 y AUTH-064.
  - **BUG-005** (HIGH): AUTH-049, más la nueva AUTH-071.

  Las 5 pruebas que estaban en FAIL (AUTH-032, CRIT-014, GST-014, AUTH-025 y AUTH-049) llevan `@regression` y pasan en la regresión final. AUTH-032, AUTH-049, CRIT-014 y GST-014 pasan además en Firefox y WebKit (§5.1).
- **Páginas:** 83 rutas × 4 roles = **332 celdas**. En las 332 lo observado coincide con lo esperado (**0 divergencias**). PERM-001…083 y PERM-090 están en PASS, también en la regresión final. Tras corregir BUG-001 y BUG-004, la columna Anónimo también se cumple para quien acaba de cerrar sesión.
- **Backend:** el replay de acciones sensibles por rol, las acciones de administración expuestas en páginas públicas o del portal y los 13 route handlers coinciden con el RBAC. Pruebas: PERM-110…159, PERM-120…138 y API-001…081, todas en PASS.
- **Controles nuevos tras la auditoría** (§3.2 y §3.3), todos en PASS:
  - Revocación de sesiones en servidor (`User.sessionVersion`): al cerrar sesión, restablecer la contraseña, cambiar el rol, desactivar la cuenta o eliminar una ficha de staff con acceso.
  - Renovación del JWT sólo en GET con ≥ 1 h (AUTH-053…058).
  - `GET /api/auth/session` ya no re-emite la cookie (AUTH-059).
  - `callbackUrl` validado en el propio `loginAction` (AUTH-065…072).
  - **`deleteStaffMember`** aplica las reglas de Usuarios a la cuenta ligada. Es un hallazgo MEDIUM del endurecimiento, corregido y cubierto por integración.
- **Tokens:** las familias cotización, portal, invitación general, invitación personal, cápsula y pago se probaron como válido, inválido, de otro evento, de otro tipo y rotado, y pasaron (PERM-160…188 y carriles 2 y 4).
  - **El link general de invitación ya es seguro:** cada respuesta crea una invitada `SELF_RSVP` nueva y nunca toma, modifica ni revela a otra (BUG-003 ✔).
  - Las rutas por token con un token inexistente responden HTTP 404 real (NAV-034).
  - Ningún formulario por token se envía por GET antes de hidratar (GST-028, PORT-023…025).
- **Controles que pasaron:** escalada OWNER→SUPER_ADMIN, IDOR de staff, tokens, CSRF, webhooks y sesión (§5.2).
- **Impacto en el gate:** no hay bugs de permisos abiertos. En la regresión final, la única prueba de autorización que no pasó es **STF-021 en WebKit** (carril 5): la desactivación de staff con sesión abierta. Se agotó el tiempo al pulsar «Entrar» en `/login` antes de llegar a la comprobación de autorización. En Chromium y Firefox pasa. Es una de las inestabilidades de WebKit del carril 5 que se están corrigiendo. El veredicto oficial lo calcula `scripts/quality-gate.mjs`.

---

## 1. Roles y permisos

### 1.1 Roles

| Rol | Permisos RBAC | Autenticación | Zona / inicio | Alcance y reglas |
|---|---|---|---|---|
| **SUPER_ADMIN** | 48 de 48 (todos) | Login del equipo (Credentials + JWT de 12 h, revocable en servidor con `User.sessionVersion`) | `/admin` | Es el único rol con `roles:assign_super_admin`: crea, promueve y modifica cuentas SUPER_ADMIN. No se puede desactivar ni degradar al último SUPER_ADMIN activo (`src/features/users/domain/user-rules.ts`, con lock consultivo en `user-service.ts`). Las mismas reglas aplican cuando la cuenta se desactiva al eliminar su ficha de staff (`checkLinkedAccountDeactivation`). |
| **OWNER** | 47 de 48: todos excepto `roles:assign_super_admin` | Login del equipo | `/admin` | Panel completo. Administra cuentas OWNER y STAFF (`users:manage`). Con cuentas SUPER_ADMIN la UI oculta las acciones y el backend responde FORBIDDEN; también al eliminar la ficha de staff ligada a una SUPER_ADMIN. Cambiar precios del catálogo exige `pricing:write` y aplicar descuentos `quotes:discount` (ambos verificados en el servicio). |
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
2. **Sesión:**
   - En cada request, `getCurrentUser` revalida `active`, `role` y `sessionVersion` contra la base. Un JWT sin versión cuenta como 0.
   - La versión se incrementa en el mismo `update` que el cambio: al cerrar sesión (evento `signOut` de Auth.js, con comparar e incrementar), al restablecer la contraseña (Usuarios y Staff), al desactivar (Usuarios, Staff y al eliminar una ficha con acceso) y al cambiar el rol.
   - El middleware ya no re-emite la cookie en cada respuesta: renueva el JWT sólo en GET cuando tiene ≥ `updateAge` (1 h) y nunca en un POST. `GET /api/auth/session`, que queda fuera del matcher, tampoco la re-emite (`withoutSessionCookieRenewal`). Los borrados de la cookie se conservan.
3. **Página:** `requirePagePermission(perm)`. Sin sesión → login; sin permiso → ⛔.
4. **Server Action:**
   - `protectedAction({ permission })` responde `UNAUTHORIZED` o `FORBIDDEN`.
   - `publicAction({ rateLimit })` aplica el límite de frecuencia.
   - Next rechaza las Server Actions con un `Origin` ajeno.
   - `loginAction` normaliza el `callbackUrl` con `safeCallbackPath` (`src/features/auth/domain/callback-url.ts`). La página `/login` y el callback `redirect` de Auth.js aplican la misma regla.
5. **Servicio:**
   - `pricing:write` y `quotes:discount` se verifican en `quote-service.ts:490-506` y `catalog-common.ts:39`.
   - `checklists:update_assigned` se verifica junto con la asignación en `checklist-service.ts:193`.
   - Las reglas de SUPER_ADMIN viven en `user-rules.ts`.
   - `deleteStaffMember` evalúa dentro de su transacción `checkLinkedAccountDeactivation` (`user-service.ts`): las mismas reglas que `setUserActive`, con el lock de super admins.
   - El alcance de cada token se limita a su evento. El link general de invitación sólo crea invitadas nuevas (`submitRsvp`).
6. **Route handlers:** `requirePermission`, `isSameOrigin`, firma HMAC del webhook o secreto de cron, según el caso.

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
| PERM-055 | `/admin/settings/users` | admin | users:manage | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | PERM-140…143, PERM-156, AUTH-028, AUTH-033, AUTH-035…037, SET-013…018 |
| PERM-056 | `/admin/staff` | admin | staff:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-057 | `/admin/staff/[id]` | admin | staff:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS | STF-018…021, AUTH-034, AUTH-064 |
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
| PERM-068 | `/e/[slug]/[token]` | experience | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | PERM-162, PERM-163, PERM-165, PERM-167, PERM-181, PERM-182, GST-017, GST-023, GST-024, GST-025, GST-028; GST-014 `@regression` PASS (BUG-003 ✔) |
| PERM-069 | `/experiencias` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | — |
| PERM-070 | `/experiencias/[slug]` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | NAV-002 `@regression` y NAV-034 (404 real; BUG-013 corregido, no es de permisos) |
| PERM-071 | `/login` | auth | — | ✅ / ✅ | ↪ /staff / ↪ /staff | ↪ /admin / ↪ /admin | ↪ /admin / ↪ /admin | PASS | AUTH-001…017, AUTH-040…051, AUTH-065…072; AUTH-049 y AUTH-071 `@regression` PASS (BUG-005 ✔) |
| PERM-072 | `/memory/[token]` | experience | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | PERM-130…138, PERM-166, PERM-186, PERM-188 |
| PERM-073 | `/mi-evento` | experience | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS | PORT-005, PORT-006, PORT-023 |
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

1. **Anónimo tras cerrar sesión.** La matriz se midió con contextos limpios. En la auditoría, para alguien que **acababa de cerrar sesión**, la columna Anónimo no se cumplía de forma fiable:
   - una respuesta en vuelo podía revivir la sesión (**BUG-001**);
   - una cookie copiada antes del logout seguía autorizando (**BUG-004**).

   Ambos están corregidos (✔): el logout revoca la sesión en el servidor y el middleware ya no re-emite la cookie. AUTH-025, AUTH-032, CRIT-012 y CRIT-014 lo verifican con `@regression`. Hoy la columna Anónimo también aplica a quien acaba de cerrar sesión. Ver §5.
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
| `users:manage` | 7 | `changeUserRoleAction` (anónimo y staff); `resetStaffPasswordAction`, `setStaffAccessActiveAction` y `createStaffAccessAction` (staff desde `/staff/events/[id]`) | 🔒 / 🔒 ↪ login | 🔒 / 🔒 FORBIDDEN | ✅ / ✅ auditado (cuentas OWNER y STAFF). Restablecer la contraseña, cambiar el rol y desactivar revocan las sesiones abiertas de la cuenta; si es la propia, también la actual | ✅ / ✅ | PERM-121…123, PERM-143, PERM-156, SET-013…018, SET-022, STF-018…021, AUTH-033…037, AUTH-064 | PASS |
| `staff:write` | 7 | `createStaffMemberAction`, `updateStaffMemberAction` y `deleteStaffMemberAction` (staff desde el portal) | 🔒 / — | 🔒 / 🔒 FORBIDDEN | ✅ / ✅ (control positivo desde la misma página). `deleteStaffMemberAction` sobre una ficha con acceso aplica además las reglas de Usuarios a la cuenta ligada (§3.2) | ✅ / — | PERM-124…127, OPS-010…015, STF-013…017; integración `operations-staff.test.ts` | PASS |
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
| **Cuenta ligada a una ficha de staff** (nuevo, endurecimiento) | `deleteStaffMemberAction` sobre la ficha ligada a una cuenta SUPER_ADMIN o a la propia cuenta: eliminar la ficha desactiva y revoca la cuenta ligada | — | — (sin `staff:write`, FORBIDDEN como en PERM-126) | 🔒 / 🔒: FORBIDDEN con una SUPER_ADMIN y CONFLICT con la propia; no se borra nada. La página no ofrece «Eliminar integrante» sobre la propia ficha | ✅ / ✅: una SUPER_ADMIN sí puede eliminar la ficha de otra SUPER_ADMIN | Integración `operations-staff.test.ts` › «eliminar una ficha ligada aplica las reglas de Usuarios…» (+ PERM-126, STF-016, STF-017 sin cambios) | PASS. Corregido en `ebb5fac`; antes una OWNER podía desactivar a una SUPER_ADMIN (o a sí misma) borrando su ficha. POTENTIAL SECURITY ISSUE, MEDIUM, reproducido 1/1 |
| IDOR de staff | «Empezar tarea» con el id de una tarea de un evento **no asignado** | 🔒 / 🔒 ↪ login | 🔒 / 🔒 FORBIDDEN, base intacta | — | — | PERM-110, PERM-113, PERM-115 | PASS |
| IDOR de staff | tarea de otra persona, SKIPPED o evidencia subida por otra persona | — | 🔒 / 🔒 | — | — | PERM-111, PERM-112, PERM-114, STF-006 | PASS |
| IDOR de staff | `/staff/events/[id]` de un evento no asignado, inexistente o cancelado | — | 404 / 404 sin datos del evento | ✅ / ✅ vista staff sin montos | ✅ / ✅ | PERM-101…105, STF-008, STF-023 | PASS |
| IDOR de staff | evidencia (`POST /api/media/upload`) de un evento no asignado o con otro propósito | 401 / 401 | 403 / 403 (✅ / ✅ para eventos asignados) | ✅ / ✅ | — | API-067 | PASS |
| Superficie expuesta | 6 acciones de administración de staff incluidas en `/staff/events/[id]` | — | 🔒 / 🔒 FORBIDDEN | ✅ / ✅ | — | PERM-120…127 | PASS |
| Superficie expuesta | 7 acciones de administración de la cápsula incluidas en `/memory/[token]` | 🔒 / 🔒 UNAUTHORIZED | 🔒 / 🔒 FORBIDDEN | ✅ / ✅ | — | PERM-130…138 | PASS |
| Ruta alterna | acción de admin enviada a `/staff/events/[id]` o a `/` | no se ejecuta / no se ejecuta | no se ejecuta / no se ejecuta | — | — | PERM-158 | PASS |
| CSRF | Server Action con cookie válida y `Origin: https://evil.example` | — | — | 🔒 / 🔒 rechazada, sin escritura | — | PERM-159 | PASS |
| Revalidación de sesión | usuaria desactivada con sesión abierta | — | 🔒 / 🔒 | 🔒 / 🔒 UNAUTHORIZED (páginas y acciones) | — | AUTH-027, STF-021 ³ | PASS |
| Revalidación de sesión | OWNER degradada a STAFF con el JWT viejo | — | — | 🔒 / 🔒 FORBIDDEN | — | AUTH-028 | PASS |
| Revalidación de sesión | STAFF promovida a OWNER | — | ✅ en el siguiente request / ✅ | — | — | AUTH-029 | PASS |
| Revocación al administrar la cuenta | restablecer la contraseña (Usuarios o Staff), cambiar el rol, desactivar y reactivar una cuenta con sesión abierta | — | 🔒 / 🔒 la sesión del portal → ↪ login | 🔒 / 🔒 la sesión abierta → ↪ login; tras volver a entrar aplica el rol nuevo; reactivar no revive la cookie anterior | — | AUTH-033, AUTH-034, AUTH-035, AUTH-036 (`@regression` BUG-004) | PASS |
| Revocación al administrar la cuenta | restablecer la **propia** contraseña (Ajustes › Usuarios, o la propia ficha en Staff) | — | — | ✅ / ✅: aviso «Se cerrarán todas tus sesiones, incluida ésta»; la cookie actual se borra y la UI va a `/login`; la cookie vieja queda revocada; auditoría `self: true` | — | AUTH-037, AUTH-064 | PASS |
| Revocación al cerrar sesión | una cookie ya revocada se usa contra `/api/auth/signout` mientras hay una sesión nueva | — | — | 🔒 / 🔒 la sesión nueva sigue vigente (comparar e incrementar) | — | AUTH-038 | PASS |

³ En la regresión final, STF-021 pasó en Chromium y Firefox y falló en WebKit: se agotó el tiempo al pulsar «Entrar» en `/login` antes de llegar a la comprobación de autorización. Es una de las inestabilidades de WebKit del carril 5 que se están corrigiendo. AUTH-027 cubre el mismo control y pasa en los 3 motores.

### 3.3 Sesión y autenticación

| Escenario | Roles | Esperado | Observado | Pruebas | Resultado |
|---|---|---|---|---|---|
| Login válido | las 5 cuentas demo | inicio del rol; el `Set-Cookie` real del login lleva `HttpOnly`, `SameSite=Lax` y `Path=/` (en los 3 motores) y la cookie no es legible desde `document.cookie` | igual | AUTH-001…005 | PASS |
| Contraseña incorrecta frente a usuario inexistente | Anónimo | mismo mensaje y mismo DOM (sin enumeración) | igual | AUTH-006, AUTH-007 | PASS |
| Cuenta desactivada, rol CUSTOMER o cuenta sin contraseña | Anónimo | mensaje genérico, sin sesión | igual | AUTH-010…012 | PASS |
| Cookie manipulada o falsificada; request sin cookies | Anónimo | ↪ login | igual | AUTH-023, AUTH-024 | PASS |
| Logout sin requests en vuelo, con dos pestañas, desde el portal staff | Owner, Staff, SuperAdmin | se elimina la cookie y las páginas privadas → ↪ login | igual | AUTH-020, AUTH-021, AUTH-026, AUTH-030, CRIT-009, CRIT-011, CRIT-012 | PASS |
| Logout con requests en vuelo ✔ | todos los del equipo (reproducido con Owner y Staff) | sesión cerrada | igual: ninguna respuesta posterior al logout re-emite la cookie con un JWT reciente y, si la cookie anterior reapareciera, ya está revocada en el servidor (auditoría: la sesión revivía) | AUTH-032, CRIT-014, CRIT-012 (`@regression` BUG-001) | PASS (BUG-001 corregido y verificado) |
| Cookie copiada antes del logout ✔ | todos los del equipo | rechazada (↪ login) | igual: 307 a `/login` (auditoría: 200 con datos) | AUTH-025 (`@regression` BUG-004) | PASS (BUG-004 corregido y verificado) |
| Renovación del JWT | Owner (JWT forjado con `iat` de hace 2 h o reciente) | renueva sólo en GET con ≥ 1 h; nunca en POST; una cookie inválida conserva su borrado; un JWT revocado sigue sin autorizar aunque se renueve | igual: GET de documento y RSC renuevan (`iat` nuevo, mismos `uid`, rol y `sessionVersion`) y la renovada autoriza; el POST de Server Action y el JWT reciente no re-emiten | AUTH-053…058 | PASS |
| `callbackUrl` interno; STAFF que pide `/admin` | Owner, Staff, Anónimo | se respeta / → `/staff` | igual | AUTH-040…042, AUTH-051, CRIT-013 | PASS |
| `callbackUrl` externos: `https://`, `//`, `/\`, `\\`, `javascript:`, `/%2F%2F`, `user@host` | Owner | no sale del origen | igual | AUTH-043…048, AUTH-050 | PASS |
| `callbackUrl` `/\t/evil.example` ✔ | cualquiera del equipo | se descarta → inicio del rol | igual (auditoría: se aceptaba, se intentaba navegar a `evil.example` y aparecía «Application error») | AUTH-049 (`@regression` BUG-005) | PASS (BUG-005 corregido y verificado) |
| `callbackUrl` malicioso escrito directo en el campo oculto de `loginAction` (mismos 8 valores) | Owner | la validación propia de `loginAction` lo descarta | igual: `x-action-redirect` del mismo origen y con el inicio del rol (`/admin`); `/%2F%2Fevil.example` se conserva como ruta interna legítima | AUTH-065…072 (AUTH-071 = TAB, `@regression` BUG-005) | PASS |
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
| `POST /api/webhooks/payments/[provider]` | firma HMAC (ventana de 300 s) + idempotencia por `WebhookEvent` ⁴ | sin firma, inválida, con otro secreto, malformada o vencida → 400 sin efecto | — | — | evento repetido → `duplicate:true` (un solo efecto); proveedor desconocido → 404; más de 256 KB → 413 | API-030…035, PAY-009…013 | PASS |
| `/api/auth/*` | Auth.js (CSRF propio); `GET /api/auth/session` envuelto con `withoutSessionCookieRenewal`; `signOut` revoca con comparar e incrementar | session `null`; un callback sin token CSRF no crea sesión | — | session sin hash; `GET /api/auth/session` **nunca re-emite la cookie** de sesión, ni con JWT reciente ni con uno antiguo, y conserva los borrados; con una cookie revocada, `/api/auth/signout` no cierra las sesiones nuevas | `providers` sólo expone credenciales | API-050…052, AUTH-059 (`@regression`), AUTH-038 | PASS. Antes de `28fb8d3` la sesión se re-emitía en cada llamada: APPLICATION BUG latente, porque la app no usa el endpoint |
| `/api/health`, `/api/health/db` | públicos | 200 sin datos sensibles; métodos no permitidos → 405 | — | — | — | API-001…012 | PASS |
| `GET /e/[slug]/[token]/calendar.ics` | token | ver §4 | — | — | — | PERM-171, GST-016 | PASS |

⁴ El inventario estático marca `checksSignature=false` porque la firma se verifica dentro de `handlePaymentWebhook` (`webhook-service`), no en el archivo de la ruta. La prueba dinámica la confirma.

### 3.5 Acciones públicas (21, `publicAction`)

| Familia | Acciones | Barrera verificada | Pruebas | Resultado |
|---|---|---|---|---|
| Configurador, contacto e IA | `submitConfiguratorAction`, `estimateAction`, `getAvailabilityAction`, `trackConfiguratorAction`, `submitContactForm`, `generateDesignAction`, `convertDesignToLeadAction` | El 6.º envío responde RATE_LIMITED. El servidor recalcula el precio e ignora el enviado. El navegador no recibe costos internos. Las fechas bloqueadas se rechazan aunque se fuerce el request. Con el flag de IA apagado, el backend rechaza. **Una captura pública nunca escribe datos de contacto en una clienta existente:** el correo escrito queda en el lead y no en su perfil, así que sus enlaces de cotización, portal y pago no se desvían. Mismo teléfono con otro correo = otra clienta (endurecimiento `fe9f23a`). | API-080, API-081, CONF-013…015, CONF-017, AI-009, CONF-021 y PUB-048 (`@regression`) | PASS |
| Cotización | `acceptQuoteAction`, `rejectQuoteAction` | Token inexistente o de otro tipo → NOT_FOUND sin reserva. Una versión reemplazada se rechaza. Aceptar sólo devuelve el token del portal. | PERM-187, QPUB-006…010, QPUB-013 | PASS |
| Portal de la anfitriona | `updatePreferencesAction`, `updateAddressAction`, `sendHostMessageAction`, `addHostGuestAction`, `removeHostGuestAction`, `submitReviewAction`, `requestPortalAccessAction` | Token de otro evento, rotado o de otro tipo → NOT_FOUND con la base intacta. Sólo se pueden quitar invitadas pendientes propias. «Solicitar acceso» no permite enumerar correos. Antes de hidratar ningún formulario se envía por GET, así que el correo, la dirección, el mensaje y la opinión nunca terminan en la URL (`d96a82a`). | PERM-180, PERM-183…185, PORT-005, PORT-013, PORT-015, PORT-023…025 | PASS |
| RSVP ✔ | `submitRsvpAction` | Token personal o general de otro evento → NOT_FOUND. **Link general (BUG-003 corregido):** cada respuesta crea una invitada `SELF_RSVP` nueva con su propio link. Nunca toma, modifica ni revela a otra invitada aunque coincida su nombre o su email, y la respuesta es idéntica haya o no coincidencia (sin enumeración). Las coincidencias se marcan «Posible duplicado» («Coincide con «…»») en el panel y en el portal, y se auditan como `guest.possible_duplicate` en la misma transacción. Límites: 10 respuestas por IP en 10 min y 60 invitadas por evento. Antes de hidratar el RSVP no se envía por GET, así que nombre y correo no terminan en la URL. | PERM-181, PERM-182, GST-014 (`@regression` BUG-003), GST-023, GST-024, GST-025, GST-028 | PASS (BUG-003 corregido y verificado) |
| Libro de visitas | `submitGuestbookMessageAction` | Cápsula no publicada o token inexistente → NOT_FOUND. El HTML se escapa. | PERM-186, MEM-016 | PASS |
| Pagos | `startCheckoutAction`, `getPaymentStatusAction`, `mockCheckoutAction` | Token sin reserva o inexistente → rechazo. El estado sólo se consulta con la firma del enlace. Un checkout inexistente no procede. | PAY-004, PAY-007, PAY-008, PAY-017 | PASS (relacionado: BUG-002, ya corregido; ver §4) |

---

## 4. Accesos por token

| Token (ruta) | Campo | Válido | Inválido (inexistente / malformado) | De otro evento | De otro tipo | Rotado / revocado | Pruebas | Resultado |
|---|---|---|---|---|---|---|---|---|
| **Cotización** `/cotizacion/[token]` | `Quote.publicToken` | 200: propuesta SENT, sin costos internos | 404 genérico / 404 | N/A: la cotización no pertenece a un evento. Un borrador → 404 (QPUB-010) | 404 (portal, invitación) | No se rota. Una nueva versión deja el enlace en 404 hasta reenviarla (QUO-025); una pestaña con la versión vieja no puede aceptar (QPUB-008) | PERM-065, PERM-160, PERM-161, PERM-164, PERM-187, QPUB-001, QPUB-008, QPUB-010, QUO-025 | PASS |
| **Portal** `/mi-evento/[token]` y `/resumen` | `Event.portalToken` | 200 | 404 / 404 | Acciones sobre invitadas de otro evento → NOT_FOUND, base intacta (PERM-180, PORT-015) | 404 (invitación, invitada, cotización, cápsula). Acciones con un token de otro tipo → NOT_FOUND (PERM-184, PERM-185) | Token viejo → 404 y el nuevo → 200. Acciones con el token rotado → NOT_FOUND (PERM-183) | PERM-074, PERM-075, PERM-160, PERM-161, PERM-164, PERM-165, PERM-180, PERM-183…185, PORT-003, PORT-015, EVT-031 | PASS |
| **Invitación general** ✔ `/e/[slug]/[token]` | `Event.inviteToken` | 200. **Ahora es seguro:** cada respuesta crea una invitada `SELF_RSVP` nueva y redirige sólo a *su* link personal (GST-013). Nunca toma, modifica ni revela a una invitada existente, aunque se escriba su nombre o su email (GST-014, GST-023). Las coincidencias quedan marcadas «Posible duplicado» con contexto para el equipo y la anfitriona (GST-023, GST-025). Máximo 60 invitadas (GST-021) y 10 respuestas por IP en 10 min (GST-024) | 404 / 404 | Slug de A + token de B → 404 (PERM-162). RSVP con la invitación de B → NOT_FOUND sin crear invitada (PERM-182) | 404 (portal, cotización) | Token viejo → 404 y los links personales siguen vigentes (PERM-165). Micrositio apagado → 404 (PERM-167) | PERM-068, PERM-160…165, PERM-167, PERM-182, GST-013, GST-014 (`@regression`), GST-017, GST-021, GST-023, GST-024, GST-025 | PASS. BUG-003 corregido (`e8165ae`, `760e7d2`) y verificado: GST-014 pasa en Chromium, Firefox y WebKit en la regresión final |
| **Invitación personal** `/e/[slug]/[token]` | `EventGuest.token` | 200. La dirección exacta sólo aparece tras confirmar; no se ven datos de otras invitadas (GST-018) | 404 / 404 | Slug de A + token personal de B → 404 (PERM-163). RSVP con el token personal de B → NOT_FOUND, su RSVP intacto (PERM-181) | 404 | No tiene rotación individual. Al eliminar a la invitada, su link se desactiva (GST-003) | PERM-163, PERM-164, PERM-181, GST-003, GST-011, GST-018, CRIT-004 | PASS. Ya no se puede obtener desde el link general (BUG-003 ✔): la respuesta del link general sólo contiene el token de la invitada recién creada |
| Calendario `/e/[slug]/[token]/calendar.ics` | invitación o invitada | 200 `text/calendar`; la dirección sólo para quien confirmó | 404 / 404 | 404 | — | 404 | PERM-171, GST-016 | PASS |
| **Cápsula** `/memory/[token]` | `MemoryCapsule.shareToken` | 200. Si no está publicada: vista borrador sin fotos ni mensajes (PERM-166) | 404 / 404 | La moderación con ids de otro evento → no encontrado (MEM-012) | 404 (portal) | Token viejo → 404 y el nuevo → 200 (PERM-166, MEM-004). Subir foto o firmar el libro con token rotado o cápsula no publicada → rechazo (PERM-186, PERM-188) | PERM-072, PERM-160, PERM-164, PERM-166, PERM-186, PERM-188, API-068, MEM-004, MEM-012, MEM-015…017, MEM-020 | PASS |
| **Pago: checkout** `/pago/mock/[checkoutId]` | id del checkout mock (`mock_cs_…`) | 200 | 404 / 404 | — | — | Un enlace de más de 1 h expira (PAY-015). Si el saldo cambió, el enlace viejo deja de valer (PAY-016). Una reserva cancelada no acepta pagos (PAY-017) | PERM-077, PERM-169, PAY-004, PAY-015…017, PAY-021, EVT-024 | PASS. Relacionado: BUG-002 (EVX-BUG-01 / SAL-BUG-03), ya corregido; ver la nota debajo de la tabla |
| **Pago: resultado** `/pago/resultado?p&s` | firma HMAC del pago | 200 con firma válida | 404 sin firma / 404 con firma alterada | 404 con la firma de otro pago | — | — | PERM-078, PERM-168, PAY-008, PAY-014 | PASS |
| Portal sin token `/mi-evento` | — | «Solicitar acceso» da una respuesta neutral; el enlace sólo se envía a correos registrados. Lo escrito antes de hidratar no se borra y el correo nunca termina en la URL (PORT-021, PORT-023) | formato inválido rechazado en el formulario y en el backend | — | — | — | PORT-005, PORT-006, PORT-021, PORT-023 | PASS |

Cabeceras y formato:

- Todas las rutas por token, válidas o inválidas, envían `X-Robots-Tag: noindex, nofollow` y `Referrer-Policy: same-origin`. El sitio público usa `strict-origin-when-cross-origin`, sin `X-Robots-Tag` (PERM-170, PUB-019).
- Los tokens malformados (cortos, con traversal, con inyección o con unicode) responden 404 sin error 500 (PERM-161).
- **404 real.** Con un slug o token inexistente, las 8 rutas públicas y por token (`/experiencias/[slug]`, `/cotizacion`, `/mi-evento` y su `/resumen`, `/e`, `/memory`, `/pago/mock` y `/pago/resultado`) responden HTTP 404, no un soft-404. Lo cubren NAV-034 (`not-found.spec.ts`) y el contrato estático `tests/unit/route-not-found-contract.test.ts` (BUG-013 y su revisión, `4a7a780`).
- **Sin datos personales en la URL.** Antes de hidratar, ningún formulario por token se envía por GET: RSVP, acceso al portal, dirección, mensajes y opinión. El botón queda deshabilitado con `aria-busy` y el formulario lleva `method="post"`. El nombre, el correo, la dirección, el mensaje y el comentario no terminan en la URL ni, por tanto, en el historial ni en el `Referer` (GST-028, PORT-023…025, `d96a82a`).

**BUG-002 (relacionado, corregido):** en la auditoría, un checkout abierto antes de cancelar el evento todavía se podía cobrar (PAY-021 y EVT-024 en FAIL). Era un defecto del ciclo de vida del pago, no un bypass del token. Ya está corregido (merge `be74647` y `445645c`):

- cancelar anula los checkouts abiertos;
- un cobro que la pasarela confirma después se registra para reembolso, sin reconfirmar el evento ni avisar a la clienta (PAY-023);
- `/pago/resultado` no promete «sin cobro» ni ofrece reintentar si se cancela mientras espera (PAY-024 y PAY-025).

PAY-021 y EVT-024 pasan en la regresión final; EVT-024 en Chromium, Firefox y WebKit.

---

## 5. Divergencias y controles

### 5.1 Divergencias de la auditoría: 4, todas corregidas y verificadas (0 abiertas)

| Bug | Severidad / prioridad | Control | Roles | Esperado | Observado en la auditoría (`f26b1a1`) | Corrección | Prueba `@regression` y verificación | Estado | Provisional |
|---|---|---|---|---|---|---|---|---|---|
| BUG-001 | CRITICAL / P0 | Logout (revocación de sesión) | Todos los del equipo (reproducido con OWNER y STAFF) | Tras «Cerrar sesión» no queda ninguna cookie válida y las páginas privadas → ↪ login | Las respuestas de requests que salieron antes del `POST /api/auth/signout` (prefetch RSC, otra pestaña) llegaban después con `Set-Cookie: authjs.session-token=<JWT nuevo>`. La sesión revivía y `/admin/customers` o `/staff` cargaban con datos. AUTH-032: 7/7; CRIT-014: 8/8 | `b24c695` (merge `d144ce7`): `User.sessionVersion` + revocación en `events.signOut`; el middleware ya no re-emite la cookie (sólo renueva en GET con ≥ 1 h). Endurecimiento `28fb8d3`: `/api/auth/session` tampoco la re-emite | AUTH-032, CRIT-014 y CRIT-012 (`@regression` BUG-001). Tras la corrección: 3/3 con `--retries=0` en Chromium, WebKit y móvil. **Regresión final:** AUTH-032 y CRIT-014 PASS en Chromium, Firefox y WebKit; CRIT-012 PASS en los 4 proyectos | **✔ Corregido y verificado** | ACC-BUG-01, TRV-BUG-06 |
| BUG-004 | HIGH / P1 | Invalidación de la sesión en el servidor | Todos los del equipo | Una cookie copiada antes del logout → 307 a `/login` (OWASP ASVS 3.3.1) | `GET /admin/customers` con la cookie previa → 200 con datos. El JWT valía 12 h y se renovaba en cada request | Misma revocación por `sessionVersion`, que se incrementa también al restablecer la contraseña, desactivar, cambiar el rol y eliminar una ficha con acceso. Restablecer la propia contraseña cierra la sesión actual (`ebb5fac` lo extiende a Staff) | AUTH-025 (`@regression` BUG-004), más AUTH-033…038 y AUTH-064, e integración (`settings-notifications`, `operations-staff`). Tras la corrección: AUTH-025 3/3; AUTH-033…038 5/5. **Regresión final:** todas PASS (carril 1, 571/571) | **✔ Corregido y verificado** | ACC-BUG-02 |
| BUG-005 | HIGH / P1 | Filtro anti open-redirect del `callbackUrl` | Quien abra un enlace de login manipulado | `/login?callbackUrl=%2F%09%2Fevil.example` se descarta → inicio del rol | `safeCallback` lo aceptaba. `x-action-redirect` llevaba `/<TAB>/evil.example`, que el navegador normaliza a `//evil.example`; el `pushState` se bloqueaba (SecurityError) y la app caía en «Application error» con la sesión ya creada | `ee67039` (merge `d144ce7`): `safeCallbackPath` puro (rechaza caracteres de control, espacios y `\`; normaliza con `new URL` y exige el mismo origen), usado en `loginAction`, en `/login` y en el callback `redirect` de Auth.js | AUTH-049 (`@regression` BUG-005) y AUTH-071, que manda el mismo valor directo a `loginAction`. 38 pruebas unitarias. Con una mutación a filtro por prefijo, AUTH-071 falla. **Regresión final:** AUTH-043…050 y AUTH-065…072 PASS en Chromium, Firefox y WebKit (AUTH-051 en Chromium) | **✔ Corregido y verificado** | ACC-BUG-03 |
| BUG-003 | CRITICAL / P0 | Autorización por token: link general de invitación | Invitada anónima con el link general | Una respuesta hecha con el link general no puede modificar a una invitada existente sin verificar que es ella, y nunca devuelve el token personal de otra | Bastaba escribir el nombre de otra invitada, sin email, para sobrescribir su RSVP (asistencia, restricciones, nota de alergia y comentario). Además redirigía a su link personal, con sus datos editables y, si respondía «Asiste», con la dirección exacta. 5/5 | `e8165ae` (merge `3964907`): se eliminó `findMatchingGuest` y cada respuesta del link general crea una `SELF_RSVP` nueva; «Posible duplicado» se deriva al leer y se audita. Endurecimiento `760e7d2`: la coincidencia muestra con quién coincide, se marca en ambos sentidos y se audita en la misma transacción | GST-014 (`@regression` BUG-003; conserva sus asserts y suma que la víctima queda intacta), más GST-023, GST-024 y GST-025, e integración `portal-rsvp`. Tras la corrección: 3/3 y 5/5. **Regresión final:** GST-014 PASS en Chromium, Firefox y WebKit; GST-023 y GST-025 PASS; GST-024 PASS en la suite `ratelimit` | **✔ Corregido y verificado** | EVX-BUG-03 |

#### Hallazgos de seguridad posteriores a la auditoría (endurecimiento)

La revisión adversarial de las correcciones encontró estos puntos. Ninguno queda abierto como divergencia.

| Hallazgo | Clasificación | Estado | Corrección y prueba |
|---|---|---|---|
| `deleteStaffMember` desactivaba la cuenta ligada sin aplicar las reglas de Usuarios: una OWNER podía desactivar a una SUPER_ADMIN, o a sí misma, borrando su ficha de staff | POTENTIAL SECURITY ISSUE · MEDIUM (reproducido 1/1) | Corregido (`ebb5fac`) | `checkLinkedAccountDeactivation` dentro de la transacción: FORBIDDEN o CONFLICT sin borrar nada. Sin «Eliminar integrante» sobre la propia ficha. Integración en `operations-staff.test.ts` (§3.2) |
| `GET /api/auth/session` (fuera del matcher) re-emitía la cookie de sesión en cada llamada: el mismo patrón que BUG-001 si algún día se usa el endpoint | APPLICATION BUG latente (la app no lo llama) | Corregido (`28fb8d3`) | `withoutSessionCookieRenewal` en el GET de `/session`. AUTH-059 `@regression`; con el handler original falla (mutación) |
| La renovación del JWT no tenía prueba automatizada | TEST GAP | Corregido | AUTH-053…058, con JWT forjados; con el middleware sin renovar, AUTH-053/054 fallan |
| AUTH-043…050 ya no ejercitaban la validación propia de `loginAction`, porque `/login` filtra antes | TEST GAP (cobertura) | Corregido | AUTH-065…072 |
| `resetStaffPassword` sobre la propia ficha revocaba la sesión en silencio | APPLICATION BUG (UX/sesión) | Corregido (`ebb5fac`) | AUTH-064 `@regression` + integración |
| El logout «falla abierto» si la base cae: Auth.js registra el error y borra la cookie igualmente | Riesgo | Mitigado | `revokeSessionsOnSignOut` registra `auth.logout_revocation_failed` (nivel error, alertable) y propaga el error. Prueba unitaria (§6) |

#### Causa raíz y corrección aplicada

El diagnóstico de la auditoría se conserva abajo como historial. Lo aplicado se resume en la tabla de §5.1 y está detallado en `docs/qa/findings/access.md` (Resolution) y `events.md` (EVX-BUG-03).

**BUG-001 y BUG-004 (misma causa raíz).** La sesión era 100 % JWT y no había revocación en el servidor.

Código responsable (en `f26b1a1`):

- `src/middleware.ts:16`: `auth()` re-emite la cookie en cada respuesta, incluidos los prefetch `?_rsc=`.
- `src/auth.config.ts:12`: JWT de 12 h, sin estado en el servidor.
- `src/components/admin/admin-shell.tsx:161` y `src/components/staff/staff-shell.tsx:38`: `signOut` sólo actúa en el cliente.
- `src/server/auth/session.ts:21-31`: `getCurrentUser` revalida `active` y `role`, pero no tiene ninguna marca de revocación.

Corrección aplicada (`b24c695`, migración aditiva `20261006140000_user_session_version`):

1. `User.sessionVersion` va en el JWT y `getCurrentUser` la compara con la base. Un token anterior al despliegue cuenta como versión 0, así que nadie pierde la sesión al desplegar.
2. El logout se revoca en el servidor con el evento `signOut` de Auth.js, que corre en `/api/auth/signout`, el endpoint del botón actual. Usa comparar e incrementar: una cookie ya revocada no puede cerrar sesiones nuevas (AUTH-038). `admin-shell` y `staff-shell` no cambian. Se descartó una Server Action de logout porque dejaría datos privados en la caché del router (AUTH-021).
3. La versión también se incrementa al restablecer la contraseña, desactivar, cambiar el rol y eliminar una ficha con acceso. Con eso se cierra también el riesgo «restablecer la contraseña no cierra sesiones» que la auditoría dejó como NOT TESTED; ahora lo cubren AUTH-033 y AUTH-034.
4. El middleware dejó de re-emitir la cookie en cada respuesta: sólo renueva el JWT en GET con ≥ 1 h y conserva los borrados. La renovación tiene prueba propia (AUTH-053…058).

Decisión de producto pendiente, documentada: cerrar sesión cierra **todas** las sesiones de la cuenta en todos los dispositivos (§6).

**BUG-005.** En la auditoría, `src/features/auth/server/actions.ts:17-22` validaba por prefijo de cadena y sólo rechazaba `//` y `/\` literales. La corrección aplicada (`ee67039`) sigue las 3 recomendaciones:

1. `safeCallbackPath` rechaza los caracteres de control (C0, DEL y C1), los espacios y `\`.
2. Normaliza con `new URL(url, origen ficticio)`, exige el mismo origen, descarta rutas que tras normalizar empiezan por `//` y devuelve `pathname + search + hash`.
3. El callback `redirect` de Auth.js (`safeRedirectUrl`) aplica la misma regla como defensa en profundidad.

Los 8 valores maliciosos de AUTH-043…050, entre ellos el TAB de AUTH-049, se descartan tanto por `/login` como escritos directo en `loginAction` (AUTH-065…072). CRIT-013 sigue en PASS.

**BUG-003.** La re-identificación era por nombre, sin ningún factor de posesión. Código responsable (en `f26b1a1`):

- `src/features/guests/domain/rsvp.ts:58-75`: `findMatchingGuest` empataba por nombre normalizado cuando no había email.
- `src/features/guests/server/rsvp-service.ts:72-96`: actualizaba a esa invitada y devolvía su `token`.
- `src/features/guests/server/actions.ts:17-24`: armaba `personalPath` con ese token.

Corrección aplicada (`e8165ae`, `760e7d2`): el link general **nunca** re-identifica a nadie, ni siquiera a invitadas `PENDING` sin contacto.

- Cada respuesta crea una `SELF_RSVP` con su propio token y la redirección usa sólo ese token.
- `findPossibleDuplicates` / `possibleDuplicateMatches` marcan la coincidencia por nombre o email en ambos sentidos, con «Coincide con «…»». La marca se deriva al leer, sin cambios de esquema.
- El cupo de 60 invitadas aplica a toda respuesta, dentro del lock del evento.
- Si la coincidencia es una invitada `HOST`+`PENDING`, el portal le sugiere a la anfitriona quitar ese registro (GST-025).

Costo aceptado: una invitada real que ignora su link personal queda como un segundo registro marcado. Pendientes de producto: recuperar el link personal por correo o WhatsApp y un tope opcional de auto-registros.

### 5.2 Controles que pasaron

| Control | Qué se verificó | Pruebas | Resultado |
|---|---|---|---|
| **Escalada OWNER→SUPER_ADMIN** | Con request forzado, OWNER no puede crear ni promover cuentas SUPER_ADMIN ni modificar el rol, estado o contraseña de una existente (FORBIDDEN, base intacta), y la UI oculta esas acciones. SUPER_ADMIN sí puede. OWNER administra cuentas OWNER y STAFF sin sobre-restricción. Nadie cambia su propio rol ni se desactiva. | PERM-140…143, PERM-156, SET-013…018 | **PASS** |
| **IDOR de staff** | STAFF sólo ve sus eventos asignados no cancelados. Un evento ajeno abierto por URL → 404 sin datos. El replay sobre tareas de eventos no asignados, de otra persona, SKIPPED o con evidencia ajena → FORBIDDEN con la base intacta, y staff2 no puede reutilizar los requests de staff. Las evidencias sólo se suben a eventos asignados. Las 6 acciones de admin expuestas en el portal → FORBIDDEN. El portal no muestra montos. | PERM-100…127, API-067, STF-001, STF-002, STF-006, STF-008, STF-009, STF-023, CRIT-005 | **PASS** |
| **Sesión y revocación** (nuevo) | El logout revoca en el servidor y una respuesta en vuelo no revive la sesión. Una cookie copiada antes del logout → ↪ login. Restablecer la contraseña, cambiar el rol, desactivar (también eliminando la ficha de staff) y el reset propio revocan las sesiones abiertas. Reactivar no revive la cookie vieja. Una cookie revocada no cierra sesiones nuevas. El JWT sólo se renueva en GET con ≥ 1 h. `/api/auth/session` no re-emite la cookie. | AUTH-025, AUTH-032, AUTH-033…038, AUTH-053…059, AUTH-064, CRIT-012, CRIT-014; integración `settings-notifications`, `operations-staff` | **PASS** (BUG-001 y BUG-004 ✔) |
| **Tokens** | Tokens inexistentes o malformados → 404 genérico sin error 500, con HTTP 404 real (NAV-034). Se probaron otro evento u otro slug, otro tipo y tokens rotados (portal, invitación y cápsula): el viejo → 404 y el nuevo funciona. Las acciones públicas con token ajeno, rotado o de otro tipo → NOT_FOUND sin escritura. El link general de invitación ya no re-identifica por nombre ni por email. También se verificaron la firma de `/pago/resultado`, el micrositio apagado, las cabeceras `noindex` y `Referrer-Policy`, y que ningún formulario por token deja datos personales en la URL. | PERM-160…171, PERM-180…188, PORT-003, PORT-015, PORT-023…025, QPUB-010, GST-014, GST-016, GST-017, GST-023, GST-028, MEM-012, MEM-017, NAV-034, PAY-004, PAY-007, PAY-008 | **PASS**, sin excepciones (BUG-003 ✔) |
| **CSRF** | Una Server Action con cookie válida y `Origin` ajeno se rechaza sin escribir. `/api/media/upload` y `/api/memory/[token]/upload` sin `Origin` o con `Origin` ajeno → 403. `/api/analytics/track` sin `Origin`, con `Origin` ajeno o con `Sec-Fetch-Site: cross-site` → 403. El callback de Auth.js sin token CSRF no crea sesión. | PERM-159, API-040, API-051, API-062, API-068, MEM-015 | **PASS** (la Server Action rechazada responde HTTP 500; ver §6) |
| **Webhooks** | Firma ausente, inválida, con otro secreto, malformada o vencida (más de 300 s) → 400 sin efecto. El mismo evento repetido se aplica una sola vez (`duplicate:true`). Proveedor desconocido → 404; más de 256 KB → 413. Un pago inexistente se registra sin efectos. `payment.failed`, los reembolsos y los cobros por debajo del monto llevan a estados correctos e idempotentes. | API-030…035, PAY-009…013 | **PASS** |
| **Cuenta ligada a una ficha de staff** (nuevo) | Eliminar una ficha ligada a una SUPER_ADMIN (siendo OWNER) o a la propia cuenta → FORBIDDEN o CONFLICT, sin borrar nada. Una SUPER_ADMIN sí puede. | Integración `operations-staff.test.ts`; PERM-126, STF-016, STF-017 | **PASS** |
| Otros controles en PASS | Secreto de cron (API-020…022). Revalidación de la sesión por estado o rol (AUTH-027…029, STF-021 ³, §3.2). Cookie falsificada (AUTH-024). Límite de intentos de login (AUTH-060…063). Límite de frecuencia en acciones públicas (API-080, API-081) y en el RSVP del link general (GST-024). URLs firmadas de media (API-060, API-061). Exportaciones CSV por rol (API-070…072). Todas las variantes de `callbackUrl` (AUTH-043…050, AUTH-065…072, CRIT-013). Las capturas públicas no escriben el contacto de una clienta existente (CONF-021, PUB-048). | — | **PASS** |

---

## 6. Observaciones (no son divergencias)

- **Permiso latente de STAFF.** STAFF tiene `inventory:read`, que habilita las 5 páginas `/admin/inventory*`, pero el middleware le cierra `/admin`. Hoy no hay impacto. Conviene decidir si se quita el permiso o si se documenta que es intencional (REQUIREMENT AMBIGUITY): si alguien relajara el middleware, STAFF vería el inventario completo.
- **Validación antes de autorizar.** En `protectedAction`, Zod valida antes de autorizar (`src/server/action.ts:71-74`). Un anónimo que llama a una acción protegida con datos inválidos recibe `VALIDATION_ERROR` con los mensajes de campo, lo que revela el esquema. Se recomienda autenticar y autorizar antes de validar.
- **Acciones co-ubicadas.** `/memory/[token]` incluye las 7 acciones de administración de la cápsula y `/staff/events/[id]` las 6 de administración de staff. Hoy el RBAC las frena (PASS), pero conviene separar las acciones públicas y las de admin en módulos distintos.
- **CSRF con HTTP 500.** Next 15.5 rechaza la Server Action con `Origin` ajeno respondiendo **HTTP 500** con `digest` en lugar de un 4xx, lo que ensucia las alertas de 5xx.
- **Bloqueo de cuentas ajenas.** El límite de login es sólo por correo (`src/auth.ts:39`): cualquiera puede bloquear 15 min una cuenta conocida. Considerar un límite combinado de correo + IP y un desbloqueo por admin.
- **Confianza en `X-Real-Ip`.** `clientIp()` (`src/lib/rate-limit.ts:55`) confía en `X-Real-Ip`. Es correcto detrás de Traefik; sin proxy, los límites por IP se evaden. Hay que documentarlo en el despliegue.
- **Promoción con sesión abierta.** Una STAFF promovida a OWNER sigue en `/staff` hasta volver a iniciar sesión, porque el middleware usa el rol del JWT. Es un detalle de UX sin riesgo (AUTH-029).
- **Documentación desalineada (sigue igual).** `docs/SECURITY.md` dice `Referrer-Policy: no-referrer` en las páginas por token, pero el middleware envía `same-origin`, y `/cotizacion/[token]` además declara `<meta name="referrer" content="no-referrer">`.
- **Cierre de sesión global (decisión de producto pendiente).** `sessionVersion` es una por cuenta. «Cerrar sesión» en un dispositivo cierra las sesiones de esa cuenta en todos los demás, y ningún texto de la UI lo dice. Si se quiere un cierre por dispositivo, la alternativa documentada en `access.md` es revocar por `jti` y dejar `sessionVersion` para el reset, la desactivación y el cambio de rol. Efecto en las pruebas: las cuentas DEMO compartidas no pueden cerrar sesión en E2E, por eso CRIT-009/011/012/014 y AUTH-025/032/033…038 usan cuentas propias.
- **El logout falla abierto si la base cae (mitigado).** Si el `updateMany` de la revocación falla, Auth.js registra el error y borra la cookie igualmente; una copia de la cookie seguiría valiendo hasta 12 h. Hoy se registra `auth.logout_revocation_failed` con nivel error (alertable). Cerrarlo del todo exige reemplazar el flujo `/api/auth/signout` de Auth.js.
- **`GET /api/auth/session` con una cookie revocada (riesgo residual bajo).** Ya no re-emite la cookie (AUTH-059), pero todavía decodifica un JWT revocado y devuelve el nombre, el correo y el rol de su dueña, porque Auth.js no conoce `sessionVersion`. La app no llama ese endpoint y toda la autorización pasa por `getCurrentUser`. Cerrarlo requiere un callback `jwt`/`session` que consulte la base.
- **«Eliminar integrante» sobre la ficha de una SUPER_ADMIN.** La página `/admin/staff/[id]` oculta el botón sólo sobre la propia ficha. A una OWNER se lo sigue ofreciendo sobre una ficha ligada a una SUPER_ADMIN, aunque el servidor siempre lo rechaza con FORBIDDEN. Es un detalle de UX sin riesgo: el control vive en el servidor.
- **Duplicados del link general (costo aceptado de BUG-003).** Una invitada real que responde por el link general en lugar de su link personal queda como un segundo registro marcado «Posible duplicado». Sólo el equipo puede quitar un `SELF_RSVP`; la anfitriona sí puede quitar su propio registro `HOST`+`PENDING`. Los recordatorios no se omiten automáticamente: de lo contrario, quien conozca un nombre podría silenciar los recordatorios de esa invitada.
- **Cobertura de replay.** No todas las acciones protegidas tuvieron replay negativo individual. 13 de los 26 grupos de permiso (87 de 148 acciones) se sostienen con la evidencia positiva de Owner y la barrera común verificada, sin replay negativo propio (§3.1). Para regresión conviene generar el replay negativo por acción desde el inventario.

## 7. Trazabilidad

Columna «Auditoría»: corrida de `f26b1a1`. Columna «Regresión final»: corrida secuencial del 2026-10-07 sobre `b47437b` con todos los navegadores (`test-results/l<n>/results.json`, más las suites `global` y `ratelimit`).

| Carril | Pruebas de permisos y autorización | Auditoría | Regresión final |
|---|---|---|---|
| 1 · Acceso (`access-coverage.md`) | PERM: 148 (83 de páginas + PERM-090 + 64 de backend y tokens) · AUTH: 68 (46 + 22 nuevas: AUTH-033…038, AUTH-053…059, AUTH-064…072) · API: 41 | PERM 148/148 PASS · AUTH 43 PASS y 3 FAIL (AUTH-025 → BUG-004, AUTH-032 → BUG-001, AUTH-049 → BUG-005) · API 41/41 PASS | **571/571 ejecuciones PASS**, 0 flaky (Chromium, Firefox y WebKit). PERM 148/148, AUTH 68/68 (AUTH-060…063 en la suite `ratelimit`, 12/12) y API 41/41. AUTH-025, AUTH-032, AUTH-049 y AUTH-071 `@regression` en PASS |
| 2 · Ventas (`sales-coverage.md`) | QPUB-006…010, QPUB-013, CONF-014, CONF-015, CONF-017, CONF-021, AI-009, PAY-004, PAY-007…017, PAY-021, PAY-023…025, PUB-048 | PASS (PAY-021 FAIL → BUG-002, de ciclo de vida, no de permisos) | 140/140 PASS. PAY-021 y PAY-023…025 (BUG-002 ✔), CONF-021 y PUB-048 en PASS |
| 3 · Comercial (`commercial-coverage.md`) | QUO-014, QUO-027, LEAD-022, CUST-011, CUST-012, CAT-020 | PASS | 135/135 PASS |
| 4 · Eventos (`events-coverage.md`) | GST-003, GST-005, GST-006, GST-010, GST-013, GST-014, GST-016…018, GST-021, GST-023…025, GST-028, EVT-031, EVT-034, MEM-004, MEM-011, MEM-012, MEM-015…017, MEM-020, PORT-003, PORT-005, PORT-013, PORT-015, PORT-023…025 | PASS · **GST-014 FAIL → BUG-003** | Las de autorización, todas en PASS: GST-014 en Chromium, Firefox y WebKit (BUG-003 ✔); GST-024 en la suite `ratelimit`. Sólo quedan inestabilidades ajenas a permisos: EVT-005 flaky en Firefox, y MEM-021 en WebKit omitida por NOT APPLICABLE |
| 5 · Operaciones (`operations-coverage.md`) | STF-001…009, STF-018…021, STF-023, SET-013…018, SET-022, FIN-011 (+ integración de `deleteStaffMember`) | PASS | STF-021 falló en WebKit (³ en §3.2; Chromium y Firefox PASS). El resto de las pruebas de autorización del carril, en PASS. Inestabilidades de Firefox y WebKit en corrección |
| 6 · Transversal (`transversal-coverage.md`) | CRIT-005, CRIT-009, CRIT-011, CRIT-012, CRIT-013, CRIT-014, SMK-035 | PASS · **CRIT-014 FAIL → BUG-001** (Chromium y WebKit) · Firefox BLOCKED (ENV-02) | 171/171 PASS. CRIT-014 en Chromium, Firefox y WebKit y CRIT-012 en los 4 proyectos (BUG-001 ✔). Firefox ya corre (ENV-02 superado) |
