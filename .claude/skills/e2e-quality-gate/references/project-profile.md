# Perfil del proyecto — Ivonne & Rosa

Hechos verificados del sistema bajo prueba. Si el código contradice algo de aquí, **manda el código**: actualiza este archivo y anótalo en el informe. El inventario vivo está en `docs/qa/.discovery/inventory.json` (lo regenera `discover.mjs`).

Contenido: [Stack](#stack) · [Roles](#roles-y-permisos) · [Rutas](#rutas-por-zona) · [Recorridos críticos](#recorridos-críticos-p0) · [Seed](#datos-del-seed-demo) · [Proveedores](#proveedores-y-flags) · [Comportamientos conocidos](#comportamientos-conocidos-que-afectan-a-las-pruebas) · [Candidatos](#hallazgos-candidatos-de-revisiones-previas)

## Stack
Next.js 15.5 App Router (React 19, `params` como Promise), Server Actions envueltas en `protectedAction` / `publicAction` (`src/server/action.ts`, devuelven `ActionResult` `{ ok, data } | { ok:false, error:{ code, message, fieldErrors?, errorId? } }`), Prisma 6 + PostgreSQL 16, Auth.js v5 (Credentials + JWT; `getCurrentUser` re-valida `active` y `role` contra la base en cada request), Zod 3, Tailwind 4 + shadcn/ui, sonner para toasts. Copy en español de México. Dinero en centavos MXN; porcentajes en bps; zona `America/Mexico_City`.

## Roles y permisos
Fuente: `src/server/auth/permissions.ts` (48 permisos).

| Rol | Cuenta E2E (`ACCOUNTS`) | Acceso |
|---|---|---|
| SUPER_ADMIN | `superadmin` | Todo |
| OWNER | `owner` (Ivonne), `owner2` (Rosa) | Todo **excepto** `roles:assign_super_admin` (no puede crear ni promover SUPER_ADMIN) |
| STAFF | `staff` (Lupita, asignada a "Cumpleaños de Sofía" y "Karaoke & Mimosas de Daniela"), `staff2` (Carlos) | `events:read_assigned`, `checklists:update_assigned`, `media:upload`, `inventory:read` — sólo `/staff` |
| CUSTOMER | — (no hay login) | Accede por **token** (cotización, portal, invitación, cápsula) |
| Anónimo | `anonPage()` / `apiAs(null)` | Sitio público, configurador, contacto, enlaces con token válido |

Barreras:
1. **Middleware** (`src/middleware.ts`): `/admin*` exige SUPER_ADMIN/OWNER; `/staff*` exige SUPER_ADMIN/OWNER/STAFF; sin sesión → `/login?callbackUrl=<ruta>`; STAFF en `/admin` → `/staff`; otro rol → `/sin-acceso`. Agrega `X-Robots-Tag: noindex` en zonas privadas y `Referrer-Policy: same-origin` en rutas con token.
2. **Página**: `requirePagePermission("<permiso>")` en cada página admin (ver inventario).
3. **Acción**: `protectedAction({ permission })` re-valida sesión + permiso en servidor; `publicAction` valida esquema + rate limit.
4. **Datos**: STAFF sólo eventos asignados (`StaffAssignment`); tokens sólo dan acceso a su propio evento/cotización/invitada.

## Rutas por zona
- **Pública** `(public)`: `/`, `/experiencias`, `/experiencias/[slug]`, `/como-funciona`, `/nuestra-historia`, `/contacto`, `/privacidad`, `/terminos`, `/crear-experiencia` (configurador), `/crear-experiencia/ai` (diseñador IA, flag).
- **Experiencia por token** `(experience)` (noindex): `/cotizacion/[token]`, `/pago/mock/[checkoutId]`, `/pago/resultado`, `/mi-evento` (solicitar acceso), `/mi-evento/[token]`, `/mi-evento/[token]/resumen`, `/e/[slug]/[token]` (+ `calendar.ics`), `/memory/[token]`.
- **Auth**: `/login`, `/sin-acceso`.
- **Admin** (61 páginas): dashboard, leads, customers, catalog (experiences, menus, addons, styles, areas, budgets), quotes (+ print), events (+ guests, operations, financials, memory), calendar, operations (+ templates), inventory (+ events, conflicts), purchases, vendors, staff, finance (+ export CSV), analytics, notifications, content (faq, gallery), settings (availability, pricing, notifications, flags, integrations, users, audit).
- **Staff**: `/staff`, `/staff/events/[id]`.
- **API**: `/api/health`, `/api/health/db`, `/api/media/upload` (sesión + origen + rate limit), `/api/media/[id]` (URL firmada), `/api/memory/[token]/upload` (token + origen + rate limit), `/api/analytics/track` (origen + rate limit), `/api/admin/leads-export` (sesión), `/api/events/[id]/guests.csv` (sesión), `/admin/finance/export` (sesión), `/api/cron/notifications` (secreto `CRON_SECRET`), `/api/webhooks/payments/[provider]` (firma + idempotencia `WebhookEvent`), `/api/auth/*` (Auth.js).

Server Actions por módulo (169; nombres y permisos exactos en el inventario): ai-designer, auth, bookings, catalog, configurator, content, customers, events, financials, guests, inventory, leads, marketing, memory-capsule, notifications, operations, payments, portal, purchases, quotes, settings, staff, users, vendors.

## Recorridos críticos (P0)
Verifica la base en cada paso; los textos exactos de botones/mensajes se leen de la UI real.
1. **Configurador → lead**: anónima elige experiencia, fecha disponible, invitadas y extras; ve estimación calculada en servidor (sin costos internos); envía datos → `Lead` + `Customer` (busca o crea por email/teléfono) + timeline + notificación → aparece en `/admin/leads`.
2. **Contacto → lead** (formulario de contacto público).
3. **Lead → cotización → envío**: OWNER crea cotización (precios del `QuoteEngine`, descuento con permiso y auditoría), la envía (`SENT`, token público, notificación).
4. **Cotización por token → aceptar → pago**: clienta abre `/cotizacion/[token]`, acepta (estado de la cotización, booking/evento creado), inicia checkout de anticipo (proveedor mock) → `/pago/mock/[checkoutId]` → resultado → pago `PAID` → evento confirmado (`onEventConfirmed`: portal, checklists, notificaciones). Rechazo también es P0 (estado `REJECTED`, sin evento).
5. **Portal de la clienta** `/mi-evento/[token]`: ver evento, pagos pendientes, invitadas (agregar/quitar), preferencias, dirección, mensajes, reseña tras el evento.
6. **RSVP de invitada** `/e/[slug]/[token]`: confirmar/declinar, persistencia, reflejo en `/admin/events/[id]/guests`.
7. **Staff**: login → `/staff` muestra sólo eventos asignados → detalle → marcar tareas del checklist → persiste; evento no asignado ⇒ 404/denegado.
8. **Login/logout/barreras** por rol (incluye usuario desactivado y cambio de rol con sesión abierta).
9. **Pago manual / reembolso** (payments:manual) con auditoría y saldo del evento.
10. **Cierre del evento** (events:close) con costos y finanzas.

## Datos del seed DEMO
El global-setup re-siembra la base del carril en **cada** invocación de Playwright. Fuente: `prisma/seed.ts` y `prisma/seed-data/*`. Constantes en `tests/e2e/fixtures/accounts.ts` (`ACCOUNTS`, `PASSWORD`, `TOKENS`).

| Clave | Qué es | Uso en pruebas |
|---|---|---|
| `TOKENS.quoteLucia` | Cotización "Cumpleaños de Lucía" en `SENT` | Sólo lectura (no aceptar: compartido) |
| `TOKENS.portalSofia` / `inviteSofia` / `micrositeSofia` | Evento "Cumpleaños de Sofía" `CONFIRMED` (staff Lupita, Carlos, Roberto) | Lectura del portal / micrositio |
| `TOKENS.guestCamila` | Invitada Camila del evento de Sofía | Lectura de RSVP |
| `TOKENS.portalFernandaPendingPayment` | "Baby Brunch de Fernanda" `PENDING_PAYMENT` | Lectura de saldo pendiente |
| `TOKENS.portalValeriaCompleted` / `memoryValeria` | "Perú x México de Valeria" `COMPLETED` + cápsula | Lectura de cápsula/reseña |

Otros eventos: "Bridal Brunch de Mariana" (`CONFIRMED`), "Karaoke & Mimosas de Daniela" (`PLANNING`, Lupita asignada), "Signature Brunch de Ana Paula" (`COMPLETED`). Leads en todos los estados (NEW, CONTACTED, QUALIFIED, QUOTED, WON, LOST). Cotizaciones ACCEPTED, SENT, REJECTED, vencidas.

**Para mutar, crea datos propios** con las factories (`tests/e2e/fixtures/data.ts`) o con Prisma (`db`) siguiendo las reglas del dominio (códigos con `generateCode`, tokens con `generateToken`, fechas con `dateOnly`). Si una factory que necesitas no existe, créala en `tests/e2e/<área>/_helpers.ts`. Para flujos con token (aceptar cotización, pagar, RSVP), crea primero la cotización/evento/invitada con Prisma o recorriendo la UI admin.

## Proveedores y flags
- Pagos: proveedor **mock** en E2E (`/pago/mock/[checkoutId]` simula aprobar/rechazar). Stripe/MercadoPago no se usan en el gate (servicio externo de pago ⇒ NOT APPLICABLE salvo instrucción).
- Email/WhatsApp: mock → todo queda en `NotificationLog` ("mock inbox" en `/admin/notifications`). Verifica notificaciones consultando `notificationLog` en la base.
- IA: proveedor mock (respuesta determinista).
- Almacenamiento: S3 local (RustFS :9000). Si no responde, las pruebas de subida quedan BLOCKED (ENVIRONMENT ISSUE).
- Flags (`Setting "flags"` en base, si no `env`; default true): `AI_DESIGNER_ENABLED`, `PAYMENTS_ENABLED`, `WHATSAPP_ENABLED`, `MEMORY_CAPSULE_ENABLED`. Cambiarlos es **estado global**: esas pruebas van en `*.global.spec.ts` (suite aparte, 1 worker) y restauran el valor al terminar.

## Comportamientos conocidos que afectan a las pruebas
- **Rate limit desactivado** en el servidor E2E normal (`RATE_LIMIT_DISABLED=true`). Las pruebas de rate limit van en `*.ratelimit.spec.ts` y corren con `E2E_SUITE=ratelimit` (carril 9, limitador encendido).
- **`notFound()` bajo `loading.tsx` puede responder HTTP 200** en páginas admin con streaming: valida el contenido (p. ej. encabezado de no encontrado como "Esta mesa no está puesta" o el `not-found.tsx` del segmento), no sólo el status. Si el status importa (SEO/seguridad), regístralo como hallazgo LOW/MEDIUM con evidencia.
- **Replay de Server Actions (Next 15.5)**: una acción enviada a una ruta cuya página no la importa **no se ejecuta** (200 con `{}` → outcome `not-executed`). Para probar el RBAC de la acción, repítela contra **su misma ruta** con un rol que pase el middleware pero no tenga el permiso (OWNER vs `roles:assign_super_admin`), o con IDOR dentro del área permitida (staff con evento no asignado, token de otro evento). Ver test-design §Autorización.
- **CSRF**: route handlers con efectos verifican `isSameOrigin` (Origin/Referer/Sec-Fetch-Site). Peticiones sin `Origin` o con origen ajeno deben fallar (403).
- **Server Actions y cabecera Origin**: Next rechaza acciones cuyo `Origin` no coincide con el host.
- Las fechas del seed son relativas a "hoy" (zona CDMX): no fijes fechas absolutas; usa `@/lib/dates` o calcula días hacia adelante.
- En Windows usa Git Bash o `pnpm.cmd`; la build standalone se desactiva en E2E (`NEXT_STANDALONE=false`).

## Hallazgos candidatos de revisiones previas
Sospechas de las revisiones de módulos. **No son bugs hasta reproducirlos** con una prueba:
- Cancelar un evento podría dejar abiertos pagos `PENDING` de checkout.
- El enlace general de invitación permite "emparejar por nombre": una invitada podría sobrescribir el RSVP de otra escribiendo su nombre.
- La exportación CSV antepone apóstrofo a teléfonos con "+" (protección contra inyección de fórmulas; ¿esperado?).
- `notFound()` con HTTP 200 en admin (ver arriba).
- El detalle del lead no muestra el diseño de la IA.
- El configurador usa su propio id de sesión para analytics.
- Recordatorios RSVP manuales no comparten la llave de deduplicación del programador.
- Cambios de catálogo (invitadas, extras) en un evento reservado no recalculan precio ni inventario.
- El encabezado del evento no muestra insignia "Cerrado".
- La notificación sembrada `STAFF_ASSIGNED` apunta a `/staff/eventos/<id>` (la ruta real es `/staff/events/<id>`): verificar si el código de la app genera el mismo enlace.
