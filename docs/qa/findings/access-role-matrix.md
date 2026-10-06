# Paquete 1 — Acceso y seguridad · ROLE_PERMISSION_MATRIX (observada)

Fuente: anotaciones `matriz` de `tests/e2e/permissions/page-matrix.spec.ts` (última corrida, carril 1). Cada celda: **esperado / observado** (HTTP sin seguir redirects, cookies de la sesión del rol).
Símbolos: ✅ 200 · ↪ login = 307 a `/login?callbackUrl=<ruta>` · ↪ /staff = 307 a /staff · ↪ /admin = 307 al inicio del rol · ⛔ sin-acceso · 404. Divergencias en **negrita**.
Además de HTTP, cada fila valida la UI con el rol principal de la zona (admin→owner, staff→staff, resto→anónimo): sin redirección, encabezado visible, sin pantalla de error y sin errores de consola/red.

## Páginas (83)

| ID | Ruta | Zona | Permiso | Anónimo | Staff | Owner | SuperAdmin | Resultado |
|---|---|---|---|---|---|---|---|---|
| PERM-001 | `/` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-002 | `/admin` | admin | dashboard:view | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-003 | `/admin/analytics` | admin | analytics:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-004 | `/admin/calendar` | admin | events:read_all | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-005 | `/admin/catalog` | admin | catalog:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-006 | `/admin/catalog/addons` | admin | catalog:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-007 | `/admin/catalog/addons/[id]` | admin | catalog:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-008 | `/admin/catalog/addons/new` | admin | catalog:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-009 | `/admin/catalog/areas` | admin | catalog:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-010 | `/admin/catalog/budgets` | admin | catalog:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-011 | `/admin/catalog/experiences/[id]` | admin | catalog:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-012 | `/admin/catalog/experiences/new` | admin | catalog:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-013 | `/admin/catalog/menus` | admin | catalog:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-014 | `/admin/catalog/menus/[id]` | admin | catalog:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-015 | `/admin/catalog/menus/new` | admin | catalog:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-016 | `/admin/catalog/styles` | admin | catalog:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-017 | `/admin/content` | admin | content:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-018 | `/admin/content/faq` | admin | content:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-019 | `/admin/content/gallery` | admin | content:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-020 | `/admin/customers` | admin | customers:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-021 | `/admin/customers/[id]` | admin | customers:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-022 | `/admin/events` | admin | events:read_all | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-023 | `/admin/events/[id]` | admin | events:read_all | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-024 | `/admin/events/[id]/financials` | admin | financials:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-025 | `/admin/events/[id]/guests` | admin | guests:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-026 | `/admin/events/[id]/memory` | admin | memory:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-027 | `/admin/events/[id]/operations` | admin | operations:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-028 | `/admin/events/new` | admin | events:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-029 | `/admin/finance` | admin | financials:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-030 | `/admin/inventory` | admin | inventory:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-031 | `/admin/inventory/[id]` | admin | inventory:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-032 | `/admin/inventory/conflicts` | admin | inventory:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-033 | `/admin/inventory/events` | admin | inventory:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-034 | `/admin/inventory/events/[eventId]` | admin | inventory:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-035 | `/admin/leads` | admin | leads:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-036 | `/admin/leads/[id]` | admin | leads:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-037 | `/admin/notifications` | admin | notifications:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-038 | `/admin/operations` | admin | operations:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-039 | `/admin/operations/templates` | admin | operations:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-040 | `/admin/operations/templates/[id]` | admin | operations:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-041 | `/admin/purchases` | admin | purchases:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-042 | `/admin/purchases/[id]` | admin | purchases:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-043 | `/admin/purchases/new` | admin | purchases:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-044 | `/admin/quotes` | admin | quotes:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-045 | `/admin/quotes/[id]` | admin | quotes:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-046 | `/admin/quotes/[id]/print` | admin | quotes:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-047 | `/admin/quotes/new` | admin | quotes:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-048 | `/admin/settings` | admin | settings:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-049 | `/admin/settings/audit` | admin | audit:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-050 | `/admin/settings/availability` | admin | settings:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-051 | `/admin/settings/flags` | admin | settings:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-052 | `/admin/settings/integrations` | admin | settings:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-053 | `/admin/settings/notifications` | admin | settings:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-054 | `/admin/settings/pricing` | admin | settings:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-055 | `/admin/settings/users` | admin | users:manage | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-056 | `/admin/staff` | admin | staff:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-057 | `/admin/staff/[id]` | admin | staff:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-058 | `/admin/staff/new` | admin | staff:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-059 | `/admin/vendors` | admin | vendors:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-060 | `/admin/vendors/[id]` | admin | vendors:read | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-061 | `/admin/vendors/[id]/edit` | admin | vendors:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-062 | `/admin/vendors/new` | admin | vendors:write | ↪ login / ↪ login | ↪ /staff / ↪ /staff | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-063 | `/como-funciona` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-064 | `/contacto` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-065 | `/cotizacion/[token]` | experience | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-066 | `/crear-experiencia` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-067 | `/crear-experiencia/ai` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-068 | `/e/[slug]/[token]` | experience | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-069 | `/experiencias` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-070 | `/experiencias/[slug]` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-071 | `/login` | auth | — | ✅ / ✅ | ↪ /staff / ↪ /staff | ↪ /admin / ↪ /admin | ↪ /admin / ↪ /admin | PASS |
| PERM-072 | `/memory/[token]` | experience | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-073 | `/mi-evento` | experience | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-074 | `/mi-evento/[token]` | experience | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-075 | `/mi-evento/[token]/resumen` | experience | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-076 | `/nuestra-historia` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-077 | `/pago/mock/[checkoutId]` | experience | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-078 | `/pago/resultado` | experience | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-079 | `/privacidad` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-080 | `/sin-acceso` | root | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-081 | `/staff` | staff | events:read_assigned | ↪ login / ↪ login | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-082 | `/staff/events/[id]` | staff | events:read_assigned | ↪ login / ↪ login | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS |
| PERM-083 | `/terminos` | public | — | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | PASS |

## Acciones (backend, replay) — esperado / observado

Barreras: middleware (`/admin` sólo SUPER_ADMIN/OWNER, `/staff` + STAFF) → `protectedAction` (sesión re-validada en base + permiso) → reglas del servicio (IDOR/asignación). 🔒 = denegado por el backend (`FORBIDDEN`/`UNAUTHORIZED`/`NOT_FOUND` o redirect del middleware) **y la base no cambió**. "no ejecutada" = Next no ejecuta la acción en una página que no la importa.

| Acción (permiso) | Ruta del replay | Anónimo | Staff | Owner | SuperAdmin | Pruebas |
|---|---|---|---|---|---|---|
| `createUserAction` con role=SUPER_ADMIN (`roles:assign_super_admin`) | /admin/settings/users | — | — | 🔒 / 🔒 FORBIDDEN | ✅ / ✅ | PERM-140 |
| `changeUserRoleAction` → SUPER_ADMIN | /admin/settings/users | 🔒 / 🔒 ↪ login | 🔒 / 🔒 ↪ /staff | 🔒 / 🔒 FORBIDDEN | ✅ / ✅ | PERM-141, PERM-156 |
| rol/estado/contraseña de una cuenta SUPER_ADMIN | /admin/settings/users | — | — | 🔒 / 🔒 FORBIDDEN (UI oculta acciones) | ✅ / ✅ | PERM-142 |
| administrar OWNER/STAFF (`users:manage`) | /admin/settings/users | — | — | ✅ / ✅ (auditado) | — | PERM-143 |
| `recordManualPaymentAction` (`payments:manual`) | /admin/events/[id] | 🔒 / 🔒 ↪ login | 🔒 / 🔒 ↪ /staff | ✅ / ✅ pago PAID + auditoría | — | PERM-150 |
| `refundPaymentAction` (`payments:manual`) | /admin/events/[id] | 🔒 / 🔒 | 🔒 / 🔒 | — | — | PERM-151 |
| `saveQuotePricingAction` con descuento (`quotes:discount`) | /admin/quotes/[id] | 🔒 / 🔒 | 🔒 / 🔒 | ✅ / ✅ `quote.discount_applied` | — | PERM-152 |
| `cancelEventAction` (`events:cancel`) | /admin/events/[id] | 🔒 / 🔒 | 🔒 / 🔒 | ✅ / ✅ CANCELLED + auditoría | — | PERM-153 |
| `closeEventAction` (`events:close`) | /admin/events/[id]/financials | 🔒 / 🔒 | 🔒 / 🔒 | — | — | PERM-154 |
| `rotateEventTokenAction` (`events:write`) | /admin/events/[id] | 🔒 / 🔒 | 🔒 / 🔒 | ✅ / ✅ token viejo → 404 | — | PERM-155, PERM-165 |
| ajustes negocio/precios/flags (`settings:write`) | /admin/settings… | 🔒 / 🔒 | 🔒 / 🔒 | — (estado global) | — | PERM-157 |
| acción admin enviada a `/staff/events/[id]` o `/` | otra página | no ejecutada / no ejecutada | no ejecutada / no ejecutada | — | — | PERM-158 |
| Server Action con `Origin` ajeno (CSRF) | /admin/events/[id] | — | — | 🔒 / 🔒 rechazada, sin escritura | — | PERM-159 |
| `markAllNotificationsReadAction` con usuaria desactivada | /admin/notifications | — | — | 🔒 / 🔒 UNAUTHORIZED | — | AUTH-027 |
| `setUserActiveAction` con OWNER degradada a STAFF (JWT viejo) | /admin/settings/users | — | — | 🔒 / 🔒 FORBIDDEN | — | AUTH-028 |
| `staffUpdateChecklistItemAction` tarea de evento NO asignado (IDOR) | /staff/events/[asignado] | 🔒 / 🔒 ↪ login | 🔒 / 🔒 FORBIDDEN | — | — | PERM-110, PERM-113, PERM-115 |
| … tarea de otra persona / SKIPPED / evidencia ajena | /staff/events/[id] | — | 🔒 / 🔒 | — | — | PERM-111, PERM-112, PERM-114 |
| 6 acciones de admin de staff expuestas en el portal (`staff:write`, `users:manage`) | /staff/events/[id] | — | 🔒 / 🔒 FORBIDDEN | ✅ / ✅ | — | PERM-120…127 |
| 7 acciones de admin de cápsula expuestas en la página pública (`memory:write`, `media:moderate`) | /memory/[token] | 🔒 / 🔒 UNAUTHORIZED | 🔒 / 🔒 FORBIDDEN | ✅ / ✅ | — | PERM-130…138 |

## Route handlers (API)

| Endpoint | Anónimo | Staff | Owner | Otras barreras | Pruebas |
|---|---|---|---|---|---|
| `GET /api/admin/leads-export` | 401 / 401 | 403 / 403 | 200 CSV / 200 | fórmulas neutralizadas, auditoría `leads.exported` | API-070 |
| `GET /api/events/[id]/guests.csv` | 401 / 401 | 403 / 403 | 200 / 200 (404 si no existe) | fórmulas neutralizadas, `guests.exported` | API-071 |
| `GET /admin/finance/export` | ↪ login / ↪ login | ↪ /staff / ↪ /staff | 200 / 200 | `finance.exported` | API-072 |
| `POST /api/media/upload` | 401 / 401 | 403 salvo evidencia de evento asignado / igual | 200 / 200 | Origin ajeno/ausente 403, magic bytes 422, tamaño 422 | API-062…067 |
| `GET /api/media/[id]` privado | firma vigente requerida (403 sin/ inválida / vencida / de otro archivo) | ídem | ídem | público libre; id inválido 404 | API-060, API-061 |
| `POST /api/memory/[token]/upload` | Origin ajeno 403; sin consentimiento 400; cápsula no publicada 403; token inexistente 404 | — | — | archivo privado + `approved=false` | API-068, PERM-188 |
| `POST /api/analytics/track` | sin Origin / ajeno / cross-site 403 | — | — | 400/413 por cuerpo | API-040…042 |
| `/api/cron/notifications` | sin/secreto incorrecto 401 | — | — | secreto correcto 200 idempotente | API-020…022 |
| `POST /api/webhooks/payments/mock` | sin firma / firma inválida / vencida 400 | — | — | repetido → `duplicate:true` (1 efecto) | API-030…035 |
| `/api/auth/*` | session `null`; callback sin CSRF no crea sesión | — | session sin hash | providers = credentials | API-050…052 |

## Enlaces por token

| Ruta | Válido | Inexistente | Malformado | De otro evento | Otro tipo de token | Rotado | Pruebas |
|---|---|---|---|---|---|---|---|
| `/cotizacion/[token]` | 200 | 404 genérico | 404 | — | 404 (portal/invitación) | — | PERM-160, 161, 164 |
| `/mi-evento/[token]` (+ `/resumen`) | 200 | 404 | 404 | — | 404 (invitación, invitada, cotización, cápsula) | 404 (nuevo 200) | PERM-160, 161, 164, 165 |
| `/e/[slug]/[token]` | 200 (general y personal) | 404 | 404 | 404 (slug A + invitación/invitada de B) | 404 (portal, cotización) | 404 (personales siguen) | PERM-162, 163, 164, 165, 167 |
| `/e/[slug]/[token]/calendar.ics` | 200 text/calendar | 404 | 404 | 404 | — | — | PERM-171 |
| `/memory/[token]` | 200 (no publicada: vista borrador sin fotos/mensajes) | 404 | 404 | — | 404 (portal) | 404 (nuevo 200) | PERM-160, 164, 166 |
| `/pago/mock/[checkoutId]` | 200 | 404 | 404 | — | — | — | PERM-169 |
| `/pago/resultado?p&s` | 200 con firma válida | 404 sin firma | 404 firma alterada | 404 firma de otro pago | — | — | PERM-168 |
| Acciones públicas (portal, RSVP, libro de visitas, cotización) con token/ID ajeno, de otro tipo o rotado | ✅ (control positivo) | NOT_FOUND | — | NOT_FOUND, base intacta | NOT_FOUND | NOT_FOUND | PERM-180…188 |

Cabeceras: todas las rutas por token (válidas e inválidas) envían `X-Robots-Tag: noindex, nofollow` y `Referrer-Policy: same-origin`; el sitio público `strict-origin-when-cross-origin` sin `X-Robots-Tag` (PERM-170).

## Sesión y autenticación (resumen)

| Escenario | Esperado | Observado | Prueba |
|---|---|---|---|
| Login válido × 5 cuentas | inicio del rol, cookie httpOnly/Lax | ✅ | AUTH-001…005 |
| Contraseña incorrecta vs. usuario inexistente | mismo mensaje y mismo DOM | ✅ | AUTH-006, 007 |
| Usuaria desactivada / rol CUSTOMER / sin contraseña | mensaje genérico, sin sesión | ✅ | AUTH-010…012 |
| Logout (sin requests en vuelo) | cookie eliminada, privadas → login | ✅ | AUTH-020, 021, 026, 030 |
| **Logout con requests en vuelo** | sesión cerrada | **❌ sesión revive (ACC-BUG-01)** | AUTH-032 |
| **Cookie copiada antes del logout** | rechazada | **❌ 200 (ACC-BUG-02)** | AUTH-025 |
| Desactivar / degradar con sesión abierta | siguiente request sin acceso (páginas y acciones) | ✅ | AUTH-027, 028 |
| callbackUrl interno / staff → /admin | respetado / → /staff | ✅ | AUTH-040…042 |
| callbackUrl externos (`https://`, `//`, `/\`, `\\`, `javascript:`, `%2F%2F`, `user@host`) | no sale del origen | ✅ | AUTH-043…048, 050 |
| **callbackUrl `/\t/evil.example`** | descartado | **❌ intento de navegación a evil.example + "Application error" (ACC-BUG-03)** | AUTH-049 |
| Fuerza bruta login (8 + bloqueo, por cuenta, sin enumeración, normalizado) | bloqueo 15 min | ✅ | AUTH-060…063 (suite ratelimit) |
