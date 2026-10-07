# Test Coverage Matrix — FULL final (754e2c6)

Generado por `.claude/skills/e2e-quality-gate/scripts/coverage-matrix.mjs` desde: `test-results/l1/results.json`, `test-results/l2/results.json`, `test-results/l3/results.json`, `test-results/l4/results.json`, `test-results/l5/results.json`, `test-results/l6/results.json`, `test-results/l2/global/results.json`, `test-results/l3/global/results.json`, `test-results/l4/global/results.json`, `test-results/l5/global/results.json`, `test-results/l9/ratelimit/results.json`.
Un escenario = una prueba con ID; el resultado combina todos los proyectos donde corrió (el peor manda). FLAKY = pasó sólo al reintentar (no cuenta como PASS).

**Escenarios:** 888 · PASS: 888 · FAIL: 0 · FLAKY: 0 · BLOCKED: 0 · NOT TESTED: 0 · NOT APPLICABLE: 0

## Por módulo

| Módulo | Total | PASS | FAIL | FLAKY | BLOCKED | NOT TESTED | NOT APPLICABLE |
|---|---|---|---|---|---|---|---|
| ai | 9 | 9 | 0 | 0 | 0 | 0 | 0 |
| analytics | 3 | 3 | 0 | 0 | 0 | 0 | 0 |
| api | 42 | 42 | 0 | 0 | 0 | 0 | 0 |
| auth | 175 | 175 | 0 | 0 | 0 | 0 | 0 |
| calendar | 16 | 16 | 0 | 0 | 0 | 0 | 0 |
| catalog | 32 | 32 | 0 | 0 | 0 | 0 | 0 |
| configurator | 30 | 30 | 0 | 0 | 0 | 0 | 0 |
| content | 14 | 14 | 0 | 0 | 0 | 0 | 0 |
| customers | 17 | 17 | 0 | 0 | 0 | 0 | 0 |
| events | 43 | 43 | 0 | 0 | 0 | 0 | 0 |
| finance | 16 | 16 | 0 | 0 | 0 | 0 | 0 |
| guests | 33 | 33 | 0 | 0 | 0 | 0 | 0 |
| inventory | 26 | 26 | 0 | 0 | 0 | 0 | 0 |
| leads | 39 | 39 | 0 | 0 | 0 | 0 | 0 |
| memory | 34 | 34 | 0 | 0 | 0 | 0 | 0 |
| navigation | 24 | 24 | 0 | 0 | 0 | 0 | 0 |
| notifications | 7 | 7 | 0 | 0 | 0 | 0 | 0 |
| operations | 30 | 30 | 0 | 0 | 0 | 0 | 0 |
| payments | 29 | 29 | 0 | 0 | 0 | 0 | 0 |
| portal | 51 | 51 | 0 | 0 | 0 | 0 | 0 |
| public | 57 | 57 | 0 | 0 | 0 | 0 | 0 |
| purchases | 15 | 15 | 0 | 0 | 0 | 0 | 0 |
| quotes | 61 | 61 | 0 | 0 | 0 | 0 | 0 |
| settings | 18 | 18 | 0 | 0 | 0 | 0 | 0 |
| staff | 50 | 50 | 0 | 0 | 0 | 0 | 0 |
| users | 11 | 11 | 0 | 0 | 0 | 0 | 0 |
| vendors | 6 | 6 | 0 | 0 | 0 | 0 | 0 |

## Escenarios

| ID | Módulo | Escenario | Rol | Priority | Automated | Result |
|---|---|---|---|---|---|---|
| A11Y-001 | public | axe sin violaciones graves: inicio | anonimo | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-002 | public | axe sin violaciones graves: catálogo | anonimo | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-003 | public | axe sin violaciones graves: detalle de experiencia | anonimo | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-004 | configurator | axe sin violaciones graves: configurador (paso 1) | anonimo | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-005 | public | axe sin violaciones graves: contacto | anonimo | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-006 | auth | axe sin violaciones graves: login | anonimo | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-007 | quotes | axe sin violaciones graves: cotización por token | anonimo | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-008 | payments | axe sin violaciones graves: pago simulado | clienta | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-009 | portal | axe sin violaciones graves: portal de la clienta | anonimo | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-010 | guests | axe sin violaciones graves: RSVP de invitada | anonimo | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-011 | memory | axe sin violaciones graves: Memory Capsule | anonimo | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-012 | analytics | axe sin violaciones graves: dashboard admin | owner | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-013 | leads | axe sin violaciones graves: leads | owner | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-014 | events | axe sin violaciones graves: detalle de evento | owner | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-015 | calendar | axe sin violaciones graves: calendario | owner | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-016 | staff | axe sin violaciones graves: portal staff | staff | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-017 | public | axe sin violaciones graves: cómo funciona | anonimo | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-018 | finance | axe sin violaciones graves: finanzas | owner | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-020 | auth | login completo sólo con teclado y foco visible | owner | P1 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-021 | configurator | configurador: radios con flechas, avance con teclado y foco al título del paso | anonimo | P1 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-022 | guests | RSVP: elegir respuesta con teclado, foco visible y labels asociados | invitada | P1 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-023 | public | enlace 'Saltar al contenido' lleva el foco al contenido principal | anonimo | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-024 | public | formularios públicos: todos los campos con label asociado y requeridos marcados | anonimo | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-025 | navigation | landmarks: banner, navegación, main y footer en público; main y navegación en el panel | anonimo | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-026 | public | imágenes con texto alternativo (o marcadas como decorativas) | anonimo | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-027 | public | prefers-reduced-motion elimina animaciones y transiciones | anonimo | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| A11Y-028 | quotes | diálogo de aceptar propuesta: foco dentro, Escape cierra y regresa el foco | clienta | P2 | ✅ `tests/e2e/accessibility/a11y.spec.ts` | PASS |
| AI-001 | ai | generar una propuesta: concepto + estimado del motor real, guardada como AiDesign y medida | anonimo | P1 | ✅ `tests/e2e/ai-designer/ai-designer.spec.ts` | PASS (chromium, mobile-chrome) |
| AI-002 | ai | «Quiero esta experiencia» crea un lead AI_DESIGNER ligado al diseño y la fundadora lo ve | anonimo | P1 | ✅ `tests/e2e/ai-designer/ai-designer.spec.ts` | PASS (chromium, mobile-chrome) |
| AI-003 | ai | el formulario exige ocasión, perfil, presupuesto, vibra y zona (sin generar nada) | anonimo | P1 | ✅ `tests/e2e/ai-designer/ai-designer.spec.ts` | PASS |
| AI-004 | ai | el backend rechaza entradas inválidas del diseñador (invitadas, presupuesto, zona, colores, vibras) | anonimo | P1 | ✅ `tests/e2e/ai-designer/ai-designer.spec.ts` | PASS |
| AI-005 | ai | convertir el mismo diseño dos veces devuelve el mismo folio (un solo lead) | anonimo | P1 | ✅ `tests/e2e/ai-designer/ai-designer.spec.ts` | PASS |
| AI-006 | ai | convertir con diseño inexistente, fecha pasada, sin consentimiento o teléfono inválido se rechaza sin crear lead | anonimo | P1 | ✅ `tests/e2e/ai-designer/ai-designer.spec.ts` | PASS |
| AI-007 | ai | un diseño de más de 30 días ya no se puede convertir | anonimo | P2 | ✅ `tests/e2e/ai-designer/ai-designer.spec.ts` | PASS |
| AI-008 | ai | la propuesta respeta el presupuesto y el número de invitadas pedido (estimado del motor real) | anonimo | P2 | ✅ `tests/e2e/ai-designer/ai-designer.spec.ts` | PASS |
| AI-009 | ai | AI_DESIGNER_ENABLED=false: la página muestra la pausa, el configurador oculta el acceso y el backend rechaza generar y convertir | anonimo | P1 | ✅ `tests/e2e/ai-designer/ai-flag.global.spec.ts` | PASS |
| API-001 | api | /api/health responde {status:ok} sin caché | anonimo | P1 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-002 | api | /api/health/db verifica PostgreSQL (status ok, database up, latencia numérica) | anonimo | P1 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-003 | api | POST /api/health → 405 | anonimo | P3 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-004 | api | DELETE /api/health/db → 405 | anonimo | P3 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-005 | api | DELETE /api/admin/leads-export → 405 | anonimo | P3 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-006 | api | POST /api/events/cxxxxxxxxxxxxxxxxxxxxxxxx/guests.csv → 405 | anonimo | P3 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-007 | api | PUT /api/media/upload → 405 | anonimo | P3 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-008 | api | POST /api/media/cxxxxxxxxxxxxxxxxxxxxxxxx → 405 | anonimo | P3 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-009 | api | GET /api/analytics/track → 405 | anonimo | P3 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-010 | api | DELETE /api/cron/notifications → 405 | anonimo | P3 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-011 | api | GET /api/webhooks/payments/mock → 405 | anonimo | P3 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-012 | api | GET /api/memory/aaaaaaaaaaaaaaaaaaaaaaaa/upload → 405 | anonimo | P3 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-020 | api | sin Authorization → 401 con WWW-Authenticate Bearer | anonimo | P0 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS (chromium, firefox, webkit) |
| API-021 | api | secreto incorrecto / esquema distinto / vacío → 401 y no ejecuta nada | anonimo | P0 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS (chromium, firefox, webkit) |
| API-022 | api | secreto correcto → 200 {ok:true} e idempotente (la 2ª corrida no duplica avisos) | anonimo | P1 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-030 | api | sin firma → 400 invalid_signature y no se registra ni procesa | anonimo | P0 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS (chromium, firefox, webkit) |
| API-031 | api | firma inválida, con otro secreto, malformada o vencida (>300 s) → 400 sin efecto | anonimo | P0 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS (chromium, firefox, webkit) |
| API-032 | api | evento repetido con firma válida: se procesa una sola vez (duplicate:true) | anonimo | P0 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS (chromium, firefox, webkit) |
| API-033 | api | proveedor desconocido o con caracteres inválidos → 404 | anonimo | P2 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-034 | api | cuerpo > 256 KB → 413 sin procesar; JSON inválido con firma válida → 400 | anonimo | P2 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-035 | api | evento válido de un pago inexistente → 200 registrado con nota payment_not_found (sin efectos) | anonimo | P2 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-040 | api | CSRF: sin Origin, con Origin ajeno o Sec-Fetch-Site cross-site → 403 sin registrar | anonimo | P1 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-041 | api | mismo origen + cuerpo válido → 204 y AnalyticsEvent con origin=client | anonimo | P2 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-042 | api | cuerpo inválido: tipo no permitido, campos extra, JSON roto → 400; > 4 KB → 413 | anonimo | P2 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-050 | api | /api/auth/session: anónimo sin usuario; owner sin datos sensibles | owner | P1 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-051 | api | POST directo a /api/auth/callback/credentials sin token CSRF no crea sesión | anonimo | P1 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-052 | api | /api/auth/signin redirige al login propio; providers sólo expone credenciales | anonimo | P3 | ✅ `tests/e2e/api/handlers.spec.ts` | PASS |
| API-060 | api | privado sin firma o con firma inválida/ajena/vencida → 403; firma vigente → redirect | anonimo | P0 | ✅ `tests/e2e/api/media-csv.spec.ts` | PASS (chromium, firefox, webkit) |
| API-061 | api | público: libre; id malformado o inexistente → 404 genérico | anonimo | P2 | ✅ `tests/e2e/api/media-csv.spec.ts` | PASS |
| API-062 | api | sin sesión → 401; con sesión pero Origin ajeno o sin Origin → 403 (CSRF); nada se guarda | owner | P0 | ✅ `tests/e2e/api/media-csv.spec.ts` | PASS (chromium, firefox, webkit) |
| API-063 | api | magic bytes falsos (texto .jpg), SVG con script y HTML → rechazados sin MediaAsset | owner | P0 | ✅ `tests/e2e/api/media-csv.spec.ts` | PASS (chromium, firefox, webkit) |
| API-064 | api | archivo que supera UPLOAD_MAX_MB → rechazado con mensaje de tamaño | owner | P1 | ✅ `tests/e2e/api/media-csv.spec.ts` | PASS |
| API-065 | api | campos inválidos (sin archivo, propósito inexistente) → 400 | owner | P2 | ✅ `tests/e2e/api/media-csv.spec.ts` | PASS |
| API-066 | api | owner sube PNG real → MediaAsset privado en base y se sirve sólo con URL firmada | owner | P1 | ✅ `tests/e2e/api/media-csv.spec.ts` | PASS |
| API-067 | api | staff: sólo evidencias de checklist de eventos ASIGNADOS (otro propósito o evento ajeno → 403) | staff | P0 | ✅ `tests/e2e/api/media-csv.spec.ts` | PASS (chromium, firefox, webkit) |
| API-068 | api | subida pública a cápsula: Origin ajeno → 403; sin consentimiento → 400; válida → 201 privada y pendiente de revisión | invitada | P1 | ✅ `tests/e2e/api/media-csv.spec.ts` | PASS |
| API-070 | api | leads CSV: anónimo 401, staff 403; owner obtiene CSV con BOM, encabezados y fórmulas neutralizadas (auditado) | owner | P0 | ✅ `tests/e2e/api/media-csv.spec.ts` | PASS (chromium, firefox, webkit) |
| API-071 | api | guests.csv: anónimo 401, staff 403 (incluso de su evento), evento inexistente 404; owner CSV neutralizado | owner | P0 | ✅ `tests/e2e/api/media-csv.spec.ts` | PASS (chromium, firefox, webkit) |
| API-072 | api | finanzas CSV (/admin/finance/export): anónimo → login, staff → /staff; owner CSV con montos y títulos neutralizados | owner | P0 | ✅ `tests/e2e/api/media-csv.spec.ts` | PASS (chromium, firefox, webkit) |
| API-080 | api | contacto: 5 envíos reales crean 5 leads; el 6º se rechaza con mensaje de límite y no crea lead | anonimo | P1 | ✅ `tests/e2e/api/public-actions.ratelimit.spec.ts` | PASS |
| API-081 | api | configurador: el 6º envío en 10 min responde RATE_LIMITED aunque el payload sea inválido | anonimo | P1 | ✅ `tests/e2e/api/public-actions.ratelimit.spec.ts` | PASS |
| AUTH-001 | auth | login válido de superadmin redirige a su inicio con sesión httpOnly | superadmin | P0 | ✅ `tests/e2e/auth/login.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-002 | auth | login válido de owner redirige a su inicio con sesión httpOnly | owner | P0 | ✅ `tests/e2e/auth/login.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-003 | auth | login válido de owner2 redirige a su inicio con sesión httpOnly | owner2 | P0 | ✅ `tests/e2e/auth/login.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-004 | auth | login válido de staff redirige a su inicio con sesión httpOnly | staff | P0 | ✅ `tests/e2e/auth/login.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-005 | auth | login válido de staff2 redirige a su inicio con sesión httpOnly | staff2 | P0 | ✅ `tests/e2e/auth/login.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-006 | auth | contraseña incorrecta: mensaje genérico, sin sesión y sin lastLoginAt | anonimo | P0 | ✅ `tests/e2e/auth/login.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-007 | auth | usuario inexistente recibe exactamente el mismo mensaje (sin enumeración) | anonimo | P0 | ✅ `tests/e2e/auth/login.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-008 | auth | campos vacíos: el navegador exige ambos y el servidor también valida | anonimo | P1 | ✅ `tests/e2e/auth/login.spec.ts` | PASS |
| AUTH-009 | auth | correo con formato inválido es rechazado en servidor | anonimo | P2 | ✅ `tests/e2e/auth/login.spec.ts` | PASS |
| AUTH-010 | auth | usuaria desactivada no puede iniciar sesión (mensaje genérico) | anonimo | P0 | ✅ `tests/e2e/auth/login.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-011 | auth | cuenta con rol CUSTOMER no entra al equipo aunque la contraseña sea correcta | anonimo | P1 | ✅ `tests/e2e/auth/login.spec.ts` | PASS |
| AUTH-012 | auth | cuenta sin contraseña (ficha sin acceso) no puede iniciar sesión | anonimo | P2 | ✅ `tests/e2e/auth/login.spec.ts` | PASS |
| AUTH-013 | auth | con sesión abierta, /login redirige al inicio del rol | owner | P2 | ✅ `tests/e2e/auth/login.spec.ts` | PASS |
| AUTH-014 | auth | correo con mayúsculas y espacios se normaliza y permite entrar | anonimo | P2 | ✅ `tests/e2e/auth/login.spec.ts` | PASS |
| AUTH-015 | auth | formulario de login accesible y operable con teclado | anonimo | P2 | ✅ `tests/e2e/auth/login.spec.ts` | PASS |
| AUTH-016 | auth | página de login: noindex, contraseña enmascarada y autocompletado correcto | anonimo | P3 | ✅ `tests/e2e/auth/login.spec.ts` | PASS |
| AUTH-017 | auth | recuperación pública de contraseña: no existe (restablecimiento sólo por admin) | anonimo | P3 | ✅ `tests/e2e/auth/login.spec.ts` | PASS |
| AUTH-020 | auth | logout desde el panel elimina la cookie y vuelve a /login | owner | P0 | ✅ `tests/e2e/auth/session.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-021 | auth | tras logout, 'Atrás' no muestra datos privados del panel | owner | P1 | ✅ `tests/e2e/auth/session.spec.ts` | PASS |
| AUTH-022 | auth | respuestas del panel autenticado no se cachean (Cache-Control no-store) | owner | P2 | ✅ `tests/e2e/auth/session.spec.ts` | PASS |
| AUTH-023 | auth | sin cookies (request directo / apiAs anónimo) las páginas privadas redirigen a login | anonimo | P0 | ✅ `tests/e2e/auth/session.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-024 | auth | cookie de sesión manipulada o falsificada no autoriza | anonimo | P0 | ✅ `tests/e2e/auth/session.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-025 | auth | logout invalida la sesión en el servidor (la cookie anterior deja de servir) | owner | P1 | ✅ `tests/e2e/auth/session.spec.ts` | PASS |
| AUTH-026 | auth | dos pestañas: logout en una ⇒ la otra pierde acceso en el siguiente request | owner | P1 | ✅ `tests/e2e/auth/session.spec.ts` | PASS |
| AUTH-027 | auth | desactivar a una usuaria con sesión abierta corta su acceso en el siguiente request (páginas y acciones) | owner | P0 | ✅ `tests/e2e/auth/session.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-028 | auth | bajar de OWNER a STAFF con sesión abierta: el siguiente request ya no autoriza el panel ni sus acciones | owner | P0 | ✅ `tests/e2e/auth/session.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-029 | auth | subir de STAFF a OWNER aplica en el siguiente request (sin re-login) | staff | P2 | ✅ `tests/e2e/auth/session.spec.ts` | PASS |
| AUTH-030 | auth | logout desde el portal staff | staff | P1 | ✅ `tests/e2e/auth/session.spec.ts` | PASS |
| AUTH-031 | auth | /sin-acceso: página 403 clara, noindex y con salidas | anonimo | P3 | ✅ `tests/e2e/auth/session.spec.ts` | PASS |
| AUTH-032 | auth | logout con otra pestaña del panel cargando: la sesión NO debe revivir | owner | P0 | ✅ `tests/e2e/auth/session.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-033 | auth | restablecer la contraseña desde Usuarios cierra las sesiones abiertas de esa cuenta | superadmin | P1 | ✅ `tests/e2e/auth/session.spec.ts` | PASS |
| AUTH-034 | auth | restablecer la contraseña de un integrante (Staff) cierra su sesión del portal | owner | P1 | ✅ `tests/e2e/auth/session.spec.ts` | PASS |
| AUTH-035 | auth | cambiar el rol desde Usuarios cierra la sesión abierta; al volver a entrar aplica el rol nuevo | owner | P1 | ✅ `tests/e2e/auth/session.spec.ts` | PASS |
| AUTH-036 | auth | desactivar y reactivar una cuenta no revive la sesión anterior | superadmin | P1 | ✅ `tests/e2e/auth/session.spec.ts` | PASS |
| AUTH-037 | auth | restablecer la propia contraseña cierra la sesión actual y pide entrar con la nueva | owner | P1 | ✅ `tests/e2e/auth/session.spec.ts` | PASS |
| AUTH-038 | auth | una cookie ya revocada no puede cerrar las sesiones nuevas de la cuenta | owner | P2 | ✅ `tests/e2e/auth/session.spec.ts` | PASS |
| AUTH-040 | auth | ruta privada sin sesión → login con callbackUrl → tras entrar vuelve a esa ruta | owner | P0 | ✅ `tests/e2e/auth/callback.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-041 | auth | STAFF con callbackUrl a /admin termina en /staff | staff | P1 | ✅ `tests/e2e/auth/callback.spec.ts` | PASS |
| AUTH-042 | auth | STAFF con callbackUrl interno permitido (/staff/...) lo respeta | staff | P2 | ✅ `tests/e2e/auth/callback.spec.ts` | PASS |
| AUTH-043 | auth | callbackUrl malicioso "https://evil.example/robo" no redirige fuera de la app | owner | P0 | ✅ `tests/e2e/auth/callback.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-044 | auth | callbackUrl malicioso "//evil.example/robo" no redirige fuera de la app | owner | P0 | ✅ `tests/e2e/auth/callback.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-045 | auth | callbackUrl malicioso "/\\evil.example/robo" no redirige fuera de la app | owner | P0 | ✅ `tests/e2e/auth/callback.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-046 | auth | callbackUrl malicioso "\\\\evil.example" no redirige fuera de la app | owner | P0 | ✅ `tests/e2e/auth/callback.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-047 | auth | callbackUrl malicioso "javascript:alert(document.domain)" no redirige fuera de la app | owner | P0 | ✅ `tests/e2e/auth/callback.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-048 | auth | callbackUrl malicioso "/%2F%2Fevil.example" no redirige fuera de la app | owner | P0 | ✅ `tests/e2e/auth/callback.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-049 | auth | callbackUrl malicioso "/\t/evil.example" no redirige fuera de la app | owner | P0 | ✅ `tests/e2e/auth/callback.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-050 | auth | callbackUrl malicioso "http://localhost.example/" no redirige fuera de la app | owner | P0 | ✅ `tests/e2e/auth/callback.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-051 | auth | el middleware conserva ruta + query en callbackUrl y no acepta hosts | anonimo | P2 | ✅ `tests/e2e/auth/callback.spec.ts` | PASS |
| AUTH-053 | auth | JWT con ≥ 1 h: un GET de documento renueva la cookie (iat nuevo, mismos datos) y la renovada autoriza | owner | P1 | ✅ `tests/e2e/auth/session-renewal.spec.ts` | PASS |
| AUTH-054 | auth | JWT con ≥ 1 h: un GET RSC (navegación del cliente) también renueva la cookie | staff | P2 | ✅ `tests/e2e/auth/session-renewal.spec.ts` | PASS |
| AUTH-055 | auth | JWT con ≥ 1 h: un POST de Server Action NO re-emite la cookie (aunque la acción corre con esa sesión) | owner | P1 | ✅ `tests/e2e/auth/session-renewal.spec.ts` | PASS |
| AUTH-056 | auth | JWT reciente: un GET no re-emite la cookie de sesión | owner | P2 | ✅ `tests/e2e/auth/session-renewal.spec.ts` | PASS |
| AUTH-057 | auth | cookie de sesión inválida: el middleware conserva su borrado y manda a login | anonimo | P2 | ✅ `tests/e2e/auth/session-renewal.spec.ts` | PASS |
| AUTH-058 | auth | JWT con ≥ 1 h pero revocado: aunque un GET lo renueve, la cookie renovada sigue sin autorizar | owner | P1 | ✅ `tests/e2e/auth/session-renewal.spec.ts` | PASS |
| AUTH-059 | auth | GET /api/auth/session devuelve la sesión pero no re-emite la cookie (ni reciente ni antigua) | owner | P2 | ✅ `tests/e2e/auth/session-renewal.spec.ts` | PASS |
| AUTH-060 | auth | 8 intentos fallidos permitidos; el 9º se bloquea y ni la contraseña correcta entra | anonimo | P0 | ✅ `tests/e2e/auth/login.ratelimit.spec.ts` | PASS |
| AUTH-061 | auth | el bloqueo es por cuenta: otra cuenta desde el mismo navegador entra normalmente | anonimo | P1 | ✅ `tests/e2e/auth/login.ratelimit.spec.ts` | PASS |
| AUTH-062 | auth | correo inexistente también se limita con el mismo mensaje (sin enumeración por el limitador) | anonimo | P1 | ✅ `tests/e2e/auth/login.ratelimit.spec.ts` | PASS |
| AUTH-063 | auth | variar mayúsculas/espacios del correo no evade el límite (misma cubeta normalizada) | anonimo | P2 | ✅ `tests/e2e/auth/login.ratelimit.spec.ts` | PASS |
| AUTH-064 | auth | restablecer la propia contraseña desde Staff (fundadora con ficha) cierra la sesión actual y pide entrar con la nueva | owner | P1 | ✅ `tests/e2e/auth/session.spec.ts` | PASS |
| AUTH-065 | auth | loginAction descarta en el servidor el callbackUrl "https://evil.example/robo" aunque el formulario lo envíe | owner | P0 | ✅ `tests/e2e/auth/callback.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-066 | auth | loginAction descarta en el servidor el callbackUrl "//evil.example/robo" aunque el formulario lo envíe | owner | P0 | ✅ `tests/e2e/auth/callback.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-067 | auth | loginAction descarta en el servidor el callbackUrl "/\\evil.example/robo" aunque el formulario lo envíe | owner | P0 | ✅ `tests/e2e/auth/callback.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-068 | auth | loginAction descarta en el servidor el callbackUrl "\\\\evil.example" aunque el formulario lo envíe | owner | P0 | ✅ `tests/e2e/auth/callback.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-069 | auth | loginAction descarta en el servidor el callbackUrl "javascript:alert(document.domain)" aunque el formulario lo envíe | owner | P0 | ✅ `tests/e2e/auth/callback.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-070 | auth | loginAction descarta en el servidor el callbackUrl "/%2F%2Fevil.example" aunque el formulario lo envíe | owner | P0 | ✅ `tests/e2e/auth/callback.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-071 | auth | loginAction descarta en el servidor el callbackUrl "/\t/evil.example" aunque el formulario lo envíe | owner | P0 | ✅ `tests/e2e/auth/callback.spec.ts` | PASS (chromium, firefox, webkit) |
| AUTH-072 | auth | loginAction descarta en el servidor el callbackUrl "http://localhost.example/" aunque el formulario lo envíe | owner | P0 | ✅ `tests/e2e/auth/callback.spec.ts` | PASS (chromium, firefox, webkit) |
| CAL-001 | calendar | el calendario muestra el evento en su fecha y el chip abre el detalle | owner | P1 | ✅ `tests/e2e/calendar/calendar.spec.ts` | PASS |
| CAL-002 | calendar | navegación de meses con «Siguiente», «Anterior» y «Hoy» | owner | P1 | ✅ `tests/e2e/calendar/calendar.spec.ts` | PASS |
| CAL-003 | calendar | el mes llega por URL; un parámetro inválido o lejano vuelve al mes actual | owner | P2 | ✅ `tests/e2e/calendar/calendar.spec.ts` | PASS |
| CAL-004 | calendar | los eventos cancelados no se muestran pero se cuentan en el mes | owner | P2 | ✅ `tests/e2e/calendar/calendar.spec.ts` | PASS |
| CAL-005 | calendar | días cerrados se marcan «Cerrado» y el «+» de un día abierto precarga la fecha del alta | owner | P2 | ✅ `tests/e2e/calendar/calendar.spec.ts` | PASS |
| CAL-006 | calendar | staff y anónimo no acceden al calendario ni pueden crear excepciones por request | staff | P1 | ✅ `tests/e2e/calendar/calendar.spec.ts` | PASS |
| CAL-007 | calendar | accesibilidad (WCAG 2.1 AA) del calendario | owner | P2 | ✅ `tests/e2e/calendar/calendar.spec.ts` | PASS |
| CAL-008 | calendar | bloquear un día desde el calendario lo cierra en el configurador y en el alta; al eliminarlo se reabre | owner | P1 | ✅ `tests/e2e/calendar/availability.global.spec.ts` | PASS |
| CAL-009 | calendar | capacidad especial: el día admite el máximo configurado en configurador y calendario | owner | P1 | ✅ `tests/e2e/calendar/availability.global.spec.ts` | PASS |
| CAL-010 | calendar | blackout con motivo: el alta lo explica y el configurador lo bloquea | owner | P2 | ✅ `tests/e2e/calendar/availability.global.spec.ts` | PASS |
| CAL-011 | calendar | excepciones inválidas: duplicada, en el pasado y capacidad sin máximo | owner | P2 | ✅ `tests/e2e/calendar/availability.global.spec.ts` | PASS |
| CAL-012 | calendar | cerrar un día de la semana desde el horario semanal lo cierra en configurador, alta y calendario | owner | P1 | ✅ `tests/e2e/calendar/availability.global.spec.ts` | PASS |
| CAL-013 | calendar | horario semanal inválido se rechaza en el formulario y en el backend | owner | P2 | ✅ `tests/e2e/calendar/availability.global.spec.ts` | PASS |
| CAT-001 | catalog | el listado de experiencias muestra cada experiencia de la base con su precio base | owner | P1 | ✅ `tests/e2e/catalog/catalog-experiences.spec.ts` | PASS |
| CAT-002 | catalog | crear experiencia por UI: slug automático, precios en centavos, nace inactiva y queda auditada | owner | P1 | ✅ `tests/e2e/catalog/catalog-experiences.spec.ts` | PASS |
| CAT-003 | catalog | slug ya usado: aviso 'No disponible' en vivo y el servidor no crea duplicado | owner | P1 | ✅ `tests/e2e/catalog/catalog-experiences.spec.ts` | PASS |
| CAT-004 | catalog | backend: checkSlug informa disponibilidad y crear/editar con slug duplicado da CONFLICT | owner | P1 | ✅ `tests/e2e/catalog/catalog-experiences.spec.ts` | PASS |
| CAT-005 | catalog | validaciones del editor: mínimo > máximo y activar con precio $0 | owner | P1 | ✅ `tests/e2e/catalog/catalog-experiences.spec.ts` | PASS |
| CAT-006 | catalog | backend rechaza montos negativos, con más de 2 decimales o enormes, y personas fuera de rango | owner | P1 | ✅ `tests/e2e/catalog/catalog-experiences.spec.ts` | PASS |
| CAT-007 | catalog | editar experiencia: precio y nombre se guardan, el cambio de precio queda en auditoría | owner | P1 | ✅ `tests/e2e/catalog/catalog-experiences.spec.ts` | PASS |
| CAT-008 | catalog | activar/desactivar desde el listado cambia la visibilidad en el sitio público | owner | P1 | ✅ `tests/e2e/catalog/catalog-experiences.spec.ts` | PASS |
| CAT-009 | catalog | no se puede activar una experiencia con precio base $0 (rollback del switch) | owner | P2 | ✅ `tests/e2e/catalog/catalog-experiences.spec.ts` | PASS |
| CAT-010 | catalog | eliminar una experiencia sin uso la borra, queda auditado y no reaparece | owner | P1 | ✅ `tests/e2e/catalog/catalog-experiences.spec.ts` | PASS |
| CAT-011 | catalog | eliminar una experiencia ligada a un lead la desactiva (integridad) en lugar de borrarla | owner | P1 | ✅ `tests/e2e/catalog/catalog-experiences.spec.ts` | PASS |
| CAT-012 | catalog | subir dos fotos, reordenarlas y quitar una (MediaUploader → S3 local) | owner | P2 | ✅ `tests/e2e/catalog/catalog-experiences.spec.ts` | PASS |
| CAT-013 | catalog | un archivo que no es imagen (magic bytes) se rechaza y no se agrega a la galería | owner | P2 | ✅ `tests/e2e/catalog/catalog-experiences.spec.ts` | PASS |
| CAT-016 | catalog | crear menú por UI con upgrade por persona (precio y costo en centavos) | owner | P1 | ✅ `tests/e2e/catalog/catalog-entities.spec.ts` | PASS |
| CAT-017 | catalog | un menú 'Incluido' guarda precio $0 aunque se envíe otro monto (sin cobros fantasma) | owner | P2 | ✅ `tests/e2e/catalog/catalog-entities.spec.ts` | PASS |
| CAT-018 | catalog | platillos: agregar, editar y eliminar con persistencia | owner | P1 | ✅ `tests/e2e/catalog/catalog-entities.spec.ts` | PASS |
| CAT-019 | catalog | reordenar platillos (subir/bajar y 'Ordenar por tiempo') persiste el orden | owner | P2 | ✅ `tests/e2e/catalog/catalog-entities.spec.ts` | PASS |
| CAT-020 | catalog | backend: reordenar con ids ajenos o incompletos se rechaza sin cambiar el orden | owner | P2 | ✅ `tests/e2e/catalog/catalog-entities.spec.ts` | PASS |
| CAT-021 | catalog | eliminar menú: sin uso se borra; ligado a una experiencia se desactiva | owner | P1 | ✅ `tests/e2e/catalog/catalog-entities.spec.ts` | PASS |
| CAT-022 | catalog | crear add-on por persona por UI (precio/costo en centavos, categoría de costo) | owner | P1 | ✅ `tests/e2e/catalog/catalog-entities.spec.ts` | PASS |
| CAT-023 | catalog | editar precio de un add-on queda auditado (catalog.price_changed) | owner | P1 | ✅ `tests/e2e/catalog/catalog-entities.spec.ts` | PASS |
| CAT-024 | catalog | backend rechaza montos/cantidades inválidas en add-ons | owner | P1 | ✅ `tests/e2e/catalog/catalog-entities.spec.ts` | PASS |
| CAT-025 | catalog | eliminar add-on usado en una cotización lo desactiva; sin uso se borra | owner | P1 | ✅ `tests/e2e/catalog/catalog-entities.spec.ts` | PASS |
| CAT-026 | catalog | estilo: crear con paleta, editar y eliminar (sin uso) | owner | P2 | ✅ `tests/e2e/catalog/catalog-entities.spec.ts` | PASS |
| CAT-027 | catalog | backend: paleta con colores no hex y slug inválido se rechazan | owner | P3 | ✅ `tests/e2e/catalog/catalog-entities.spec.ts` | PASS |
| CAT-028 | catalog | zona: crear con códigos postales y tarifa; un CP inválido se marca y no se agrega | owner | P1 | ✅ `tests/e2e/catalog/catalog-entities.spec.ts` | PASS |
| CAT-029 | catalog | zona con códigos postales que ya cubre otra zona: se guarda y avisa del traslape | owner | P2 | ✅ `tests/e2e/catalog/catalog-entities.spec.ts` | PASS |
| CAT-030 | catalog | eliminar zona: ligada a un lead se desactiva; libre se borra | owner | P2 | ✅ `tests/e2e/catalog/catalog-entities.spec.ts` | PASS |
| CAT-031 | catalog | rango de presupuesto: crear (con etiqueta sugerida), editar y eliminar | owner | P2 | ✅ `tests/e2e/catalog/catalog-entities.spec.ts` | PASS |
| CAT-032 | catalog | rango de presupuesto inválido: máximo ≤ mínimo (UI) y montos negativos (backend) | owner | P2 | ✅ `tests/e2e/catalog/catalog-entities.spec.ts` | PASS |
| CAT-033 | catalog | eliminar un rango ligado a un lead lo desactiva | owner | P3 | ✅ `tests/e2e/catalog/catalog-entities.spec.ts` | PASS |
| CAT-034 | catalog | las pestañas del catálogo cargan cada sección y marcan la activa | owner | P3 | ✅ `tests/e2e/catalog/catalog-entities.spec.ts` | PASS |
| CNT-001 | content | crear un testimonio guarda autora, calificación y visibilidad y se audita | owner | P1 | ✅ `tests/e2e/content/content.spec.ts` | PASS |
| CNT-002 | content | el testimonio exige autora (2+) y texto (10+) | owner | P2 | ✅ `tests/e2e/content/content.spec.ts` | PASS |
| CNT-003 | content | editar, ocultar y eliminar un testimonio persiste en la base (con auditoría) | owner | P1 | ✅ `tests/e2e/content/content.spec.ts` | PASS |
| CNT-006 | content | crear una pregunta frecuente con categoría la guarda, la audita y la filtra por categoría | owner | P1 | ✅ `tests/e2e/content/content.spec.ts` | PASS |
| CNT-007 | content | editar, ocultar y eliminar una pregunta frecuente persiste (con auditoría) | owner | P1 | ✅ `tests/e2e/content/content.spec.ts` | PASS |
| CNT-008 | content | la pregunta frecuente exige pregunta y respuesta (5+) | owner | P2 | ✅ `tests/e2e/content/content.spec.ts` | PASS |
| CNT-010 | content | subir una foto a la galería, ponerle texto alternativo, destacarla y eliminarla | owner | P1 | ✅ `tests/e2e/content/content.spec.ts` | PASS |
| CNT-011 | content | el texto alternativo exige 3+ caracteres (sin cambios en base) | owner | P2 | ✅ `tests/e2e/content/content.spec.ts` | PASS |
| CNT-012 | content | un archivo que no es imagen se rechaza al subirlo a la galería | owner | P2 | ✅ `tests/e2e/content/content.spec.ts` | PASS |
| CNT-020 | content | un testimonio visible con orden 0 aparece primero en la portada; oculto desaparece | owner | P1 | ✅ `tests/e2e/content/content.global.spec.ts` | PASS |
| CNT-021 | content | una pregunta general visible aparece en «Cómo funciona»; oculta desaparece | owner | P1 | ✅ `tests/e2e/content/content.global.spec.ts` | PASS |
| CNT-022 | content | subir/bajar una pregunta frecuente intercambia su posición con la vecina | owner | P2 | ✅ `tests/e2e/content/content.global.spec.ts` | PASS |
| CNT-023 | content | reordenar testimonios persiste el orden y la lista se actualiza en pantalla | owner | P2 | ✅ `tests/e2e/content/content.global.spec.ts` | PASS |
| CNT-024 | content | reordenar fotos de la galería persiste el orden y la tarjeta cambia de posición | owner | P2 | ✅ `tests/e2e/content/content.global.spec.ts` | PASS |
| CONF-001 | configurator | recorrido completo: estimado de servidor → envío → lead NEW + clienta + snapshot + avisos → visible en /admin/leads | anonimo | P0 | ✅ `tests/e2e/configurator/wizard.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| CONF-002 | configurator | el estimado se recalcula en servidor al cambiar invitadas y extras (sin costos internos) | anonimo | P1 | ✅ `tests/e2e/configurator/wizard.spec.ts` | PASS |
| CONF-003 | configurator | límites de invitadas en la UI: mínimo 2, máximo 40 y aviso de consulta especial | anonimo | P1 | ✅ `tests/e2e/configurator/wizard.spec.ts` | PASS |
| CONF-004 | configurator | calendario: pasados, lunes, bloqueados y llenos no se pueden elegir; el paso exige fecha | anonimo | P1 | ✅ `tests/e2e/configurator/wizard.spec.ts` | PASS |
| CONF-005 | configurator | datos de contacto inválidos: errores por campo y no se crea ningún lead | anonimo | P1 | ✅ `tests/e2e/configurator/wizard.spec.ts` | PASS |
| CONF-006 | configurator | doble clic en «Consultar disponibilidad» crea un solo lead | anonimo | P1 | ✅ `tests/e2e/configurator/wizard.spec.ts` | PASS |
| CONF-007 | configurator | recargar a mitad del wizard ofrece continuar el borrador y el envío funciona | anonimo | P2 | ✅ `tests/e2e/configurator/wizard.spec.ts` | PASS |
| CONF-008 | configurator | «Otra zona»: el lead queda fuera de cobertura con la colonia y la logística «por confirmar» | anonimo | P1 | ✅ `tests/e2e/configurator/wizard.spec.ts` | PASS |
| CONF-009 | configurator | grupo de 20 personas: consulta especial marcada en el lead y en la confirmación | anonimo | P1 | ✅ `tests/e2e/configurator/wizard.spec.ts` | PASS |
| CONF-010 | configurator | llegar desde una experiencia (?experiencia=&ocasion=) preselecciona ocasión y experiencia | anonimo | P1 | ✅ `tests/e2e/configurator/wizard.spec.ts` | PASS |
| CONF-011 | configurator | cada paso valida antes de avanzar con mensajes claros | anonimo | P2 | ✅ `tests/e2e/configurator/wizard.spec.ts` | PASS |
| CONF-012 | configurator | accesibilidad del configurador (pasos 1–2 y resumen) y navegación por teclado del paso 1 | anonimo | P2 | ✅ `tests/e2e/configurator/wizard.spec.ts` | PASS |
| CONF-013 | configurator | el estimado se calcula en servidor con las reglas del motor (base, extras, menú/extra por persona, logística, IVA 16 % incluido, anticipo 50 %) | anonimo | P0 | ✅ `tests/e2e/configurator/server.spec.ts` | PASS (chromium, firefox, webkit) |
| CONF-014 | configurator | el catálogo que recibe el navegador no incluye costos internos | anonimo | P0 | ✅ `tests/e2e/configurator/server.spec.ts` | PASS (chromium, firefox, webkit) |
| CONF-015 | configurator | precio manipulado en el request: el servidor lo ignora y guarda el estimado recalculado | anonimo | P0 | ✅ `tests/e2e/configurator/server.spec.ts` | PASS (chromium, firefox, webkit) |
| CONF-016 | configurator | disponibilidad pública: estados por día correctos y sin datos de otros eventos | anonimo | P1 | ✅ `tests/e2e/configurator/server.spec.ts` | PASS |
| CONF-017 | configurator | fechas pasadas o bloqueadas se rechazan al enviar (aunque se fuerce el request) y no crean lead | anonimo | P1 | ✅ `tests/e2e/configurator/server.spec.ts` | PASS |
| CONF-018 | configurator | el backend rechaza contacto inválido, consentimiento falso, límites de invitadas e ids incompatibles | anonimo | P1 | ✅ `tests/e2e/configurator/server.spec.ts` | PASS |
| CONF-019 | configurator | reintento con el mismo submissionId devuelve el mismo folio sin duplicar lead, clienta ni avisos | anonimo | P1 | ✅ `tests/e2e/configurator/server.spec.ts` | PASS |
| CONF-020 | configurator | día lleno: la solicitud se acepta como consulta y el equipo ve la nota «Fecha llena» | anonimo | P2 | ✅ `tests/e2e/configurator/server.spec.ts` | PASS |
| CONF-021 | configurator | la misma clienta (mismo teléfono) que vuelve a escribir no se duplica (y su perfil no toma el correo escrito en el sitio) | anonimo | P2 | ✅ `tests/e2e/configurator/server.spec.ts` | PASS |
| CONF-022 | configurator | la clienta se reconoce entre canales por teléfono (configurador → diseñador IA / contacto) | anonimo | P2 | ✅ `tests/e2e/configurator/server.spec.ts` | PASS |
| CONF-023 | configurator | analítica del embudo: inicio y resumen se registran con el id de sesión | anonimo | P3 | ✅ `tests/e2e/configurator/server.spec.ts` | PASS |
| CONF-024 | configurator | resumen con líneas por persona («· N × $precio») sin texto atenuado bajo AA | anonimo | P2 | ✅ `tests/e2e/configurator/wizard.spec.ts` | PASS |
| CONF-025 | configurator | antes de que el configurador hidrate, «Siguiente» no envía el paso de forma nativa (ni recarga ni pierde la experiencia de partida) | anonimo | P1 | ✅ `tests/e2e/configurator/wizard.spec.ts` | PASS |
| CRIT-001 | configurator | configurador anónimo → lead NEW con clienta, snapshot y notificación → la fundadora lo ve y lo abre | anonimo | P0 | ✅ `tests/e2e/critical/sales.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| CRIT-002 | quotes | lead → cotización (precio del servidor) → envío → la clienta acepta → anticipo mock → evento confirmado → portal | owner | P0 | ✅ `tests/e2e/critical/sales.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| CRIT-003 | quotes | la clienta rechaza la propuesta por token → REJECTED, sin reserva ni evento, lead con actividad | clienta | P0 | ✅ `tests/e2e/critical/sales.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| CRIT-004 | guests | la anfitriona agrega una invitada en su portal → la invitada confirma RSVP → admin y portal ven la confirmación | clienta | P0 | ✅ `tests/e2e/critical/experience.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| CRIT-005 | staff | la fundadora asigna staff → el staff entra y ve SÓLO ese evento → marca su tarea → la fundadora la ve hecha | owner | P0 | ✅ `tests/e2e/critical/operations.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| CRIT-006 | payments | pago manual del saldo (fundadora) → saldo en cero, auditoría, notificación y portal liquidado | owner | P0 | ✅ `tests/e2e/critical/operations.spec.ts` | PASS (chromium, firefox, webkit) |
| CRIT-007 | finance | cierre del evento con costos reales → snapshot congelado y finanzas con margen correcto | owner | P0 | ✅ `tests/e2e/critical/operations.spec.ts` | PASS (chromium, firefox, webkit) |
| CRIT-008 | memory | Memory Capsule: la invitada deja mensaje y foto → la fundadora aprueba la foto → visible públicamente | invitada | P0 | ✅ `tests/e2e/critical/experience.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| CRIT-009 | auth | owner: login → panel → logout → las rutas privadas vuelven a pedir login (UI y request) | owner | P0 | ✅ `tests/e2e/critical/access.spec.ts` | PASS (chromium, firefox, webkit) |
| CRIT-010 | public | formulario de contacto público → lead CONTACT_FORM + clienta + notificación → visible en admin | anonimo | P0 | ✅ `tests/e2e/critical/sales.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| CRIT-011 | auth | superadmin: login → panel → logout → las rutas privadas vuelven a pedir login (UI y request) | superadmin | P0 | ✅ `tests/e2e/critical/access.spec.ts` | PASS (chromium, firefox, webkit) |
| CRIT-012 | auth | staff: login → /staff; /admin la regresa a /staff; logout cierra el portal | staff | P0 | ✅ `tests/e2e/critical/access.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| CRIT-013 | auth | anónima: ruta privada → login con callbackUrl → tras entrar regresa a esa ruta (sólo rutas internas) | anonimo | P0 | ✅ `tests/e2e/critical/access.spec.ts` | PASS (chromium, firefox, webkit) |
| CRIT-014 | auth | logout definitivo: una respuesta que estaba en vuelo al cerrar sesión no revive la sesión | staff | P0 | ✅ `tests/e2e/critical/access.spec.ts` | PASS (chromium, firefox, webkit) |
| CUST-001 | customers | el listado filtrado muestra el conteo y las filas que hay en la base | owner | P1 | ✅ `tests/e2e/customers/customers.spec.ts` | PASS |
| CUST-002 | customers | búsqueda por nombre, correo, teléfono, Instagram y código de referido; sin coincidencias | owner | P1 | ✅ `tests/e2e/customers/customers.spec.ts` | PASS |
| CUST-003 | customers | orden por nombre (A–Z) y por más recientes | owner | P3 | ✅ `tests/e2e/customers/customers.spec.ts` | PASS |
| CUST-004 | customers | paginación de clientas conservando búsqueda | owner | P3 | ✅ `tests/e2e/customers/customers.spec.ts` | PASS |
| CUST-005 | customers | la ficha muestra historial de leads, cotizaciones, eventos y pagos de la clienta (seed) | owner | P1 | ✅ `tests/e2e/customers/customers.spec.ts` | PASS |
| CUST-006 | customers | editar perfil normaliza Instagram/correo, guarda y audita antes/después | owner | P1 | ✅ `tests/e2e/customers/customers.spec.ts` | PASS |
| CUST-007 | customers | no se permite usar el correo de otra clienta (aunque cambie mayúsculas) | owner | P1 | ✅ `tests/e2e/customers/customers.spec.ts` | PASS |
| CUST-008 | customers | validaciones del perfil en el formulario (correo, teléfono, Instagram) | owner | P2 | ✅ `tests/e2e/customers/customers.spec.ts` | PASS |
| CUST-009 | customers | dos clientas pueden compartir teléfono: no hay validación de unicidad (ambigüedad de requisito) | owner | P3 | ✅ `tests/e2e/customers/customers.spec.ts` | PASS |
| CUST-010 | customers | eliminar clienta sin historial comercial: sus leads quedan sin clienta, auditado y no reaparece | owner | P1 | ✅ `tests/e2e/customers/customers.spec.ts` | PASS |
| CUST-011 | customers | una clienta con cotización no se puede eliminar (UI oculta el botón y el backend lo rechaza) | owner | P1 | ✅ `tests/e2e/customers/customers.spec.ts` | PASS |
| CUST-012 | customers | una clienta con reserva y evento (seed) no se puede eliminar desde el backend | superadmin | P1 | ✅ `tests/e2e/customers/customers.spec.ts` | PASS |
| CUST-013 | customers | ficha inexistente o con id malformado muestra 'No encontramos a esta clienta' | owner | P2 | ✅ `tests/e2e/customers/customers.spec.ts` | PASS |
| CUST-014 | customers | cancelar la eliminación no borra nada | owner | P2 | ✅ `tests/e2e/customers/customers.spec.ts` | PASS |
| CUST-015 | customers | el servidor valida el perfil aunque se salte el formulario | owner | P1 | ✅ `tests/e2e/customers/customers.spec.ts` | PASS |
| CUST-016 | customers | una clienta con teléfono guardado con formato se reutiliza al llegar un lead con ese número | owner | P2 | ✅ `tests/e2e/customers/customers.spec.ts` | PASS |
| CUST-017 | customers | un campo con descripción conserva descripción y error aunque los ids del HTML y de React difieran | owner | P2 | ✅ `tests/e2e/customers/customers.spec.ts` | PASS |
| EVT-001 | events | listado muestra eventos y filtra por estado y búsqueda (URL compartible) | owner | P1 | ✅ `tests/e2e/events/events.spec.ts` | PASS |
| EVT-002 | events | periodo «Pasados» lista eventos completados y no los futuros | owner | P2 | ✅ `tests/e2e/events/events.spec.ts` | PASS |
| EVT-003 | events | detalle: encabezado, estado y pestañas navegables sin errores | owner | P1 | ✅ `tests/e2e/events/events.spec.ts` | PASS |
| EVT-004 | events | evento inexistente muestra «No encontramos este evento» | owner | P2 | ✅ `tests/e2e/events/events.spec.ts` | PASS |
| EVT-005 | events | crear evento con nueva clienta persiste (INQUIRY, tokens, auditoría) y aparece en el listado | owner | P0 | ✅ `tests/e2e/events/events.spec.ts` | PASS (chromium, firefox, webkit) |
| EVT-006 | events | crear evento para una clienta existente (búsqueda) la vincula sin duplicarla | owner | P1 | ✅ `tests/e2e/events/events.spec.ts` | PASS |
| EVT-007 | events | fecha ocupada: aviso en vivo, confirmación explícita y auditoría del override | owner | P1 | ✅ `tests/e2e/events/events.spec.ts` | PASS |
| EVT-008 | events | validaciones del alta en el formulario (clienta, título y fecha requeridos) | owner | P1 | ✅ `tests/e2e/events/events.spec.ts` | PASS |
| EVT-009 | events | el backend rechaza altas inválidas aunque se salte la validación del cliente | owner | P1 | ✅ `tests/e2e/events/events.spec.ts` | PASS |
| EVT-010 | events | disponibilidad del alta: día cerrado, fecha pasada y fuera de horario | owner | P2 | ✅ `tests/e2e/events/events.spec.ts` | PASS |
| EVT-011 | events | doble clic en «Crear evento» genera un solo evento | owner | P3 | ✅ `tests/e2e/events/events.spec.ts` | PASS |
| EVT-012 | events | texto con HTML en el título se muestra escapado | owner | P2 | ✅ `tests/e2e/events/events.spec.ts` | PASS |
| EVT-013 | events | editar título, invitadas y notas persiste y audita los cambios sensibles | owner | P1 | ✅ `tests/e2e/events/events.spec.ts` | PASS |
| EVT-014 | events | reprogramar a una fecha llena pide confirmación y mueve el horario | owner | P1 | ✅ `tests/e2e/events/events.spec.ts` | PASS |
| EVT-015 | events | un evento completado o cancelado no se puede reprogramar (UI y backend) | owner | P1 | ✅ `tests/e2e/events/events.spec.ts` | PASS |
| EVT-016 | events | desactivar el micrositio deja sin efecto el link de invitación; reactivarlo lo restablece | owner | P2 | ✅ `tests/e2e/events/events.spec.ts` | PASS |
| EVT-017 | events | confirmar un evento en consulta lo confirma, audita y dispara el ciclo de vida (checklists e inventario) | owner | P0 | ✅ `tests/e2e/events/event-status.spec.ts` | PASS (chromium, firefox, webkit) |
| EVT-018 | events | recorrido completo de estados hasta «Completado» desde el panel | owner | P1 | ✅ `tests/e2e/events/event-status.spec.ts` | PASS |
| EVT-019 | events | transiciones inválidas: la UI sólo ofrece las válidas y el backend rechaza el resto | owner | P1 | ✅ `tests/e2e/events/event-status.spec.ts` | PASS |
| EVT-020 | events | confirmar en una fecha llena avisa del conflicto y sólo procede con confirmación explícita | owner | P1 | ✅ `tests/e2e/events/event-status.spec.ts` | PASS |
| EVT-021 | events | cancelar con motivo y aviso: estado, reserva, auditoría, notificación y portal/micrositio cancelados | owner | P0 | ✅ `tests/e2e/events/event-status.spec.ts` | PASS (chromium, firefox, webkit) |
| EVT-022 | events | cancelar libera las reservas de inventario del evento | owner | P1 | ✅ `tests/e2e/events/event-status.spec.ts` | PASS |
| EVT-023 | events | cancelar exige motivo (UI y backend) y no aplica a eventos completados | owner | P1 | ✅ `tests/e2e/events/event-status.spec.ts` | PASS |
| EVT-024 | events | al cancelar, un checkout de anticipo PENDIENTE no debe poder cobrarse | owner | P0 | ✅ `tests/e2e/events/event-status.spec.ts` | PASS (chromium, firefox, webkit) |
| EVT-025 | events | registrar el anticipo como pago manual confirma el evento, recalcula el saldo y audita | owner | P0 | ✅ `tests/e2e/events/event-payments.spec.ts` | PASS (chromium, firefox, webkit) |
| EVT-026 | events | un pago manual mayor al saldo pendiente se rechaza en la UI y en el backend | owner | P1 | ✅ `tests/e2e/events/event-payments.spec.ts` | PASS |
| EVT-027 | events | pago manual: fecha futura, monto mínimo, evento cancelado y evento sin reserva se rechazan | owner | P1 | ✅ `tests/e2e/events/event-payments.spec.ts` | PASS |
| EVT-028 | events | reembolso parcial de un pago cobrado: estado, fila REFUND, auditoría y saldo | owner | P0 | ✅ `tests/e2e/events/event-payments.spec.ts` | PASS (chromium, firefox, webkit) |
| EVT-029 | events | reembolsos inválidos: mayor a lo disponible, pago pendiente, fila de reembolso y doble reembolso total | owner | P1 | ✅ `tests/e2e/events/event-payments.spec.ts` | PASS |
| EVT-030 | events | staff y anónimo no pueden registrar pagos ni reembolsar aunque fuercen el request | staff | P0 | ✅ `tests/e2e/events/event-payments.spec.ts` | PASS (chromium, firefox, webkit) |
| EVT-031 | events | rotar el enlace del portal invalida el anterior (404) y audita sin guardar el token completo | owner | P1 | ✅ `tests/e2e/events/event-experience.spec.ts` | PASS |
| EVT-032 | events | rotar la invitación general invalida el link anterior pero no los links personales | owner | P1 | ✅ `tests/e2e/events/event-experience.spec.ts` | PASS |
| EVT-033 | events | programa del evento: agregar, editar y eliminar momentos; sólo los visibles llegan al micrositio | owner | P1 | ✅ `tests/e2e/events/event-experience.spec.ts` | PASS |
| EVT-034 | events | programa: el backend no permite editar ni borrar momentos de otro evento (IDOR) ni títulos vacíos | owner | P2 | ✅ `tests/e2e/events/event-experience.spec.ts` | PASS |
| EVT-035 | events | mensaje del equipo a la clienta: queda en la conversación, la notifica y lo ve en su portal | owner | P1 | ✅ `tests/e2e/events/event-experience.spec.ts` | PASS |
| EVT-036 | events | staff y anónimo: sin acceso a /admin/events y sin poder crear ni cancelar por request directo | staff | P0 | ✅ `tests/e2e/events/event-experience.spec.ts` | PASS (chromium, firefox, webkit) |
| EVT-037 | events | accesibilidad (WCAG 2.1 AA) del listado, el alta y el detalle de evento | owner | P2 | ✅ `tests/e2e/events/event-experience.spec.ts` | PASS |
| EVT-038 | events | «Limpiar filtros» regresa al listado sin filtros (navegación del cliente) | owner | P2 | ✅ `tests/e2e/events/events.spec.ts` | PASS |
| EVT-039 | events | buscar por el teléfono de la clienta en Eventos y Cotizaciones encuentra su evento en cualquier formato | owner | P2 | ✅ `tests/e2e/events/events.spec.ts` | PASS |
| EVT-040 | events | «Nueva clienta» deja Nombre, WhatsApp y Correo con su etiqueta aunque los ids del HTML y de React difieran | owner | P2 | ✅ `tests/e2e/events/events.spec.ts` | PASS |
| FIN-001 | finance | registrar un costo manual lo guarda en centavos, lo suma al total y lo audita | owner | P1 | ✅ `tests/e2e/finance/finance.spec.ts` | PASS |
| FIN-002 | finance | el costo manual exige descripción (3+) y monto mayor a $0 | owner | P2 | ✅ `tests/e2e/finance/finance.spec.ts` | PASS |
| FIN-003 | finance | editar un costo manual actualiza monto y categoría con auditoría antes/después | owner | P1 | ✅ `tests/e2e/finance/finance.spec.ts` | PASS |
| FIN-004 | finance | eliminar un costo manual lo quita del costo real y queda en auditoría | owner | P1 | ✅ `tests/e2e/finance/finance.spec.ts` | PASS |
| FIN-005 | finance | la rentabilidad del evento cuadra con la base: venta − IVA − costos reales = margen | owner | P0 | ✅ `tests/e2e/finance/finance.spec.ts` | PASS (chromium, firefox, webkit) |
| FIN-006 | finance | cerrar un evento completado congela números, audita, notifica a la clienta y bloquea costos | owner | P0 | ✅ `tests/e2e/finance/finance.spec.ts` | PASS (chromium, firefox, webkit) |
| FIN-007 | finance | el encabezado del evento (todas las pestañas) indica que el evento está cerrado | owner | P3 | ✅ `tests/e2e/finance/finance.spec.ts` | PASS |
| FIN-008 | finance | sólo se cierran eventos completados; el doble cierre se rechaza (backend) | owner | P1 | ✅ `tests/e2e/finance/finance.spec.ts` | PASS |
| FIN-010 | finance | /admin/finance muestra KPIs y el filtro «Cerrados» incluye el evento cerrado | owner | P1 | ✅ `tests/e2e/finance/finance.spec.ts` | PASS |
| FIN-011 | finance | la exportación CSV trae BOM, encabezados, filas en pesos y queda auditada; sin sesión → 401 | owner | P1 | ✅ `tests/e2e/finance/finance.spec.ts` | PASS |
| FIN-012 | finance | /admin/analytics renderiza con datos reales sin errores de consola | owner | P2 | ✅ `tests/e2e/finance/finance.spec.ts` | PASS |
| FIN-013 | finance | el CSV neutraliza fórmulas en textos (título que empieza con «=») | owner | P2 | ✅ `tests/e2e/finance/finance.spec.ts` | PASS |
| GST-001 | guests | agregar una invitada desde el admin genera su link personal y persiste | owner | P1 | ✅ `tests/e2e/guests/guests-admin.spec.ts` | PASS |
| GST-002 | guests | editar asistencia, acompañante y restricciones actualiza el resumen y audita el cambio de RSVP | owner | P1 | ✅ `tests/e2e/guests/guests-admin.spec.ts` | PASS |
| GST-003 | guests | quitar una invitada la elimina, audita y desactiva su link personal | owner | P1 | ✅ `tests/e2e/guests/guests-admin.spec.ts` | PASS |
| GST-004 | guests | contacto duplicado: aviso confirmable antes de guardar a otra persona con el mismo correo | owner | P2 | ✅ `tests/e2e/guests/guests-admin.spec.ts` | PASS |
| GST-005 | guests | validaciones de invitada en el formulario y en el backend (incluye IDOR de invitada) | owner | P2 | ✅ `tests/e2e/guests/guests-admin.spec.ts` | PASS |
| GST-006 | guests | exportar CSV: contenido correcto, BOM, auditoría, fórmulas neutralizadas y acceso restringido | owner | P1 | ✅ `tests/e2e/guests/guests-admin.spec.ts` | PASS |
| GST-007 | guests | recordatorio RSVP a pendientes: notificaciones por canal, auditoría y un solo envío por día | owner | P1 | ✅ `tests/e2e/guests/guests-admin.spec.ts` | PASS |
| GST-008 | guests | recordatorios bloqueados en eventos cancelados o con micrositio apagado (UI y backend) | owner | P2 | ✅ `tests/e2e/guests/guests-admin.spec.ts` | PASS |
| GST-009 | guests | ocultar y volver a mostrar un mensaje para la homenajeada (moderación auditada) | owner | P2 | ✅ `tests/e2e/guests/guests-admin.spec.ts` | PASS |
| GST-010 | guests | staff y anónimo no gestionan invitadas aunque fuercen el request | staff | P1 | ✅ `tests/e2e/guests/guests-admin.spec.ts` | PASS |
| GST-011 | guests | confirmar asistencia con el link personal (acompañante y restricción) se refleja en admin y portal | invitada | P0 | ✅ `tests/e2e/guests/rsvp.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| GST-012 | guests | declinar y luego cambiar la respuesta con «Editar mi respuesta» | invitada | P1 | ✅ `tests/e2e/guests/rsvp.spec.ts` | PASS (chromium, mobile-chrome) |
| GST-013 | guests | con el link general una invitada nueva se registra sola y recibe su link personal | invitada | P1 | ✅ `tests/e2e/guests/rsvp.spec.ts` | PASS |
| GST-014 | guests | con el link general, escribir el nombre de otra invitada NO debe sobrescribir su respuesta ni entregar su link personal | invitada | P0 | ✅ `tests/e2e/guests/rsvp.spec.ts` | PASS (chromium, firefox, webkit) |
| GST-015 | guests | mensaje para la homenajeada: se guarda uno por invitada y se actualiza al editar | invitada | P1 | ✅ `tests/e2e/guests/rsvp.spec.ts` | PASS |
| GST-016 | guests | archivo .ics: con dirección sólo para quien confirmó; 404 para cancelado o token inválido | invitada | P1 | ✅ `tests/e2e/guests/rsvp.spec.ts` | PASS |
| GST-017 | guests | tokens del micrositio: otro evento, slug equivocado, micrositio apagado o token inexistente → 404 | anonimo | P1 | ✅ `tests/e2e/guests/rsvp.spec.ts` | PASS |
| GST-018 | guests | privacidad del micrositio: sin dirección exacta antes de confirmar y sin datos de otras invitadas | invitada | P1 | ✅ `tests/e2e/guests/rsvp.spec.ts` | PASS |
| GST-019 | guests | validaciones del RSVP en el formulario y en el backend | invitada | P2 | ✅ `tests/e2e/guests/rsvp.spec.ts` | PASS |
| GST-020 | guests | RSVP cerrado en eventos completados y cancelados (UI y backend) | invitada | P1 | ✅ `tests/e2e/guests/rsvp.spec.ts` | PASS |
| GST-021 | guests | el link general no admite más de 60 invitadas | invitada | P2 | ✅ `tests/e2e/guests/rsvp.spec.ts` | PASS |
| GST-022 | guests | invitación sembrada de Camila (sólo lectura) y accesibilidad del micrositio | invitada | P2 | ✅ `tests/e2e/guests/rsvp.spec.ts` | PASS |
| GST-023 | guests | posible duplicado del link general (nombre o email de otra invitada): se marca para la anfitriona y el equipo sin tocar ni revelar a la original | invitada | P1 | ✅ `tests/e2e/guests/rsvp.spec.ts` | PASS |
| GST-024 | guests | link general: 10 respuestas por IP en 10 min; la 11ª responde RATE_LIMITED y no crea invitada | invitada | P2 | ✅ `tests/e2e/guests/rsvp.ratelimit.spec.ts` | PASS |
| GST-025 | guests | amiga agregada por la anfitriona que responde con el link general: el portal le dice que quite el pendiente y el admin con quién coincide | clienta | P2 | ✅ `tests/e2e/guests/rsvp.spec.ts` | PASS |
| GST-026 | guests | lo que la invitada escribe antes de que la página hidrate no se borra y se guarda con su respuesta | invitada | P0 | ✅ `tests/e2e/guests/rsvp.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| GST-027 | guests | editar la respuesta sin cambiar «No podré ir» guarda aunque las notas para la cocina sigan ocultas | invitada | P1 | ✅ `tests/e2e/guests/rsvp.spec.ts` | PASS |
| GST-028 | guests | antes de que la página hidrate el RSVP no se envía de forma nativa: el nombre y el correo de la invitada nunca terminan en la URL | invitada | P1 | ✅ `tests/e2e/guests/rsvp.spec.ts` | PASS (chromium, mobile-chrome) |
| INV-001 | inventory | el inventario lista artículos con indicadores y la búsqueda filtra por SKU | owner | P1 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-002 | inventory | alta de artículo: SKU en mayúsculas, movimiento de alta y auditoría; aparece al recargar | owner | P1 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-003 | inventory | el SKU es único sin distinguir mayúsculas (no crea duplicado) | owner | P2 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-004 | inventory | el alta valida formato de SKU y nombre (front y back) | owner | P2 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-005 | inventory | editar un artículo cambia sus datos sin tocar cantidades y audita sólo lo que cambió | owner | P1 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-006 | inventory | un artículo inactivo se oculta del listado y no se puede reservar (backend) | owner | P1 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-007 | inventory | entrada por compra suma al total, registra el movimiento y audita | owner | P0 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS (chromium, firefox, webkit) |
| INV-008 | inventory | una baja mayor a lo utilizable se bloquea en la UI y en el backend (nunca negativo) | owner | P1 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-009 | inventory | mantenimiento (enviar y regresar) y ajuste por conteo restando mantienen 0 ≤ mant ≤ total | owner | P1 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-010 | inventory | el indicador de stock bajo aparece al llegar al umbral y desaparece al reponer | owner | P1 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-011 | inventory | agregar un artículo a un evento crea la reserva y su movimiento | owner | P1 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-012 | inventory | editar la cantidad reservada registra el delta y lo audita | owner | P1 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-013 | inventory | salida y regreso con piezas dañadas: reserva RETURNED, baja del total y auditoría de merma | owner | P1 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-014 | inventory | el regreso exige que buenas + dañadas sumen lo que salió | owner | P2 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-015 | inventory | liberar una reserva la cancela, registra RELEASE y la lista como liberada | owner | P1 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-016 | inventory | «Entregar todo» pasa todas las reservas pendientes a En evento | owner | P1 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-017 | inventory | un evento cancelado que aún aparta piezas se libera con «Liberar todo» | owner | P1 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-018 | inventory | recalcular desde requerimientos reserva por invitada y fijos según la experiencia | owner | P1 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-019 | inventory | un evento completado no se recalcula (botón oculto + backend CONFLICT) | owner | P2 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-020 | inventory | dos eventos el mismo día que sobre-reservan un artículo aparecen en Conflictos | owner | P1 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-021 | inventory | el rango de conflictos se elige entre 30, 60 y 90 días | owner | P3 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-022 | inventory | «Reservas por evento» lista el evento próximo con su conteo y abre su detalle | owner | P2 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-023 | inventory | un artículo inexistente muestra «no encontrado» | owner | P3 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-024 | inventory | no se puede reservar dos veces el mismo artículo en el evento | owner | P2 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| INV-025 | inventory | los filtros del inventario (búsqueda y «Incluir inactivos») actualizan la URL y la lista sin recargar | owner | P1 | ✅ `tests/e2e/inventory/inventory.spec.ts` | PASS |
| LEAD-001 | leads | el resumen por estado y la tabla reflejan exactamente lo que hay en la base | owner | P1 | ✅ `tests/e2e/leads/leads-list.spec.ts` | PASS |
| LEAD-002 | leads | crear lead manual: toast, detalle, clienta vinculada, timeline y persistencia | owner | P1 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-003 | leads | requeridos vacíos: el formulario muestra errores y no llama al servidor | owner | P1 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-004 | leads | formatos inválidos de teléfono y correo se rechazan en el formulario | owner | P2 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-005 | leads | el servidor rechaza capturas inválidas aunque se salte el formulario | owner | P1 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-006 | leads | duplicados: la misma clienta (correo con otra capitalización o mismo teléfono) se reutiliza | owner | P1 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-007 | leads | señales automáticas: grupo grande = consulta especial y zona escrita = fuera de cobertura | owner | P2 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-008 | leads | la búsqueda encuentra por nombre, correo, código y teléfono con formato | owner | P1 | ✅ `tests/e2e/leads/leads-list.spec.ts` | PASS |
| LEAD-009 | leads | filtros por estado, origen y señales; estado vacío con búsqueda sin coincidencias | owner | P2 | ✅ `tests/e2e/leads/leads-list.spec.ts` | PASS |
| LEAD-010 | leads | filtro por rango de fecha del evento (incluye extremos y corrige rango invertido) | owner | P2 | ✅ `tests/e2e/leads/leads-list.spec.ts` | PASS |
| LEAD-011 | leads | paginación de 25 en 25 conservando la búsqueda | owner | P2 | ✅ `tests/e2e/leads/leads-list.spec.ts` | PASS |
| LEAD-012 | leads | orden por creación ascendente y por fecha del evento | owner | P3 | ✅ `tests/e2e/leads/leads-list.spec.ts` | PASS |
| LEAD-013 | leads | kanban: mover una tarjeta respeta la máquina de estados y persiste | owner | P2 | ✅ `tests/e2e/leads/leads-list.spec.ts` | PASS |
| LEAD-014 | leads | kanban: pasar a Perdido exige motivo (diálogo) y lo guarda | owner | P1 | ✅ `tests/e2e/leads/leads-list.spec.ts` | PASS |
| LEAD-015 | leads | detalle de un lead inexistente muestra 'Este lead no existe' | owner | P2 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-016 | leads | cambiar estado con nota: badge, timeline, base y auditoría | owner | P1 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-017 | leads | el selector sólo ofrece las transiciones válidas de leadStatusMachine (y WON es final) | owner | P1 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-018 | leads | el servidor rechaza transiciones inválidas y no modifica el lead | owner | P1 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-019 | leads | Perdido sin motivo (o sólo espacios) se rechaza en el servidor | owner | P1 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-020 | leads | marcar Perdido en el detalle exige motivo; reactivar limpia el motivo | owner | P1 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-021 | leads | asignar y desasignar responsable: timeline y auditoría | owner | P1 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-022 | leads | no se puede asignar un lead a personal STAFF ni a un id inexistente (backend) | superadmin | P1 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-023 | leads | registrar un WhatsApp sobre un lead nuevo lo pasa a Contactado automáticamente | owner | P1 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-024 | leads | una nota interna no cambia estado ni último contacto; mensaje corto se rechaza | owner | P2 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-025 | leads | editar datos del lead: campos cambiados en timeline y auditoría; sin cambios avisa | owner | P1 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-026 | leads | HTML/script en notas e inspiración se muestra escapado (sin ejecutar) | owner | P2 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-027 | leads | editar con referencias de catálogo inexistentes se rechaza en el servidor | owner | P2 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-028 | leads | el CSV trae encabezados, BOM y exactamente los leads filtrados, y queda auditado | owner | P1 | ✅ `tests/e2e/leads/leads-list.spec.ts` | PASS |
| LEAD-029 | leads | el CSV respeta filtros de estado y señales | owner | P2 | ✅ `tests/e2e/leads/leads-list.spec.ts` | PASS |
| LEAD-030 | leads | el CSV neutraliza inyección de fórmulas (=, +, -, @) | owner | P2 | ✅ `tests/e2e/leads/leads-list.spec.ts` | PASS |
| LEAD-031 | leads | el botón Exportar CSV conserva los filtros activos | owner | P3 | ✅ `tests/e2e/leads/leads-list.spec.ts` | PASS |
| LEAD-033 | leads | doble clic en Crear lead registra un solo lead | owner | P2 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-034 | leads | otra fundadora (Rosa) ve y opera el lead creado por Ivonne; la auditoría registra a quien actuó | owner2 | P2 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-035 | leads | captura desde el panel con origen 'Captura manual' no envía notificaciones | owner | P2 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-036 | leads | captura desde el panel con otro origen no avisa a la fundadora de su propio registro | owner | P3 | ✅ `tests/e2e/leads/leads-detail.spec.ts` | PASS |
| LEAD-037 | leads | 'Siguiente' y 'Limpiar filtros' navegan con un clic (misma ruta, otros searchParams) | owner | P2 | ✅ `tests/e2e/leads/leads-list.spec.ts` | PASS |
| MEM-001 | memory | crear la cápsula de un evento la deja en preparación (enlace con aviso, sin fotos) | owner | P1 | ✅ `tests/e2e/memory/memory-admin.spec.ts` | PASS |
| MEM-002 | memory | publicar la cápsula desde Ajustes la abre al público con su título y mensaje | owner | P1 | ✅ `tests/e2e/memory/memory-admin.spec.ts` | PASS |
| MEM-003 | memory | cápsula duplicada, título corto o cápsula inexistente se rechazan en el backend | owner | P2 | ✅ `tests/e2e/memory/memory-admin.spec.ts` | PASS |
| MEM-004 | memory | generar un nuevo enlace invalida el anterior (404) y audita sin guardar el token | owner | P1 | ✅ `tests/e2e/memory/memory-admin.spec.ts` | PASS |
| MEM-005 | memory | aprobar una foto de invitada la publica en la galería con URL firmada | owner | P1 | ✅ `tests/e2e/memory/memory-admin.spec.ts` | PASS |
| MEM-006 | memory | ocultar una foto aprobada la retira de la galería pública | owner | P1 | ✅ `tests/e2e/memory/memory-admin.spec.ts` | PASS |
| MEM-007 | memory | elegir como portada una foto oculta la aprueba y la muestra en la portada pública | owner | P2 | ✅ `tests/e2e/memory/memory-admin.spec.ts` | PASS |
| MEM-008 | memory | eliminar una foto la borra de la base y del almacenamiento (la URL firmada deja de servir) | owner | P1 | ✅ `tests/e2e/memory/memory-admin.spec.ts` | PASS |
| MEM-009 | memory | ocultar y mostrar mensajes del libro de visitas desde la moderación | owner | P1 | ✅ `tests/e2e/memory/memory-admin.spec.ts` | PASS |
| MEM-010 | memory | fotos subidas por el equipo se publican aprobadas | owner | P2 | ✅ `tests/e2e/memory/memory-admin.spec.ts` | PASS |
| MEM-011 | memory | moderación protegida: anónimo y staff no pueden aprobar fotos ni ocultar mensajes aunque usen la ruta pública | staff | P0 | ✅ `tests/e2e/memory/memory-admin.spec.ts` | PASS (chromium, firefox, webkit) |
| MEM-012 | memory | IDOR en moderación: foto o mensaje de otro evento con ids de esta cápsula → no encontrado | owner | P1 | ✅ `tests/e2e/memory/memory-admin.spec.ts` | PASS |
| MEM-013 | memory | una invitada deja un mensaje en el libro de visitas y queda en el muro y en la moderación | invitada | P0 | ✅ `tests/e2e/memory/memory-public.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| MEM-014 | memory | una invitada sube una foto con consentimiento: queda privada y pendiente de revisión | invitada | P0 | ✅ `tests/e2e/memory/memory-public.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| MEM-015 | memory | subida pública rechaza tipos falsos, PDF, falta de consentimiento, origen ajeno y cápsulas cerradas | anonimo | P1 | ✅ `tests/e2e/memory/memory-public.spec.ts` | PASS |
| MEM-016 | memory | libro de visitas: cápsula en preparación, token inválido y mensaje vacío se rechazan; el HTML se escapa | anonimo | P1 | ✅ `tests/e2e/memory/memory-public.spec.ts` | PASS |
| MEM-017 | memory | la galería pública sólo muestra lo aprobado y visible; tokens inválidos responden 404 | anonimo | P1 | ✅ `tests/e2e/memory/memory-public.spec.ts` | PASS |
| MEM-018 | memory | cápsula sembrada de Valeria (sólo lectura) y acceso desde su portal | clienta | P2 | ✅ `tests/e2e/memory/memory-public.spec.ts` | PASS |
| MEM-019 | memory | accesibilidad (WCAG 2.1 AA) de la cápsula pública | invitada | P2 | ✅ `tests/e2e/memory/memory-public.spec.ts` | PASS |
| MEM-020 | memory | con MEMORY_CAPSULE_ENABLED=false la cápsula pública, la subida y el libro de visitas quedan cerrados | anonimo | P1 | ✅ `tests/e2e/memory/memory.global.spec.ts` | PASS |
| MEM-021 | memory | lo que la invitada escribe antes de que la página hidrate no se borra (libro de visitas y subida de fotos) | invitada | P0 | ✅ `tests/e2e/memory/memory-public.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| NAV-001 | navigation | ruta pública inexistente → 404 'Esta mesa no está puesta' con regreso al inicio | anonimo | P2 | ✅ `tests/e2e/navigation/not-found.spec.ts` | PASS |
| NAV-002 | navigation | experiencia pública inexistente → contenido 404 y HTTP 404 (no soft-404) | anonimo | P3 | ✅ `tests/e2e/navigation/not-found.spec.ts` | PASS |
| NAV-003 | navigation | ruta inexistente dentro del panel (owner) → HTTP 404 con la página 404 general | owner | P2 | ✅ `tests/e2e/navigation/not-found.spec.ts` | PASS |
| NAV-004 | navigation | detalle admin con id inexistente (lead, evento, cotización, clienta, compra) → 'No encontramos…' sin error | owner | P2 | ✅ `tests/e2e/navigation/not-found.spec.ts` | PASS |
| NAV-005 | navigation | ruta inexistente en el portal staff → 404 y la navegación del portal sigue disponible | staff | P3 | ✅ `tests/e2e/navigation/not-found.spec.ts` | PASS |
| NAV-006 | navigation | 404 de experiencia (token) ofrece salida y no muestra navegación de marketing | clienta | P3 | ✅ `tests/e2e/navigation/not-found.spec.ts` | PASS |
| NAV-010 | navigation | sitio público: todos los enlaces internos de las páginas públicas responden | anonimo | P1 | ✅ `tests/e2e/navigation/links.spec.ts` | PASS |
| NAV-011 | navigation | panel admin (owner): sidebar y enlaces de cada sección responden sin 404/500 | owner | P1 | ✅ `tests/e2e/navigation/links.spec.ts` | PASS |
| NAV-012 | navigation | secciones de detalle del panel (evento, cotización, lead, clienta, catálogo, configuración) sin enlaces rotos | owner | P2 | ✅ `tests/e2e/navigation/links.spec.ts` | PASS |
| NAV-013 | navigation | portal staff: enlaces de 'Mis eventos' y del detalle responden para staff | staff | P1 | ✅ `tests/e2e/navigation/links.spec.ts` | PASS |
| NAV-014 | navigation | experiencias por token (cotización, portal, micrositio, cápsula): enlaces internos responden | clienta | P2 | ✅ `tests/e2e/navigation/links.spec.ts` | PASS |
| NAV-015 | navigation | enlaces de acción del buzón (NotificationLog.actionUrl) apuntan a rutas existentes | owner | P3 | ✅ `tests/e2e/navigation/links.spec.ts` | PASS |
| NAV-020 | navigation | sidebar (owner): cada sección navega, marca aria-current y muestra su encabezado | owner | P1 | ✅ `tests/e2e/navigation/menus.spec.ts` | PASS |
| NAV-021 | navigation | superadmin ve las mismas 17 secciones; staff no ve el panel | superadmin | P2 | ✅ `tests/e2e/navigation/menus.spec.ts` | PASS |
| NAV-022 | navigation | menú móvil del panel (390 px): abre, navega y se cierra | owner | P2 | ✅ `tests/e2e/navigation/menus.spec.ts` | PASS (chromium, mobile-chrome) |
| NAV-023 | navigation | atrás/adelante entre secciones del panel conserva la página correcta | owner | P2 | ✅ `tests/e2e/navigation/menus.spec.ts` | PASS |
| NAV-024 | navigation | enlaces 'volver' de los detalles (lead, staff portal) regresan al listado | owner | P2 | ✅ `tests/e2e/navigation/menus.spec.ts` | PASS |
| NAV-030 | navigation | cabecera pública: cada enlace navega y marca aria-current; CTA lleva al configurador | anonimo | P1 | ✅ `tests/e2e/navigation/menus.spec.ts` | PASS |
| NAV-031 | navigation | menú móvil público (390 px): abre, navega y cierra | anonimo | P2 | ✅ `tests/e2e/navigation/menus.spec.ts` | PASS (chromium, mobile-chrome) |
| NAV-032 | navigation | migas de pan en la ficha de experiencia: Inicio › Experiencias › nombre | anonimo | P2 | ✅ `tests/e2e/navigation/menus.spec.ts` | PASS |
| NAV-033 | navigation | 'Saltar al contenido' es el primer foco y lleva al <main> | anonimo | P2 | ✅ `tests/e2e/navigation/menus.spec.ts` | PASS |
| NAV-034 | navigation | rutas públicas y por token con slug/token inexistente → HTTP 404 real (no soft-404) | anonimo | P3 | ✅ `tests/e2e/navigation/not-found.spec.ts` | PASS |
| NAV-037 | payments | /pago/mock: el checkout simulado hidrata el HTML del servidor aunque pago/error.tsx llegue tarde | clienta | P0 | ✅ `tests/e2e/navigation/hydration.spec.ts` | PASS (chromium, firefox, webkit) |
| NAV-038 | configurator | sitio público: el configurador hidrata el HTML del servidor aunque (public)/error.tsx llegue tarde | anonimo | P0 | ✅ `tests/e2e/navigation/hydration.spec.ts` | PASS (chromium, firefox, webkit) |
| NAV-039 | quotes | panel: /admin/quotes hidrata el HTML del servidor aunque admin/error.tsx llegue tarde | owner | P0 | ✅ `tests/e2e/navigation/hydration.spec.ts` | PASS (chromium, firefox, webkit) |
| NOT-001 | notifications | la bandeja busca por asunto y filtra por canal, tipo y estado | owner | P1 | ✅ `tests/e2e/notifications/inbox.spec.ts` | PASS |
| NOT-002 | notifications | abrir un mensaje lo marca como leído y se puede volver a marcar como no leído | owner | P1 | ✅ `tests/e2e/notifications/inbox.spec.ts` | PASS |
| NOT-003 | notifications | el filtro «sin leer» muestra sólo pendientes y respeta la lectura | owner | P2 | ✅ `tests/e2e/notifications/inbox.spec.ts` | PASS |
| NOT-004 | notifications | «Marcar todo como leído» deja la bandeja sin pendientes | owner | P1 | ✅ `tests/e2e/notifications/notifications.global.spec.ts` | PASS |
| NOT-005 | notifications | «Ejecutar recordatorios ahora» genera 7 días y 48 h una sola vez (idempotente) y se audita | owner | P0 | ✅ `tests/e2e/notifications/notifications.global.spec.ts` | PASS |
| NOT-006 | notifications | el cron /api/cron/notifications con el secreto correcto ejecuta las reglas sin duplicar | anonimo | P1 | ✅ `tests/e2e/notifications/notifications.global.spec.ts` | PASS |
| NOT-007 | notifications | los avisos STAFF_ASSIGNED de la bandeja enlazan a una ruta real del portal (/staff/events/<id>) | staff | P3 | ✅ `tests/e2e/notifications/inbox.spec.ts` | PASS |
| OPS-001 | operations | el tablero muestra los eventos de los próximos 14 días y enlaza a su orden de producción | owner | P1 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS |
| OPS-002 | operations | generar checklist desde plantillas crea las tareas activas una sola vez (idempotente) | owner | P0 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS (chromium, firefox, webkit) |
| OPS-003 | operations | un evento cancelado no permite generar checklist (UI oculta + backend CONFLICT) | owner | P1 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS |
| OPS-004 | operations | agregar una tarea personalizada la guarda con fase, área y evidencia y persiste al recargar | owner | P1 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS |
| OPS-005 | operations | la tarea personalizada exige título de 3+ caracteres (sin registro en base) | owner | P2 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS |
| OPS-006 | operations | cambiar el estado a Hecho registra fecha y autora; reabrir la limpia | owner | P1 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS |
| OPS-007 | operations | una tarea con evidencia obligatoria no se puede cerrar sin foto (UI y backend) | owner | P1 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS |
| OPS-008 | operations | responsable, notas y fecha límite de una tarea se guardan por separado (las notas no se borran) | owner | P2 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS |
| OPS-009 | operations | eliminar una tarea la quita del checklist y queda en auditoría | owner | P1 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS |
| OPS-010 | operations | asignar staff crea la asignación con su tarifa, notifica y el enlace lleva a /staff/events/<id> | owner | P0 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS (chromium, firefox, webkit) |
| OPS-011 | operations | no se puede asignar dos veces a la misma persona con la misma función | owner | P2 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS |
| OPS-012 | operations | la hora de salida debe ser posterior a la de entrada | owner | P2 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS |
| OPS-013 | operations | confirmar y marcar como pagada una asignación persiste y audita el pago | owner | P1 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS |
| OPS-014 | operations | editar una asignación cambia función y monto acordado (centavos) y lo audita | owner | P1 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS |
| OPS-015 | operations | quitar una asignación libera sus tareas abiertas y el staff deja de ver el evento | owner | P1 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS |
| OPS-016 | operations | guardar salida, montaje y desmontaje persiste en hora CDMX y queda en auditoría | owner | P1 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS |
| OPS-017 | operations | el montaje después del inicio del evento se rechaza en el servidor (sin cambios) | owner | P2 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS |
| OPS-018 | operations | las notas operativas de un add-on se guardan y las ve el staff asignado | owner | P2 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS |
| OPS-019 | operations | la orden de un evento cancelado es de sólo referencia (sin asignar ni editar logística) | owner | P2 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS |
| OPS-020 | operations | la orden de producción de un evento inexistente muestra «no encontrado» | owner | P2 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS |
| OPS-021 | operations | las tareas vencidas aparecen en el tablero con enlace al checklist del evento | owner | P2 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS |
| OPS-022 | operations | la lista agrupa las plantillas del seed por fase y abre el detalle con sus tareas | owner | P1 | ✅ `tests/e2e/operations/templates.spec.ts` | PASS |
| OPS-023 | operations | crear una plantilla (inactiva) redirige a su detalle, persiste y se audita | owner | P1 | ✅ `tests/e2e/operations/templates.spec.ts` | PASS |
| OPS-024 | operations | editar nombre, orden y descripción de una plantilla persiste y se audita | owner | P1 | ✅ `tests/e2e/operations/templates.spec.ts` | PASS |
| OPS-025 | operations | tareas de plantilla: agregar con desfase, editar y eliminar (auditado) | owner | P1 | ✅ `tests/e2e/operations/templates.spec.ts` | PASS |
| OPS-026 | operations | el desfase máximo de una tarea de plantilla es de 365 días (validación del servidor) | owner | P2 | ✅ `tests/e2e/operations/templates.spec.ts` | PASS |
| OPS-027 | operations | eliminar una plantilla borra sus tareas modelo, regresa a la lista y se audita | owner | P1 | ✅ `tests/e2e/operations/templates.spec.ts` | PASS |
| OPS-028 | operations | una plantilla inexistente o con id inválido muestra «no encontrado» | owner | P2 | ✅ `tests/e2e/operations/templates.spec.ts` | PASS |
| OPS-029 | operations | una plantilla general activa se copia al generar checklists; al desactivarla deja de copiarse | owner | P1 | ✅ `tests/e2e/operations/operations.global.spec.ts` | PASS |
| OPS-030 | operations | la acción de asignar staff repetida por la fundadora es idempotente respecto a duplicados (backend) | owner | P2 | ✅ `tests/e2e/operations/operations.spec.ts` | PASS |
| PAY-001 | payments | anticipo: pagar en el checkout simulado confirma el evento (webhook → PAID → onEventConfirmed) | clienta | P0 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| PAY-002 | payments | pago rechazado: queda FAILED con motivo, el evento sigue pendiente y se puede reintentar | clienta | P0 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS (chromium, firefox, webkit) |
| PAY-003 | payments | cancelar en la pasarela regresa a la propuesta sin cobrar ni confirmar | clienta | P1 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PAY-004 | payments | checkout inexistente o mal formado responde 404 y la acción simulada no procede | anonimo | P1 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PAY-005 | payments | pagar dos veces: el checkout ya procesado no vuelve a cobrar y el anticipo cubierto bloquea otro checkout | clienta | P1 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PAY-006 | payments | iniciar el checkout de nuevo reutiliza el mismo pago pendiente (sin duplicar cobros) | clienta | P1 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PAY-007 | payments | no se puede iniciar un pago con un token sin reserva, inexistente o datos inválidos | anonimo | P1 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PAY-008 | payments | el estado del pago sólo se consulta con la firma correcta del enlace | anonimo | P1 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PAY-009 | payments | webhook firmado payment.succeeded confirma una vez; el reenvío del mismo evento es idempotente | anonimo | P1 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PAY-010 | payments | webhook payment.failed marca FAILED; un reintento cobrado pasa a PAID y un fallo tardío no lo degrada | anonimo | P1 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PAY-011 | payments | cobro menor al esperado no marca PAID: queda en revisión manual y se avisa al equipo | anonimo | P1 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PAY-012 | payments | webhook de un pago desconocido se registra sin efectos; firma inválida no procesa nada | anonimo | P2 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PAY-013 | payments | reembolso reportado por la pasarela: PARTIAL_REFUND + registro REFUND + auditoría, idempotente | anonimo | P2 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PAY-014 | payments | /pago/resultado espera la confirmación del webhook y se actualiza sola al llegar | clienta | P1 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PAY-015 | payments | enlace de pago con más de 1 h expira: no se puede pagar y no se cobra | clienta | P1 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PAY-016 | payments | si el saldo cambió (pago manual parcial), el enlace viejo ya no es vigente | clienta | P2 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PAY-017 | payments | una reserva cancelada no acepta pagos | clienta | P1 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PAY-018 | payments | saldo desde el portal: cobra total − anticipo y después ya no hay saldo pendiente | clienta | P2 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PAY-019 | payments | dos solicitudes simultáneas de checkout (dos pestañas / reintento de red) no deben duplicar el pago pendiente | clienta | P2 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PAY-020 | payments | PAYMENTS_ENABLED=false: «Pagar anticipo» avisa la pausa y el backend no crea pagos; al restaurar se puede pagar | clienta | P1 | ✅ `tests/e2e/payments/payments-flag.global.spec.ts` | PASS |
| PAY-021 | payments | un checkout abierto antes de que el equipo cancele el evento ya no debe poder cobrarse | clienta | P1 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PAY-022 | payments | accesibilidad del checkout simulado y del resultado del pago | clienta | P2 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PAY-023 | payments | si la pasarela confirma un cobro de un evento ya cancelado, se registra para reembolso sin reconfirmar ni avisar a la clienta | clienta | P1 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PAY-024 | payments | si el equipo cancela mientras la clienta espera la confirmación, el resultado no asegura «sin cobro» ni ofrece reintentar | clienta | P1 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PAY-025 | payments | un anticipo pagado antes de cancelar el evento no se presenta como cobro por reembolsar | clienta | P2 | ✅ `tests/e2e/payments/payments.spec.ts` | PASS |
| PERM-001 | auth | / — anónimo/staff/owner/superadmin | owner | P2 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS |
| PERM-002 | auth | /admin — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-003 | auth | /admin/analytics — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-004 | auth | /admin/calendar — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-005 | auth | /admin/catalog — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-006 | auth | /admin/catalog/addons — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-007 | auth | /admin/catalog/addons/[id] — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-008 | auth | /admin/catalog/addons/new — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-009 | auth | /admin/catalog/areas — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-010 | auth | /admin/catalog/budgets — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-011 | auth | /admin/catalog/experiences/[id] — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-012 | auth | /admin/catalog/experiences/new — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-013 | auth | /admin/catalog/menus — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-014 | auth | /admin/catalog/menus/[id] — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-015 | auth | /admin/catalog/menus/new — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-016 | auth | /admin/catalog/styles — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-017 | auth | /admin/content — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-018 | auth | /admin/content/faq — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-019 | auth | /admin/content/gallery — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-020 | auth | /admin/customers — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-021 | auth | /admin/customers/[id] — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-022 | auth | /admin/events — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-023 | auth | /admin/events/[id] — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-024 | auth | /admin/events/[id]/financials — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-025 | auth | /admin/events/[id]/guests — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-026 | auth | /admin/events/[id]/memory — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-027 | auth | /admin/events/[id]/operations — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-028 | auth | /admin/events/new — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-029 | auth | /admin/finance — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-030 | auth | /admin/inventory — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-031 | auth | /admin/inventory/[id] — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-032 | auth | /admin/inventory/conflicts — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-033 | auth | /admin/inventory/events — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-034 | auth | /admin/inventory/events/[eventId] — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-035 | auth | /admin/leads — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-036 | auth | /admin/leads/[id] — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-037 | auth | /admin/notifications — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-038 | auth | /admin/operations — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-039 | auth | /admin/operations/templates — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-040 | auth | /admin/operations/templates/[id] — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-041 | auth | /admin/purchases — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-042 | auth | /admin/purchases/[id] — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-043 | auth | /admin/purchases/new — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-044 | auth | /admin/quotes — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-045 | auth | /admin/quotes/[id] — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-046 | auth | /admin/quotes/[id]/print — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-047 | auth | /admin/quotes/new — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-048 | auth | /admin/settings — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-049 | auth | /admin/settings/audit — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-050 | auth | /admin/settings/availability — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-051 | auth | /admin/settings/flags — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-052 | auth | /admin/settings/integrations — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-053 | auth | /admin/settings/notifications — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-054 | auth | /admin/settings/pricing — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-055 | auth | /admin/settings/users — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-056 | auth | /admin/staff — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-057 | auth | /admin/staff/[id] — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-058 | auth | /admin/staff/new — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-059 | auth | /admin/vendors — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-060 | auth | /admin/vendors/[id] — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-061 | auth | /admin/vendors/[id]/edit — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-062 | auth | /admin/vendors/new — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-063 | auth | /como-funciona — anónimo/staff/owner/superadmin | owner | P2 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS |
| PERM-064 | auth | /contacto — anónimo/staff/owner/superadmin | owner | P2 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS |
| PERM-065 | auth | /cotizacion/[token] — anónimo/staff/owner/superadmin | owner | P1 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS |
| PERM-066 | auth | /crear-experiencia — anónimo/staff/owner/superadmin | owner | P2 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS |
| PERM-067 | auth | /crear-experiencia/ai — anónimo/staff/owner/superadmin | owner | P2 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS |
| PERM-068 | auth | /e/[slug]/[token] — anónimo/staff/owner/superadmin | owner | P1 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS |
| PERM-069 | auth | /experiencias — anónimo/staff/owner/superadmin | owner | P2 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS |
| PERM-070 | auth | /experiencias/[slug] — anónimo/staff/owner/superadmin | owner | P2 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS |
| PERM-071 | auth | /login — anónimo/staff/owner/superadmin | owner | P2 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS |
| PERM-072 | auth | /memory/[token] — anónimo/staff/owner/superadmin | owner | P1 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS |
| PERM-073 | auth | /mi-evento — anónimo/staff/owner/superadmin | owner | P1 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS |
| PERM-074 | auth | /mi-evento/[token] — anónimo/staff/owner/superadmin | owner | P1 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS |
| PERM-075 | auth | /mi-evento/[token]/resumen — anónimo/staff/owner/superadmin | owner | P1 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS |
| PERM-076 | auth | /nuestra-historia — anónimo/staff/owner/superadmin | owner | P2 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS |
| PERM-077 | auth | /pago/mock/[checkoutId] — anónimo/staff/owner/superadmin | owner | P1 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS |
| PERM-078 | auth | /pago/resultado — anónimo/staff/owner/superadmin | owner | P1 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS |
| PERM-079 | auth | /privacidad — anónimo/staff/owner/superadmin | owner | P2 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS |
| PERM-080 | auth | /sin-acceso — anónimo/staff/owner/superadmin | owner | P2 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS |
| PERM-081 | auth | /staff — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-082 | auth | /staff/events/[id] — anónimo/staff/owner/superadmin | owner | P0 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-083 | auth | /terminos — anónimo/staff/owner/superadmin | owner | P2 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS |
| PERM-090 | auth | el inventario cubre las 83 páginas y todas tienen fila en la matriz | owner | P2 | ✅ `tests/e2e/permissions/page-matrix.spec.ts` | PASS |
| PERM-100 | staff | /staff muestra sólo los eventos asignados a la persona (y ninguno ajeno) | staff | P0 | ✅ `tests/e2e/permissions/staff-access.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-101 | staff | staff en /staff/events/<evento NO asignado> → no encontrado y sin datos del evento | staff | P0 | ✅ `tests/e2e/permissions/staff-access.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-102 | staff | staff2 no ve un evento asignado sólo a staff (y staff sí) | staff2 | P0 | ✅ `tests/e2e/permissions/staff-access.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-103 | staff | evento asignado pero CANCELADO deja de ser visible para staff | staff | P1 | ✅ `tests/e2e/permissions/staff-access.spec.ts` | PASS |
| PERM-104 | staff | id inexistente o malformado en /staff/events/[id] → no encontrado (sin error 500) | staff | P2 | ✅ `tests/e2e/permissions/staff-access.spec.ts` | PASS |
| PERM-105 | staff | owner/superadmin pueden abrir la vista staff de cualquier evento (sin montos) | owner | P2 | ✅ `tests/e2e/permissions/staff-access.spec.ts` | PASS |
| PERM-110 | staff | staff repite 'Empezar tarea' con el id de una tarea de un evento NO asignado → FORBIDDEN y la base no cambia | staff | P0 | ✅ `tests/e2e/permissions/staff-access.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-111 | staff | staff no puede cambiar una tarea asignada a otra persona del mismo evento | staff | P1 | ✅ `tests/e2e/permissions/staff-access.spec.ts` | PASS |
| PERM-112 | staff | staff no puede OMITIR (SKIPPED) tareas aunque sean suyas | staff | P2 | ✅ `tests/e2e/permissions/staff-access.spec.ts` | PASS |
| PERM-113 | staff | staff2 repitiendo el request de Lupita sobre un evento donde no está asignado → FORBIDDEN | staff2 | P1 | ✅ `tests/e2e/permissions/staff-access.spec.ts` | PASS |
| PERM-114 | staff | staff no puede adjuntar como evidencia una foto subida por otra persona | staff | P1 | ✅ `tests/e2e/permissions/staff-access.spec.ts` | PASS |
| PERM-115 | staff | tarea inexistente → NOT_FOUND controlado; anónimo → redirigido a login | staff | P2 | ✅ `tests/e2e/permissions/staff-access.spec.ts` | PASS |
| PERM-120 | staff | el build expone acciones de admin de staff en la página del portal (inventario de superficie) | staff | P2 | ✅ `tests/e2e/permissions/staff-access.spec.ts` | PASS |
| PERM-121 | staff | staff ejecutando resetStaffPasswordAction desde /staff/events/[id] → FORBIDDEN y sin cambios | staff | P0 | ✅ `tests/e2e/permissions/staff-access.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-122 | staff | staff ejecutando setStaffAccessActiveAction desde /staff/events/[id] → FORBIDDEN y sin cambios | staff | P0 | ✅ `tests/e2e/permissions/staff-access.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-123 | staff | staff ejecutando createStaffAccessAction desde /staff/events/[id] → FORBIDDEN y sin cambios | staff | P0 | ✅ `tests/e2e/permissions/staff-access.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-124 | staff | staff ejecutando createStaffMemberAction desde /staff/events/[id] → FORBIDDEN y sin cambios | staff | P0 | ✅ `tests/e2e/permissions/staff-access.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-125 | staff | staff ejecutando updateStaffMemberAction desde /staff/events/[id] → FORBIDDEN y sin cambios | staff | P0 | ✅ `tests/e2e/permissions/staff-access.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-126 | staff | staff ejecutando deleteStaffMemberAction desde /staff/events/[id] → FORBIDDEN y sin cambios | staff | P0 | ✅ `tests/e2e/permissions/staff-access.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-127 | staff | control positivo: la misma acción desde /staff/events/[id] con OWNER sí se ejecuta | owner | P2 | ✅ `tests/e2e/permissions/staff-access.spec.ts` | PASS |
| PERM-130 | memory | superficie: la página pública /memory/[token] importa las 7 acciones de administración de la cápsula | anonimo | P2 | ✅ `tests/e2e/permissions/exposed-actions.spec.ts` | PASS |
| PERM-131 | memory | anónimo y staff ejecutando rotateShareTokenAction desde /memory/[token] → rechazado y sin cambios | anonimo | P0 | ✅ `tests/e2e/permissions/exposed-actions.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-132 | memory | anónimo y staff ejecutando updateCapsuleAction desde /memory/[token] → rechazado y sin cambios | anonimo | P0 | ✅ `tests/e2e/permissions/exposed-actions.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-133 | memory | anónimo y staff ejecutando setCoverAction desde /memory/[token] → rechazado y sin cambios | anonimo | P0 | ✅ `tests/e2e/permissions/exposed-actions.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-134 | memory | anónimo y staff ejecutando setMediaApprovalAction desde /memory/[token] → rechazado y sin cambios | anonimo | P0 | ✅ `tests/e2e/permissions/exposed-actions.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-135 | memory | anónimo y staff ejecutando deleteCapsuleMediaAction desde /memory/[token] → rechazado y sin cambios | anonimo | P0 | ✅ `tests/e2e/permissions/exposed-actions.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-136 | memory | anónimo y staff ejecutando setMessageHiddenAction desde /memory/[token] → rechazado y sin cambios | anonimo | P0 | ✅ `tests/e2e/permissions/exposed-actions.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-137 | memory | anónimo y staff ejecutando createCapsuleAction desde /memory/[token] → rechazado y sin cambios | anonimo | P0 | ✅ `tests/e2e/permissions/exposed-actions.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-138 | memory | control positivo: OWNER sí ejecuta updateCapsuleAction desde la misma página pública | owner | P2 | ✅ `tests/e2e/permissions/exposed-actions.spec.ts` | PASS |
| PERM-140 | users | OWNER no puede CREAR una cuenta SUPER_ADMIN (request forzado) — superadmin sí | owner | P0 | ✅ `tests/e2e/permissions/role-actions.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-141 | users | OWNER no puede PROMOVER a SUPER_ADMIN (request forzado) — superadmin sí | owner | P0 | ✅ `tests/e2e/permissions/role-actions.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-142 | users | OWNER no puede modificar una cuenta SUPER_ADMIN (rol, estado ni contraseña) — UI y backend | owner | P0 | ✅ `tests/e2e/permissions/role-actions.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-143 | users | OWNER puede administrar fundadoras y staff (no es sobre-restrictivo) | owner | P1 | ✅ `tests/e2e/permissions/role-actions.spec.ts` | PASS |
| PERM-150 | auth | pago manual: staff/anónimo denegados y sin pago; OWNER sí registra (con auditoría) | staff | P0 | ✅ `tests/e2e/permissions/sensitive-replay.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-151 | auth | reembolso: staff/anónimo denegados y el pago no cambia | staff | P0 | ✅ `tests/e2e/permissions/sensitive-replay.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-152 | auth | descuento en cotización: staff/anónimo denegados; OWNER aplica con auditoría quote.discount_applied | staff | P0 | ✅ `tests/e2e/permissions/sensitive-replay.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-153 | auth | cancelar evento: staff/anónimo denegados; OWNER cancela con auditoría | staff | P0 | ✅ `tests/e2e/permissions/sensitive-replay.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-154 | auth | cerrar evento (finanzas): staff/anónimo denegados y el evento sigue abierto | staff | P1 | ✅ `tests/e2e/permissions/sensitive-replay.spec.ts` | PASS |
| PERM-155 | auth | rotar token del portal: staff/anónimo denegados; OWNER rota (el anterior deja de servir) | staff | P0 | ✅ `tests/e2e/permissions/sensitive-replay.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-156 | auth | cambio de rol: staff/anónimo denegados y el rol no cambia | staff | P0 | ✅ `tests/e2e/permissions/sensitive-replay.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-157 | auth | ajustes del negocio, precios y feature flags: staff/anónimo denegados y la configuración no cambia | staff | P0 | ✅ `tests/e2e/permissions/sensitive-replay.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-158 | auth | acción de admin enviada a una página que no la importa (/staff, /) no se ejecuta | staff | P1 | ✅ `tests/e2e/permissions/sensitive-replay.spec.ts` | PASS |
| PERM-159 | auth | CSRF: Server Action con sesión válida pero Origin ajeno es rechazada y no escribe | owner | P0 | ✅ `tests/e2e/permissions/sensitive-replay.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-160 | portal | token inexistente (formato válido) en cada ruta por token → 404 genérico | anonimo | P0 | ✅ `tests/e2e/permissions/token-security.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-161 | portal | token malformado (corto, traversal, inyección, unicode) → 404 sin error 500 | anonimo | P1 | ✅ `tests/e2e/permissions/token-security.spec.ts` | PASS |
| PERM-162 | portal | micrositio: slug de un evento + token de invitación de OTRO evento → 404 sin datos de ninguno | invitada | P0 | ✅ `tests/e2e/permissions/token-security.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-163 | portal | micrositio: slug de un evento + token PERSONAL de invitada de otro evento → 404 | invitada | P0 | ✅ `tests/e2e/permissions/token-security.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-164 | portal | tokens de otro TIPO no abren otras zonas (portal↔invitación↔cotización↔cápsula) | clienta | P0 | ✅ `tests/e2e/permissions/token-security.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-165 | portal | tokens rotados desde el admin (portal e invitación): el anterior → 404, el nuevo funciona | owner | P0 | ✅ `tests/e2e/permissions/token-security.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-166 | portal | cápsula: token rotado → 404; cápsula NO publicada no muestra fotos ni mensajes | owner | P1 | ✅ `tests/e2e/permissions/token-security.spec.ts` | PASS |
| PERM-167 | portal | micrositio deshabilitado → 404 aunque el token sea correcto | invitada | P2 | ✅ `tests/e2e/permissions/token-security.spec.ts` | PASS |
| PERM-168 | portal | /pago/resultado: firma inválida, ausente o de otro pago → 404; firma válida → 200 | clienta | P1 | ✅ `tests/e2e/permissions/token-security.spec.ts` | PASS |
| PERM-169 | portal | /pago/mock: checkout inexistente o malformado → 404; existente → 200 | clienta | P2 | ✅ `tests/e2e/permissions/token-security.spec.ts` | PASS |
| PERM-170 | portal | rutas por token: X-Robots-Tag noindex + Referrer-Policy same-origin (válidas e inválidas) | anonimo | P1 | ✅ `tests/e2e/permissions/token-security.spec.ts` | PASS |
| PERM-171 | portal | calendar.ics: válido es text/calendar con el evento; token ajeno/rotado → 404 | invitada | P1 | ✅ `tests/e2e/permissions/token-security.spec.ts` | PASS |
| PERM-180 | portal | portal: quitar invitada de OTRO evento con mi token → NOT_FOUND y la invitada sigue | clienta | P0 | ✅ `tests/e2e/permissions/public-actions-idor.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-181 | portal | RSVP: slug de mi evento + token personal de invitada de OTRO evento → NOT_FOUND y su RSVP no cambia | invitada | P0 | ✅ `tests/e2e/permissions/public-actions-idor.spec.ts` | PASS (chromium, firefox, webkit) |
| PERM-182 | portal | RSVP: slug de mi evento + invitación general de OTRO evento → NOT_FOUND sin crear invitada | invitada | P1 | ✅ `tests/e2e/permissions/public-actions-idor.spec.ts` | PASS |
| PERM-183 | portal | portal: mensaje con token ROTADO → NOT_FOUND; con el vigente sí se envía | clienta | P1 | ✅ `tests/e2e/permissions/public-actions-idor.spec.ts` | PASS |
| PERM-184 | portal | portal: preferencias con token de INVITACIÓN o de invitada (otro tipo) → NOT_FOUND y el evento no cambia | invitada | P1 | ✅ `tests/e2e/permissions/public-actions-idor.spec.ts` | PASS |
| PERM-185 | portal | portal: agregar invitada con token de otro tipo → NOT_FOUND sin crear registros | invitada | P2 | ✅ `tests/e2e/permissions/public-actions-idor.spec.ts` | PASS |
| PERM-186 | portal | cápsula: libro de visitas con token de cápsula NO publicada o inexistente → NOT_FOUND; publicada → se crea | invitada | P1 | ✅ `tests/e2e/permissions/public-actions-idor.spec.ts` | PASS |
| PERM-187 | portal | cotización: aceptar/rechazar con token inexistente o de otro tipo → NOT_FOUND y sin reserva | clienta | P1 | ✅ `tests/e2e/permissions/public-actions-idor.spec.ts` | PASS |
| PERM-188 | portal | subida de foto a cápsula NO publicada o con token rotado → rechazada sin MediaAsset | invitada | P1 | ✅ `tests/e2e/permissions/public-actions-idor.spec.ts` | PASS |
| PORT-001 | portal | portal de Sofía (confirmado): datos del evento, pago, invitadas y sin datos internos | clienta | P0 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| PORT-002 | portal | portal de Fernanda (pendiente de pago): anticipo pendiente y CTA de pago con el monto correcto | clienta | P1 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS (chromium, mobile-chrome) |
| PORT-003 | portal | tokens inválidos, inexistentes o rotados responden 404 genérico | anonimo | P1 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS |
| PORT-004 | portal | resumen imprimible del evento | clienta | P2 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS |
| PORT-005 | portal | solicitar acceso: respuesta neutral y enlace enviado sólo a correos registrados (sin enumeración) | anonimo | P1 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS |
| PORT-006 | portal | solicitar acceso valida el correo en el formulario y en el backend | anonimo | P2 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS |
| PORT-007 | portal | editar preferencias guarda, avisa al equipo en la conversación, audita y se refleja en la invitación | clienta | P1 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS |
| PORT-008 | portal | preferencias inválidas (playlist, colores, enlace javascript:) se rechazan | clienta | P2 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS |
| PORT-009 | portal | editar la dirección (más de 48 h antes) actualiza el evento y lo audita | clienta | P1 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS |
| PORT-010 | portal | a menos de 48 h la dirección ya no se puede editar (UI y backend) | clienta | P1 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS |
| PORT-011 | portal | mensaje de la anfitriona llega al equipo (conversación del admin + aviso) | clienta | P0 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS (chromium, firefox, webkit) |
| PORT-012 | portal | la anfitriona agrega invitadas; duplicados y contactos inválidos se rechazan | clienta | P1 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS |
| PORT-013 | portal | la anfitriona sólo puede quitar invitadas pendientes que ella agregó | clienta | P1 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS |
| PORT-014 | portal | la lista de la anfitriona tiene un máximo de 60 invitadas | clienta | P1 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS |
| PORT-015 | portal | el token de un evento no permite tocar invitadas ni datos de otro evento (IDOR) | clienta | P0 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS (chromium, firefox, webkit) |
| PORT-016 | portal | evento cancelado: aviso amable y sin cambios posibles desde el portal | clienta | P1 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS |
| PORT-017 | portal | tras un evento completado la clienta deja su opinión una sola vez | clienta | P1 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS |
| PORT-018 | portal | antes de completarse el evento no se puede opinar (UI y backend) | clienta | P1 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS |
| PORT-019 | portal | texto con HTML en las preferencias se muestra escapado en portal e invitación | clienta | P2 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS |
| PORT-020 | portal | accesibilidad (WCAG 2.1 AA) del portal y del acceso por correo | clienta | P2 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS |
| PORT-021 | portal | el correo escrito antes de que /mi-evento hidrate no se borra y el enlace llega | clienta | P1 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS (chromium, mobile-chrome) |
| PORT-022 | portal | el mensaje escrito antes de que el portal hidrate no se borra y llega al equipo | clienta | P0 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| PORT-023 | portal | antes de que /mi-evento hidrate el acceso no se envía de forma nativa: el correo nunca termina en la URL | clienta | P1 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS (chromium, mobile-chrome) |
| PORT-024 | portal | antes de que el portal hidrate, la dirección y el mensaje no se envían de forma nativa ni terminan en la URL | clienta | P1 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS |
| PORT-025 | portal | antes de que el portal hidrate, la opinión no se envía de forma nativa: el comentario nunca termina en la URL | clienta | P1 | ✅ `tests/e2e/portal/portal.spec.ts` | PASS |
| PUB-001 | public | / carga sin errores, con un h1, landmarks y navegación | anonimo | P1 | ✅ `tests/e2e/public/site.spec.ts` | PASS |
| PUB-002 | public | /experiencias carga sin errores, con un h1, landmarks y navegación | anonimo | P1 | ✅ `tests/e2e/public/site.spec.ts` | PASS |
| PUB-003 | public | /experiencias/birthday-table carga sin errores, con un h1, landmarks y navegación | anonimo | P1 | ✅ `tests/e2e/public/site.spec.ts` | PASS |
| PUB-004 | public | /como-funciona carga sin errores, con un h1, landmarks y navegación | anonimo | P2 | ✅ `tests/e2e/public/site.spec.ts` | PASS |
| PUB-005 | public | /nuestra-historia carga sin errores, con un h1, landmarks y navegación | anonimo | P2 | ✅ `tests/e2e/public/site.spec.ts` | PASS |
| PUB-006 | public | /contacto carga sin errores, con un h1, landmarks y navegación | anonimo | P1 | ✅ `tests/e2e/public/site.spec.ts` | PASS |
| PUB-007 | public | /privacidad carga sin errores, con un h1, landmarks y navegación | anonimo | P2 | ✅ `tests/e2e/public/site.spec.ts` | PASS |
| PUB-008 | public | /terminos carga sin errores, con un h1, landmarks y navegación | anonimo | P2 | ✅ `tests/e2e/public/site.spec.ts` | PASS |
| PUB-009 | public | /crear-experiencia carga sin errores, con un h1, landmarks y navegación | anonimo | P1 | ✅ `tests/e2e/public/site.spec.ts` | PASS |
| PUB-010 | public | /crear-experiencia/ai carga sin errores, con un h1, landmarks y navegación | anonimo | P1 | ✅ `tests/e2e/public/site.spec.ts` | PASS |
| PUB-011 | public | menú principal, CTA del encabezado y enlaces legales del pie llevan a su página | anonimo | P2 | ✅ `tests/e2e/public/site.spec.ts` | PASS |
| PUB-012 | public | menú móvil: abre, navega y cierra | anonimo | P2 | ✅ `tests/e2e/public/site.spec.ts` | PASS (chromium, mobile-chrome) |
| PUB-013 | public | los CTAs del inicio llevan al configurador y al catálogo | anonimo | P1 | ✅ `tests/e2e/public/site.spec.ts` | PASS |
| PUB-014 | public | /experiencias muestra exactamente las experiencias activas del catálogo y enlaza a su detalle | anonimo | P1 | ✅ `tests/e2e/public/site.spec.ts` | PASS |
| PUB-015 | public | detalle de experiencia: precio desde, rango de personas y CTA al configurador con la experiencia preseleccionada | anonimo | P1 | ✅ `tests/e2e/public/site.spec.ts` | PASS |
| PUB-016 | public | experiencia inexistente o inactiva → página «no disponible» con noindex, HTTP 404 real (y no aparece en el catálogo) | anonimo | P1 | ✅ `tests/e2e/public/site.spec.ts` | PASS |
| PUB-017 | public | filtros del catálogo: ocasión coincide con la base, grupo grande muestra consulta especial y sin resultados muestra estado vacío | anonimo | P2 | ✅ `tests/e2e/public/site.spec.ts` | PASS |
| PUB-018 | public | SEO: páginas indexables con title, description, canonical y Open Graph en el <head> que ve un buscador (sin noindex) | anonimo | P2 | ✅ `tests/e2e/public/site.spec.ts` | PASS |
| PUB-019 | public | páginas con token y de pago no se indexan (meta robots + X-Robots-Tag) y robots.txt/sitemap son coherentes | anonimo | P1 | ✅ `tests/e2e/public/site.spec.ts` | PASS |
| PUB-020 | public | accesibilidad (axe WCAG 2.1 AA) de las páginas públicas clave | anonimo | P2 | ✅ `tests/e2e/public/site.spec.ts` | PASS |
| PUB-021 | public | responsive: sin scroll horizontal y CTA visible en 1440, 1366, 768 y 390 | anonimo | P2 | ✅ `tests/e2e/public/site.spec.ts` | PASS |
| PUB-040 | public | enviar el formulario crea lead CONTACT_FORM + clienta + avisos y la fundadora lo ve en /admin/leads | anonimo | P0 | ✅ `tests/e2e/public/contact.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| PUB-041 | public | enviar vacío muestra todos los errores por campo y no crea nada | anonimo | P1 | ✅ `tests/e2e/public/contact.spec.ts` | PASS |
| PUB-042 | public | formatos inválidos (teléfono, correo, mensaje corto, fecha pasada) se rechazan en el navegador | anonimo | P1 | ✅ `tests/e2e/public/contact.spec.ts` | PASS |
| PUB-043 | public | el backend valida aunque se salte el navegador (sin consentimiento, correo, teléfono, fecha pasada, campos gigantes) | anonimo | P1 | ✅ `tests/e2e/public/contact.spec.ts` | PASS |
| PUB-044 | public | doble clic en «Enviar mensaje» crea un solo lead | anonimo | P1 | ✅ `tests/e2e/public/contact.spec.ts` | PASS |
| PUB-045 | public | honeypot lleno: respuesta de éxito para el bot pero no se crea lead ni clienta | anonimo | P2 | ✅ `tests/e2e/public/contact.spec.ts` | PASS |
| PUB-046 | public | la misma clienta (mismo correo) que escribe dos veces conserva un solo registro de clienta | anonimo | P2 | ✅ `tests/e2e/public/contact.spec.ts` | PASS |
| PUB-047 | public | texto con HTML/script se muestra escapado en la confirmación y en el panel (sin ejecutar) | anonimo | P2 | ✅ `tests/e2e/public/contact.spec.ts` | PASS |
| PUB-048 | public | con el teléfono de una clienta registrada el mensaje se liga a ella, pero su perfil no toma el correo escrito (sus enlaces no se desvían) | anonimo | P1 | ✅ `tests/e2e/public/contact.spec.ts` | PASS |
| PUB-049 | public | lo que la clienta escribe antes de que la página hidrate no se borra y llega completo al lead | anonimo | P0 | ✅ `tests/e2e/public/contact.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| PUR-001 | purchases | la lista de compras muestra totales y filtra por evento | owner | P1 | ✅ `tests/e2e/purchasing/purchases.spec.ts` | PASS |
| PUR-002 | purchases | registrar una compra para un evento guarda el monto en centavos y se audita | owner | P0 | ✅ `tests/e2e/purchasing/purchases.spec.ts` | PASS (chromium, firefox, webkit) |
| PUR-003 | purchases | la compra exige concepto (3+) y monto esperado | owner | P2 | ✅ `tests/e2e/purchasing/purchases.spec.ts` | PASS |
| PUR-004 | purchases | marcar como ordenada y volver a solicitada actualiza estado y fecha de orden | owner | P1 | ✅ `tests/e2e/purchasing/purchases.spec.ts` | PASS |
| PUR-005 | purchases | recibir con monto real lo guarda en centavos y suma al costo real del evento | owner | P0 | ✅ `tests/e2e/purchasing/purchases.spec.ts` | PASS (chromium, firefox, webkit) |
| PUR-006 | purchases | cancelar con motivo lo deja en notas e historial; reabrir la regresa a solicitada | owner | P1 | ✅ `tests/e2e/purchasing/purchases.spec.ts` | PASS |
| PUR-007 | purchases | transiciones inválidas (recibida→ordenada, cancelada→recibida) se rechazan en el backend | owner | P1 | ✅ `tests/e2e/purchasing/purchases.spec.ts` | PASS |
| PUR-008 | purchases | corregir el monto real de una compra recibida exige motivo y queda auditado | owner | P1 | ✅ `tests/e2e/purchasing/purchases.spec.ts` | PASS |
| PUR-009 | purchases | corregir el monto real de una compra no recibida se rechaza en el backend | owner | P2 | ✅ `tests/e2e/purchasing/purchases.spec.ts` | PASS |
| PUR-010 | purchases | adjuntar un comprobante (imagen) lo liga a la compra y se puede quitar | owner | P1 | ✅ `tests/e2e/purchasing/purchases.spec.ts` | PASS |
| PUR-011 | purchases | un archivo que no es imagen ni PDF se rechaza como comprobante | owner | P2 | ✅ `tests/e2e/purchasing/purchases.spec.ts` | PASS |
| PUR-012 | purchases | en un evento cerrado no se puede recibir una compra (UI + backend) | owner | P1 | ✅ `tests/e2e/purchasing/purchases.spec.ts` | PASS |
| PUR-013 | purchases | editar los detalles de una compra persiste y aparece en el historial | owner | P2 | ✅ `tests/e2e/purchasing/purchases.spec.ts` | PASS |
| PUR-014 | purchases | un proveedor bloqueado no se ofrece ni se acepta en el backend al registrar compras | owner | P2 | ✅ `tests/e2e/purchasing/purchases.spec.ts` | PASS |
| PUR-020 | vendors | la lista de proveedores muestra los del seed y filtra por búsqueda | owner | P1 | ✅ `tests/e2e/purchasing/vendors.spec.ts` | PASS |
| PUR-021 | vendors | alta de proveedor con contacto y calificación persiste y se audita | owner | P1 | ✅ `tests/e2e/purchasing/vendors.spec.ts` | PASS |
| PUR-022 | vendors | el alta valida correo, teléfono y WhatsApp (sin crear registro) | owner | P2 | ✅ `tests/e2e/purchasing/vendors.spec.ts` | PASS |
| PUR-023 | vendors | bloquear un proveedor queda auditado y oculta «Nueva compra» | owner | P1 | ✅ `tests/e2e/purchasing/vendors.spec.ts` | PASS |
| PUR-024 | vendors | eliminar un proveedor sin compras lo borra y se audita | owner | P1 | ✅ `tests/e2e/purchasing/vendors.spec.ts` | PASS |
| PUR-025 | vendors | un proveedor con compras no se puede borrar (botón deshabilitado + backend CONFLICT) | owner | P1 | ✅ `tests/e2e/purchasing/vendors.spec.ts` | PASS |
| QPUB-001 | quotes | la clienta ve su propuesta SENT con montos en MXN, sin costos internos, y se registra la vista | clienta | P0 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| QPUB-002 | quotes | aceptar la propuesta crea reserva + evento PENDING_PAYMENT, gana el lead y notifica | clienta | P0 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| QPUB-003 | quotes | rechazar con motivo deja la cotización REJECTED, sin reserva ni evento, y avisa al equipo | clienta | P0 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| QPUB-004 | quotes | aceptar exige nombre y apellido y los términos (front y back); la base no cambia | clienta | P1 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` | PASS |
| QPUB-005 | quotes | cotización con vigencia vencida: se muestra expirada, pasa a EXPIRED y no se puede aceptar | clienta | P1 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` | PASS |
| QPUB-006 | quotes | una propuesta ya aceptada no se puede volver a aceptar ni rechazar (una sola reserva) | clienta | P1 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` | PASS |
| QPUB-007 | quotes | una propuesta rechazada muestra el cierre y ya no se puede aceptar; rechazar de nuevo es idempotente | clienta | P1 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` | PASS |
| QPUB-008 | quotes | versión reemplazada: aceptar desde una pestaña con la versión vieja se rechaza y muestra la vigente | clienta | P1 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` | PASS |
| QPUB-009 | quotes | doble clic en «Aceptar y continuar» crea una sola reserva y un solo evento | clienta | P1 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` | PASS |
| QPUB-010 | quotes | tokens inválidos, inexistentes o de borradores responden 404 genérico sin datos | anonimo | P1 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` | PASS |
| QPUB-011 | quotes | si la fecha ya se llenó, aceptar falla con aviso, la cotización sigue SENT y el equipo es notificado | clienta | P1 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` | PASS |
| QPUB-012 | quotes | la vista de una fundadora con sesión no marca la propuesta como vista por la clienta | owner | P3 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` | PASS |
| QPUB-013 | quotes | respuesta de aceptar sólo devuelve el token del portal (sin datos internos) | clienta | P2 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` | PASS |
| QPUB-014 | quotes | accesibilidad (axe WCAG 2.1 AA) de la propuesta y del diálogo de aceptar | clienta | P2 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` | PASS |
| QPUB-015 | quotes | teclado: el diálogo de aceptar se abre con Enter, enfoca el nombre y al cerrarse devuelve el foco al botón | clienta | P3 | ✅ `tests/e2e/quote-public/quote-public.spec.ts` | PASS |
| QUO-001 | quotes | listado: pestañas por estado, búsqueda por código/clienta/título y estado vacío | owner | P1 | ✅ `tests/e2e/quotes/quotes-lifecycle.spec.ts` | PASS |
| QUO-002 | quotes | crear cotización desde un lead: precarga, cálculo en vivo = oráculo, lead pasa a Cotizado | owner | P0 | ✅ `tests/e2e/quotes/quotes-create.spec.ts` | PASS (chromium, firefox, webkit) |
| QUO-003 | quotes | crear desde /admin/quotes/new buscando una clienta existente | owner | P1 | ✅ `tests/e2e/quotes/quotes-create.spec.ts` | PASS |
| QUO-004 | quotes | clienta nueva desde la cotización: se crea con origen manual y un correo repetido reutiliza la existente | owner | P1 | ✅ `tests/e2e/quotes/quotes-create.spec.ts` | PASS |
| QUO-005 | quotes | validaciones del formulario: clienta, contacto e invitadas | owner | P1 | ✅ `tests/e2e/quotes/quotes-create.spec.ts` | PASS |
| QUO-006 | quotes | el servidor rechaza invitadas fuera de rango, anticipo > 100% y add-ons con cantidad inválida | owner | P1 | ✅ `tests/e2e/quotes/quotes-create.spec.ts` | PASS |
| QUO-007 | quotes | invitadas por encima del máximo de la experiencia: avisos de validación y consulta especial; se cotiza por invitada | owner | P1 | ✅ `tests/e2e/quotes/quotes-create.spec.ts` | PASS |
| QUO-008 | quotes | precio calculado en servidor: la vista previa coincide con el oráculo en combinaciones de menú, add-ons, zona e invitadas | owner | P0 | ✅ `tests/e2e/quotes/quotes-create.spec.ts` | PASS (chromium, firefox, webkit) |
| QUO-009 | quotes | el detalle muestra subtotal, IVA incluido, total, anticipo y saldo exactamente como en la base | owner | P0 | ✅ `tests/e2e/quotes/quotes-pricing.spec.ts` | PASS (chromium, firefox, webkit) |
| QUO-010 | quotes | agregar add-on del catálogo y un concepto personalizado: recálculo en servidor y guardado | owner | P1 | ✅ `tests/e2e/quotes/quotes-pricing.spec.ts` | PASS |
| QUO-011 | quotes | líneas de catálogo: el servidor fija precio/costo, aplica invitadas facturables y tope de cantidad | owner | P1 | ✅ `tests/e2e/quotes/quotes-pricing.spec.ts` | PASS |
| QUO-012 | quotes | descuento por porcentaje con motivo: total recalculado y auditoría before/after | owner | P0 | ✅ `tests/e2e/quotes/quotes-pricing.spec.ts` | PASS (chromium, firefox, webkit) |
| QUO-013 | quotes | descuento por monto mayor al subtotal: se limita al subtotal (total $0) y la propuesta no se puede enviar | owner | P1 | ✅ `tests/e2e/quotes/quotes-pricing.spec.ts` | PASS |
| QUO-014 | quotes | descuento sin motivo, > 100% o negativo se rechaza en el servidor sin tocar la cotización | owner | P1 | ✅ `tests/e2e/quotes/quotes-pricing.spec.ts` | PASS |
| QUO-015 | quotes | cantidades negativas/cero, precios negativos o con decimales y conceptos vacíos se rechazan | owner | P1 | ✅ `tests/e2e/quotes/quotes-pricing.spec.ts` | PASS |
| QUO-016 | quotes | experiencia base, menú y logística no cambian de cantidad aunque se manipule la petición | owner | P1 | ✅ `tests/e2e/quotes/quotes-pricing.spec.ts` | PASS |
| QUO-017 | quotes | cambiar el precio unitario de una línea de catálogo queda auditado (quote.price_changed) | owner | P1 | ✅ `tests/e2e/quotes/quotes-pricing.spec.ts` | PASS |
| QUO-018 | quotes | datos de la propuesta: cambiar invitadas recalcula extras y add-ons por persona; vigencia pasada se rechaza | owner | P1 | ✅ `tests/e2e/quotes/quotes-pricing.spec.ts` | PASS |
| QUO-019 | quotes | enviar: estado SENT, vigencia, lead Cotizado, notificaciones email+WhatsApp, auditoría y enlace público | owner | P0 | ✅ `tests/e2e/quotes/quotes-lifecycle.spec.ts` | PASS (chromium, firefox, webkit) |
| QUO-020 | quotes | no se envía sin fecha del evento ni con fecha pasada; queda en borrador y sin notificaciones | owner | P1 | ✅ `tests/e2e/quotes/quotes-lifecycle.spec.ts` | PASS |
| QUO-021 | quotes | reenviar una cotización enviada, aceptada o rechazada da CONFLICT y no notifica de nuevo | owner | P1 | ✅ `tests/e2e/quotes/quotes-lifecycle.spec.ts` | PASS |
| QUO-022 | quotes | marcar expirada y reactivar/reenviar con nueva vigencia | owner | P1 | ✅ `tests/e2e/quotes/quotes-lifecycle.spec.ts` | PASS |
| QUO-023 | quotes | sólo las enviadas pueden marcarse expiradas (borrador/expirada/aceptada → CONFLICT) | owner | P1 | ✅ `tests/e2e/quotes/quotes-lifecycle.spec.ts` | PASS |
| QUO-024 | quotes | duplicar crea un borrador nuevo (código y token propios) con los mismos conceptos y totales | owner | P1 | ✅ `tests/e2e/quotes/quotes-lifecycle.spec.ts` | PASS |
| QUO-025 | quotes | nueva versión: vuelve a borrador con versión +1, mismo token y el enlace público deja de funcionar | owner | P1 | ✅ `tests/e2e/quotes/quotes-lifecycle.spec.ts` | PASS |
| QUO-026 | quotes | nueva versión sobre borrador o aceptada se rechaza (máquina de estados) | owner | P1 | ✅ `tests/e2e/quotes/quotes-lifecycle.spec.ts` | PASS |
| QUO-027 | quotes | una cotización enviada es de sólo lectura: sin editor en la UI y el servidor rechaza cambios | owner | P1 | ✅ `tests/e2e/quotes/quotes-lifecycle.spec.ts` | PASS |
| QUO-028 | quotes | una cotización aceptada no ofrece enviar, expirar ni nueva versión | owner | P1 | ✅ `tests/e2e/quotes/quotes-lifecycle.spec.ts` | PASS |
| QUO-029 | quotes | vista de impresión: datos y totales de la base, sin costos, márgenes ni notas internas | owner | P1 | ✅ `tests/e2e/quotes/quotes-lifecycle.spec.ts` | PASS |
| QUO-030 | quotes | detalle e impresión de una cotización inexistente muestran 'No encontramos este registro' | owner | P2 | ✅ `tests/e2e/quotes/quotes-lifecycle.spec.ts` | PASS |
| QUO-031 | quotes | crear cotización desde un lead PERDIDO: la UI no lo ofrece | owner | P3 | ✅ `tests/e2e/quotes/quotes-lifecycle.spec.ts` | PASS |
| QUO-032 | quotes | 'Por vencer (48 h)' sólo lista enviadas cuya vigencia termina en las próximas 48 horas | owner | P2 | ✅ `tests/e2e/quotes/quotes-lifecycle.spec.ts` | PASS |
| QUO-033 | quotes | otra fundadora (Rosa) aplica un descuento y la auditoría registra su correo | owner2 | P2 | ✅ `tests/e2e/quotes/quotes-pricing.spec.ts` | PASS |
| QUO-034 | quotes | doble clic en 'Crear cotización' crea una sola cotización | owner | P2 | ✅ `tests/e2e/quotes/quotes-create.spec.ts` | PASS |
| QUO-036 | quotes | buscador de clientas: teclado (↓/Enter), sin coincidencias y 'Cambiar' | owner | P2 | ✅ `tests/e2e/quotes/quotes-create.spec.ts` | PASS |
| QUO-037 | quotes | el detalle muestra historial (auditoría) y notificaciones enviadas | owner | P2 | ✅ `tests/e2e/quotes/quotes-lifecycle.spec.ts` | PASS |
| QUO-038 | quotes | con 'precios sin IVA' el IVA (16%) se suma al subtotal y se muestra como '+IVA' | owner | P1 | ✅ `tests/e2e/quotes/pricing.global.spec.ts` | PASS |
| QUO-039 | quotes | con IVA incluido y tasa 8% el desglose usa la tasa configurada (bps) sin cambiar el total | owner | P2 | ✅ `tests/e2e/quotes/pricing.global.spec.ts` | PASS |
| RESP-001 | public | inicio | anonimo | P1 | ✅ `tests/e2e/responsive/responsive.spec.ts` | PASS |
| RESP-002 | public | catálogo de experiencias | anonimo | P1 | ✅ `tests/e2e/responsive/responsive.spec.ts` | PASS |
| RESP-003 | public | detalle de experiencia | anonimo | P1 | ✅ `tests/e2e/responsive/responsive.spec.ts` | PASS |
| RESP-004 | configurator | configurador (paso 1) | anonimo | P1 | ✅ `tests/e2e/responsive/responsive.spec.ts` | PASS |
| RESP-005 | public | contacto | anonimo | P1 | ✅ `tests/e2e/responsive/responsive.spec.ts` | PASS |
| RESP-006 | auth | login del equipo | anonimo | P1 | ✅ `tests/e2e/responsive/responsive.spec.ts` | PASS |
| RESP-007 | public | menú móvil público abre, navega y cierra (390 y 768) | anonimo | P1 | ✅ `tests/e2e/responsive/responsive.spec.ts` | PASS |
| RESP-008 | quotes | cotización por token | clienta | P1 | ✅ `tests/e2e/responsive/responsive.spec.ts` | PASS |
| RESP-009 | payments | pago simulado (checkout del anticipo) | clienta | P1 | ✅ `tests/e2e/responsive/responsive.spec.ts` | PASS |
| RESP-010 | portal | portal de la clienta | clienta | P1 | ✅ `tests/e2e/responsive/responsive.spec.ts` | PASS |
| RESP-011 | guests | RSVP de invitada | invitada | P1 | ✅ `tests/e2e/responsive/responsive.spec.ts` | PASS |
| RESP-012 | memory | Memory Capsule pública | invitada | P1 | ✅ `tests/e2e/responsive/responsive.spec.ts` | PASS |
| RESP-013 | portal | acceso a Mi evento (solicitar enlace) | clienta | P2 | ✅ `tests/e2e/responsive/responsive.spec.ts` | PASS |
| RESP-014 | analytics | dashboard admin | owner | P2 | ✅ `tests/e2e/responsive/responsive.spec.ts` | PASS |
| RESP-015 | leads | leads (tabla/lista contenida) | owner | P2 | ✅ `tests/e2e/responsive/responsive.spec.ts` | PASS |
| RESP-016 | events | detalle de evento | owner | P2 | ✅ `tests/e2e/responsive/responsive.spec.ts` | PASS |
| RESP-017 | calendar | calendario | owner | P2 | ✅ `tests/e2e/responsive/responsive.spec.ts` | PASS |
| RESP-018 | finance | finanzas (tablas anchas con scroll contenido) | owner | P2 | ✅ `tests/e2e/responsive/responsive.spec.ts` | PASS |
| RESP-019 | navigation | menú del panel admin abre y cierra en móvil/tablet | owner | P2 | ✅ `tests/e2e/responsive/responsive.spec.ts` | PASS |
| RESP-020 | staff | portal staff | staff | P1 | ✅ `tests/e2e/responsive/responsive.spec.ts` | PASS |
| SET-001 | settings | todas las secciones de configuración cargan desde la navegación lateral | superadmin | P1 | ✅ `tests/e2e/settings/settings.spec.ts` | PASS |
| SET-002 | settings | datos del negocio: guardar la versión de términos persiste y queda auditado | owner | P1 | ✅ `tests/e2e/settings/settings.global.spec.ts` | PASS |
| SET-003 | settings | datos del negocio: un WhatsApp con letras se rechaza sin guardar | owner | P2 | ✅ `tests/e2e/settings/settings.global.spec.ts` | PASS |
| SET-004 | settings | precios: cambiar el IVA a 17 % se guarda en bps, se describe el cambio y se audita | owner | P0 | ✅ `tests/e2e/settings/settings.global.spec.ts` | PASS |
| SET-005 | settings | precios: el máximo de invitadas no puede ser menor al mínimo | owner | P2 | ✅ `tests/e2e/settings/settings.global.spec.ts` | PASS |
| SET-006 | settings | disponibilidad: cambiar la anticipación mínima persiste y se restaura | owner | P1 | ✅ `tests/e2e/settings/settings.global.spec.ts` | PASS |
| SET-007 | settings | disponibilidad: «Reservas con hasta» debe superar la anticipación mínima | owner | P2 | ✅ `tests/e2e/settings/settings.global.spec.ts` | PASS |
| SET-008 | settings | notificaciones: el correo del equipo se guarda (validado) y se restaura | owner | P1 | ✅ `tests/e2e/settings/settings.global.spec.ts` | PASS |
| SET-009 | settings | apagar WhatsApp deja los mensajes como OMITIDOS; restablecer vuelve al valor de entorno (auditado) | owner | P0 | ✅ `tests/e2e/settings/settings.global.spec.ts` | PASS |
| SET-010 | settings | apagar el diseñador con IA muestra la pausa en el sitio; restablecerlo lo devuelve | owner | P1 | ✅ `tests/e2e/settings/settings.global.spec.ts` | PASS |
| SET-011 | settings | el email de prueba queda registrado (simulado) en la bandeja a nombre de quien lo pide | owner | P1 | ✅ `tests/e2e/settings/settings.spec.ts` | PASS |
| SET-012 | settings | el WhatsApp de prueba se registra hacia el número del negocio | owner | P1 | ✅ `tests/e2e/settings/settings.spec.ts` | PASS |
| SET-013 | users | superadmin crea una fundadora que puede iniciar sesión en el panel | superadmin | P0 | ✅ `tests/e2e/settings/settings.spec.ts` | PASS (chromium, firefox, webkit) |
| SET-014 | users | cambiar el rol de una usuaria persiste y queda auditado | superadmin | P1 | ✅ `tests/e2e/settings/settings.spec.ts` | PASS |
| SET-015 | users | desactivar una cuenta impide el login; reactivarla lo devuelve (auditado) | superadmin | P0 | ✅ `tests/e2e/settings/settings.spec.ts` | PASS (chromium, firefox, webkit) |
| SET-016 | users | restablecer la contraseña invalida la anterior y no guarda la contraseña en auditoría | superadmin | P1 | ✅ `tests/e2e/settings/settings.spec.ts` | PASS |
| SET-017 | users | no se crean cuentas duplicadas ni con contraseñas que contienen el correo | superadmin | P2 | ✅ `tests/e2e/settings/settings.spec.ts` | PASS |
| SET-018 | users | la propia cuenta no puede cambiar su rol ni desactivarse desde la lista | superadmin | P2 | ✅ `tests/e2e/settings/settings.spec.ts` | PASS |
| SET-019 | settings | las acciones sensibles aparecen en la bitácora con actor, diff y filtros | superadmin | P1 | ✅ `tests/e2e/settings/settings.spec.ts` | PASS |
| SET-020 | settings | filtros inválidos de la bitácora se ignoran sin romper la página | superadmin | P3 | ✅ `tests/e2e/settings/settings.spec.ts` | PASS |
| SET-021 | settings | Integraciones muestra proveedores, webhooks, cron y prueba de mensajes | owner | P2 | ✅ `tests/e2e/settings/settings.spec.ts` | PASS |
| SET-022 | users | una usuaria STAFF creada y vinculada a su ficha ve su portal | superadmin | P1 | ✅ `tests/e2e/settings/settings.spec.ts` | PASS |
| SET-023 | settings | volver a «Negocio» con Atrás tras saltar rápido a «Precios» muestra la página, no el esqueleto | owner | P2 | ✅ `tests/e2e/settings/settings.spec.ts` | PASS |
| SET-024 | settings | volver a «Negocio» con el enlace «Negocio» tras saltar rápido a «Precios» muestra la página, no el esqueleto | owner | P2 | ✅ `tests/e2e/settings/settings.spec.ts` | PASS |
| SMK-001 | api | health y base de datos responden | anonimo | P0 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS (chromium, firefox, webkit) |
| SMK-002 | auth | login por formulario de superadmin (SUPER_ADMIN) llega a su home /admin | superadmin | P0 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS (chromium, firefox, webkit) |
| SMK-003 | auth | login por formulario de owner (OWNER) llega a su home /admin | owner | P0 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS (chromium, firefox, webkit) |
| SMK-004 | auth | login por formulario de owner2 (OWNER) llega a su home /admin | owner2 | P0 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS (chromium, firefox, webkit) |
| SMK-005 | auth | login por formulario de staff (STAFF) llega a su home /staff | staff | P0 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS (chromium, firefox, webkit) |
| SMK-006 | auth | login por formulario de staff2 (STAFF) llega a su home /staff | staff2 | P0 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS (chromium, firefox, webkit) |
| SMK-010 | public | página pública / carga con su contenido y sin errores | anonimo | P0 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS (chromium, firefox, webkit) |
| SMK-011 | public | página pública /experiencias carga con su contenido y sin errores | anonimo | P0 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS (chromium, firefox, webkit) |
| SMK-012 | public | página pública /experiencias/signature-brunch carga con su contenido y sin errores | anonimo | P0 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS (chromium, firefox, webkit) |
| SMK-013 | public | página pública /crear-experiencia carga con su contenido y sin errores | anonimo | P0 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS (chromium, firefox, webkit) |
| SMK-014 | public | página pública /contacto carga con su contenido y sin errores | anonimo | P0 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS (chromium, firefox, webkit) |
| SMK-015 | public | página pública /como-funciona carga con su contenido y sin errores | anonimo | P1 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS |
| SMK-016 | public | página pública /nuestra-historia carga con su contenido y sin errores | anonimo | P1 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS |
| SMK-017 | public | página pública /privacidad carga con su contenido y sin errores | anonimo | P1 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS |
| SMK-018 | public | página pública /terminos carga con su contenido y sin errores | anonimo | P1 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS |
| SMK-019 | public | página pública /login carga con su contenido y sin errores | anonimo | P0 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS (chromium, firefox, webkit) |
| SMK-020 | public | catálogo público muestra las experiencias activas de la base | anonimo | P1 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS |
| SMK-021 | analytics | dashboard admin con saludo y paneles | owner | P1 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS |
| SMK-022 | leads | leads: lista y búsqueda muestran un lead real | owner | P1 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS |
| SMK-023 | quotes | cotizaciones: lista con la propuesta sembrada | owner | P1 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS |
| SMK-024 | events | eventos: lista y detalle de un evento real | owner | P1 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS |
| SMK-025 | calendar | calendario del mes | owner | P1 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS |
| SMK-026 | inventory | inventario muestra artículos de la base | owner | P1 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS |
| SMK-027 | purchases | compras y proveedores | owner | P1 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS |
| SMK-028 | finance | finanzas con eventos y totales | owner | P1 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS |
| SMK-029 | settings | ajustes del negocio cargan los valores guardados | owner | P1 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS |
| SMK-030 | staff | portal staff: Lupita ve sólo sus eventos asignados | staff | P1 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS (chromium, mobile-chrome) |
| SMK-031 | quotes | cotización por token (Lucía) | clienta | P0 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| SMK-032 | portal | portal de la clienta por token (Sofía) | clienta | P0 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| SMK-033 | guests | invitación general y RSVP personal (Sofía / Camila) | invitada | P0 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| SMK-034 | memory | Memory Capsule pública por token (Valeria) | invitada | P0 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| SMK-035 | portal | token inválido responde 404 genérico sin datos | anonimo | P1 | ✅ `tests/e2e/smoke/smoke.spec.ts` | PASS |
| STF-001 | staff | Lupita ve sólo sus eventos asignados (Sofía y Daniela, no Mariana) | staff | P0 | ✅ `tests/e2e/staff/staff-portal.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| STF-002 | staff | Carlos (staff2) ve sus eventos asignados y no los ajenos | staff2 | P1 | ✅ `tests/e2e/staff/staff-portal.spec.ts` | PASS (chromium, mobile-chrome) |
| STF-003 | staff | marcar una tarea como hecha persiste y la fundadora la ve completada por Lupita | staff | P0 | ✅ `tests/e2e/staff/staff-portal.spec.ts` | PASS (chromium, mobile-chrome, firefox, webkit) |
| STF-004 | staff | empezar, volver a pendiente y reabrir cambian el estado en la base | staff | P1 | ✅ `tests/e2e/staff/staff-portal.spec.ts` | PASS |
| STF-005 | staff | la nota para coordinación se guarda y la ve la fundadora | staff | P1 | ✅ `tests/e2e/staff/staff-portal.spec.ts` | PASS |
| STF-006 | staff | una tarea asignada a otra persona es de sólo lectura y el backend rechaza el cambio | staff | P1 | ✅ `tests/e2e/staff/staff-portal.spec.ts` | PASS |
| STF-007 | staff | una tarea con foto obligatoria no se marca como hecha sin evidencia | staff | P1 | ✅ `tests/e2e/staff/staff-portal.spec.ts` | PASS |
| STF-008 | staff | un evento no asignado abierto por URL responde «No encontramos este evento» sin filtrar datos | staff | P0 | ✅ `tests/e2e/staff/staff-portal.spec.ts` | PASS (chromium, firefox, webkit) |
| STF-009 | staff | el detalle muestra horario y equipo pero nunca montos; el teléfono de la clienta sólo a coordinación/chofer | staff | P1 | ✅ `tests/e2e/staff/staff-portal.spec.ts` | PASS |
| STF-010 | staff | subir la foto de evidencia la liga a la tarea y entonces sí se puede cerrar | staff | P1 | ✅ `tests/e2e/staff/staff-portal.spec.ts` | PASS |
| STF-011 | staff | el portal staff se usa en celular sin scroll horizontal y con el CTA visible | staff | P2 | ✅ `tests/e2e/staff/staff-portal.spec.ts` | PASS (chromium, mobile-chrome) |
| STF-012 | staff | la lista de staff muestra al equipo y filtra por nombre y estado | owner | P1 | ✅ `tests/e2e/staff/staff-admin.spec.ts` | PASS |
| STF-013 | staff | alta de integrante guarda tarifa en centavos, días y función, y se audita | owner | P1 | ✅ `tests/e2e/staff/staff-admin.spec.ts` | PASS |
| STF-014 | staff | el alta valida nombre, teléfono y correo (sin crear registro) | owner | P2 | ✅ `tests/e2e/staff/staff-admin.spec.ts` | PASS |
| STF-015 | staff | editar un integrante (tarifa, tipo, desactivar) persiste y deja de ofrecerse al asignar | owner | P1 | ✅ `tests/e2e/staff/staff-admin.spec.ts` | PASS |
| STF-016 | staff | eliminar un integrante sin historial lo borra y se audita | owner | P1 | ✅ `tests/e2e/staff/staff-admin.spec.ts` | PASS |
| STF-017 | staff | un integrante con historial no se puede eliminar (UI oculta + backend CONFLICT) | owner | P2 | ✅ `tests/e2e/staff/staff-admin.spec.ts` | PASS |
| STF-018 | staff | crear acceso genera una cuenta STAFF ligada que puede iniciar sesión en /staff | owner | P0 | ✅ `tests/e2e/staff/staff-admin.spec.ts` | PASS (chromium, firefox, webkit) |
| STF-019 | staff | no se puede crear un acceso con un correo que ya tiene cuenta | owner | P1 | ✅ `tests/e2e/staff/staff-admin.spec.ts` | PASS |
| STF-020 | staff | restablecer la contraseña invalida la anterior y habilita la nueva | owner | P1 | ✅ `tests/e2e/staff/staff-admin.spec.ts` | PASS |
| STF-021 | staff | desactivar el acceso bloquea el login y la sesión abierta | owner | P0 | ✅ `tests/e2e/staff/staff-admin.spec.ts` | PASS (chromium, firefox, webkit) |
| STF-022 | staff | el detalle de un integrante inexistente muestra «no encontrado» | owner | P3 | ✅ `tests/e2e/staff/staff-admin.spec.ts` | PASS |
| STF-023 | staff | un evento asignado pero cancelado ya no aparece ni se puede abrir | staff | P1 | ✅ `tests/e2e/staff/staff-portal.spec.ts` | PASS |
| STF-024 | staff | el portal staff (lista y detalle con checklist) no tiene violaciones WCAG 2.1 AA graves | staff | P2 | ✅ `tests/e2e/staff/staff-portal.spec.ts` | PASS |
| STF-025 | staff | teclado: «Agregar nota» lleva el foco al campo (sin aria-controls roto) y «Cancelar» lo regresa al botón | staff | P3 | ✅ `tests/e2e/staff/staff-portal.spec.ts` | PASS |
| STF-026 | staff | reactivar un acceso desactivado lo devuelve: la cuenta vuelve a iniciar sesión | owner | P0 | ✅ `tests/e2e/staff/staff-admin.spec.ts` | PASS (chromium, firefox, webkit) |
