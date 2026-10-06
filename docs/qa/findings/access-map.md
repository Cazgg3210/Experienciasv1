# Paquete 1 — Acceso y seguridad · APPLICATION_TEST_MAP

Alcance: autenticación (AUTH), matriz rol × página y permisos de acción/tokens (PERM), API/route handlers (API) y navegación (NAV).
Fuente: inventario `docs/qa/.discovery/inventory.json` (83 páginas, 13 APIs, 169 acciones) · commit f26b1a1 · prioridades P0 crítico · P1 principal · P2 secundario · P3 menor.

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad |
|---|---|---|---|---|---|---|
| API-001 | api | API — health y métodos | Anónimo | /api/health responde {status | ok} sin caché | P1 |
| API-002 | api | API — health y métodos | Anónimo | /api/health/db verifica PostgreSQL (status ok, database up, latencia numérica) | Ver escenario | P1 |
| API-003 | api | API — health y métodos | Anónimo | POST /api/health | 405 | P3 |
| API-004 | api | API — health y métodos | Anónimo | DELETE /api/health/db | 405 | P3 |
| API-005 | api | API — health y métodos | Anónimo | DELETE /api/admin/leads-export | 405 | P3 |
| API-006 | api | API — health y métodos | Anónimo | POST /api/events/cxxxxxxxxxxxxxxxxxxxxxxxx/guests.csv | 405 | P3 |
| API-007 | api | API — health y métodos | Anónimo | PUT /api/media/upload | 405 | P3 |
| API-008 | api | API — health y métodos | Anónimo | POST /api/media/cxxxxxxxxxxxxxxxxxxxxxxxx | 405 | P3 |
| API-009 | api | API — health y métodos | Anónimo | GET /api/analytics/track | 405 | P3 |
| API-010 | api | API — health y métodos | Anónimo | DELETE /api/cron/notifications | 405 | P3 |
| API-011 | api | API — health y métodos | Anónimo | GET /api/webhooks/payments/mock | 405 | P3 |
| API-012 | api | API — health y métodos | Anónimo | GET /api/memory/aaaaaaaaaaaaaaaaaaaaaaaa/upload | 405 | P3 |
| API-020 | api | API — cron de recordatorios | Anónimo | sin Authorization | 401 con WWW-Authenticate Bearer | P0 |
| API-021 | api | API — cron de recordatorios | Anónimo | secreto incorrecto / esquema distinto / vacío | 401 y no ejecuta nada | P0 |
| API-022 | api | API — cron de recordatorios | Anónimo | secreto correcto | 200 {ok:true} e idempotente (la 2ª corrida no duplica avisos) | P1 |
| API-030 | api | API — webhook de pagos | Anónimo | sin firma | 400 invalid_signature y no se registra ni procesa | P0 |
| API-031 | api | API — webhook de pagos | Anónimo | firma inválida, con otro secreto, malformada o vencida (>300 s) | 400 sin efecto | P0 |
| API-032 | api | API — webhook de pagos | Anónimo | evento repetido con firma válida | se procesa una sola vez (duplicate:true) | P0 |
| API-033 | api | API — webhook de pagos | Anónimo | proveedor desconocido o con caracteres inválidos | 404 | P2 |
| API-034 | api | API — webhook de pagos | Anónimo | cuerpo > 256 KB | 413 sin procesar; JSON inválido con firma válida → 400 | P2 |
| API-035 | api | API — webhook de pagos | Anónimo | evento válido de un pago inexistente | 200 registrado con nota payment_not_found (sin efectos) | P2 |
| API-040 | api | API — analytics (beacon público) | Anónimo | CSRF: sin Origin, con Origin ajeno o Sec-Fetch-Site cross-site | 403 sin registrar | P1 |
| API-041 | api | API — analytics (beacon público) | Anónimo | mismo origen + cuerpo válido | 204 y AnalyticsEvent con origin=client | P2 |
| API-042 | api | API — analytics (beacon público) | Anónimo | cuerpo inválido: tipo no permitido, campos extra, JSON roto | 400; > 4 KB → 413 | P2 |
| API-050 | api | API — Auth.js | Owner | /api/auth/session | anónimo sin usuario; owner sin datos sensibles | P1 |
| API-051 | api | API — Auth.js | Anónimo | POST directo a /api/auth/callback/credentials sin token CSRF no crea sesión | Ver escenario | P1 |
| API-052 | api | API — Auth.js | Anónimo | /api/auth/signin redirige al login propio; providers sólo expone credenciales | Ver escenario | P3 |
| API-060 | api | API — /api/media/[id] (URLs firmadas) | Anónimo | privado sin firma o con firma inválida/ajena/vencida | 403; firma vigente → redirect | P0 |
| API-061 | api | API — /api/media/[id] (URLs firmadas) | Anónimo | público: libre; id malformado o inexistente | 404 genérico | P2 |
| API-062 | api | API — /api/media/upload | Owner | sin sesión | 401; con sesión pero Origin ajeno o sin Origin → 403 (CSRF); nada se guarda | P0 |
| API-063 | api | API — /api/media/upload | Owner | magic bytes falsos (texto .jpg), SVG con script y HTML | rechazados sin MediaAsset | P0 |
| API-064 | api | API — /api/media/upload | Owner | archivo que supera UPLOAD_MAX_MB | rechazado con mensaje de tamaño | P1 |
| API-065 | api | API — /api/media/upload | Owner | campos inválidos (sin archivo, propósito inexistente) | 400 | P2 |
| API-066 | api | API — /api/media/upload | Owner | owner sube PNG real | MediaAsset privado en base y se sirve sólo con URL firmada | P1 |
| API-067 | api | API — /api/media/upload | Staff | staff: sólo evidencias de checklist de eventos ASIGNADOS (otro propósito o evento ajeno | 403) | P0 |
| API-068 | api | API — /api/media/upload | Invitada (token) | subida pública a cápsula: Origin ajeno | 403; sin consentimiento → 400; válida → 201 privada y pendiente de revisión | P1 |
| API-070 | api | API — exportaciones CSV | Owner | leads CSV | anónimo 401, staff 403; owner obtiene CSV con BOM, encabezados y fórmulas neutralizadas (auditado) | P0 |
| API-071 | api | API — exportaciones CSV | Owner | guests.csv | anónimo 401, staff 403 (incluso de su evento), evento inexistente 404; owner CSV neutralizado | P0 |
| API-072 | api | API — exportaciones CSV | Owner | finanzas CSV (/admin/finance/export): anónimo | login, staff → /staff; owner CSV con montos y títulos neutralizados | P0 |
| API-080 | api | Acciones públicas — rate limit | Anónimo | contacto | 5 envíos reales crean 5 leads; el 6º se rechaza con mensaje de límite y no crea lead | P1 |
| API-081 | api | Acciones públicas — rate limit | Anónimo | configurador | el 6º envío en 10 min responde RATE_LIMITED aunque el payload sea inválido | P1 |
| AUTH-001 | auth | Login del equipo | SuperAdmin | login válido de superadmin redirige a su inicio con sesión httpOnly | Ver escenario | P0 |
| AUTH-002 | auth | Login del equipo | Owner | login válido de owner redirige a su inicio con sesión httpOnly | Ver escenario | P0 |
| AUTH-003 | auth | Login del equipo | Owner | login válido de owner2 redirige a su inicio con sesión httpOnly | Ver escenario | P0 |
| AUTH-004 | auth | Login del equipo | Staff | login válido de staff redirige a su inicio con sesión httpOnly | Ver escenario | P0 |
| AUTH-005 | auth | Login del equipo | Staff | login válido de staff2 redirige a su inicio con sesión httpOnly | Ver escenario | P0 |
| AUTH-006 | auth | Login del equipo | Anónimo | contraseña incorrecta | mensaje genérico, sin sesión y sin lastLoginAt | P0 |
| AUTH-007 | auth | Login del equipo | Anónimo | usuario inexistente recibe exactamente el mismo mensaje (sin enumeración) | Ver escenario | P0 |
| AUTH-008 | auth | Login del equipo | Anónimo | campos vacíos | el navegador exige ambos y el servidor también valida | P1 |
| AUTH-009 | auth | Login del equipo | Anónimo | correo con formato inválido es rechazado en servidor | Ver escenario | P2 |
| AUTH-010 | auth | Login del equipo | Anónimo | usuaria desactivada no puede iniciar sesión (mensaje genérico) | Ver escenario | P0 |
| AUTH-011 | auth | Login del equipo | Anónimo | cuenta con rol CUSTOMER no entra al equipo aunque la contraseña sea correcta | Ver escenario | P1 |
| AUTH-012 | auth | Login del equipo | Anónimo | cuenta sin contraseña (ficha sin acceso) no puede iniciar sesión | Ver escenario | P2 |
| AUTH-013 | auth | Login del equipo | Owner | con sesión abierta, /login redirige al inicio del rol | Ver escenario | P2 |
| AUTH-014 | auth | Login del equipo | Anónimo | correo con mayúsculas y espacios se normaliza y permite entrar | Ver escenario | P2 |
| AUTH-015 | auth | Login del equipo | Anónimo | formulario de login accesible y operable con teclado | Ver escenario | P2 |
| AUTH-016 | auth | Login del equipo | Anónimo | página de login | noindex, contraseña enmascarada y autocompletado correcto | P3 |
| AUTH-017 | auth | Login del equipo | Anónimo | recuperación pública de contraseña | no existe (restablecimiento sólo por admin) | P3 |
| AUTH-020 | auth | Logout y sesión | Owner | logout desde el panel elimina la cookie y vuelve a /login | Ver escenario | P0 |
| AUTH-021 | auth | Logout y sesión | Owner | tras logout, 'Atrás' no muestra datos privados del panel | Ver escenario | P1 |
| AUTH-022 | auth | Logout y sesión | Owner | respuestas del panel autenticado no se cachean (Cache-Control no-store) | Ver escenario | P2 |
| AUTH-023 | auth | Logout y sesión | Anónimo | sin cookies (request directo / apiAs anónimo) las páginas privadas redirigen a login | Ver escenario | P0 |
| AUTH-024 | auth | Logout y sesión | Anónimo | cookie de sesión manipulada o falsificada no autoriza | Ver escenario | P0 |
| AUTH-025 | auth | Logout y sesión | Owner | logout invalida la sesión en el servidor (la cookie anterior deja de servir) | Ver escenario | P1 |
| AUTH-026 | auth | Logout y sesión | Owner | dos pestañas | logout en una ⇒ la otra pierde acceso en el siguiente request | P1 |
| AUTH-027 | auth | Logout y sesión | Owner | desactivar a una usuaria con sesión abierta corta su acceso en el siguiente request (páginas y acciones) | Ver escenario | P0 |
| AUTH-028 | auth | Logout y sesión | Owner | bajar de OWNER a STAFF con sesión abierta | el siguiente request ya no autoriza el panel ni sus acciones | P0 |
| AUTH-029 | auth | Logout y sesión | Staff | subir de STAFF a OWNER aplica en el siguiente request (sin re-login) | Ver escenario | P2 |
| AUTH-030 | auth | Logout y sesión | Staff | logout desde el portal staff | Ver escenario | P1 |
| AUTH-031 | auth | Logout y sesión | Anónimo | /sin-acceso | página 403 clara, noindex y con salidas | P3 |
| AUTH-032 | auth | Logout y sesión | Owner | logout con otra pestaña del panel cargando | la sesión NO debe revivir | P0 |
| AUTH-040 | auth | callbackUrl | Owner | ruta privada sin sesión | login con callbackUrl → tras entrar vuelve a esa ruta | P0 |
| AUTH-041 | auth | callbackUrl | Staff | STAFF con callbackUrl a /admin termina en /staff | Ver escenario | P1 |
| AUTH-042 | auth | callbackUrl | Staff | STAFF con callbackUrl interno permitido (/staff/...) lo respeta | Ver escenario | P2 |
| AUTH-043 | auth | callbackUrl | Owner | callbackUrl malicioso "https | //evil.example/robo" no redirige fuera de la app | P0 |
| AUTH-044 | auth | callbackUrl | Owner | callbackUrl malicioso "//evil.example/robo" no redirige fuera de la app | Ver escenario | P0 |
| AUTH-045 | auth | callbackUrl | Owner | callbackUrl malicioso "/\\evil.example/robo" no redirige fuera de la app | Ver escenario | P0 |
| AUTH-046 | auth | callbackUrl | Owner | callbackUrl malicioso "\\\\evil.example" no redirige fuera de la app | Ver escenario | P0 |
| AUTH-047 | auth | callbackUrl | Owner | callbackUrl malicioso "javascript | alert(document.domain)" no redirige fuera de la app | P0 |
| AUTH-048 | auth | callbackUrl | Owner | callbackUrl malicioso "/%2F%2Fevil.example" no redirige fuera de la app | Ver escenario | P0 |
| AUTH-049 | auth | callbackUrl | Owner | callbackUrl malicioso "/\t/evil.example" no redirige fuera de la app | Ver escenario | P0 |
| AUTH-050 | auth | callbackUrl | Owner | callbackUrl malicioso "http | //localhost@evil.example/" no redirige fuera de la app | P0 |
| AUTH-051 | auth | callbackUrl | Anónimo | el middleware conserva ruta + query en callbackUrl y no acepta hosts | Ver escenario | P2 |
| AUTH-060 | auth | Login — fuerza bruta | Anónimo | 8 intentos fallidos permitidos; el 9º se bloquea y ni la contraseña correcta entra | Ver escenario | P0 |
| AUTH-061 | auth | Login — fuerza bruta | Anónimo | el bloqueo es por cuenta | otra cuenta desde el mismo navegador entra normalmente | P1 |
| AUTH-062 | auth | Login — fuerza bruta | Anónimo | correo inexistente también se limita con el mismo mensaje (sin enumeración por el limitador) | Ver escenario | P1 |
| AUTH-063 | auth | Login — fuerza bruta | Anónimo | variar mayúsculas/espacios del correo no evade el límite (misma cubeta normalizada) | Ver escenario | P2 |
| NAV-001 | navigation | 404 | Anónimo | ruta pública inexistente | 404 'Esta mesa no está puesta' con regreso al inicio | P2 |
| NAV-002 | navigation | 404 | Anónimo | experiencia pública inexistente | contenido 404 y HTTP 404 (no soft-404) | P3 |
| NAV-003 | navigation | 404 | Owner | ruta inexistente dentro del panel (owner) | HTTP 404 con la página 404 general | P2 |
| NAV-004 | navigation | 404 | Owner | detalle admin con id inexistente (lead, evento, cotización, clienta, compra) | 'No encontramos…' sin error | P2 |
| NAV-005 | navigation | 404 | Staff | ruta inexistente en el portal staff | 404 y la navegación del portal sigue disponible | P3 |
| NAV-006 | navigation | 404 | Clienta (token) | 404 de experiencia (token) ofrece salida y no muestra navegación de marketing | Ver escenario | P3 |
| NAV-010 | navigation | Enlaces internos sin 404/500 | Anónimo | sitio público | todos los enlaces internos de las páginas públicas responden | P1 |
| NAV-011 | navigation | Enlaces internos sin 404/500 | Owner | panel admin (owner) | sidebar y enlaces de cada sección responden sin 404/500 | P1 |
| NAV-012 | navigation | Enlaces internos sin 404/500 | Owner | secciones de detalle del panel (evento, cotización, lead, clienta, catálogo, configuración) sin enlaces rotos | Ver escenario | P2 |
| NAV-013 | navigation | Enlaces internos sin 404/500 | Staff | portal staff | enlaces de 'Mis eventos' y del detalle responden para staff | P1 |
| NAV-014 | navigation | Enlaces internos sin 404/500 | Clienta (token) | experiencias por token (cotización, portal, micrositio, cápsula) | enlaces internos responden | P2 |
| NAV-015 | navigation | Enlaces internos sin 404/500 | Owner | enlaces de acción del buzón (NotificationLog.actionUrl) apuntan a rutas existentes | Ver escenario | P3 |
| NAV-020 | navigation | Navegación del panel | Owner | sidebar (owner) | cada sección navega, marca aria-current y muestra su encabezado | P1 |
| NAV-021 | navigation | Navegación del panel | SuperAdmin | superadmin ve las mismas 17 secciones; staff no ve el panel | Ver escenario | P2 |
| NAV-022 | navigation | Navegación del panel | Owner | menú móvil del panel (390 px) | abre, navega y se cierra | P2 |
| NAV-023 | navigation | Navegación del panel | Owner | atrás/adelante entre secciones del panel conserva la página correcta | Ver escenario | P2 |
| NAV-024 | navigation | Navegación del panel | Owner | enlaces 'volver' de los detalles (lead, staff portal) regresan al listado | Ver escenario | P2 |
| NAV-030 | navigation | Navegación pública | Anónimo | cabecera pública | cada enlace navega y marca aria-current; CTA lleva al configurador | P1 |
| NAV-031 | navigation | Navegación pública | Anónimo | menú móvil público (390 px) | abre, navega y cierra | P2 |
| NAV-032 | navigation | Navegación pública | Anónimo | migas de pan en la ficha de experiencia | Inicio › Experiencias › nombre | P2 |
| NAV-033 | navigation | Navegación pública | Anónimo | 'Saltar al contenido' es el primer foco y lleva al <main> | Ver escenario | P2 |
| PERM-001 | auth | Matriz rol × página | Owner | / — anónimo/staff/owner/superadmin | Ver escenario | P2 |
| PERM-002 | auth | Matriz rol × página | Owner | /admin — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-003 | auth | Matriz rol × página | Owner | /admin/analytics — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-004 | auth | Matriz rol × página | Owner | /admin/calendar — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-005 | auth | Matriz rol × página | Owner | /admin/catalog — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-006 | auth | Matriz rol × página | Owner | /admin/catalog/addons — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-007 | auth | Matriz rol × página | Owner | /admin/catalog/addons/[id] — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-008 | auth | Matriz rol × página | Owner | /admin/catalog/addons/new — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-009 | auth | Matriz rol × página | Owner | /admin/catalog/areas — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-010 | auth | Matriz rol × página | Owner | /admin/catalog/budgets — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-011 | auth | Matriz rol × página | Owner | /admin/catalog/experiences/[id] — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-012 | auth | Matriz rol × página | Owner | /admin/catalog/experiences/new — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-013 | auth | Matriz rol × página | Owner | /admin/catalog/menus — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-014 | auth | Matriz rol × página | Owner | /admin/catalog/menus/[id] — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-015 | auth | Matriz rol × página | Owner | /admin/catalog/menus/new — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-016 | auth | Matriz rol × página | Owner | /admin/catalog/styles — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-017 | auth | Matriz rol × página | Owner | /admin/content — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-018 | auth | Matriz rol × página | Owner | /admin/content/faq — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-019 | auth | Matriz rol × página | Owner | /admin/content/gallery — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-020 | auth | Matriz rol × página | Owner | /admin/customers — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-021 | auth | Matriz rol × página | Owner | /admin/customers/[id] — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-022 | auth | Matriz rol × página | Owner | /admin/events — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-023 | auth | Matriz rol × página | Owner | /admin/events/[id] — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-024 | auth | Matriz rol × página | Owner | /admin/events/[id]/financials — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-025 | auth | Matriz rol × página | Owner | /admin/events/[id]/guests — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-026 | auth | Matriz rol × página | Owner | /admin/events/[id]/memory — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-027 | auth | Matriz rol × página | Owner | /admin/events/[id]/operations — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-028 | auth | Matriz rol × página | Owner | /admin/events/new — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-029 | auth | Matriz rol × página | Owner | /admin/finance — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-030 | auth | Matriz rol × página | Owner | /admin/inventory — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-031 | auth | Matriz rol × página | Owner | /admin/inventory/[id] — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-032 | auth | Matriz rol × página | Owner | /admin/inventory/conflicts — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-033 | auth | Matriz rol × página | Owner | /admin/inventory/events — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-034 | auth | Matriz rol × página | Owner | /admin/inventory/events/[eventId] — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-035 | auth | Matriz rol × página | Owner | /admin/leads — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-036 | auth | Matriz rol × página | Owner | /admin/leads/[id] — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-037 | auth | Matriz rol × página | Owner | /admin/notifications — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-038 | auth | Matriz rol × página | Owner | /admin/operations — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-039 | auth | Matriz rol × página | Owner | /admin/operations/templates — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-040 | auth | Matriz rol × página | Owner | /admin/operations/templates/[id] — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-041 | auth | Matriz rol × página | Owner | /admin/purchases — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-042 | auth | Matriz rol × página | Owner | /admin/purchases/[id] — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-043 | auth | Matriz rol × página | Owner | /admin/purchases/new — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-044 | auth | Matriz rol × página | Owner | /admin/quotes — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-045 | auth | Matriz rol × página | Owner | /admin/quotes/[id] — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-046 | auth | Matriz rol × página | Owner | /admin/quotes/[id]/print — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-047 | auth | Matriz rol × página | Owner | /admin/quotes/new — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-048 | auth | Matriz rol × página | Owner | /admin/settings — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-049 | auth | Matriz rol × página | Owner | /admin/settings/audit — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-050 | auth | Matriz rol × página | Owner | /admin/settings/availability — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-051 | auth | Matriz rol × página | Owner | /admin/settings/flags — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-052 | auth | Matriz rol × página | Owner | /admin/settings/integrations — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-053 | auth | Matriz rol × página | Owner | /admin/settings/notifications — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-054 | auth | Matriz rol × página | Owner | /admin/settings/pricing — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-055 | auth | Matriz rol × página | Owner | /admin/settings/users — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-056 | auth | Matriz rol × página | Owner | /admin/staff — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-057 | auth | Matriz rol × página | Owner | /admin/staff/[id] — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-058 | auth | Matriz rol × página | Owner | /admin/staff/new — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-059 | auth | Matriz rol × página | Owner | /admin/vendors — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-060 | auth | Matriz rol × página | Owner | /admin/vendors/[id] — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-061 | auth | Matriz rol × página | Owner | /admin/vendors/[id]/edit — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-062 | auth | Matriz rol × página | Owner | /admin/vendors/new — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-063 | auth | Matriz rol × página | Owner | /como-funciona — anónimo/staff/owner/superadmin | Ver escenario | P2 |
| PERM-064 | auth | Matriz rol × página | Owner | /contacto — anónimo/staff/owner/superadmin | Ver escenario | P2 |
| PERM-065 | auth | Matriz rol × página | Owner | /cotizacion/[token] — anónimo/staff/owner/superadmin | Ver escenario | P1 |
| PERM-066 | auth | Matriz rol × página | Owner | /crear-experiencia — anónimo/staff/owner/superadmin | Ver escenario | P2 |
| PERM-067 | auth | Matriz rol × página | Owner | /crear-experiencia/ai — anónimo/staff/owner/superadmin | Ver escenario | P2 |
| PERM-068 | auth | Matriz rol × página | Owner | /e/[slug]/[token] — anónimo/staff/owner/superadmin | Ver escenario | P1 |
| PERM-069 | auth | Matriz rol × página | Owner | /experiencias — anónimo/staff/owner/superadmin | Ver escenario | P2 |
| PERM-070 | auth | Matriz rol × página | Owner | /experiencias/[slug] — anónimo/staff/owner/superadmin | Ver escenario | P2 |
| PERM-071 | auth | Matriz rol × página | Owner | /login — anónimo/staff/owner/superadmin | Ver escenario | P2 |
| PERM-072 | auth | Matriz rol × página | Owner | /memory/[token] — anónimo/staff/owner/superadmin | Ver escenario | P1 |
| PERM-073 | auth | Matriz rol × página | Owner | /mi-evento — anónimo/staff/owner/superadmin | Ver escenario | P1 |
| PERM-074 | auth | Matriz rol × página | Owner | /mi-evento/[token] — anónimo/staff/owner/superadmin | Ver escenario | P1 |
| PERM-075 | auth | Matriz rol × página | Owner | /mi-evento/[token]/resumen — anónimo/staff/owner/superadmin | Ver escenario | P1 |
| PERM-076 | auth | Matriz rol × página | Owner | /nuestra-historia — anónimo/staff/owner/superadmin | Ver escenario | P2 |
| PERM-077 | auth | Matriz rol × página | Owner | /pago/mock/[checkoutId] — anónimo/staff/owner/superadmin | Ver escenario | P1 |
| PERM-078 | auth | Matriz rol × página | Owner | /pago/resultado — anónimo/staff/owner/superadmin | Ver escenario | P1 |
| PERM-079 | auth | Matriz rol × página | Owner | /privacidad — anónimo/staff/owner/superadmin | Ver escenario | P2 |
| PERM-080 | auth | Matriz rol × página | Owner | /sin-acceso — anónimo/staff/owner/superadmin | Ver escenario | P2 |
| PERM-081 | auth | Matriz rol × página | Owner | /staff — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-082 | auth | Matriz rol × página | Owner | /staff/events/[id] — anónimo/staff/owner/superadmin | Ver escenario | P0 |
| PERM-083 | auth | Matriz rol × página | Owner | /terminos — anónimo/staff/owner/superadmin | Ver escenario | P2 |
| PERM-090 | auth | Matriz rol × página | Owner | el inventario cubre las 83 páginas y todas tienen fila en la matriz | Ver escenario | P2 |
| PERM-100 | staff | Portal staff — acceso por asignación | Staff | /staff muestra sólo los eventos asignados a la persona (y ninguno ajeno) | Ver escenario | P0 |
| PERM-101 | staff | Portal staff — acceso por asignación | Staff | staff en /staff/events/<evento NO asignado> | no encontrado y sin datos del evento | P0 |
| PERM-102 | staff | Portal staff — acceso por asignación | Staff | staff2 no ve un evento asignado sólo a staff (y staff sí) | Ver escenario | P0 |
| PERM-103 | staff | Portal staff — acceso por asignación | Staff | evento asignado pero CANCELADO deja de ser visible para staff | Ver escenario | P1 |
| PERM-104 | staff | Portal staff — acceso por asignación | Staff | id inexistente o malformado en /staff/events/[id] | no encontrado (sin error 500) | P2 |
| PERM-105 | staff | Portal staff — acceso por asignación | Owner | owner/superadmin pueden abrir la vista staff de cualquier evento (sin montos) | Ver escenario | P2 |
| PERM-110 | staff | Portal staff — IDOR en tareas del checklist | Staff | staff repite 'Empezar tarea' con el id de una tarea de un evento NO asignado | FORBIDDEN y la base no cambia | P0 |
| PERM-111 | staff | Portal staff — IDOR en tareas del checklist | Staff | staff no puede cambiar una tarea asignada a otra persona del mismo evento | Ver escenario | P1 |
| PERM-112 | staff | Portal staff — IDOR en tareas del checklist | Staff | staff no puede OMITIR (SKIPPED) tareas aunque sean suyas | Ver escenario | P2 |
| PERM-113 | staff | Portal staff — IDOR en tareas del checklist | Staff | staff2 repitiendo el request de Lupita sobre un evento donde no está asignado | FORBIDDEN | P1 |
| PERM-114 | staff | Portal staff — IDOR en tareas del checklist | Staff | staff no puede adjuntar como evidencia una foto subida por otra persona | Ver escenario | P1 |
| PERM-115 | staff | Portal staff — IDOR en tareas del checklist | Staff | tarea inexistente | NOT_FOUND controlado; anónimo → redirigido a login | P2 |
| PERM-120 | staff | Acciones de administración expuestas en /staff/events/[id] | Staff | el build expone acciones de admin de staff en la página del portal (inventario de superficie) | Ver escenario | P2 |
| PERM-121 | staff | Acciones de administración expuestas en /staff/events/[id] | Staff | staff ejecutando resetStaffPasswordAction desde /staff/events/[id] | FORBIDDEN y sin cambios | P0 |
| PERM-122 | staff | Acciones de administración expuestas en /staff/events/[id] | Staff | staff ejecutando setStaffAccessActiveAction desde /staff/events/[id] | FORBIDDEN y sin cambios | P0 |
| PERM-123 | staff | Acciones de administración expuestas en /staff/events/[id] | Staff | staff ejecutando createStaffAccessAction desde /staff/events/[id] | FORBIDDEN y sin cambios | P0 |
| PERM-124 | staff | Acciones de administración expuestas en /staff/events/[id] | Staff | staff ejecutando createStaffMemberAction desde /staff/events/[id] | FORBIDDEN y sin cambios | P0 |
| PERM-125 | staff | Acciones de administración expuestas en /staff/events/[id] | Staff | staff ejecutando updateStaffMemberAction desde /staff/events/[id] | FORBIDDEN y sin cambios | P0 |
| PERM-126 | staff | Acciones de administración expuestas en /staff/events/[id] | Staff | staff ejecutando deleteStaffMemberAction desde /staff/events/[id] | FORBIDDEN y sin cambios | P0 |
| PERM-127 | staff | Acciones de administración expuestas en /staff/events/[id] | Owner | control positivo | la misma acción desde /staff/events/[id] con OWNER sí se ejecuta | P2 |
| PERM-130 | memory | Acciones de administración alcanzables desde /memory/[token] | Anónimo | superficie | la página pública /memory/[token] importa las 7 acciones de administración de la cápsula | P2 |
| PERM-131 | memory | Acciones de administración alcanzables desde /memory/[token] | Anónimo | anónimo y staff ejecutando rotateShareTokenAction desde /memory/[token] | rechazado y sin cambios | P0 |
| PERM-132 | memory | Acciones de administración alcanzables desde /memory/[token] | Anónimo | anónimo y staff ejecutando updateCapsuleAction desde /memory/[token] | rechazado y sin cambios | P0 |
| PERM-133 | memory | Acciones de administración alcanzables desde /memory/[token] | Anónimo | anónimo y staff ejecutando setCoverAction desde /memory/[token] | rechazado y sin cambios | P0 |
| PERM-134 | memory | Acciones de administración alcanzables desde /memory/[token] | Anónimo | anónimo y staff ejecutando setMediaApprovalAction desde /memory/[token] | rechazado y sin cambios | P0 |
| PERM-135 | memory | Acciones de administración alcanzables desde /memory/[token] | Anónimo | anónimo y staff ejecutando deleteCapsuleMediaAction desde /memory/[token] | rechazado y sin cambios | P0 |
| PERM-136 | memory | Acciones de administración alcanzables desde /memory/[token] | Anónimo | anónimo y staff ejecutando setMessageHiddenAction desde /memory/[token] | rechazado y sin cambios | P0 |
| PERM-137 | memory | Acciones de administración alcanzables desde /memory/[token] | Anónimo | anónimo y staff ejecutando createCapsuleAction desde /memory/[token] | rechazado y sin cambios | P0 |
| PERM-138 | memory | Acciones de administración alcanzables desde /memory/[token] | Owner | control positivo | OWNER sí ejecuta updateCapsuleAction desde la misma página pública | P2 |
| PERM-140 | users | Usuarios: escalada a SUPER_ADMIN | Owner | OWNER no puede CREAR una cuenta SUPER_ADMIN (request forzado) — superadmin sí | Ver escenario | P0 |
| PERM-141 | users | Usuarios: escalada a SUPER_ADMIN | Owner | OWNER no puede PROMOVER a SUPER_ADMIN (request forzado) — superadmin sí | Ver escenario | P0 |
| PERM-142 | users | Usuarios: escalada a SUPER_ADMIN | Owner | OWNER no puede modificar una cuenta SUPER_ADMIN (rol, estado ni contraseña) — UI y backend | Ver escenario | P0 |
| PERM-143 | users | Usuarios: escalada a SUPER_ADMIN | Owner | OWNER puede administrar fundadoras y staff (no es sobre-restrictivo) | Ver escenario | P1 |
| PERM-150 | auth | Acciones sensibles: replay con rol sin permiso | Staff | pago manual | staff/anónimo denegados y sin pago; OWNER sí registra (con auditoría) | P0 |
| PERM-151 | auth | Acciones sensibles: replay con rol sin permiso | Staff | reembolso | staff/anónimo denegados y el pago no cambia | P0 |
| PERM-152 | auth | Acciones sensibles: replay con rol sin permiso | Staff | descuento en cotización | staff/anónimo denegados; OWNER aplica con auditoría quote.discount_applied | P0 |
| PERM-153 | auth | Acciones sensibles: replay con rol sin permiso | Staff | cancelar evento | staff/anónimo denegados; OWNER cancela con auditoría | P0 |
| PERM-154 | auth | Acciones sensibles: replay con rol sin permiso | Staff | cerrar evento (finanzas) | staff/anónimo denegados y el evento sigue abierto | P1 |
| PERM-155 | auth | Acciones sensibles: replay con rol sin permiso | Staff | rotar token del portal | staff/anónimo denegados; OWNER rota (el anterior deja de servir) | P0 |
| PERM-156 | auth | Acciones sensibles: replay con rol sin permiso | Staff | cambio de rol | staff/anónimo denegados y el rol no cambia | P0 |
| PERM-157 | auth | Acciones sensibles: replay con rol sin permiso | Staff | ajustes del negocio, precios y feature flags | staff/anónimo denegados y la configuración no cambia | P0 |
| PERM-158 | auth | Acciones sensibles: replay con rol sin permiso | Staff | acción de admin enviada a una página que no la importa (/staff, /) no se ejecuta | Ver escenario | P1 |
| PERM-159 | auth | Acciones sensibles: replay con rol sin permiso | Owner | CSRF | Server Action con sesión válida pero Origin ajeno es rechazada y no escribe | P0 |
| PERM-160 | portal | Enlaces por token | Anónimo | token inexistente (formato válido) en cada ruta por token | 404 genérico | P0 |
| PERM-161 | portal | Enlaces por token | Anónimo | token malformado (corto, traversal, inyección, unicode) | 404 sin error 500 | P1 |
| PERM-162 | portal | Enlaces por token | Invitada (token) | micrositio: slug de un evento + token de invitación de OTRO evento | 404 sin datos de ninguno | P0 |
| PERM-163 | portal | Enlaces por token | Invitada (token) | micrositio: slug de un evento + token PERSONAL de invitada de otro evento | 404 | P0 |
| PERM-164 | portal | Enlaces por token | Clienta (token) | tokens de otro TIPO no abren otras zonas (portal↔invitación↔cotización↔cápsula) | Ver escenario | P0 |
| PERM-165 | portal | Enlaces por token | Owner | tokens rotados desde el admin (portal e invitación): el anterior | 404, el nuevo funciona | P0 |
| PERM-166 | portal | Enlaces por token | Owner | cápsula: token rotado | 404; cápsula NO publicada no muestra fotos ni mensajes | P1 |
| PERM-167 | portal | Enlaces por token | Invitada (token) | micrositio deshabilitado | 404 aunque el token sea correcto | P2 |
| PERM-168 | portal | Enlaces por token | Clienta (token) | /pago/resultado: firma inválida, ausente o de otro pago | 404; firma válida → 200 | P1 |
| PERM-169 | portal | Enlaces por token | Clienta (token) | /pago/mock: checkout inexistente o malformado | 404; existente → 200 | P2 |
| PERM-170 | portal | Enlaces por token | Anónimo | rutas por token | X-Robots-Tag noindex + Referrer-Policy same-origin (válidas e inválidas) | P1 |
| PERM-171 | portal | Enlaces por token | Invitada (token) | calendar.ics: válido es text/calendar con el evento; token ajeno/rotado | 404 | P1 |
| PERM-180 | portal | Acciones públicas con token ajeno | Clienta (token) | portal: quitar invitada de OTRO evento con mi token | NOT_FOUND y la invitada sigue | P0 |
| PERM-181 | portal | Acciones públicas con token ajeno | Invitada (token) | RSVP: slug de mi evento + token personal de invitada de OTRO evento | NOT_FOUND y su RSVP no cambia | P0 |
| PERM-182 | portal | Acciones públicas con token ajeno | Invitada (token) | RSVP: slug de mi evento + invitación general de OTRO evento | NOT_FOUND sin crear invitada | P1 |
| PERM-183 | portal | Acciones públicas con token ajeno | Clienta (token) | portal: mensaje con token ROTADO | NOT_FOUND; con el vigente sí se envía | P1 |
| PERM-184 | portal | Acciones públicas con token ajeno | Invitada (token) | portal: preferencias con token de INVITACIÓN o de invitada (otro tipo) | NOT_FOUND y el evento no cambia | P1 |
| PERM-185 | portal | Acciones públicas con token ajeno | Invitada (token) | portal: agregar invitada con token de otro tipo | NOT_FOUND sin crear registros | P2 |
| PERM-186 | portal | Acciones públicas con token ajeno | Invitada (token) | cápsula: libro de visitas con token de cápsula NO publicada o inexistente | NOT_FOUND; publicada → se crea | P1 |
| PERM-187 | portal | Acciones públicas con token ajeno | Clienta (token) | cotización: aceptar/rechazar con token inexistente o de otro tipo | NOT_FOUND y sin reserva | P1 |
| PERM-188 | portal | Acciones públicas con token ajeno | Invitada (token) | subida de foto a cápsula NO publicada o con token rotado | rechazada sin MediaAsset | P1 |
