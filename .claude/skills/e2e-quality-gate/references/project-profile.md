# Perfil del proyecto — Ivonne & Rosa

Hechos verificados del sistema bajo prueba. Si el código contradice algo de aquí, **manda el código**: actualiza este archivo y anótalo en el informe. El inventario vivo está en `docs/qa/.discovery/inventory.json` (lo regenera `discover.mjs`).

Contenido: [Stack](#stack) · [Roles](#roles-y-permisos) · [Rutas](#rutas-por-zona) · [Recorridos críticos](#recorridos-críticos-p0) · [Seed](#datos-del-seed-demo) · [Proveedores](#proveedores-y-flags) · [Comportamientos conocidos](#comportamientos-conocidos-que-afectan-a-las-pruebas) · [Candidatos](#hallazgos-candidatos-de-revisiones-previas)

## Stack
Next.js 15.5 App Router (React 19, `params` como Promise), Server Actions envueltas en `protectedAction` / `publicAction` (`src/server/action.ts`, devuelven `ActionResult` `{ ok, data } | { ok:false, error:{ code, message, fieldErrors?, errorId? } }`), Prisma 6 + PostgreSQL 16, Auth.js v5 (Credentials + JWT; `getCurrentUser` re-valida `active`, `role` y `sessionVersion` contra la base en cada request; ver [Sesión](#sesión-revocación-y-renovación)), Zod 3, Tailwind 4 + shadcn/ui, sonner para toasts. Copy en español de México. Dinero en centavos MXN; porcentajes en bps; zona `America/Mexico_City`.

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
- **`notFound()` bajo `loading.tsx` puede responder HTTP 200** en páginas admin con streaming: valida el contenido (p. ej. encabezado de no encontrado como "Esta mesa no está puesta" o el `not-found.tsx` del segmento), no sólo el status. En `/admin/**/[id]` y `/staff/events/[id]` es una observación conocida (zona con sesión y `noindex`), no un bug. Las rutas públicas y por token sí devuelven **404 real** (BUG-013): validan en su `layout.tsx` antes de cualquier límite de carga, y `tests/unit/route-not-found-contract.test.ts` falla si un `loading.*` o `<Suspense>` ancestro las vuelve a envolver. Un 200 ahí es regresión.
- **Replay de Server Actions (Next 15.5)**: una acción enviada a una ruta cuya página no la importa **no se ejecuta** (200 con `{}` → outcome `not-executed`). Para probar el RBAC de la acción, repítela contra **su misma ruta** con un rol que pase el middleware pero no tenga el permiso (OWNER vs `roles:assign_super_admin`), o con IDOR dentro del área permitida (staff con evento no asignado, token de otro evento). Ver test-design §Autorización.
- **4xx en consola**: Chromium repite cada respuesta 4xx como error de consola; el guard la clasifica como observación 4xx (con URL), no como violación. Declara con `guard.allow()` sólo errores de consola/5xx esperados.
- **CSRF**: route handlers con efectos verifican `isSameOrigin` (Origin/Referer/Sec-Fetch-Site). Peticiones sin `Origin` o con origen ajeno deben fallar (403).
- **Server Actions y cabecera Origin**: Next rechaza acciones cuyo `Origin` no coincide con el host.
- Las fechas del seed son relativas a "hoy" (zona CDMX): no fijes fechas absolutas; usa `@/lib/dates` o calcula días hacia adelante.
- En Windows usa Git Bash o `pnpm.cmd`; la build standalone se desactiva en E2E (`NEXT_STANDALONE=false`).
- Particularidades de Firefox y WebKit (cookies, fuentes abortadas, recargas, `networkidle`): test-design §[Recetas cross-browser](test-design.md#recetas-cross-browser).

### Navegación del App Router: mitigación de BUG-006
**Causa** (no es código de la app): un ping perdido en el reconciliador de React `19.2.0-canary-0bdb9206`, el que trae Next 15.5.27. Sólo en el build de producción, se quedaban colgadas estas transiciones: navegar a la misma ruta cambiando `searchParams` (calendario, filtros, paginación), `router.refresh()` y las Server Actions que revalidan. La URL y la UI no cambiaban. Está **mitigado, no corregido de raíz**. `src/instrumentation-client.ts` instala la mitigación en el navegador antes de hidratar y reenvía `onRouterTransitionStart(url, tipo)`:
- `src/lib/rsc-response-buffer.ts` (puro): **A**, entrega a React las respuestas RSC (`text/x-component`) ya completas; **B**, si otra navegación empezó después de un *lazy fetch*, le entrega un payload vacío (`f: []`) para descartarlo.
- `src/lib/navigation-guard.ts` (puro): red de seguridad, y recuperación con `router.refresh()` al volver con Atrás/Adelante a una URL cuyo lazy fetch se descartó ([SET-023]; [SET-024] es el control).
- `src/components/navigation/navigation-guard.ts`: el instalador, el único módulo con efectos globales. Envuelve `window.fetch`, observa `<head>` y usa temporizadores. `navigation-guard-bridge.tsx` (montado en el layout raíz) le entrega el router.

**Red de seguridad.** Vigila los push/replace hacia **otra** URL. Si la navegación no se confirma (la URL sigue igual y no empezó otra navegación) y la red lleva 5 s en reposo (sin RSC en vuelo ni scripts u hojas de estilo cargando en `<head>`), hace `location.assign` o `location.replace` y emite `console.error("[navegación] La navegación a … no se confirmó …")`. El guard de E2E convierte ese error en FAIL, así que la red de seguridad no puede ocultar una regresión. **Nunca lo declares con `guard.allow`**: si aparece, volvió BUG-006 o hay un cuelgue nuevo, y hay que investigarlo. La recuperación de Atrás/Adelante emite `console.warn("[navegación] … se recupera con router.refresh()")`. Ése es esperado y no cuenta como error. No vigila Atrás/Adelante, `router.refresh()` ni Server Actions. Límites documentados:
- una redirección HTTP que vuelve a la URL de partida se vería como «no confirmada» (hoy no hay ningún camino en la app que llegue ahí);
- el lazy fetch descartado de un *layout* no se recupera.

**Costo:** las navegaciones del cliente ya no se pintan por partes; el HTML inicial sigue en streaming. `net::ERR_ABORTED` es benigno, así que una prueba de navegación debe afirmar la URL y el contenido, no la ausencia de errores.

**Criterio de retiro:** la corrección real es facebook/react#36134. La traen **Next ≥ 16.3.0** y react-dom 19.3.0; ninguna 15.5.x la tiene. Subir sólo `react`/`react-dom` no sirve, porque el App Router usa el React que Next trae incluido. Es una actualización mayor que decide el usuario. Al hacerla, quitar `installNavigationGuard` de `instrumentation-client` y `<NavigationGuardBridge />` del layout raíz. Después correr con `--repeat-each=5 --retries=0`: CAL-002, EVT-038, LEAD-037, INV-025, GST-011/012/015, CNT-022..024 (suite global), NOT-002, SET-001, SET-023/024 y CRIT-004. Detalle y evidencia en `docs/qa/findings/events.md` › EVX-BUG-02 › «Corrección (BUG-006)» y «Endurecimiento».

### Hidratación en Firefox: `<SegmentChildren>`
**Síntoma:** `pageerror` con React **#418** sólo en Firefox (PAY-001 y EVT-024 intermitentes). React descarta el HTML del servidor y vuelve a pintar todo en el cliente.

**Causa:** Next pasa el componente de `error.tsx` **por valor** al router del segmento. Si su chunk llega tarde (en Firefox pasa al venir de otra página con el resto de los chunks en caché), React suspende en el elemento HTML que envuelve `children`. Al reintentar, vuelve a reclamar el mismo nodo del DOM. Es un defecto de React, no de la app.

**Corrección:** `src/components/layout/segment-children.tsx` (un `Fragment` con `key`, sin DOM). Se aplica en los 7 layouts que tienen un `error.tsx` hermano y pintan `children` dentro de un elemento HTML: `(public)`, `(experience)/pago`, `admin` (vía `AdminShell`), `admin/catalog`, `admin/content`, `admin/events/[id]` y `admin/settings`. Los layouts por token de `(experience)` devuelven `children` directo, y `staff` no tiene `error.tsx`.

**Regresión:** [NAV-037..039] en `tests/e2e/navigation/hydration.spec.ts` retrasan sólo el chunk de `error.tsx` y exigen que el `<main id="contenido">` hidratado sea el mismo nodo que llegó del servidor.

Si aparece un #418 nuevo en Firefox, revisa primero si un layout nuevo o modificado pinta `children` sin `<SegmentChildren>`. El envoltorio se retira sólo cuando una versión de Next lo corrija y NAV-037..039 pasen en Firefox sin él.

### Formularios públicos y por token antes de hidratar
Un celular lento ve el HTML del servidor y puede escribir o enviar antes de que React hidrate. Eso producía dos defectos, ambos corregidos (commits `e2f3699` y `d96a82a`, más CRIT-008 y MEM-021 en la cápsula): lo escrito se borraba al hidratar, y el formulario se enviaba de forma nativa por **GET**, con nombre, correo, dirección o alergias en la URL (historial, logs, Referer). El patrón vigente tiene tres partes:
- `<SubmitButton waitForHydration>` (`@/components/forms/submit-button`, que usa `useHydrated` de `@/components/forms/use-hydrated`). Hasta hidratar, el botón queda deshabilitado y con `aria-busy="true"`, así que ni el clic ni Enter envían nada.
- `<form method="post">` sin `action`, más `<NoScriptNotice />`. Si algo se escapara, nunca sería un GET con datos.
- `useForm` sin `defaultValues` de cadena vacía en los campos de texto. react-hook-form escribe `""` en el DOM al registrar el campo y borraba lo ya escrito. Los valores guardados van como `defaultValue` del propio campo. Sólo conservan su default los campos que pueden empezar ocultos y que Zod exige aunque no se monten: el acompañante y las notas del RSVP ([GST-027]).

**Cubiertos:** contacto, RSVP, acceso a `/mi-evento`, mensajes, opinión, dirección (cuando llega abierta), diseñadora IA, el paso del configurador, el libro de visitas y la subida de la cápsula. **Sin riesgo:** lo que sólo existe tras un clic o dentro de un diálogo, los filtros del catálogo (un GET intencional, sin datos personales) y el login (Server Action).

**En pruebas:**
- Antes de hidratar, el estado correcto es «botón deshabilitado + `aria-busy` + `method="post"`». Un formulario público con el botón activo antes de hidratar es una regresión.
- Las pruebas normales esperan `toBeEnabled()` del botón antes de interactuar.
- El panel admin sigue con el patrón anterior (observación «Carrera de hidratación» en BUG_REPORT): sus pruebas esperan la hidratación (`gotoReady`) y eso no es un bug.
- Límite conocido: un `<textarea>` con valor guardado que se edita antes de hidratar vuelve al valor original (comportamiento de React).

Cómo escenificarlo: test-design §[Antes de hidratar](test-design.md#antes-de-hidratar).

### Sesión: revocación y renovación
**Revocación** (BUG-001/004). `User.sessionVersion` va en el JWT y `getCurrentUser` lo compara con la base; si difiere, no hay sesión. Se incrementa en estos casos:
- **logout**: hook `events.signOut` de `src/auth.ts` → `revokeSessionsOnSignOut`. Es un *compare-and-increment*, así que una cookie ya revocada no cierra sesiones más nuevas;
- restablecer la contraseña (Usuarios y Staff);
- desactivar la cuenta o cambiarle el rol;
- eliminar una ficha de staff ligada a una cuenta.

**El logout revoca todas las sesiones de la cuenta en todos los dispositivos.** Es el diseño actual; la revocación por sesión sigue pendiente de decisión. Restablecer la propia contraseña cierra también la sesión actual y lleva a `/login`.

En E2E, **nunca cierres sesión, restablezcas la contraseña, desactives ni cambies el rol de las cuentas DEMO** (`ACCOUNTS.*`): eso mata las sesiones compartidas (`tests/e2e/.auth/`) de todo el carril. Crea una cuenta propia con `createTeamUser` (`tests/e2e/permissions/_helpers.ts`), como CRIT-009/011/012/014 y AUTH-033..038.

**Renovación.** El middleware (`src/middleware.ts`) quita de todas las respuestas la re-emisión de la cookie de sesión y conserva los borrados. **Sólo renueva en GET** (de documento o RSC) cuando el JWT ya cumplió `session.updateAge` (1 h; `maxAge` es 12 h). Un POST, incluidas las Server Actions, nunca la re-emite. `/api/auth/session` está fuera del matcher, así que se protege por separado (`withoutSessionCookieRenewal`). Un `Set-Cookie` de sesión fuera del login, el logout o esa renovación es anómalo.

Riesgo documentado: si la base cae durante el logout, Auth.js borra la cookie igual («falla abierto») y se registra `auth.logout_revocation_failed`.

**Cobertura:** AUTH-025, AUTH-032..038, AUTH-053..059 (renovación con JWT forjado, ver test-design §[Autenticación](test-design.md#autenticación)), AUTH-064 y CRIT-012/014.

## Hallazgos candidatos de revisiones previas
Sospechas de las revisiones de módulos. **No son bugs hasta reproducirlos** con una prueba. La auditoría FULL (`f26b1a1`) y la ronda de corrección resolvieron así las de la lista original (BUG-IDs de `docs/qa/BUG_REPORT.md`):

| Candidato | Resolución |
|---|---|
| Cancelar un evento podría dejar abiertos pagos `PENDING` de checkout | **Bug: BUG-002 (CRITICAL), corregido.** `cancelEvent` anula bajo el candado de la reserva los checkouts abiertos (`FAILED`, «Evento cancelado.»), y la pasarela mock y `startCheckout` rechazan una reserva cancelada. Un cobro tardío de un proveedor real queda `PAID` con «Reembolso requerido», auditoría y alerta al equipo, sin confirmación a la clienta. Las sesiones de Stripe/MP se expiran (`expireCheckout`). Pruebas: EVT-024, PAY-021, PAY-023..025. Relacionado: **BUG-007** (dos checkouts simultáneos duplicaban el pago `PENDING`; PAY-019). |
| El link general de invitación «empareja por nombre» | **Bug: BUG-003 (CRITICAL), corregido.** El link general siempre crea una invitada `SELF_RSVP` nueva y nunca toma, modifica ni revela a otra. Los posibles duplicados se marcan en los dos lados («Posible duplicado» + «Coincide con…», auditoría `guest.possible_duplicate`). Pruebas: GST-014, GST-023, GST-025 y rate limit GST-024. |
| El CSV antepone apóstrofo a teléfonos con «+» | **No es bug.** Es la protección contra inyección de fórmulas de `toCsv`. Queda como REQUIREMENT AMBIGUITY abierta (BUG_REPORT › Observaciones). Desde BUG-008 todos los teléfonos se guardan como `+52…`, así que ahora aplica a todos (LEAD-030, GST-006). |
| `notFound()` con HTTP 200 en admin | **No es bug en admin/staff** (zona con sesión y `noindex`; es una observación). La misma causa en el sitio público sí fue **BUG-013 (LOW), corregido**: 404 real en `/experiencias/[slug]`, NAV-002 y PUB-016, más el contrato unitario y la prueba de 404 real en las rutas públicas y por token (`tests/e2e/navigation/not-found.spec.ts`). |
| El detalle del lead no muestra el diseño de la IA | **No es bug.** `/admin/leads/[id]` muestra el panel «Diseño con IA» (`AiDesignCard`) cuando el lead tiene diseños, y AI-002 verifica en base el vínculo lead↔diseño. Hueco de cobertura: ninguna E2E afirma ese panel en la UI. |
| El configurador usa su propio id de sesión para analytics | **No es bug** (diseño). El id es por pestaña y sirve para el embudo START/COMPLETE (CONF-023 PASS). |
| Los recordatorios RSVP manuales no comparten la llave de deduplicación del programador | **Sin resolver (NOT TESTED).** GST-007 verifica la deduplicación diaria por invitada y canal. Falta probar que coincida con la llave de `/api/cron/notifications`. |
| Cambiar invitadas o extras en un evento reservado no recalcula precio ni inventario | **Sin resolver (REQUIREMENT AMBIGUITY).** `updateEvent` sólo audita y no hay requisito escrito. |
| El encabezado del evento no muestra la insignia «Cerrado» | **Bug: BUG-015 (LOW), corregido** (FIN-007). |
| La notificación sembrada `STAFF_ASSIGNED` apunta a `/staff/eventos/<id>` | **Bug sólo del seed: BUG-016 (LOW), corregido.** La app ya generaba `/staff/events/<id>` (OPS-010, CRIT-005). Pruebas: NAV-015, NOT-007. |

Candidatos abiertos que dejaron las revisiones adversariales de la ronda de corrección. Siguen en el código; **no están reproducidos como bug**:
- El WhatsApp del negocio en Ajustes se valida con `/^\d{10,15}$/` y no con `normalizePhone`. Un número que la app considera inválido deja los botones `wa.me` sin destinatario.
- Una captura pública activa `marketingOptIn` de una clienta existente (`lead-intake.ts`). Es consentimiento de un tercero, y contradice la regla de que lo público no escribe en perfiles existentes.
- Un pago reservado sin `checkoutUrl` (el proceso cae entre reservar y publicar) sólo se limpia en el siguiente `startCheckout` de esa reserva; ningún cron lo cierra.
- Una OWNER ve «Eliminar integrante» en una ficha ligada a una SUPER_ADMIN, y el servidor lo rechaza.
- El contador «N/240» del perfil en la diseñadora IA queda desfasado si se escribe antes de hidratar. Es su `aria-describedby`.
- axe `link-name` en «Ver sitio» del panel a menos de 640 px, y `scrollable-region-focusable` a 390 px (tablas de operaciones/analytics, `<pre>` de integraciones, resumen del portal).
- El modo oscuro está preparado pero inactivo, y aún tiene superficies con fondo claro fijo.
