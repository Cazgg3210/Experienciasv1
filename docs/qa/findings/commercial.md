# Hallazgos — Paquete 3 «Comercial admin» (carril 3)

**Modo:** FULL (paquete 3/6) · **Carril:** `E2E_LANE=3` → servidor `:3203`, base `ivonne_rosa_e2e_l3` (re-sembrada por invocación)
**Entorno:** TEST — build de producción local `.next-e2e` (Next 15.5.27), commit `f26b1a1` (sin cambios de código de la app), 2026-10-06
**Alcance:** leads (`LEAD`), clientas (`CUST`), catálogo (`CAT`), cotizaciones (`QUO`) — `tests/e2e/{leads,customers,catalog,quotes}/`
**Resumen de bugs:** 0 Blocker · 0 Critical · 0 High · 2 Medium · 1 Low (IDs provisionales; el consolidado los re-numera)

| ID | Severidad | Resumen |
|---|---|---|
| COM-BUG-02 | MEDIUM | Un teléfono guardado con formato en la ficha de la clienta ("55 1234 5678") no se reconoce al llegar un lead con ese número: se crea una clienta duplicada |
| COM-BUG-03 | MEDIUM | Navegación por `<Link>` a la misma ruta con otros `searchParams` no ocurre: "Limpiar filtros" (estado vacío de leads) falla siempre; "Siguiente" de la paginación falla de forma intermitente |
| COM-BUG-01 | LOW | Un lead capturado a mano desde el panel con «Origen» ≠ «Captura manual» dispara los avisos de lead entrante (a la clienta y a la fundadora que lo acaba de capturar) |

Todos reproducidos 2/2 con `--repeat-each=2 --retries=0` y de nuevo en la corrida final (intento + reintento). Las rutas de evidencia son las de la corrida final en `test-results/l3/artifacts/`.

---

## COM-BUG-02 — Clienta duplicada cuando su teléfono se guardó con formato desde la ficha

**Severity:** MEDIUM
**Priority:** P2
**Status:** Open
**Type:** APPLICATION BUG (integridad de datos: clientas duplicadas, historial partido)
**Module:** customers / leads (captura única `createInboundLead`)
**Role:** OWNER (ivonne@ivonne-rosa.test)
**Environment:** TEST — build local :3203, base ivonne_rosa_e2e_l3, commit f26b1a1
**Reproducible:** Sí (2/2 + corrida final 2/2)
**Test:** [CUST-016] tests/e2e/customers/customers.spec.ts

### Preconditions
Clienta existente sin teléfono (o con cualquier teléfono) en `/admin/customers/<id>`.

### Steps to reproduce
1. En la ficha de la clienta escribir en «Teléfono» `55 1234 5678` (con espacios, como lo sugiere el formulario) y «Guardar perfil» → «Perfil actualizado».
2. Registrar un lead con el mismo número sin espacios (`5512345678`) — desde «Nuevo lead», el configurador, el formulario de contacto o `createLeadAction`.

### Expected
El lead se vincula a la clienta existente (la captura única busca por correo y después por teléfono).

### Actual
Se crea **otra** clienta con `phone = "5512345678"`; el lead queda vinculado a la nueva. La clienta original conserva `phone = "55 1234 5678"`.

### Evidence
- trace/screenshot: `test-results/l3/artifacts/customers-customers-Client-22f12-egar-un-lead-con-ese-número-chromium/` (y `…-retry1/`)
- Anotación de la prueba «teléfono guardado»: `55 1234 5678`; aserción: `lead.customerId` esperado = id de la clienta original, recibido = id de una clienta nueva.
- Consulta: `select id, name, phone from "Customer" where phone in ('55 1234 5678','5512345678');` → 2 filas para la misma persona.
- Mismo síntoma con el seed: las clientas DEMO tienen `phone = '+52 55 5102 3301'` (con espacios); un lead del configurador con ese número llega normalizado (`+525551023301`) y tampoco coincide.

### Console
Sin errores.

### Network
`POST /admin/leads` (Server Action `createLeadAction`) → 200 `{"ok":true,…}`.

### Technical Analysis
- Escritura sin normalizar: `src/features/customers/server/customer-service.ts:234` — `phone: normalizeOptional(input.phone)` (sólo `trim`); igual `whatsapp`.
- Lectura normalizada + igualdad exacta: `src/features/leads/server/lead-intake.ts:53-56` (`normPhone` quita todo salvo dígitos y `+`) y `:63` `tx.customer.findFirst({ where: { phone: input.phone } })`.
- Relacionado: `/admin/quotes/new` → «Clienta nueva» sólo reutiliza por correo (`src/features/quotes/server/quote-service.ts:160`), con teléfono solo siempre crea clienta.

### Suspected Root Cause
No hay una forma canónica única del teléfono: el perfil (y el seed) guardan el texto tal cual y la captura compara contra la forma normalizada.

### Recommended Fix
Normalizar el teléfono en **todas** las escrituras (perfil, seed, cotización rápida) con la misma función (`normPhone` → idealmente E.164 `+52…`), migrar los datos existentes y buscar por la forma normalizada (o una columna `phoneNormalized` indexada). Agregar prueba `@regression` (CUST-016 ya la cubre).

---

## COM-BUG-03 — «Limpiar filtros» y la paginación (Link a la misma ruta con otros searchParams) no navegan

**Severity:** MEDIUM
**Priority:** P2
**Status:** Open
**Type:** INTEGRATION ISSUE (App Router de Next 15.5 / navegación del cliente) — impacto UX directo
**Module:** leads (también observado en clientas)
**Role:** OWNER
**Environment:** TEST — build local :3203, base ivonne_rosa_e2e_l3, commit f26b1a1, Chromium (Playwright)
**Reproducible:** Sí — «Limpiar filtros» del estado vacío de `/admin/leads`: 8/8 intentos (exploración 4/4 + repeat 2/2 + corrida final 2/2). «Siguiente» de la paginación: intermitente (clientas 3/8 sin navegar en exploración; LEAD-011 falló 1 vez de 3).
**Test:** [LEAD-037] tests/e2e/leads/leads-list.spec.ts

### Preconditions
Sesión de owner; `/admin/leads?q=<texto sin resultados>` (estado vacío «Ningún lead coincide»).

### Steps to reproduce
1. Abrir `/admin/leads?q=zz-no-existe` y esperar a que la página termine de cargar (red en reposo).
2. Clic en «Limpiar filtros» (enlace del estado vacío, `href="/admin/leads"`).
3. (Variante) `/admin/customers?q=<prefijo con 27 resultados>` → clic en «Siguiente».

### Expected
La URL cambia a `/admin/leads` y se muestra el listado completo (o la página 2).

### Actual
El navegador pide el payload RSC de destino (`GET /admin/leads?_rsc=…` → **200**, ~176 KB, sin error de servidor ni de consola) pero el router **no confirma** la navegación: la URL y la pantalla se quedan igual indefinidamente (> 45 s). Una carga completa (`page.goto(href)`) del mismo href sí funciona. Si la respuesta RSC se entrega de una sola vez (interceptada con `page.route` + `route.fulfill`) la navegación **sí** ocurre, lo que apunta al streaming de la respuesta.

### Evidence
- `test-results/l3/artifacts/leads-leads-list-Leads-·-n-2297e-ma-ruta-otros-searchParams--chromium/` (trace, video, screenshot) y `…-retry1/`
- Trace de la paginación de clientas (exploración): petición `…/admin/customers?q=…&page=2&_rsc=…` 200 a los 59 ms del clic; la URL nunca cambió.
- Script de diagnóstico (no forma parte de la suite): «fast-click» 2/4 sin navegar, «hover + red en reposo + clic» 1/4 sin navegar, «Limpiar filtros» 4/4 sin navegar.

### Console
Sin errores ni excepciones de página.

### Network
`GET /admin/leads?_rsc=<id>` → 200 `text/x-component`, `transfer-encoding: chunked`, `content-encoding: gzip`.

### Technical Analysis
Las páginas son `force-dynamic` con `loading.tsx`; la navegación es una transición de React que conserva la UI anterior hasta que el nuevo árbol resuelve. Con la respuesta en streaming el árbol nunca termina de resolverse en el cliente (con la respuesta completa sí). Afecta a cualquier `<Link>` que sólo cambie los `searchParams` de la página actual: `src/app/(admin)/admin/leads/page.tsx:115` (EmptyState «Limpiar filtros»), `src/features/leads/components/lead-filters-bar.tsx:184`, `src/components/data/pagination.tsx:44,56` (Anterior/Siguiente), pestañas de `/admin/quotes` y `src/app/(admin)/admin/customers/page.tsx:83` («Ver todas»).

### Suspected Root Cause
Interacción del router de Next 15.5 con respuestas RSC en streaming (gzip/chunked) para navegaciones a la misma ruta; no se encontró código de la app que intercepte clics (`admin-shell.tsx` sólo cierra el menú).

### Recommended Fix
1. Reproducir a mano en Chrome con la build de producción (los filtros GET del formulario hacen carga completa y sí funcionan).
2. Mitigación inmediata: en esos enlaces usar `<a href>` (carga completa, igual que el formulario de filtros) o `prefetch={false}` + `router.push` explícito, y verificar.
3. Revisar el streaming de la respuesta (compresión del servidor, Suspense del `loading.tsx` con `searchParams`) y actualizar Next al último parche 15.5.x.
4. Mantener [LEAD-037] como `@regression`.

---

## COM-BUG-01 — Captura manual con «Origen» distinto a «Captura manual» envía avisos de lead entrante

**Severity:** LOW
**Priority:** P3
**Status:** Open
**Type:** APPLICATION BUG (con REQUIREMENT AMBIGUITY: no hay requisito escrito; la intención del código es no notificar capturas manuales)
**Module:** leads
**Role:** OWNER
**Environment:** TEST — build local :3203, base ivonne_rosa_e2e_l3, commit f26b1a1
**Reproducible:** Sí (2/2 + corrida final 2/2)
**Test:** [LEAD-036] tests/e2e/leads/leads-detail.spec.ts (control positivo: [LEAD-035] con origen «Captura manual» → 0 avisos, PASS)

### Preconditions
Sesión de owner en `/admin/leads`.

### Steps to reproduce
1. «Nuevo lead» → nombre, correo, «Origen» = «Instagram» (o WhatsApp, Recomendación…) → «Crear lead».
2. Consultar `NotificationLog` del lead.

### Expected
Una captura hecha por el equipo desde el panel no genera avisos de «lead entrante» (es lo que hace con el origen por defecto «Captura manual»).

### Actual
Se registran `LEAD_RECEIVED` a la clienta (email y WhatsApp si tiene teléfono) y un `GENERIC` «Nuevo lead L-…» al correo del equipo (`equipo@ivonne-rosa.test`) — la fundadora recibe aviso de un lead que ella misma capturó y la clienta recibe un «recibimos tu solicitud» automático.

### Evidence
- `test-results/l3/artifacts/leads-leads-detail-Leads-·-274a2-adora-de-su-propio-registro-chromium/` (+ `…-retry1/`); la anotación «notificaciones» de la prueba lista los registros creados. Corrida final, lead `L-2610-MHFD`: `LEAD_RECEIVED / EMAIL → insta-…@e2e.ivonne-rosa.test «Recibimos tu solicitud»` y `GENERIC / EMAIL → equipo@ivonne-rosa.test «Nuevo lead L-2610-MHFD»` (reintento: `L-2610-XMJQ`, mismos 2 registros).
- Consulta: `select type, channel, "to" from "NotificationLog" where "leadId" = '<id>';`

### Console / Network
Sin errores; `createLeadAction` → `{ ok: true }`.

### Technical Analysis
`src/features/leads/server/lead-intake.ts:192` decide con `if (input.source !== "MANUAL")`; `createManualLead` (`src/features/leads/server/lead-service.ts:205`) pasa el origen elegido en el formulario, así que el «origen comercial» se usa como si fuera «canal de captura».

### Suspected Root Cause
Se mezcla el origen del lead (marketing) con el canal por el que se capturó (panel vs. sitio).

### Recommended Fix
Pasar un indicador explícito (p. ej. `ctx.actor` presente o `{ notify: false }` desde `createManualLead`) y notificar sólo capturas públicas; si se desea avisar a la clienta en capturas manuales, hacerlo con una opción explícita en el formulario.

---

## ENVIRONMENT / infraestructura compartida (no son bugs de la app)

- **ENV-01 (ya reportado por otros carriles):** la caché de datos de Next (`.next-e2e/cache/fetch-cache`, `unstable_cache`) es compartida por todos los carriles. Para no depender de ella, las pruebas públicas de este paquete (CAT-008) sólo usan `/experiencias/<slug>` con **slugs únicos** creados en el carril 3 y nunca el listado `/experiencias`.
- **Guard de consola (`tests/e2e/fixtures/guard.ts`):** los mensajes `Failed to load resource: … status of 4xx` se guardan **sin la URL** en `text`, así que `guard.allow(/…/api\/media\/upload/)` no puede acotarse a un endpoint; hubo que declarar el patrón por código de estado (CAT-013: 422, QUO-025: 404). Sugerencia: incluir `msg.location().url` en el texto de las entradas de consola.
- **Hidratación:** interactuar con formularios cliente (react-hook-form) antes de la hidratación pierde el cambio (un `select` nativo cambia en el DOM pero el formulario no lo ve). Se resolvió en las pruebas con `gotoReady()` (espera red en reposo). No es bug de la app, pero conviene un helper compartido.
- `pnpm.cmd exec playwright -g "A|B"` falla en Windows (cmd interpreta `|`): se usó `node node_modules/@playwright/test/cli.js`.

## Observaciones UX / accesibilidad / rendimiento (no son bug)

1. **CSV de leads:** los teléfonos que empiezan con `+` salen como `'+52…` por la protección anti-inyección de fórmulas (`src/lib/csv.ts:6`). Correcto por seguridad, pero el dato exportado ya no es «limpio» para reimportar; documentarlo o exportar el teléfono sin `+` (LEAD-030).
2. **Unicidad del teléfono (REQUIREMENT AMBIGUITY):** sólo el correo es único (schema `Customer.email @unique` + servicio). Dos clientas pueden compartir teléfono sin aviso (CUST-009), lo que además vuelve ambigua la búsqueda por teléfono de la captura única (`findFirst`). Decidir si debe advertirse.
3. **Disponibilidad en cotizaciones:** el admin puede crear/enviar cotizaciones en fechas bloqueadas o sin capacidad; por diseño (DOMAIN.md §Disponibilidad) se valida al aceptar. Sugerencia UX: mostrar un aviso en «Cálculo en vivo» cuando la fecha no está disponible para no enviar propuestas que la clienta no podrá aceptar.
4. **Descuento ≥ subtotal:** se limita al subtotal y deja la cotización en $0 que luego no se puede enviar («La cotización no tiene conceptos con precio»). El mensaje no menciona el descuento como causa (QUO-013).
5. **StatCard** (`src/components/data/stat-card.tsx`): etiqueta y valor son `span/div` sin relación semántica (sin `dt/dd` ni `aria-labelledby`); un lector de pantalla los lee sueltos. Menor.
6. **Payload RSC grande:** `/admin/leads` sin filtros devuelve ~176 KB de RSC con ~200 leads en base (tabla de 25 filas + opciones del formulario «Nuevo lead»). Observación de rendimiento para bases grandes.
7. **Editor de precios:** con cambios sin guardar registra `beforeunload`; correcto, pero el botón «Guardar cambios» aparece sólo cuando hay cambios (barra inferior) — funciona; sin observaciones de bloqueo.
