# Hallazgos — Paquete 5 «Operación y back-office» (carril 5)

- **Fecha:** 2026-10-06 · **Commit:** f26b1a1 · **Modo:** FULL (paquete 5/6)
- **Entorno:** TEST — build de producción local `.next-e2e` en :3205, base `ivonne_rosa_e2e_l5` (re-sembrada por invocación), proveedores mock (email/WhatsApp/pagos), S3 local (RustFS :9000) disponible.
- **Alcance:** operaciones (tablero, orden de producción, checklist, plantillas, asignaciones, logística, add-ons), portal staff + administración de staff y accesos, inventario y reservas, compras y proveedores, finanzas (costos, rentabilidad, cierre, CSV, analytics), ajustes (negocio, precios, disponibilidad, notificaciones, flags, integraciones, usuarios, auditoría), contenido (testimonios, FAQ, galería) y notificaciones (bandeja, recordatorios, cron).
- **Resumen por severidad (IDs provisionales):** BLOCKER 0 · CRITICAL 0 · HIGH 1 (OPX-BUG-01) · MEDIUM 2 (OPX-BUG-02, OPX-BUG-05) · LOW 2 (OPX-BUG-03, OPX-BUG-04). FLAKY en la corrida final: NOT-002 (síntoma de OPX-BUG-02); SET-001 inestable en corridas previas.
- **Corrida final (carril 5):** regular chromium + mobile-chrome → 140 passed · 4 failed · 1 flaky (145 ejecuciones); global → 22 passed · 1 failed. Total 154 escenarios: PASS 148 · FAIL 5 · FLAKY 1 · BLOCKED 0 · NOT TESTED 0 (ver `operations-coverage.md`).

> Nota de deduplicación: OPX-BUG-01 y OPX-BUG-02 muestran el mismo síntoma que **EVX-BUG-02** del carril 4 (navegación del router que se queda pendiente con sólo `searchParams` o con `router.refresh()`); al consolidar probablemente sean un solo defecto con varias manifestaciones.

---

## OPX-BUG-01 — Los filtros del inventario (búsqueda, «Incluir inactivos») nunca se aplican: la navegación queda pendiente

**Severity:** HIGH
**Priority:** P1
**Status:** Fixed — consolidado como **BUG-006**; causa raíz y corrección en docs/qa/findings/events.md (EVX-BUG-02 › «Corrección (BUG-006)»)
**Type:** APPLICATION BUG
**Module:** inventory (componente compartido `ListFilters`, también usado por compras y proveedores)
**Role:** OWNER (ivonne@ivonne-rosa.test)
**Environment:** TEST — build de producción local :3205, base ivonne_rosa_e2e_l5, commit f26b1a1
**Reproducible:** Sí (4/4 corridas; 2/2 en la corrida final con reintento)
**Test:** [INV-025] tests/e2e/inventory/inventory.spec.ts

### Preconditions
Sesión de fundadora; artículo de inventario propio inactivo (SKU `E2E-xxxx`).

### Steps to reproduce
1. Abrir `/admin/inventory` (carga completa).
2. Escribir el SKU en «Buscar» y esperar (debounce de 400 ms) — o activar el interruptor «Incluir inactivos».

### Expected
La URL cambia a `?q=<SKU>` / `?inactive=1` y la tabla se filtra sin recargar.

### Actual
La URL nunca cambia (sigue `/admin/inventory` tras 15 s), la tabla no se filtra y el indicador «Filtrando…» queda activo. Abrir la misma URL con recarga completa (`/admin/inventory?q=<SKU>`, `?inactive=1&q=…`) sí funciona (INV-001 e INV-006 PASS por esa vía).

### Evidence
- trace: `test-results/l5/artifacts/inventory-inventory-Invent-90ef1-URL-y-la-lista-sin-recargar-chromium/trace.zip` (y `-retry1/`), screenshot `test-failed-1.png`, video.
- Red (trace): `GET /admin/inventory?q=<SKU>&inactive=1&_rsc=…` → 200 `text/x-component`, headers recibidos en ~22 ms pero el cuerpo nunca se marca como recibido (`receive=-1`, `size=-1`); la transición del router no se confirma.
- Reproducción por fuera del navegador (curl con la sesión E2E del carril, `RSC: 1` + el `Next-Router-State-Tree` capturado, con y sin gzip): el servidor responde completo (14–41 KB en < 0.11 s). ⇒ El servidor sí termina; la transición del lado del cliente queda pendiente.
- Base: sin cambios esperados (lectura).

### Console
Sin errores de consola.

### Network
Ver arriba: única petición RSC 200 sin cierre observado por el navegador; sin 4xx/5xx.

### Technical Analysis
`src/features/inventory/components/list-filters.tsx:41-50` envuelve `router.push(...)` en `startTransition`; la navegación sólo cambia `searchParams` de la misma ruta (`/admin/inventory`, `force-dynamic`, con `loading.tsx`). La URL de Next sólo se actualiza al confirmar la transición, que nunca se completa. El mismo patrón (router en transición que no termina) aparece en OPX-BUG-02 y en EVX-BUG-02 (carril 4).

### Suspected Root Cause
Transición del App Router que queda suspendida al aplicar el payload RSC de la misma ruta (posible componente cliente que suspende durante la transición, p. ej. `useSearchParams` dentro de `ListFilters` sin `Suspense` propio bajo un segmento con `loading.tsx`, o interacción con el `set-cookie` de sesión que Auth.js agrega a cada respuesta RSC). No se pudo aislar sin instrumentar la app (fuera del alcance de QA).

### Recommended Fix
1. Reproducir con `next start` local y React DevTools/`NEXT_DEBUG`: verificar qué frontera queda suspendida al navegar `?q=`.
2. Envolver `ListFilters` (y cualquier cliente con `useSearchParams`) en `<Suspense>` propio; probar `router.replace` sin `startTransition` o un `<form method="get">` (como `/admin/staff`, cuyo filtro funciona — STF-012 PASS).
3. Agregar una prueba `@regression` (INV-025 ya lo es) y revisar los mismos filtros en `/admin/purchases` y `/admin/vendors` (comparten componente; no verificados por esta vía).

---

## OPX-BUG-02 — Tras reordenar contenido (subir/bajar) la lista no se refresca y los botones quedan deshabilitados

**Severity:** MEDIUM
**Priority:** P2
**Status:** Fixed — consolidado como **BUG-006**; causa raíz y corrección en docs/qa/findings/events.md (EVX-BUG-02 › «Corrección (BUG-006)»)
**Type:** APPLICATION BUG (intermitente; posible carrera)
**Module:** content (testimonios, FAQ, galería) · también visto en notifications (NOT-002)
**Role:** OWNER (ivonne@ivonne-rosa.test)
**Environment:** TEST — build de producción local :3205, base ivonne_rosa_e2e_l5, commit f26b1a1
**Reproducible:** Sí — CNT-022 2/2 en la corrida global final (intento + reintento); CNT-023/CNT-024 en 6 de 8 intentos con `--repeat-each` (pasaron en la corrida final: intermitente); NOT-002 FLAKY en la corrida final (falló el 1.er intento)
**Test:** [CNT-022], [CNT-023], [CNT-024] tests/e2e/content/content.global.spec.ts · [NOT-002] tests/e2e/notifications/inbox.spec.ts

### Preconditions
Testimonios / galería del seed; sesión de fundadora.

### Steps to reproduce
1. `/admin/content` → «Bajar testimonio de Valeria C.» (o `/admin/content/gallery` → «Bajar imagen 1»).
2. Observar la lista.

### Expected
El orden se guarda y la lista se vuelve a pintar con el nuevo orden; los botones de orden se re-habilitan.

### Actual
El orden SÍ cambia en la base (`Testimonial.sortOrder` / `MediaAsset.sortOrder` normalizados), pero la lista no se repinta: todos los botones «Subir/Bajar» quedan `disabled` (el `useTransition` de `OrderButtons` sigue pendiente) hasta recargar la página. Con la lista sin refrescar, las etiquetas posicionales («Subir imagen 2») apuntan a otra imagen, lo que puede mover la foto equivocada.

### Evidence
- corrida final: `test-results/l5/global/artifacts/content-content.global-Con-43a70-a-su-posición-con-la-vecina-chromium-global/` y `-retry1/` (trace, screenshot, video): el botón «Bajar pregunta …» queda `disabled` 15 s tras «Subir».
- repeticiones previas: `test-results/l5/global/artifacts/content-content.global-Con-42d0d-ta-se-actualiza-en-pantalla-chromium-global*/`, `…-43f0c--tarjeta-cambia-de-posición-chromium-global*/`.
- NOT-002 (final, intento 1): `test-results/l5/artifacts/notifications-inbox-Notifi-731ce-lver-a-marcar-como-no-leído-chromium/` — el mensaje se marcó leído en la base (`readAt` no nulo) pero el botón «Marcar como no leído» nunca apareció (el `router.refresh()` de `AutoMarkRead` no se aplicó).
- Red (trace): `POST /admin/content` (Next-Action de `moveTestimonialAction`) 200 y `GET /admin/content?_rsc=…` 200, ambos sin cierre de cuerpo observado (`receive=-1`).
- Base: `select id, "sortOrder" from "Testimonial" order by "sortOrder"` → el testimonio movido quedó en la posición 2 (la acción se ejecutó).

### Console
Sin errores.

### Network
Sin 4xx/5xx.

### Technical Analysis
`src/features/content/components/content-controls.tsx:28-33`: `startTransition(async () => { await onMove(); router.refresh(); })` — el botón queda deshabilitado mientras `pending`. La acción (`src/features/content/server/actions.ts:78-85`) además llama `revalidatePath("/")` y `revalidateTag("content")`; la respuesta de la Server Action trae el árbol RSC revalidado. El síntoma coincide con OPX-BUG-01 / EVX-BUG-02.

### Suspected Root Cause
Misma familia que OPX-BUG-01: la transición del router (respuesta de la acción + refresh) no se confirma. Agravante: `OrderButtons` identifica las filas por posición (`imagen ${i + 1}`), así que un clic sobre una lista desactualizada actúa sobre otro elemento.

### Recommended Fix
Atender la causa de OPX-BUG-01/EVX-BUG-02; además, no envolver `router.refresh()` dentro de la transición (o usar `useOptimistic` para el orden) y etiquetar los botones por el contenido (alt/título), no por la posición.

---

## OPX-BUG-03 — El encabezado del evento no indica que el evento está cerrado

**Severity:** LOW
**Priority:** P3
**Status:** Fixed — consolidado como BUG-015 (commit `d38e91e`). `getEventHeader` selecciona `closedAt` y `EventHeader` muestra la insignia «Cerrado». Verificado: FIN-007 PASS 3/3.
**Type:** UX ISSUE
**Module:** finance / events (encabezado compartido de las pestañas del evento)
**Role:** OWNER
**Environment:** TEST — build de producción local :3205, base ivonne_rosa_e2e_l5, commit f26b1a1
**Reproducible:** Sí (2/2 en la corrida final: intento + reintento)
**Test:** [FIN-007] tests/e2e/finance/finance.spec.ts

### Preconditions
Evento COMPLETED con `closedAt` (cerrado desde Finanzas).

### Steps to reproduce
1. Cerrar un evento completado en `/admin/events/<id>/financials` («Cerrar evento»).
2. Abrir cualquier otra pestaña del evento (Resumen, Operaciones, Invitadas).

### Expected
El encabezado del evento (código, estado, título) muestra una insignia «Cerrado» (como la pestaña Finanzas y la tabla de `/admin/finance`).

### Actual
El encabezado sólo muestra «EV-… · Completado»; nada indica que los costos están congelados salvo en la pestaña Finanzas.

### Evidence
- trace/screenshot: `test-results/l5/artifacts/finance-finance-Finanzas-·-fc22c--que-el-evento-está-cerrado-chromium/` (y `-retry1`); snapshot: `text: EV-2610-B4YE Completado` junto al h1.
- Base: `select "closedAt" from "Event" where id = '<id>'` → no nulo.

### Technical Analysis
`src/features/events/server/event-queries.ts:160-183` (`getEventHeader`) no selecciona `closedAt`; `src/features/events/components/event-header.tsx:32-37` sólo pinta `EVENT_STATUS_LABELS[status]`.

### Suspected Root Cause
El dato no llega al encabezado.

### Recommended Fix
Agregar `closedAt: true` a `getEventHeader` y mostrar `<StatusBadge tone="neutral" dot={false}><Lock/> Cerrado</StatusBadge>` en `EventHeader` cuando exista.

---

## OPX-BUG-04 — El aviso sembrado «STAFF_ASSIGNED» enlaza a /staff/eventos/<id> (ruta inexistente)

**Severity:** LOW
**Priority:** P3
**Status:** Fixed — consolidado como BUG-016 (commit `af52434`). Seed corregido a `/staff/events/<id>` (y `/admin/events/<id>`). Verificado: NOT-007 PASS 3/3.
**Type:** DATA ISSUE (seed DEMO)
**Module:** notifications (seed)
**Role:** STAFF (staff@ivonne-rosa.test)
**Environment:** TEST — build de producción local :3205, base ivonne_rosa_e2e_l5, commit f26b1a1
**Reproducible:** Sí (determinista, 2/2)
**Test:** [NOT-007] tests/e2e/notifications/inbox.spec.ts

### Preconditions
Base re-sembrada con el seed DEMO.

### Steps to reproduce
1. `/admin/notifications` → aviso «Lupita, quedaste asignada como coordinadora…» (WhatsApp).
2. Abrir su enlace como Lupita.

### Expected
`/staff/events/<id>` (la ruta real; la app genera ese enlace correctamente — OPS-010 PASS).

### Actual
`actionUrl = <APP_URL>/staff/eventos/<id>` → «No encontramos este evento»/404.

### Evidence
- trace/screenshot: `test-results/l5/artifacts/notifications-inbox-Notifi-3386e-del-portal-staff-events-id--chromium/` (y `-retry1/`); anotación de la prueba: `…: /staff/eventos/<id>`.
- Base: `select "actionUrl" from "NotificationLog" where type = 'STAFF_ASSIGNED' and "dedupeKey" is null` → `/staff/eventos/…`.

### Technical Analysis
`prisma/seed-data/demo-activity.ts:102` construye `actionUrl: \`${appUrl}/staff/eventos/${e1.id}\``. El código de la app (`src/features/operations/server/assignment-service.ts:562`) usa `/staff/events/`.

### Recommended Fix
Cambiar el seed a `/staff/events/${e1.id}` (sólo datos de demo; no afecta producción).

---

## OPX-BUG-05 — Portal staff: violaciones WCAG 2.1 AA graves (contraste y `aria-controls` a un id inexistente)

**Severity:** MEDIUM
**Priority:** P2
**Status:** Fixed — aria-controls como BUG-011 (commit `e813c1c`: sin `aria-controls` colgante, foco al campo y de regreso al botón) y contraste como BUG-009 (commit `cf3e12d`). Verificado: STF-024 y la nueva STF-025 PASS 3/3.
**Type:** UX ISSUE (accesibilidad)
**Module:** staff (portal `/staff`, `/staff/events/[id]`)
**Role:** STAFF (staff@ivonne-rosa.test)
**Environment:** TEST — build de producción local :3205, base ivonne_rosa_e2e_l5, commit f26b1a1
**Reproducible:** Sí (2/2 en la corrida final: intento + reintento)
**Test:** [STF-024] tests/e2e/staff/staff-portal.spec.ts

### Preconditions
Lupita asignada a un evento propio con una tarea pendiente.

### Steps to reproduce
1. Como staff abrir `/staff` y `/staff/events/<id>`.
2. Correr axe (WCAG 2.0/2.1 A + AA) — `scanA11y`.

### Expected
Sin violaciones `critical`/`serious`.

### Actual
- `/staff`: **serious `color-contrast`** en `.text-warning` (texto «· por confirmar» de las tarjetas).
- `/staff/events/<id>`: **critical `aria-valid-attr-value`** en el botón `.h-7` «Agregar nota» y **serious `color-contrast`** en insignias `.bg-warning/10` (estado «Pendiente», tono warning).

### Evidence
- Adjuntos `a11y-axe.json` de la prueba en `test-results/l5/results.json` y trace en `test-results/l5/artifacts/staff-staff-portal-Portal--2d61e-laciones-WCAG-2-1-AA-graves-chromium/` (y `-retry1/`).

### Technical Analysis
- `src/features/staff/components/portal-checklist.tsx:261`: `<Button … aria-controls={notesId}>` apunta a `notas-<id>`, pero el `<Textarea id={notesId}>` sólo existe cuando `notesOpen` es verdadero ⇒ referencia ARIA inválida.
- Tono `warning` (`text-warning` sobre fondo claro / `bg-warning/10`) no alcanza 4.5:1 en texto pequeño (`src/components/data/status-badge.tsx`, tokens en `globals.css`).

### Recommended Fix
Poner `aria-controls` sólo cuando el panel exista (o renderizar el panel oculto con `hidden`) y usar `aria-expanded`; oscurecer el token `--warning` para texto (o usar `text-charcoal` sobre `bg-warning/10`) hasta cumplir AA.

---

## Pruebas inestables (FLAKY, no son PASS)

- **[NOT-002]** (FLAKY en la corrida final): ver OPX-BUG-02 — refresh pendiente tras marcar leído.
- **[SET-001]** (PASS en la corrida final, inestable antes) navegar entre secciones de `/admin/settings` con la barra lateral: 1/2 en la corrida final (pasó al reintentar) y 1/5 con `--repeat-each=5 --retries=0`. En el intento fallido el clic en «Precios y márgenes» no cambia de página en 15 s; el trace muestra un `GET /admin/settings?_rsc=…` (refresh RSC, no prefetch) pendiente justo antes, y los prefetch de las demás secciones sin cierre observado. Mismo patrón que OPX-BUG-01/EVX-BUG-02 (transición del router pendiente); se reporta como **POTENTIAL FLAKY TEST con causa probable en la app**, no como bug independiente. Trace: `test-results/l5/artifacts/settings-settings-Ajustes--b84b7-desde-la-navegación-lateral-chromium/trace.zip`.

---

## Observaciones (no son bugs)

**UX / funcionalidad**
- *Carrera de hidratación en formularios con `react-hook-form`*: lo que se escribe antes de que React hidrate se descarta en silencio (visto en «Transporte y montaje»: la salida de bodega no se guardó en la primera versión de OPS-016). En celulares lentos el staff/fundadora podría perder lo tecleado. Sugerencia: deshabilitar los campos/botón hasta hidratar (como ya hacen compras/proveedores con `useHydrated`).
- `addReservation` (inventario) no deja entrada de auditoría, mientras editar cantidad, liberar y mermas sí. Considerar `inventory.reservation_added` para trazabilidad.
- El margen se muestra con 1 decimal (7025 bps → «70.3%»); el CSV exporta 70.25. Consistente pero conviene documentarlo.
- `OrderButtons` (contenido) etiqueta por posición («Subir imagen 2»): ambiguo para lector de pantalla y frágil (ver OPX-BUG-02).
- El historial de compras lista campos cambiados en orden de `jsonb` («notas, concepto»), no en el orden del formulario.

**Accesibilidad**
- `Section` (`src/components/layout/page-header.tsx:46-73`) renderiza `<section>` sin nombre accesible: no es landmark/region (p. ej. «Compras», «Staff», «Costos manuales» en Finanzas). Agregar `aria-labelledby` al `h2`.
- La calificación de testimonios usa radios `sr-only` cuyo ícono intercepta el puntero; con mouse funciona clic en la estrella (label) y con teclado los radios; OK, sólo se anota.
- Moderate/minor de axe no se cuentan como fallo (ver adjunto `a11y-axe.json` de STF-024).

**Rendimiento**
- Sin páginas > 5 s en el carril; las acciones de inventario/compras responden < 1 s con 3 workers.

**Riesgo de entorno (ENV-01)**
- La caché de datos de Next (`unstable_cache`: settings de negocio, testimonios, FAQ, galería) se comparte entre carriles. Las pruebas globales de contenido (CNT-020/021) pintan la portada con datos del carril 5 durante segundos; al terminar, borran lo creado vía UI (lo que vuelve a invalidar la etiqueta `content`). Las pruebas de ajustes de negocio no abren páginas públicas mientras el valor está modificado.

## Defectos/observaciones de la infraestructura compartida
- `tests/e2e/fixtures/guard.ts`: los 4xx se declaran «observaciones», pero Chromium también emite el mensaje de consola `Failed to load resource: … status of 4xx`, que el guard cuenta como **violación** (`kind: console`). Toda prueba que provoca un 4xx esperado (subidas rechazadas, 404 de `notFound()`) necesita `guard.allow(/status of 4xx/)`. Sugerencia: ignorar en `violations()` los mensajes de consola `Failed to load resource` cuyo status sea 4xx (ya quedan en `observations4xx`).
- Runbook/test-design piden `test.describe.configure({ mode: "serial" })` en `*.global.spec.ts`: en modo serial un fallo deja el resto del archivo como «did not run» (6 pruebas NOT TESTED en la primera corrida global). Con `E2E_SUITE=global` ya hay 1 worker; los specs globales de este paquete usan `mode: "default"` (secuencial, sin cascada).
