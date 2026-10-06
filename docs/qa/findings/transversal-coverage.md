# Test Coverage Matrix — Paquete 6/6 "Transversal" (carril 6)

**Corrida final:** una invocación, `E2E_LANE=6 E2E_CROSS_BROWSER=1 E2E_WORKERS=4` sobre `tests/e2e/{smoke,critical,responsive,accessibility}`, sin filtro de proyecto, reintentos = 1 (config). Inicio 2026-10-06 07:42:53 UTC, duración 4.8 min. Fuente: `test-results/l6/results.json`.
**Entorno:** TEST — build de producción local `.next-e2e` :3206, base `ivonne_rosa_e2e_l6` re-sembrada, commit `f26b1a1`.

Leyenda Result: PASS / FAIL (bug) / FLAKY / BLOCKED (causa) / NOT TESTED. **BLOCKED (ENV-02)** = Firefox no pudo lanzarse en esta máquina (`spawn UNKNOWN`, error SxS de Windows); Playwright lo registra como fallo, aquí se clasifica como BLOCKED porque nunca se ejecutó código de la prueba. **nota ENV-01** = la página vino de la caché de datos compartida entre carriles (ver hallazgos); la prueba la detectó y tomó la medida documentada.

## Totales de la corrida final

| Proyecto (navegador / viewport) | Ejecuciones | PASS | FAIL | FLAKY | BLOCKED | NOT TESTED |
|---|---|---|---|---|---|---|
| chromium (Desktop Chrome 1440×900; responsive recorre 1440×900, 1366×768, 768×1024, 390×844) | 93 | 81 | 12 | 0 | 0 | 0 |
| mobile-chrome (Pixel 7, 390×844, `@mobile`) | 13 | 13 | 0 | 0 | 0 | 0 |
| firefox (Desktop Firefox 1440×900, `@P0`) | 30 | 0 | 0 | 0 | 30 (ENV-02) | 0 |
| webkit (Desktop Safari 1440×900, `@P0`) | 30 | 29 | 1 | 0 | 0 | 0 |
| **Total** | **166** | **123** | **13** | **0** | **30** | **0** |

Playwright (`results.json` stats): expected 128 (incluye 5 de `setup`), unexpected 43 (= 13 FAIL reales + 30 lanzamientos de Firefox), flaky 0, skipped 0.

| Prioridad | PASS | FAIL | BLOCKED (ENV-02) |
|---|---|---|---|
| P0 (smoke P0 + recorridos críticos, 4 proyectos) | 70 | 2 (CRIT-014 chromium + webkit → TRV-BUG-06) | 30 |
| P1 | 33 | 0 | 0 |
| P2 | 20 | 11 (axe + foco → TRV-BUG-02/03/04/05) | 0 |

| Área | IDs | PASS (chromium) | FAIL (chromium) |
|---|---|---|---|
| Smoke | 32 | 32 | 0 |
| Recorridos críticos | 14 | 13 | 1 (CRIT-014) |
| Responsive (4 viewports c/u; overflow medido 0 px en todas) | 20 | 20 | 0 |
| Accesibilidad | 27 | 16 | 11 |

### Responsive — overflow horizontal medido por viewport (corrida final)
Todas las páginas: **0 px** en 1440×900, 1366×768, 768×1024 y 390×844 (RESP-001…006, 008…018, 020); CTA principal visible, dentro del ancho y sin elementos encima en los 4 tamaños. Menú móvil público (RESP-007) y del panel (RESP-019) abren/cierran/navegan en 390 y 768; tabla de finanzas con scroll interno en 768 (RESP-018).

## Matriz

| ID | Módulo | Escenario | Rol | Priority | Automated | Result (por proyecto) |
|---|---|---|---|---|---|---|
| A11Y-001 | Público | axe sin violaciones graves: inicio | Anónimo | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: PASS |
| A11Y-002 | Público | axe sin violaciones graves: catálogo | Anónimo | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: PASS |
| A11Y-003 | Público | axe sin violaciones graves: detalle de experiencia | Anónimo | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: PASS · nota: ENV-01 |
| A11Y-004 | Configurador | axe sin violaciones graves: configurador (paso 1) | Anónimo | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: PASS |
| A11Y-005 | Público | axe sin violaciones graves: contacto | Anónimo | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: PASS |
| A11Y-006 | Auth | axe sin violaciones graves: login | Anónimo | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: PASS |
| A11Y-007 | Cotizaciones | axe sin violaciones graves: cotización por token | Anónimo | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: FAIL (TRV-BUG-04) |
| A11Y-008 | Pagos | axe sin violaciones graves: pago simulado | Clienta (token) | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: FAIL (TRV-BUG-03) |
| A11Y-009 | Portal | axe sin violaciones graves: portal de la clienta | Anónimo | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: FAIL (TRV-BUG-02, TRV-BUG-03) |
| A11Y-010 | Invitadas/RSVP | axe sin violaciones graves: RSVP de invitada | Anónimo | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: FAIL (TRV-BUG-04) |
| A11Y-011 | Memory Capsule | axe sin violaciones graves: Memory Capsule | Anónimo | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: FAIL (TRV-BUG-03) |
| A11Y-012 | Dashboard | axe sin violaciones graves: dashboard admin | Owner | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: FAIL (TRV-BUG-02) |
| A11Y-013 | Leads | axe sin violaciones graves: leads | Owner | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: FAIL (TRV-BUG-02) |
| A11Y-014 | Eventos | axe sin violaciones graves: detalle de evento | Owner | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: FAIL (TRV-BUG-02) |
| A11Y-015 | Calendario | axe sin violaciones graves: calendario | Owner | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: FAIL (TRV-BUG-02, TRV-BUG-03) |
| A11Y-016 | Staff | axe sin violaciones graves: portal staff | Staff | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: PASS |
| A11Y-017 | Público | axe sin violaciones graves: cómo funciona | Anónimo | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: PASS |
| A11Y-018 | Finanzas | axe sin violaciones graves: finanzas | Owner | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: FAIL (TRV-BUG-02, TRV-BUG-03) |
| A11Y-020 | Auth | login completo sólo con teclado y foco visible | Owner | P1 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: PASS |
| A11Y-021 | Configurador | configurador: radios con flechas, avance con teclado y foco al título del paso | Anónimo | P1 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: PASS |
| A11Y-022 | Invitadas/RSVP | RSVP: elegir respuesta con teclado, foco visible y labels asociados | Invitada (token) | P1 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: PASS |
| A11Y-023 | Público | enlace 'Saltar al contenido' lleva el foco al contenido principal | Anónimo | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: PASS |
| A11Y-024 | Público | formularios públicos: todos los campos con label asociado y requeridos marcados | Anónimo | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: PASS |
| A11Y-025 | Navegación | landmarks: banner, navegación, main y footer en público; main y navegación en el panel | Anónimo | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: PASS |
| A11Y-026 | Público | imágenes con texto alternativo (o marcadas como decorativas) | Anónimo | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: PASS · nota: ENV-01 |
| A11Y-027 | Público | prefers-reduced-motion elimina animaciones y transiciones | Anónimo | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: PASS |
| A11Y-028 | Cotizaciones | diálogo de aceptar propuesta: foco dentro, Escape cierra y regresa el foco | Clienta (token) | P2 | ✅ tests/e2e/accessibility/a11y.spec.ts | Chromium: FAIL (TRV-BUG-05) |
| CRIT-001 | Configurador | configurador anónimo → lead NEW con clienta, snapshot y notificación → la fundadora lo ve y lo abre | Anónimo | P0 | ✅ tests/e2e/critical/sales.spec.ts | Chromium: PASS · Móvil 390: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS · precondición ENV-01 verificada (catálogo consistente) |
| CRIT-002 | Cotizaciones | lead → cotización (precio del servidor) → envío → la clienta acepta → anticipo mock → evento confirmado → portal | Owner | P0 | ✅ tests/e2e/critical/sales.spec.ts | Chromium: PASS · Móvil 390: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| CRIT-003 | Cotizaciones | la clienta rechaza la propuesta por token → REJECTED, sin reserva ni evento, lead con actividad | Clienta (token) | P0 | ✅ tests/e2e/critical/sales.spec.ts | Chromium: PASS · Móvil 390: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| CRIT-004 | Invitadas/RSVP | la anfitriona agrega una invitada en su portal → la invitada confirma RSVP → admin y portal ven la confirmación | Clienta (token) | P0 | ✅ tests/e2e/critical/experience.spec.ts | Chromium: PASS · Móvil 390: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS · ⚠ intermitente: la confirmación visual falló 17/26 en corridas previas (TRV-BUG-01, abierto) |
| CRIT-005 | Staff | la fundadora asigna staff → el staff entra y ve SÓLO ese evento → marca su tarea → la fundadora la ve hecha | Owner | P0 | ✅ tests/e2e/critical/operations.spec.ts | Chromium: PASS · Móvil 390: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| CRIT-006 | Pagos | pago manual del saldo (fundadora) → saldo en cero, auditoría, notificación y portal liquidado | Owner | P0 | ✅ tests/e2e/critical/operations.spec.ts | Chromium: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| CRIT-007 | Finanzas | cierre del evento con costos reales → snapshot congelado y finanzas con margen correcto | Owner | P0 | ✅ tests/e2e/critical/operations.spec.ts | Chromium: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| CRIT-008 | Memory Capsule | Memory Capsule: la invitada deja mensaje y foto → la fundadora aprueba la foto → visible públicamente | Invitada (token) | P0 | ✅ tests/e2e/critical/experience.spec.ts | Chromium: PASS · Móvil 390: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| CRIT-009 | Auth | owner: login → panel → logout → las rutas privadas vuelven a pedir login (UI y request) | Owner | P0 | ✅ tests/e2e/critical/access.spec.ts | Chromium: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| CRIT-010 | Público | formulario de contacto público → lead CONTACT_FORM + clienta + notificación → visible en admin | Anónimo | P0 | ✅ tests/e2e/critical/sales.spec.ts | Chromium: PASS · Móvil 390: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| CRIT-011 | Auth | superadmin: login → panel → logout → las rutas privadas vuelven a pedir login (UI y request) | SuperAdmin | P0 | ✅ tests/e2e/critical/access.spec.ts | Chromium: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| CRIT-012 | Auth | staff: login → /staff; /admin la regresa a /staff; logout cierra el portal | Staff | P0 | ✅ tests/e2e/critical/access.spec.ts | Chromium: PASS · Móvil 390: PASS · WebKit: PASS (3/3 cada uno sin reintentos; @regression BUG-001, cuenta STAFF propia con evento asignado; corrección carril 1) · Firefox: NOT TESTED en la corrección |
| CRIT-013 | Auth | anónima: ruta privada → login con callbackUrl → tras entrar regresa a esa ruta (sólo rutas internas) | Anónimo | P0 | ✅ tests/e2e/critical/access.spec.ts | Chromium: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| CRIT-014 | Auth | logout definitivo: una respuesta que estaba en vuelo al cerrar sesión no revive la sesión | Staff | P0 | ✅ tests/e2e/critical/access.spec.ts | Chromium: PASS · WebKit: PASS (3/3 cada uno sin reintentos; @regression BUG-001, cuenta STAFF propia; corrección carril 1) · Firefox: NOT TESTED en la corrección |
| RESP-001 | Público | inicio | Anónimo | P1 | ✅ tests/e2e/responsive/responsive.spec.ts | Chromium: PASS |
| RESP-002 | Público | catálogo de experiencias | Anónimo | P1 | ✅ tests/e2e/responsive/responsive.spec.ts | Chromium: PASS |
| RESP-003 | Público | detalle de experiencia | Anónimo | P1 | ✅ tests/e2e/responsive/responsive.spec.ts | Chromium: PASS · nota: ENV-01 |
| RESP-004 | Configurador | configurador (paso 1) | Anónimo | P1 | ✅ tests/e2e/responsive/responsive.spec.ts | Chromium: PASS |
| RESP-005 | Público | contacto | Anónimo | P1 | ✅ tests/e2e/responsive/responsive.spec.ts | Chromium: PASS |
| RESP-006 | Auth | login del equipo | Anónimo | P1 | ✅ tests/e2e/responsive/responsive.spec.ts | Chromium: PASS |
| RESP-007 | Público | menú móvil público abre, navega y cierra (390 y 768) | Anónimo | P1 | ✅ tests/e2e/responsive/responsive.spec.ts | Chromium: PASS |
| RESP-008 | Cotizaciones | cotización por token | Clienta (token) | P1 | ✅ tests/e2e/responsive/responsive.spec.ts | Chromium: PASS |
| RESP-009 | Pagos | pago simulado (checkout del anticipo) | Clienta (token) | P1 | ✅ tests/e2e/responsive/responsive.spec.ts | Chromium: PASS |
| RESP-010 | Portal | portal de la clienta | Clienta (token) | P1 | ✅ tests/e2e/responsive/responsive.spec.ts | Chromium: PASS |
| RESP-011 | Invitadas/RSVP | RSVP de invitada | Invitada (token) | P1 | ✅ tests/e2e/responsive/responsive.spec.ts | Chromium: PASS |
| RESP-012 | Memory Capsule | Memory Capsule pública | Invitada (token) | P1 | ✅ tests/e2e/responsive/responsive.spec.ts | Chromium: PASS |
| RESP-013 | Portal | acceso a Mi evento (solicitar enlace) | Clienta (token) | P2 | ✅ tests/e2e/responsive/responsive.spec.ts | Chromium: PASS |
| RESP-014 | Dashboard | dashboard admin | Owner | P2 | ✅ tests/e2e/responsive/responsive.spec.ts | Chromium: PASS |
| RESP-015 | Leads | leads (tabla/lista contenida) | Owner | P2 | ✅ tests/e2e/responsive/responsive.spec.ts | Chromium: PASS |
| RESP-016 | Eventos | detalle de evento | Owner | P2 | ✅ tests/e2e/responsive/responsive.spec.ts | Chromium: PASS |
| RESP-017 | Calendario | calendario | Owner | P2 | ✅ tests/e2e/responsive/responsive.spec.ts | Chromium: PASS |
| RESP-018 | Finanzas | finanzas (tablas anchas con scroll contenido) | Owner | P2 | ✅ tests/e2e/responsive/responsive.spec.ts | Chromium: PASS |
| RESP-019 | Navegación | menú del panel admin abre y cierra en móvil/tablet | Owner | P2 | ✅ tests/e2e/responsive/responsive.spec.ts | Chromium: PASS |
| RESP-020 | Staff | portal staff | Staff | P1 | ✅ tests/e2e/responsive/responsive.spec.ts | Chromium: PASS |
| SMK-001 | API | health y base de datos responden | Anónimo | P0 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| SMK-002 | Auth | login por formulario de superadmin (SUPER_ADMIN) llega a su home /admin | SuperAdmin | P0 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| SMK-003 | Auth | login por formulario de owner (OWNER) llega a su home /admin | Owner | P0 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| SMK-004 | Auth | login por formulario de owner2 (OWNER) llega a su home /admin | Owner (Rosa) | P0 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| SMK-005 | Auth | login por formulario de staff (STAFF) llega a su home /staff | Staff | P0 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| SMK-006 | Auth | login por formulario de staff2 (STAFF) llega a su home /staff | Staff (Carlos) | P0 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| SMK-010 | Público | página pública / carga con su contenido y sin errores | Anónimo | P0 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| SMK-011 | Público | página pública /experiencias carga con su contenido y sin errores | Anónimo | P0 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| SMK-012 | Público | página pública /experiencias/signature-brunch carga con su contenido y sin errores | Anónimo | P0 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS · nota: ENV-01 |
| SMK-013 | Público | página pública /crear-experiencia carga con su contenido y sin errores | Anónimo | P0 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| SMK-014 | Público | página pública /contacto carga con su contenido y sin errores | Anónimo | P0 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| SMK-015 | Público | página pública /como-funciona carga con su contenido y sin errores | Anónimo | P1 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS |
| SMK-016 | Público | página pública /nuestra-historia carga con su contenido y sin errores | Anónimo | P1 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS |
| SMK-017 | Público | página pública /privacidad carga con su contenido y sin errores | Anónimo | P1 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS |
| SMK-018 | Público | página pública /terminos carga con su contenido y sin errores | Anónimo | P1 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS |
| SMK-019 | Público | página pública /login carga con su contenido y sin errores | Anónimo | P0 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| SMK-020 | Público | catálogo público muestra las experiencias activas de la base | Anónimo | P1 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS |
| SMK-021 | Dashboard | dashboard admin con saludo y paneles | Owner | P1 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS |
| SMK-022 | Leads | leads: lista y búsqueda muestran un lead real | Owner | P1 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS |
| SMK-023 | Cotizaciones | cotizaciones: lista con la propuesta sembrada | Owner | P1 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS |
| SMK-024 | Eventos | eventos: lista y detalle de un evento real | Owner | P1 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS |
| SMK-025 | Calendario | calendario del mes | Owner | P1 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS |
| SMK-026 | Inventario | inventario muestra artículos de la base | Owner | P1 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS |
| SMK-027 | Compras | compras y proveedores | Owner | P1 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS |
| SMK-028 | Finanzas | finanzas con eventos y totales | Owner | P1 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS |
| SMK-029 | Ajustes | ajustes del negocio cargan los valores guardados | Owner | P1 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS |
| SMK-030 | Staff | portal staff: Lupita ve sólo sus eventos asignados | Staff | P1 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS · Móvil 390: PASS |
| SMK-031 | Cotizaciones | cotización por token (Lucía) | Clienta (token) | P0 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS · Móvil 390: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| SMK-032 | Portal | portal de la clienta por token (Sofía) | Clienta (token) | P0 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS · Móvil 390: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| SMK-033 | Invitadas/RSVP | invitación general y RSVP personal (Sofía / Camila) | Invitada (token) | P0 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS · Móvil 390: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| SMK-034 | Memory Capsule | Memory Capsule pública por token (Valeria) | Invitada (token) | P0 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS · Móvil 390: PASS · Firefox: BLOCKED (ENV-02) · WebKit: PASS |
| SMK-035 | Portal | token inválido responde 404 genérico sin datos | Anónimo | P1 | ✅ tests/e2e/smoke/smoke.spec.ts | Chromium: PASS |
