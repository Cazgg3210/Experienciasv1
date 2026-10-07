# Ivonne & Rosa — Guía para agentes y desarrolladores

Plataforma (commerce + operations + experience) para un negocio de experiencias íntimas en CDMX.
Modular monolith en Next.js. Todo el copy visible es **español de México**, cálido y premium.

## Stack (versiones fijas — NO agregar dependencias sin aprobación)
- Next.js **15.5** App Router + React 19, TypeScript strict. `params`/`searchParams` son **Promises** (`await params`).
- Prisma **6** + PostgreSQL 16 (`prisma/schema.prisma` es la fuente de verdad; no modificarla sin coordinación).
- Auth.js **v5 beta** (`next-auth@5`): Credentials + JWT. `src/auth.ts` (servidor) y `src/auth.config.ts` (edge/middleware).
- Zod **3**, React Hook Form + `@hookform/resolvers/zod`, Tailwind CSS **4**, shadcn/ui (estilo radix-nova, `src/components/ui/*`), lucide-react, sonner, date-fns 4 + `@date-fns/tz`.
- Vitest 3 (unit: `src/**/*.test.ts`, `tests/unit`; integración: `tests/integration` contra `TEST_DATABASE_URL`), Playwright (e2e: `tests/e2e`).

## Estructura y capas
```
src/app/(public)/...        sitio de marketing + configurador (layout con header/footer)
src/app/(experience)/...    páginas por token: /cotizacion, /pago, /mi-evento, /e, /memory (noindex)
src/app/(admin)/admin/...   panel (SUPER_ADMIN/OWNER)
src/app/(staff)/staff/...   portal staff (eventos asignados + checklists)
src/app/(auth)/login        login del equipo
src/app/api/...             route handlers (webhooks, media, cron, health, csv)
src/features/<modulo>/
  domain/      lógica pura y testeable (sin I/O)  -> *.test.ts al lado
  server/      servicios (I/O, Prisma), queries y actions ("use server")
  components/  UI del módulo
  schemas.ts   esquemas Zod compartidos cliente/servidor
src/server/    auth (permissions, session), action wrapper, audit, analytics, providers (infra)
src/lib/       utilidades puras (money, dates, tokens, codes, labels, errors, env, flags, csv, rate-limit)
src/components/ ui (shadcn), layout, feedback, data, forms, media, admin, staff, brand
```
- NO lógica de negocio en componentes React. Páginas (RSC) llaman queries de `features/*/server`.
- Servicios en `features/<m>/server/*-service.ts` reciben el actor explícito (`SessionUser`) para poder probarse en integración; las Server Actions (`actions.ts`) sólo validan, autorizan y delegan.

## Reglas de dominio
- **Dinero**: enteros en centavos MXN (`formatMXN(cents)` de `@/lib/money`). Porcentajes en **bps** (1600 = 16%).
- **Fechas**: zona de negocio `America/Mexico_City`. Usar `@/lib/dates` (`zonedDateTime`, `dateOnly`, `toDateKey`, `formatLongDate`, `formatShortDate`, `formatDateTime`, `localDateKey`, `daysUntil`). Columnas `@db.Date` se crean con `dateOnly("YYYY-MM-DD")`.
- **Precios**: SIEMPRE en servidor vía `@/features/quotes/server/pricing` (`estimateSelection`, `buildEngineInput`) que usa el `QuoteEngine` puro (`@/features/quotes/domain/quote-engine`). Nunca calcular precios en el cliente. `publicEstimate()` oculta costos/márgenes al público.
- **Estados**: usar las máquinas en `features/*/domain/*-status.ts` (`leadStatusMachine`, `quoteStatusMachine`, `eventStatusMachine`, `paymentStatusMachine`, `purchaseStatusMachine`) con `.assert(from, to)`.
- **Disponibilidad**: `@/features/bookings/server/availability-service` (`checkAvailability`, `getRangeAvailability`).
- **Leads entrantes**: `createInboundLead` de `@/features/leads/server/lead-intake` (busca/crea clienta, timeline, snapshot, notifica, analytics).
- **Ciclo de vida de eventos**: al confirmar un evento llamar `onEventConfirmed(eventId)` (`@/features/events/server/lifecycle`).
- **Etiquetas en español** de todos los enums + tonos de badge: `@/lib/labels` (p. ej. `EVENT_STATUS_LABELS`, `EVENT_STATUS_TONES`, `toOptions`).
- **Códigos legibles** (no secuenciales): `generateCode("L"|"Q"|"B"|"EV"|"P")`. **Tokens públicos**: `generateToken()` (256 bits) y validar con `isPlausibleToken` antes de consultar.
- **Configuración** editable: `getSettings("business"|"pricing"|"availability"|"notifications"|"flags")`. **Feature flags**: `isEnabled("AI_DESIGNER_ENABLED"|"PAYMENTS_ENABLED"|"WHATSAPP_ENABLED"|"MEMORY_CAPSULE_ENABLED")` de `@/lib/flags`.

## Seguridad (obligatorio)
- **RBAC server-side** con `@/server/auth/permissions` (`can(role, perm)`). Páginas admin: `await requirePagePermission("leads:read")` (de `@/server/auth/session`). Acciones: `protectedAction({ name, schema, permission }, handler)`; públicas: `publicAction({ name, schema, rateLimit }, handler)` (ambas en `@/server/action`, devuelven `ActionResult<T>`).
- Cliente: `handleActionResult(result, { form, success: "Guardado" })` de `@/components/forms/action-result` (toasts + errores por campo).
- Validar TODO input con Zod en servidor. Nunca exponer stack traces (el wrapper devuelve `errorId`).
- Acciones sensibles → `audit({ action: "quote.discount_applied", entityType, entityId, before, after, actor })` de `@/server/audit` (precio, descuento, cambio de evento, pago manual, cancelación, eliminación, roles).
- Accesos por token (clienta/invitada): nunca filtrar datos de otros eventos; responder 404 genérico a tokens inválidos; rate limit en acciones públicas.
- Route handlers con efectos: verificar `isSameOrigin(req)` (`@/lib/csrf`). Webhooks: verificar firma + idempotencia (`WebhookEvent`).
- Archivos: sólo vía `storeUpload` (`@/features/media/server/upload-service`) — valida magic bytes (JPG/PNG/WEBP/PDF) y tamaño; mostrar con `mediaUrl(asset)` / `signedMediaPath(id)` (`@/features/media/server/media-url`). UI: `<MediaUploader />` (`@/components/media/media-uploader`).
- Notificaciones: `notify(...)` / `notifyCustomer(...)` de `@/features/notifications/server/notification-service` (siempre deja `NotificationLog`; en dev es el "mock inbox").
- Analytics internos: `track("VIEW_EXPERIENCE" | ...)` de `@/server/analytics` (nunca lanza).
- Proveedores (pagos, email, WhatsApp, IA, storage): `@/server/providers` (`getPaymentProvider()`, etc.). Deep links WhatsApp: `whatsappLink(phone, text)`.
- **Sesiones**: revocar = `...REVOKE_ALL_SESSIONS` (incrementa `User.sessionVersion`; `@/features/auth/server/session-service`) en el mismo `update` que la causa (contraseña, desactivar, rol); `getCurrentUser` la compara en cada request. Logout con `signOut()` de next-auth/react (nunca una Server Action): `events.signOut` revoca todas las sesiones de la cuenta. Sólo el middleware re-emite la cookie de sesión (GET con JWT ≥ `updateAge`).

## UI / UX
- Público y portales: mobile-first, editorial, cálido (paleta ivory/sand/sage/olive/taupe/charcoal en `globals.css`: clases `bg-ivory`, `text-olive`, `bg-sand-soft`, `bg-sage-soft`, `text-taupe`, `font-heading`). Sin degradados excesivos ni estética SaaS genérica. CTA principal único por pantalla (`<Button size="xl">`).
- Admin: dashboard profesional, denso pero claro, misma paleta (nada de azules genéricos).
- Componentes compartidos: `PageHeader`, `Section` (`@/components/layout/page-header`), `EmptyState`, `PageSkeleton`, `CardsSkeleton`, `ConfirmDialog`, `StatusBadge`, `StatCard`, `CopyButton`, `Field`, `FormError`, `SubmitButton`, `Logo`.
- Cada ruta: estados vacío / carga (`loading.tsx`) / error (`error.tsx` o manejo inline). Toasts con sonner.
- **Formularios públicos / por token** (llegan en el HTML del servidor): `<SubmitButton waitForHydration>` y `<form method="post">` sin `action` + `<NoScriptNotice />` (si no, antes de hidratar se envían por GET con datos personales en la URL); `useForm` sin `defaultValues` de cadena vacía en campos de texto (borran lo escrito antes de hidratar; los valores guardados van como `defaultValue` del campo).
- **Layout con `error.tsx` en su carpeta** que pinta `children` dentro de un elemento HTML (`<main>`, `<div>`, `AdminShell`): envolver `children` en `<SegmentChildren>` (`@/components/layout/segment-children`). Sin él, Firefox falla la hidratación (React #418).
- **Navegación (BUG-006)**: no quitar, rodear ni duplicar el navigation guard (`src/instrumentation-client.ts`, `@/components/navigation/navigation-guard`, `@/lib/rsc-response-buffer`, `@/lib/navigation-guard`), ni envolver `window.fetch` por otro lado, sin leer su criterio de retiro en `src/lib/rsc-response-buffer.ts` (Next ≥ 16.3.0). Un `console.error("[navegación] …")` es una regresión, no ruido.
- Accesibilidad: landmarks, labels asociados (`<Field>`), foco visible, navegable con teclado, `aria-*`, contraste AA, respeta reduced-motion. Imágenes con `next/image` y `alt`.
- Responsive verificado en 375, 390, 768, 1024 y 1440 px.

## Desarrollo
- Servicios: `docker compose up -d` (Postgres 5432 + S3/RustFS 9000). `pnpm db:setup` = env + servicios + migraciones + bucket + seed.
- Comandos: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration` (prepara con `pnpm test:integration:prepare`), `pnpm test:e2e`.
- Varios dev servers en paralelo: `NEXT_DIST_DIR=.next-<nombre> pnpm next dev -p <puerto>` (detenerlos al terminar).
- Cuentas demo (sólo desarrollo, contraseña `Demo2026!`): superadmin@ivonne-rosa.test, ivonne@ivonne-rosa.test, rosa@ivonne-rosa.test (OWNER), staff@ivonne-rosa.test, staff2@ivonne-rosa.test (STAFF).

## QA End-to-End (Quality Gate)
- Skill `/e2e-quality-gate [full|smoke|critical|auth|permissions|regression|module <nombre>]` (`.claude/skills/e2e-quality-gate/`), ejecutada por el agente `qa-e2e-engineer` (`.claude/agents/`). Documentos en `docs/qa/`.
- E2E corre contra un build de producción local (:3200) y la base `*_e2e` re-sembrada por corrida — nunca dev ni producción. Carriles paralelos `E2E_LANE=1..9`; suites aparte `E2E_SUITE=global|ratelimit`.
- Pruebas: importar `test`/`expect` desde `tests/e2e/fixtures`; ID `[PREFIJO-NNN]` en el título y etiquetas `@P0..@P3`, `@module:<m>`; validar UI + base + recarga. Comandos: `pnpm qa:preflight`, `pnpm qa:discover`, `pnpm e2e:infra|smoke|critical|auth|permissions|regression`, `pnpm qa:gate`.
