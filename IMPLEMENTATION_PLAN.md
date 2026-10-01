# IMPLEMENTATION_PLAN — Ivonne & Rosa MVP

> Plataforma de commerce + operations + experience para experiencias íntimas llave en mano en CDMX
> (Polanco, Granada, Irrigación). "Tú reúne a las tuyas. Nosotras hacemos el resto."

## 1. Diagnóstico del repositorio

- Repositorio vacío al iniciar (sin código previo que preservar). Se creó desde cero con `create-next-app` 15.5.
- Entorno local: Windows 11, Node 24, Docker 29 (Postgres 16 + almacenamiento S3 compatible en contenedores).
- MinIO dejó de publicar imágenes en Docker Hub (2025); para desarrollo se usa **RustFS** (API S3 compatible).
  En producción el adapter funciona con DigitalOcean Spaces, Cloudflare R2, AWS S3 o MinIO propio.

## 2. Arquitectura propuesta

**Modular monolith** en Next.js (App Router) desplegado como un único contenedor Docker en Dokploy.

```
Navegador (público / clienta / invitada / equipo)
        │
        ▼
Next.js 15 (RSC + Server Actions + Route Handlers)  ── middleware (Auth.js edge: /admin, /staff)
  ├─ features/<módulo>/domain     lógica pura (QuoteEngine, disponibilidad, máquinas de estado, finanzas)
  ├─ features/<módulo>/server     servicios + queries + actions (Zod + RBAC + auditoría)
  ├─ features/<módulo>/components UI
  └─ server/providers             infraestructura intercambiable:
        PaymentProvider (Mock | Stripe | Mercado Pago)   EmailProvider (Mock | Resend)
        WhatsAppProvider (Mock+deep links | Cloud API)   AIProvider (Mock+reglas | Anthropic | OpenAI)
        StorageProvider (S3-compatible | Local dev)
        │
        ▼
PostgreSQL 16 (Prisma 6)            Bucket S3 (archivos)            Cron (Dokploy) → /api/cron/notifications
```

Capas: **UI** (componentes, sin reglas de negocio) → **application/services** (`server/*-service.ts`, reciben actor
explícito, transacciones) → **domain** (`domain/*.ts`, puro y probado) → **infrastructure** (`server/providers`, `db`).

## 3. ERD resumido

```
User 1─0..1 StaffMember            User 1─0..1 Customer
Customer 1─* Lead 1─0..1 ConfigurationSnapshot ; Lead 1─* LeadActivity ; Lead *─0..1 BudgetRange
Experience *─* Style | ServiceArea | Menu | AddOn ; Experience 1─* ExperienceCostComponent | ExperienceImage | Faq
Menu 1─* MenuItem ; AddOn 1─* AddOnInventoryRequirement ; Experience 1─* ExperienceInventoryRequirement
Lead 1─* Quote 1─* QuoteItem ; Quote 1─0..1 Booking 1─1 Event ; Booking 1─* Payment (Payment 1─* Payment refunds)
Event 1─* EventAddOn | EventGuest | EventMessage | EventTimelineItem | EventChecklistItem | StaffAssignment
Event 1─* InventoryReservation | InventoryMovement | Purchase | EventCost | MediaAsset ; Event 1─0..1 MemoryCapsule | Review
ChecklistTemplate 1─* ChecklistTemplateItem 1─* EventChecklistItem
InventoryItem 1─* InventoryReservation | InventoryMovement ; Vendor 1─* Purchase
AvailabilityRule (7 días) ; AvailabilityException (fechas) ; Setting (config JSON validada con Zod)
WebhookEvent (idempotencia) ; NotificationLog ; AnalyticsEvent ; AuditLog ; AiDesign ; RateLimitBucket
```

Convenciones: IDs `cuid`, `createdAt/updatedAt`, índices por estado/fecha, únicos en tokens/códigos/slugs,
dinero en **centavos** (Int), porcentajes en **bps**, JSON sólo para snapshots (configuración, cotización,
cierre financiero, IA, auditoría) y configuración.

## 4. Mapa de rutas

| Zona | Rutas |
|---|---|
| Público | `/`, `/experiencias`, `/experiencias/[slug]`, `/nuestra-historia`, `/como-funciona`, `/contacto`, `/privacidad`, `/terminos`, `/crear-experiencia`, `/crear-experiencia/ai` |
| Clienta (token) | `/cotizacion/[token]`, `/pago/mock/[checkoutId]`, `/pago/resultado`, `/mi-evento`, `/mi-evento/[token]`, `/mi-evento/[token]/resumen` |
| Invitada (token) | `/e/[slug]/[token]`, `/memory/[token]` |
| Equipo | `/login`, `/staff`, `/staff/events/[id]` |
| Admin | `/admin`, `/admin/leads(/[id])`, `/admin/customers(/[id])`, `/admin/catalog/*`, `/admin/quotes(/new,/[id])`, `/admin/events(/new,/[id],/[id]/guests,/[id]/operations,/[id]/financials,/[id]/memory)`, `/admin/calendar`, `/admin/operations(/templates)`, `/admin/inventory(/*)`, `/admin/purchases(/*)`, `/admin/vendors(/*)`, `/admin/staff(/*)`, `/admin/finance`, `/admin/content`, `/admin/analytics`, `/admin/notifications`, `/admin/settings(/*)` |
| API | `/api/health`, `/api/health/db`, `/api/auth/*`, `/api/webhooks/payments/[provider]`, `/api/media/upload`, `/api/media/[id]`, `/api/memory/[token]/upload`, `/api/analytics/track`, `/api/cron/notifications`, `/api/events/[id]/guests.csv` |

## 5. Matriz de roles (RBAC centralizado en `src/server/auth/permissions.ts`)

| Capacidad | SUPER_ADMIN | OWNER | STAFF | CUSTOMER | GUEST |
|---|:-:|:-:|:-:|:-:|:-:|
| Dashboard, leads, clientes, catálogo, cotizaciones | ✔ | ✔ | — | — | — |
| Descuentos / cambios de precio | ✔ | ✔ | — | — | — |
| Pagos manuales / reembolsos | ✔ | ✔ | — | — | — |
| Eventos (todos), calendario, operaciones | ✔ | ✔ | sólo asignados | — | — |
| Checklists | ✔ | ✔ | tareas propias / sin asignar de sus eventos | — | — |
| Inventario, compras, proveedores, staff | ✔ | ✔ | inventario (lectura) | — | — |
| Finanzas, analytics, auditoría, configuración | ✔ | ✔ | — | — | — |
| Usuarios y roles | ✔ | ✔ (no crea SUPER_ADMIN) | — | — | — |
| Portal `/mi-evento/[token]` | — | — | — | ✔ (token) | — |
| Micrositio + RSVP + Memory Capsule | — | — | — | ✔ | ✔ (token) |

CUSTOMER y GUEST no usan contraseña: acceso por **tokens de 256 bits** (magic links), rotables desde admin.

## 6. Módulos

auth · customers · leads · catalog · configurator · quotes (QuoteEngine) · bookings (disponibilidad) · payments ·
events · guests/RSVP · portal · operations (checklists) · inventory · vendors · purchases · staff · financials ·
media · memory-capsule · notifications · analytics · settings (+ feature flags) · content · users · audit · ai-designer.

## 7. Fases (orden de implementación)

1. **Foundation** — proyecto, auth, DB/schema, design system, layouts, seed, roles. ✅
2. **Catalog** — experiencias, menús, add-ons, estilos, zonas, presupuestos.
3. **Public** — marketing, configurador, leads.
4. **Sales** — cotizaciones, clientas, aceptación.
5. **Payments** — provider, webhook idempotente, booking.
6. **Client Experience** — portal, micrositio, RSVP.
7. **Operations** — eventos, checklists, staff.
8. **Inventory / Vendors** — inventario, proveedores, compras.
9. **Financials** — costos, márgenes, cierre.
10. **Memory** — fotos, cápsula.
11. **AI** — diseñador, reglas, provider.
12. **Hardening** — pruebas (unit, integración, E2E), seguridad, documentación de despliegue.

Las fases 2–11 se construyeron en paralelo por módulos con propiedad de archivos disjunta, sobre contratos
compartidos definidos en la fase 1 (QuoteEngine, disponibilidad, captura de leads, ciclo de vida de eventos,
pipeline de archivos, proveedores), seguidas de una auditoría independiente por módulo y QA integral.

## 8. Decisiones técnicas (no bloqueantes, tomadas y documentadas)

| Decisión | Motivo |
|---|---|
| Next.js 15.5 (no 16) | Máxima compatibilidad con Auth.js v5 beta y ecosistema estable; Next 16 cambia middleware/caché. |
| Prisma 6 (no 7) | Prisma 7 exige driver adapters y config nueva; 6 es estable con `migrate deploy` en Docker. |
| Zod 3 | Compatibilidad plena con `@hookform/resolvers` y shadcn. |
| Auth.js Credentials + JWT para el equipo; **tokens** para clientas/invitadas | Las clientas no deben crear cuenta; el portal es un magic link rotatable + recuperación por email. |
| Booking (comercial) + Event (operativo) 1:1; el estado vive en `Event.status` | Una sola fuente de verdad de estado; Booking guarda términos aceptados y montos. |
| Evento se crea al aceptar la cotización en `PENDING_PAYMENT`; se confirma con el webhook del anticipo | Reserva la fecha (capacidad) mientras se paga; nunca se confía en el redirect del navegador. |
| RSVP integrado en `EventGuest` (estado + respuestas) y restricciones como enum array | Menos joins, consultas simples para cocina. |
| Rate limit persistido en PostgreSQL | Funciona con varias réplicas sin Redis; Redis queda como mejora futura. |
| Uploads proxied por la app (validación magic bytes) a S3 privado + URLs firmadas | Seguridad (no SVG/HTML), sin CORS, sin filesystem efímero. |
| Pagos: `MockPaymentProvider` con webhook firmado HMAC real + adapters Stripe y Mercado Pago listos | Demo sin credenciales con el mismo contrato que producción. |
| IVA incluido en precios (configurable) | Práctica B2C en México (PROFECO); margen se calcula sobre ingreso neto. |
| Costos de menú = costo completo de platillos por persona (se suma a componentes no-menú de la experiencia) | Costeo transparente por categoría. |
| Imágenes placeholder SVG de marca; arquitectura `MediaAsset` real | Demo inmediata sin depender de servicios externos. |
| Notificaciones registradas en `NotificationLog` (mock inbox) + cron HTTP protegido | Sin worker/Redis en V1; Dokploy Schedules invoca el endpoint. |
| RustFS en desarrollo | MinIO ya no distribuye imágenes públicas. |

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación en el producto |
|---|---|
| Operación demasiado personalizada | Regla 70/20/10 reflejada en catálogo (experiencias base + add-ons + notas); personalización premium como add-on. |
| Margen desconocido | Componentes de costo por experiencia, margen estimado en cada cotización con alerta bajo mínimo, costeo real por evento (compras, staff, comisiones, costos manuales) y cierre con snapshot. |
| Logística | Zonas de servicio con tarifa/costo, buffers, capacidad por día, bloqueos y horarios. |
| Dependencia de fundadoras | Checklists por fases con plantillas, orden de producción imprimible, portal de staff. |
| Inventario insuficiente | Reservas por evento desde requerimientos y alertas de faltantes por fecha. |
| Pagos y cancelaciones | Webhook idempotente y firmado, política visible y aceptada, reembolsos auditados. |
| Sobreconstrucción | Cada módulo atado a un flujo operativo medible; IA con fallback a reglas. |
| Privacidad (alergias, fotos) | Datos mínimos, consentimiento de fotos, tokens no adivinables, noindex, aviso de privacidad. |

## 10. Preguntas (no bloqueantes — se decidió y documentó)

1. **Nombre definitivo de la marca**: se usa "Ivonne & Rosa" configurable en Configuración → Negocio.
2. **Proveedor de pagos**: Mercado Pago vs Stripe — ambos implementados detrás de `PaymentProvider`; demo con Mock.
3. **Política de cancelación definitiva**: texto editable en Configuración (default razonable incluido).
4. **Número de WhatsApp Business y dominio**: variables de entorno / configuración.
5. **Textos legales**: borradores incluidos; validar con asesor legal en México.
