# Paquete 1 — Acceso y seguridad · TEST_COVERAGE_MATRIX

Fuente: `test-results/l1/results.json` (chromium, carril 1) + `test-results/l9/ratelimit/results.json` (suite ratelimit). Generado 2026-10-06T07:49:38.658Z.
Resultado REAL de la última corrida (reintentos = 1: una prueba que pasa sólo al reintentar figura como FLAKY).

**Total 256** — PASS 251 · FAIL 5

> Actualización 2026-10-06 (corrección de BUG-001 / BUG-004 / BUG-005, carril 1): AUTH-025, AUTH-032 y AUTH-049 pasan como `@regression`; se agregaron AUTH-033…AUTH-038 (revocación de sesiones). Los totales de arriba son de la corrida de auditoría original.

> Actualización ronda 1 (carril 4, hallazgos menores de las revisiones): nuevas AUTH-053…059 (renovación de la cookie con JWT forjados), AUTH-064 (auto-restablecimiento desde Staff), AUTH-065…072 (validación propia de `loginAction`) y NAV-034 (404 real en rutas públicas y por token). Corrida `E2E_LANE=4` de auth + navigation + permissions + api en chromium: 271/271 PASS; AUTH-053…059, AUTH-064…072 y NAV-034 con `--repeat-each=5 --retries=0`: 0 fallas.

| ID | Módulo | Escenario | Rol | Priority | Automated | Result |
|---|---|---|---|---|---|---|
| API-001 | api | /api/health responde {status:ok} sin caché | Anónimo | P1 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-002 | api | /api/health/db verifica PostgreSQL (status ok, database up, latencia numérica) | Anónimo | P1 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-003 | api | POST /api/health → 405 | Anónimo | P3 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-004 | api | DELETE /api/health/db → 405 | Anónimo | P3 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-005 | api | DELETE /api/admin/leads-export → 405 | Anónimo | P3 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-006 | api | POST /api/events/cxxxxxxxxxxxxxxxxxxxxxxxx/guests.csv → 405 | Anónimo | P3 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-007 | api | PUT /api/media/upload → 405 | Anónimo | P3 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-008 | api | POST /api/media/cxxxxxxxxxxxxxxxxxxxxxxxx → 405 | Anónimo | P3 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-009 | api | GET /api/analytics/track → 405 | Anónimo | P3 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-010 | api | DELETE /api/cron/notifications → 405 | Anónimo | P3 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-011 | api | GET /api/webhooks/payments/mock → 405 | Anónimo | P3 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-012 | api | GET /api/memory/aaaaaaaaaaaaaaaaaaaaaaaa/upload → 405 | Anónimo | P3 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-020 | api | sin Authorization → 401 con WWW-Authenticate Bearer | Anónimo | P0 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-021 | api | secreto incorrecto / esquema distinto / vacío → 401 y no ejecuta nada | Anónimo | P0 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-022 | api | secreto correcto → 200 {ok:true} e idempotente (la 2ª corrida no duplica avisos) | Anónimo | P1 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-030 | api | sin firma → 400 invalid_signature y no se registra ni procesa | Anónimo | P0 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-031 | api | firma inválida, con otro secreto, malformada o vencida (>300 s) → 400 sin efecto | Anónimo | P0 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-032 | api | evento repetido con firma válida: se procesa una sola vez (duplicate:true) | Anónimo | P0 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-033 | api | proveedor desconocido o con caracteres inválidos → 404 | Anónimo | P2 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-034 | api | cuerpo > 256 KB → 413 sin procesar; JSON inválido con firma válida → 400 | Anónimo | P2 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-035 | api | evento válido de un pago inexistente → 200 registrado con nota payment_not_found (sin efectos) | Anónimo | P2 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-040 | api | CSRF: sin Origin, con Origin ajeno o Sec-Fetch-Site cross-site → 403 sin registrar | Anónimo | P1 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-041 | api | mismo origen + cuerpo válido → 204 y AnalyticsEvent con origin=client | Anónimo | P2 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-042 | api | cuerpo inválido: tipo no permitido, campos extra, JSON roto → 400; > 4 KB → 413 | Anónimo | P2 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-050 | api | /api/auth/session: anónimo sin usuario; owner sin datos sensibles | Owner | P1 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-051 | api | POST directo a /api/auth/callback/credentials sin token CSRF no crea sesión | Anónimo | P1 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-052 | api | /api/auth/signin redirige al login propio; providers sólo expone credenciales | Anónimo | P3 | ✅ tests/e2e/api/handlers.spec.ts | PASS |
| API-060 | api | privado sin firma o con firma inválida/ajena/vencida → 403; firma vigente → redirect | Anónimo | P0 | ✅ tests/e2e/api/media-csv.spec.ts | PASS |
| API-061 | api | público: libre; id malformado o inexistente → 404 genérico | Anónimo | P2 | ✅ tests/e2e/api/media-csv.spec.ts | PASS |
| API-062 | api | sin sesión → 401; con sesión pero Origin ajeno o sin Origin → 403 (CSRF); nada se guarda | Owner | P0 | ✅ tests/e2e/api/media-csv.spec.ts | PASS |
| API-063 | api | magic bytes falsos (texto .jpg), SVG con script y HTML → rechazados sin MediaAsset | Owner | P0 | ✅ tests/e2e/api/media-csv.spec.ts | PASS |
| API-064 | api | archivo que supera UPLOAD_MAX_MB → rechazado con mensaje de tamaño | Owner | P1 | ✅ tests/e2e/api/media-csv.spec.ts | PASS |
| API-065 | api | campos inválidos (sin archivo, propósito inexistente) → 400 | Owner | P2 | ✅ tests/e2e/api/media-csv.spec.ts | PASS |
| API-066 | api | owner sube PNG real → MediaAsset privado en base y se sirve sólo con URL firmada | Owner | P1 | ✅ tests/e2e/api/media-csv.spec.ts | PASS |
| API-067 | api | staff: sólo evidencias de checklist de eventos ASIGNADOS (otro propósito o evento ajeno → 403) | Staff | P0 | ✅ tests/e2e/api/media-csv.spec.ts | PASS |
| API-068 | api | subida pública a cápsula: Origin ajeno → 403; sin consentimiento → 400; válida → 201 privada y pendiente de revisión | Invitada (token) | P1 | ✅ tests/e2e/api/media-csv.spec.ts | PASS |
| API-070 | api | leads CSV: anónimo 401, staff 403; owner obtiene CSV con BOM, encabezados y fórmulas neutralizadas (auditado) | Owner | P0 | ✅ tests/e2e/api/media-csv.spec.ts | PASS |
| API-071 | api | guests.csv: anónimo 401, staff 403 (incluso de su evento), evento inexistente 404; owner CSV neutralizado | Owner | P0 | ✅ tests/e2e/api/media-csv.spec.ts | PASS |
| API-072 | api | finanzas CSV (/admin/finance/export): anónimo → login, staff → /staff; owner CSV con montos y títulos neutralizados | Owner | P0 | ✅ tests/e2e/api/media-csv.spec.ts | PASS |
| API-080 | api | contacto: 5 envíos reales crean 5 leads; el 6º se rechaza con mensaje de límite y no crea lead | Anónimo | P1 | ✅ tests/e2e/api/public-actions.ratelimit.spec.ts (chromium-ratelimit) | PASS |
| API-081 | api | configurador: el 6º envío en 10 min responde RATE_LIMITED aunque el payload sea inválido | Anónimo | P1 | ✅ tests/e2e/api/public-actions.ratelimit.spec.ts (chromium-ratelimit) | PASS |
| AUTH-001 | auth | login válido de superadmin redirige a su inicio con sesión httpOnly | SuperAdmin | P0 | ✅ tests/e2e/auth/login.spec.ts | PASS |
| AUTH-002 | auth | login válido de owner redirige a su inicio con sesión httpOnly | Owner | P0 | ✅ tests/e2e/auth/login.spec.ts | PASS |
| AUTH-003 | auth | login válido de owner2 redirige a su inicio con sesión httpOnly | Owner | P0 | ✅ tests/e2e/auth/login.spec.ts | PASS |
| AUTH-004 | auth | login válido de staff redirige a su inicio con sesión httpOnly | Staff | P0 | ✅ tests/e2e/auth/login.spec.ts | PASS |
| AUTH-005 | auth | login válido de staff2 redirige a su inicio con sesión httpOnly | Staff | P0 | ✅ tests/e2e/auth/login.spec.ts | PASS |
| AUTH-006 | auth | contraseña incorrecta: mensaje genérico, sin sesión y sin lastLoginAt | Anónimo | P0 | ✅ tests/e2e/auth/login.spec.ts | PASS |
| AUTH-007 | auth | usuario inexistente recibe exactamente el mismo mensaje (sin enumeración) | Anónimo | P0 | ✅ tests/e2e/auth/login.spec.ts | PASS |
| AUTH-008 | auth | campos vacíos: el navegador exige ambos y el servidor también valida | Anónimo | P1 | ✅ tests/e2e/auth/login.spec.ts | PASS |
| AUTH-009 | auth | correo con formato inválido es rechazado en servidor | Anónimo | P2 | ✅ tests/e2e/auth/login.spec.ts | PASS |
| AUTH-010 | auth | usuaria desactivada no puede iniciar sesión (mensaje genérico) | Anónimo | P0 | ✅ tests/e2e/auth/login.spec.ts | PASS |
| AUTH-011 | auth | cuenta con rol CUSTOMER no entra al equipo aunque la contraseña sea correcta | Anónimo | P1 | ✅ tests/e2e/auth/login.spec.ts | PASS |
| AUTH-012 | auth | cuenta sin contraseña (ficha sin acceso) no puede iniciar sesión | Anónimo | P2 | ✅ tests/e2e/auth/login.spec.ts | PASS |
| AUTH-013 | auth | con sesión abierta, /login redirige al inicio del rol | Owner | P2 | ✅ tests/e2e/auth/login.spec.ts | PASS |
| AUTH-014 | auth | correo con mayúsculas y espacios se normaliza y permite entrar | Anónimo | P2 | ✅ tests/e2e/auth/login.spec.ts | PASS |
| AUTH-015 | auth | formulario de login accesible y operable con teclado | Anónimo | P2 | ✅ tests/e2e/auth/login.spec.ts | PASS |
| AUTH-016 | auth | página de login: noindex, contraseña enmascarada y autocompletado correcto | Anónimo | P3 | ✅ tests/e2e/auth/login.spec.ts | PASS |
| AUTH-017 | auth | recuperación pública de contraseña: no existe (restablecimiento sólo por admin) | Anónimo | P3 | ✅ tests/e2e/auth/login.spec.ts | PASS |
| AUTH-020 | auth | logout desde el panel elimina la cookie y vuelve a /login | Owner | P0 | ✅ tests/e2e/auth/session.spec.ts | PASS |
| AUTH-021 | auth | tras logout, 'Atrás' no muestra datos privados del panel | Owner | P1 | ✅ tests/e2e/auth/session.spec.ts | PASS |
| AUTH-022 | auth | respuestas del panel autenticado no se cachean (Cache-Control no-store) | Owner | P2 | ✅ tests/e2e/auth/session.spec.ts | PASS |
| AUTH-023 | auth | sin cookies (request directo / apiAs anónimo) las páginas privadas redirigen a login | Anónimo | P0 | ✅ tests/e2e/auth/session.spec.ts | PASS |
| AUTH-024 | auth | cookie de sesión manipulada o falsificada no autoriza | Anónimo | P0 | ✅ tests/e2e/auth/session.spec.ts | PASS |
| AUTH-025 | auth | logout invalida la sesión en el servidor (la cookie anterior deja de servir) | Owner | P1 | ✅ tests/e2e/auth/session.spec.ts | PASS (@regression BUG-004) |
| AUTH-026 | auth | dos pestañas: logout en una ⇒ la otra pierde acceso en el siguiente request | Owner | P1 | ✅ tests/e2e/auth/session.spec.ts | PASS |
| AUTH-027 | auth | desactivar a una usuaria con sesión abierta corta su acceso en el siguiente request (páginas y acciones) | Owner | P0 | ✅ tests/e2e/auth/session.spec.ts | PASS |
| AUTH-028 | auth | bajar de OWNER a STAFF con sesión abierta: el siguiente request ya no autoriza el panel ni sus acciones | Owner | P0 | ✅ tests/e2e/auth/session.spec.ts | PASS |
| AUTH-029 | auth | subir de STAFF a OWNER aplica en el siguiente request (sin re-login) | Staff | P2 | ✅ tests/e2e/auth/session.spec.ts | PASS |
| AUTH-030 | auth | logout desde el portal staff | Staff | P1 | ✅ tests/e2e/auth/session.spec.ts | PASS |
| AUTH-031 | auth | /sin-acceso: página 403 clara, noindex y con salidas | Anónimo | P3 | ✅ tests/e2e/auth/session.spec.ts | PASS |
| AUTH-032 | auth | logout con otra pestaña del panel cargando: la sesión NO debe revivir | Owner | P0 | ✅ tests/e2e/auth/session.spec.ts | PASS (@regression BUG-001) |
| AUTH-033 | auth | restablecer la contraseña desde Usuarios cierra las sesiones abiertas de esa cuenta | Superadmin | P1 | ✅ tests/e2e/auth/session.spec.ts | PASS (@regression BUG-004) |
| AUTH-034 | auth | restablecer la contraseña de un integrante (Staff) cierra su sesión del portal | Owner | P1 | ✅ tests/e2e/auth/session.spec.ts | PASS (@regression BUG-004) |
| AUTH-035 | auth | cambiar el rol desde Usuarios cierra la sesión abierta; al volver a entrar aplica el rol nuevo | Owner | P1 | ✅ tests/e2e/auth/session.spec.ts | PASS (@regression BUG-004) |
| AUTH-036 | auth | desactivar y reactivar una cuenta no revive la sesión anterior | Superadmin | P1 | ✅ tests/e2e/auth/session.spec.ts | PASS (@regression BUG-004) |
| AUTH-037 | auth | restablecer la propia contraseña cierra la sesión actual y pide entrar con la nueva | Owner | P1 | ✅ tests/e2e/auth/session.spec.ts | PASS (@regression BUG-004) |
| AUTH-038 | auth | una cookie ya revocada no puede cerrar las sesiones nuevas de la cuenta | Owner | P2 | ✅ tests/e2e/auth/session.spec.ts | PASS |
| AUTH-040 | auth | ruta privada sin sesión → login con callbackUrl → tras entrar vuelve a esa ruta | Owner | P0 | ✅ tests/e2e/auth/callback.spec.ts | PASS |
| AUTH-041 | auth | STAFF con callbackUrl a /admin termina en /staff | Staff | P1 | ✅ tests/e2e/auth/callback.spec.ts | PASS |
| AUTH-042 | auth | STAFF con callbackUrl interno permitido (/staff/...) lo respeta | Staff | P2 | ✅ tests/e2e/auth/callback.spec.ts | PASS |
| AUTH-043 | auth | callbackUrl malicioso "https://evil.example/robo" no redirige fuera de la app | Owner | P0 | ✅ tests/e2e/auth/callback.spec.ts | PASS |
| AUTH-044 | auth | callbackUrl malicioso "//evil.example/robo" no redirige fuera de la app | Owner | P0 | ✅ tests/e2e/auth/callback.spec.ts | PASS |
| AUTH-045 | auth | callbackUrl malicioso "/\\evil.example/robo" no redirige fuera de la app | Owner | P0 | ✅ tests/e2e/auth/callback.spec.ts | PASS |
| AUTH-046 | auth | callbackUrl malicioso "\\\\evil.example" no redirige fuera de la app | Owner | P0 | ✅ tests/e2e/auth/callback.spec.ts | PASS |
| AUTH-047 | auth | callbackUrl malicioso "javascript:alert(document.domain)" no redirige fuera de la app | Owner | P0 | ✅ tests/e2e/auth/callback.spec.ts | PASS |
| AUTH-048 | auth | callbackUrl malicioso "/%2F%2Fevil.example" no redirige fuera de la app | Owner | P0 | ✅ tests/e2e/auth/callback.spec.ts | PASS |
| AUTH-049 | auth | callbackUrl malicioso "/\t/evil.example" no redirige fuera de la app | Owner | P0 | ✅ tests/e2e/auth/callback.spec.ts | PASS (@regression BUG-005) |
| AUTH-050 | auth | callbackUrl malicioso "http://localhost@evil.example/" no redirige fuera de la app | Owner | P0 | ✅ tests/e2e/auth/callback.spec.ts | PASS |
| AUTH-051 | auth | el middleware conserva ruta + query en callbackUrl y no acepta hosts | Anónimo | P2 | ✅ tests/e2e/auth/callback.spec.ts | PASS |
| AUTH-053 | auth | JWT con ≥ 1 h: un GET de documento renueva la cookie (iat nuevo, mismos datos) y la renovada autoriza | Owner | P1 | ✅ tests/e2e/auth/session-renewal.spec.ts | PASS (@regression BUG-001) |
| AUTH-054 | auth | JWT con ≥ 1 h: un GET RSC (navegación del cliente) también renueva la cookie | Staff | P2 | ✅ tests/e2e/auth/session-renewal.spec.ts | PASS |
| AUTH-055 | auth | JWT con ≥ 1 h: un POST de Server Action NO re-emite la cookie (la acción corre con esa sesión) | Owner | P1 | ✅ tests/e2e/auth/session-renewal.spec.ts | PASS (@regression BUG-001) |
| AUTH-056 | auth | JWT reciente: un GET (documento y RSC) no re-emite la cookie | Owner | P2 | ✅ tests/e2e/auth/session-renewal.spec.ts | PASS |
| AUTH-057 | auth | cookie de sesión inválida: el middleware conserva su borrado y manda a login | Anónimo | P2 | ✅ tests/e2e/auth/session-renewal.spec.ts | PASS |
| AUTH-058 | auth | JWT con ≥ 1 h pero revocado: aunque un GET lo renueve, la cookie renovada sigue sin autorizar | Owner | P1 | ✅ tests/e2e/auth/session-renewal.spec.ts | PASS (@regression BUG-004) |
| AUTH-059 | auth | GET /api/auth/session devuelve la sesión pero no re-emite la cookie | Owner | P2 | ✅ tests/e2e/auth/session-renewal.spec.ts | PASS (@regression BUG-001) |
| AUTH-060 | auth | 8 intentos fallidos permitidos; el 9º se bloquea y ni la contraseña correcta entra | Anónimo | P0 | ✅ tests/e2e/auth/login.ratelimit.spec.ts (chromium-ratelimit) | PASS |
| AUTH-061 | auth | el bloqueo es por cuenta: otra cuenta desde el mismo navegador entra normalmente | Anónimo | P1 | ✅ tests/e2e/auth/login.ratelimit.spec.ts (chromium-ratelimit) | PASS |
| AUTH-062 | auth | correo inexistente también se limita con el mismo mensaje (sin enumeración por el limitador) | Anónimo | P1 | ✅ tests/e2e/auth/login.ratelimit.spec.ts (chromium-ratelimit) | PASS |
| AUTH-063 | auth | variar mayúsculas/espacios del correo no evade el límite (misma cubeta normalizada) | Anónimo | P2 | ✅ tests/e2e/auth/login.ratelimit.spec.ts (chromium-ratelimit) | PASS |
| AUTH-064 | auth | restablecer la propia contraseña desde Staff (fundadora con ficha) cierra la sesión y pide entrar con la nueva | Owner | P1 | ✅ tests/e2e/auth/session.spec.ts | PASS (@regression BUG-004) |
| AUTH-065…072 | auth | loginAction descarta en el servidor cada callbackUrl malicioso de AUTH-043…050 aunque el formulario lo envíe | Owner | P0 | ✅ tests/e2e/auth/callback.spec.ts | PASS chromium/firefox/webkit (AUTH-071 @regression BUG-005) |
| NAV-001 | navigation | ruta pública inexistente → 404 'Esta mesa no está puesta' con regreso al inicio | Anónimo | P2 | ✅ tests/e2e/navigation/not-found.spec.ts | PASS |
| NAV-002 | navigation | experiencia pública inexistente → contenido 404 y HTTP 404 (no soft-404) | Anónimo | P3 | ✅ tests/e2e/navigation/not-found.spec.ts | FAIL (ACC-BUG-04) |
| NAV-003 | navigation | ruta inexistente dentro del panel (owner) → HTTP 404 con la página 404 general | Owner | P2 | ✅ tests/e2e/navigation/not-found.spec.ts | PASS |
| NAV-004 | navigation | detalle admin con id inexistente (lead, evento, cotización, clienta, compra) → 'No encontramos…' sin error | Owner | P2 | ✅ tests/e2e/navigation/not-found.spec.ts | PASS |
| NAV-005 | navigation | ruta inexistente en el portal staff → 404 y la navegación del portal sigue disponible | Staff | P3 | ✅ tests/e2e/navigation/not-found.spec.ts | PASS |
| NAV-006 | navigation | 404 de experiencia (token) ofrece salida y no muestra navegación de marketing | Clienta (token) | P3 | ✅ tests/e2e/navigation/not-found.spec.ts | PASS |
| NAV-034 | navigation | rutas públicas y por token con slug/token inexistente → HTTP 404 real (no soft-404) | Anónimo | P3 | ✅ tests/e2e/navigation/not-found.spec.ts | PASS (@regression BUG-013) |
| NAV-010 | navigation | sitio público: todos los enlaces internos de las páginas públicas responden | Anónimo | P1 | ✅ tests/e2e/navigation/links.spec.ts | PASS |
| NAV-011 | navigation | panel admin (owner): sidebar y enlaces de cada sección responden sin 404/500 | Owner | P1 | ✅ tests/e2e/navigation/links.spec.ts | PASS |
| NAV-012 | navigation | secciones de detalle del panel (evento, cotización, lead, clienta, catálogo, configuración) sin enlaces rotos | Owner | P2 | ✅ tests/e2e/navigation/links.spec.ts | PASS |
| NAV-013 | navigation | portal staff: enlaces de 'Mis eventos' y del detalle responden para staff | Staff | P1 | ✅ tests/e2e/navigation/links.spec.ts | PASS |
| NAV-014 | navigation | experiencias por token (cotización, portal, micrositio, cápsula): enlaces internos responden | Clienta (token) | P2 | ✅ tests/e2e/navigation/links.spec.ts | PASS |
| NAV-015 | navigation | enlaces de acción del buzón (NotificationLog.actionUrl) apuntan a rutas existentes | Owner | P3 | ✅ tests/e2e/navigation/links.spec.ts | FAIL (ACC-BUG-05) |
| NAV-020 | navigation | sidebar (owner): cada sección navega, marca aria-current y muestra su encabezado | Owner | P1 | ✅ tests/e2e/navigation/menus.spec.ts | PASS |
| NAV-021 | navigation | superadmin ve las mismas 17 secciones; staff no ve el panel | SuperAdmin | P2 | ✅ tests/e2e/navigation/menus.spec.ts | PASS |
| NAV-022 | navigation | menú móvil del panel (390 px): abre, navega y se cierra | Owner | P2 | ✅ tests/e2e/navigation/menus.spec.ts | PASS |
| NAV-023 | navigation | atrás/adelante entre secciones del panel conserva la página correcta | Owner | P2 | ✅ tests/e2e/navigation/menus.spec.ts | PASS |
| NAV-024 | navigation | enlaces 'volver' de los detalles (lead, staff portal) regresan al listado | Owner | P2 | ✅ tests/e2e/navigation/menus.spec.ts | PASS |
| NAV-030 | navigation | cabecera pública: cada enlace navega y marca aria-current; CTA lleva al configurador | Anónimo | P1 | ✅ tests/e2e/navigation/menus.spec.ts | PASS |
| NAV-031 | navigation | menú móvil público (390 px): abre, navega y cierra | Anónimo | P2 | ✅ tests/e2e/navigation/menus.spec.ts | PASS |
| NAV-032 | navigation | migas de pan en la ficha de experiencia: Inicio › Experiencias › nombre | Anónimo | P2 | ✅ tests/e2e/navigation/menus.spec.ts | PASS |
| NAV-033 | navigation | 'Saltar al contenido' es el primer foco y lleva al <main> | Anónimo | P2 | ✅ tests/e2e/navigation/menus.spec.ts | PASS |
| PERM-001 | auth | / — anónimo/staff/owner/superadmin | Owner | P2 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-002 | auth | /admin — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-003 | auth | /admin/analytics — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-004 | auth | /admin/calendar — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-005 | auth | /admin/catalog — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-006 | auth | /admin/catalog/addons — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-007 | auth | /admin/catalog/addons/[id] — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-008 | auth | /admin/catalog/addons/new — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-009 | auth | /admin/catalog/areas — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-010 | auth | /admin/catalog/budgets — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-011 | auth | /admin/catalog/experiences/[id] — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-012 | auth | /admin/catalog/experiences/new — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-013 | auth | /admin/catalog/menus — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-014 | auth | /admin/catalog/menus/[id] — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-015 | auth | /admin/catalog/menus/new — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-016 | auth | /admin/catalog/styles — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-017 | auth | /admin/content — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-018 | auth | /admin/content/faq — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-019 | auth | /admin/content/gallery — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-020 | auth | /admin/customers — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-021 | auth | /admin/customers/[id] — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-022 | auth | /admin/events — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-023 | auth | /admin/events/[id] — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-024 | auth | /admin/events/[id]/financials — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-025 | auth | /admin/events/[id]/guests — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-026 | auth | /admin/events/[id]/memory — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-027 | auth | /admin/events/[id]/operations — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-028 | auth | /admin/events/new — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-029 | auth | /admin/finance — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-030 | auth | /admin/inventory — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-031 | auth | /admin/inventory/[id] — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-032 | auth | /admin/inventory/conflicts — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-033 | auth | /admin/inventory/events — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-034 | auth | /admin/inventory/events/[eventId] — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-035 | auth | /admin/leads — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-036 | auth | /admin/leads/[id] — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-037 | auth | /admin/notifications — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-038 | auth | /admin/operations — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-039 | auth | /admin/operations/templates — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-040 | auth | /admin/operations/templates/[id] — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-041 | auth | /admin/purchases — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-042 | auth | /admin/purchases/[id] — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-043 | auth | /admin/purchases/new — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-044 | auth | /admin/quotes — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-045 | auth | /admin/quotes/[id] — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-046 | auth | /admin/quotes/[id]/print — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-047 | auth | /admin/quotes/new — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-048 | auth | /admin/settings — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-049 | auth | /admin/settings/audit — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-050 | auth | /admin/settings/availability — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-051 | auth | /admin/settings/flags — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-052 | auth | /admin/settings/integrations — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-053 | auth | /admin/settings/notifications — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-054 | auth | /admin/settings/pricing — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-055 | auth | /admin/settings/users — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-056 | auth | /admin/staff — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-057 | auth | /admin/staff/[id] — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-058 | auth | /admin/staff/new — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-059 | auth | /admin/vendors — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-060 | auth | /admin/vendors/[id] — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-061 | auth | /admin/vendors/[id]/edit — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-062 | auth | /admin/vendors/new — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-063 | auth | /como-funciona — anónimo/staff/owner/superadmin | Owner | P2 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-064 | auth | /contacto — anónimo/staff/owner/superadmin | Owner | P2 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-065 | auth | /cotizacion/[token] — anónimo/staff/owner/superadmin | Owner | P1 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-066 | auth | /crear-experiencia — anónimo/staff/owner/superadmin | Owner | P2 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-067 | auth | /crear-experiencia/ai — anónimo/staff/owner/superadmin | Owner | P2 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-068 | auth | /e/[slug]/[token] — anónimo/staff/owner/superadmin | Owner | P1 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-069 | auth | /experiencias — anónimo/staff/owner/superadmin | Owner | P2 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-070 | auth | /experiencias/[slug] — anónimo/staff/owner/superadmin | Owner | P2 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-071 | auth | /login — anónimo/staff/owner/superadmin | Owner | P2 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-072 | auth | /memory/[token] — anónimo/staff/owner/superadmin | Owner | P1 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-073 | auth | /mi-evento — anónimo/staff/owner/superadmin | Owner | P1 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-074 | auth | /mi-evento/[token] — anónimo/staff/owner/superadmin | Owner | P1 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-075 | auth | /mi-evento/[token]/resumen — anónimo/staff/owner/superadmin | Owner | P1 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-076 | auth | /nuestra-historia — anónimo/staff/owner/superadmin | Owner | P2 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-077 | auth | /pago/mock/[checkoutId] — anónimo/staff/owner/superadmin | Owner | P1 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-078 | auth | /pago/resultado — anónimo/staff/owner/superadmin | Owner | P1 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-079 | auth | /privacidad — anónimo/staff/owner/superadmin | Owner | P2 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-080 | auth | /sin-acceso — anónimo/staff/owner/superadmin | Owner | P2 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-081 | auth | /staff — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-082 | auth | /staff/events/[id] — anónimo/staff/owner/superadmin | Owner | P0 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-083 | auth | /terminos — anónimo/staff/owner/superadmin | Owner | P2 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-090 | auth | el inventario cubre las 83 páginas y todas tienen fila en la matriz | Owner | P2 | ✅ tests/e2e/permissions/page-matrix.spec.ts | PASS |
| PERM-100 | staff | /staff muestra sólo los eventos asignados a la persona (y ninguno ajeno) | Staff | P0 | ✅ tests/e2e/permissions/staff-access.spec.ts | PASS |
| PERM-101 | staff | staff en /staff/events/<evento NO asignado> → no encontrado y sin datos del evento | Staff | P0 | ✅ tests/e2e/permissions/staff-access.spec.ts | PASS |
| PERM-102 | staff | staff2 no ve un evento asignado sólo a staff (y staff sí) | Staff | P0 | ✅ tests/e2e/permissions/staff-access.spec.ts | PASS |
| PERM-103 | staff | evento asignado pero CANCELADO deja de ser visible para staff | Staff | P1 | ✅ tests/e2e/permissions/staff-access.spec.ts | PASS |
| PERM-104 | staff | id inexistente o malformado en /staff/events/[id] → no encontrado (sin error 500) | Staff | P2 | ✅ tests/e2e/permissions/staff-access.spec.ts | PASS |
| PERM-105 | staff | owner/superadmin pueden abrir la vista staff de cualquier evento (sin montos) | Owner | P2 | ✅ tests/e2e/permissions/staff-access.spec.ts | PASS |
| PERM-110 | staff | staff repite 'Empezar tarea' con el id de una tarea de un evento NO asignado → FORBIDDEN y la base no cambia | Staff | P0 | ✅ tests/e2e/permissions/staff-access.spec.ts | PASS |
| PERM-111 | staff | staff no puede cambiar una tarea asignada a otra persona del mismo evento | Staff | P1 | ✅ tests/e2e/permissions/staff-access.spec.ts | PASS |
| PERM-112 | staff | staff no puede OMITIR (SKIPPED) tareas aunque sean suyas | Staff | P2 | ✅ tests/e2e/permissions/staff-access.spec.ts | PASS |
| PERM-113 | staff | staff2 repitiendo el request de Lupita sobre un evento donde no está asignado → FORBIDDEN | Staff | P1 | ✅ tests/e2e/permissions/staff-access.spec.ts | PASS |
| PERM-114 | staff | staff no puede adjuntar como evidencia una foto subida por otra persona | Staff | P1 | ✅ tests/e2e/permissions/staff-access.spec.ts | PASS |
| PERM-115 | staff | tarea inexistente → NOT_FOUND controlado; anónimo → redirigido a login | Staff | P2 | ✅ tests/e2e/permissions/staff-access.spec.ts | PASS |
| PERM-120 | staff | el build expone acciones de admin de staff en la página del portal (inventario de superficie) | Staff | P2 | ✅ tests/e2e/permissions/staff-access.spec.ts | PASS |
| PERM-121 | staff | staff ejecutando resetStaffPasswordAction desde /staff/events/[id] → FORBIDDEN y sin cambios | Staff | P0 | ✅ tests/e2e/permissions/staff-access.spec.ts | PASS |
| PERM-122 | staff | staff ejecutando setStaffAccessActiveAction desde /staff/events/[id] → FORBIDDEN y sin cambios | Staff | P0 | ✅ tests/e2e/permissions/staff-access.spec.ts | PASS |
| PERM-123 | staff | staff ejecutando createStaffAccessAction desde /staff/events/[id] → FORBIDDEN y sin cambios | Staff | P0 | ✅ tests/e2e/permissions/staff-access.spec.ts | PASS |
| PERM-124 | staff | staff ejecutando createStaffMemberAction desde /staff/events/[id] → FORBIDDEN y sin cambios | Staff | P0 | ✅ tests/e2e/permissions/staff-access.spec.ts | PASS |
| PERM-125 | staff | staff ejecutando updateStaffMemberAction desde /staff/events/[id] → FORBIDDEN y sin cambios | Staff | P0 | ✅ tests/e2e/permissions/staff-access.spec.ts | PASS |
| PERM-126 | staff | staff ejecutando deleteStaffMemberAction desde /staff/events/[id] → FORBIDDEN y sin cambios | Staff | P0 | ✅ tests/e2e/permissions/staff-access.spec.ts | PASS |
| PERM-127 | staff | control positivo: la misma acción desde /staff/events/[id] con OWNER sí se ejecuta | Owner | P2 | ✅ tests/e2e/permissions/staff-access.spec.ts | PASS |
| PERM-130 | memory | superficie: la página pública /memory/[token] importa las 7 acciones de administración de la cápsula | Anónimo | P2 | ✅ tests/e2e/permissions/exposed-actions.spec.ts | PASS |
| PERM-131 | memory | anónimo y staff ejecutando rotateShareTokenAction desde /memory/[token] → rechazado y sin cambios | Anónimo | P0 | ✅ tests/e2e/permissions/exposed-actions.spec.ts | PASS |
| PERM-132 | memory | anónimo y staff ejecutando updateCapsuleAction desde /memory/[token] → rechazado y sin cambios | Anónimo | P0 | ✅ tests/e2e/permissions/exposed-actions.spec.ts | PASS |
| PERM-133 | memory | anónimo y staff ejecutando setCoverAction desde /memory/[token] → rechazado y sin cambios | Anónimo | P0 | ✅ tests/e2e/permissions/exposed-actions.spec.ts | PASS |
| PERM-134 | memory | anónimo y staff ejecutando setMediaApprovalAction desde /memory/[token] → rechazado y sin cambios | Anónimo | P0 | ✅ tests/e2e/permissions/exposed-actions.spec.ts | PASS |
| PERM-135 | memory | anónimo y staff ejecutando deleteCapsuleMediaAction desde /memory/[token] → rechazado y sin cambios | Anónimo | P0 | ✅ tests/e2e/permissions/exposed-actions.spec.ts | PASS |
| PERM-136 | memory | anónimo y staff ejecutando setMessageHiddenAction desde /memory/[token] → rechazado y sin cambios | Anónimo | P0 | ✅ tests/e2e/permissions/exposed-actions.spec.ts | PASS |
| PERM-137 | memory | anónimo y staff ejecutando createCapsuleAction desde /memory/[token] → rechazado y sin cambios | Anónimo | P0 | ✅ tests/e2e/permissions/exposed-actions.spec.ts | PASS |
| PERM-138 | memory | control positivo: OWNER sí ejecuta updateCapsuleAction desde la misma página pública | Owner | P2 | ✅ tests/e2e/permissions/exposed-actions.spec.ts | PASS |
| PERM-140 | users | OWNER no puede CREAR una cuenta SUPER_ADMIN (request forzado) — superadmin sí | Owner | P0 | ✅ tests/e2e/permissions/role-actions.spec.ts | PASS |
| PERM-141 | users | OWNER no puede PROMOVER a SUPER_ADMIN (request forzado) — superadmin sí | Owner | P0 | ✅ tests/e2e/permissions/role-actions.spec.ts | PASS |
| PERM-142 | users | OWNER no puede modificar una cuenta SUPER_ADMIN (rol, estado ni contraseña) — UI y backend | Owner | P0 | ✅ tests/e2e/permissions/role-actions.spec.ts | PASS |
| PERM-143 | users | OWNER puede administrar fundadoras y staff (no es sobre-restrictivo) | Owner | P1 | ✅ tests/e2e/permissions/role-actions.spec.ts | PASS |
| PERM-150 | auth | pago manual: staff/anónimo denegados y sin pago; OWNER sí registra (con auditoría) | Staff | P0 | ✅ tests/e2e/permissions/sensitive-replay.spec.ts | PASS |
| PERM-151 | auth | reembolso: staff/anónimo denegados y el pago no cambia | Staff | P0 | ✅ tests/e2e/permissions/sensitive-replay.spec.ts | PASS |
| PERM-152 | auth | descuento en cotización: staff/anónimo denegados; OWNER aplica con auditoría quote.discount_applied | Staff | P0 | ✅ tests/e2e/permissions/sensitive-replay.spec.ts | PASS |
| PERM-153 | auth | cancelar evento: staff/anónimo denegados; OWNER cancela con auditoría | Staff | P0 | ✅ tests/e2e/permissions/sensitive-replay.spec.ts | PASS |
| PERM-154 | auth | cerrar evento (finanzas): staff/anónimo denegados y el evento sigue abierto | Staff | P1 | ✅ tests/e2e/permissions/sensitive-replay.spec.ts | PASS |
| PERM-155 | auth | rotar token del portal: staff/anónimo denegados; OWNER rota (el anterior deja de servir) | Staff | P0 | ✅ tests/e2e/permissions/sensitive-replay.spec.ts | PASS |
| PERM-156 | auth | cambio de rol: staff/anónimo denegados y el rol no cambia | Staff | P0 | ✅ tests/e2e/permissions/sensitive-replay.spec.ts | PASS |
| PERM-157 | auth | ajustes del negocio, precios y feature flags: staff/anónimo denegados y la configuración no cambia | Staff | P0 | ✅ tests/e2e/permissions/sensitive-replay.spec.ts | PASS |
| PERM-158 | auth | acción de admin enviada a una página que no la importa (/staff, /) no se ejecuta | Staff | P1 | ✅ tests/e2e/permissions/sensitive-replay.spec.ts | PASS |
| PERM-159 | auth | CSRF: Server Action con sesión válida pero Origin ajeno es rechazada y no escribe | Owner | P0 | ✅ tests/e2e/permissions/sensitive-replay.spec.ts | PASS |
| PERM-160 | portal | token inexistente (formato válido) en cada ruta por token → 404 genérico | Anónimo | P0 | ✅ tests/e2e/permissions/token-security.spec.ts | PASS |
| PERM-161 | portal | token malformado (corto, traversal, inyección, unicode) → 404 sin error 500 | Anónimo | P1 | ✅ tests/e2e/permissions/token-security.spec.ts | PASS |
| PERM-162 | portal | micrositio: slug de un evento + token de invitación de OTRO evento → 404 sin datos de ninguno | Invitada (token) | P0 | ✅ tests/e2e/permissions/token-security.spec.ts | PASS |
| PERM-163 | portal | micrositio: slug de un evento + token PERSONAL de invitada de otro evento → 404 | Invitada (token) | P0 | ✅ tests/e2e/permissions/token-security.spec.ts | PASS |
| PERM-164 | portal | tokens de otro TIPO no abren otras zonas (portal↔invitación↔cotización↔cápsula) | Clienta (token) | P0 | ✅ tests/e2e/permissions/token-security.spec.ts | PASS |
| PERM-165 | portal | tokens rotados desde el admin (portal e invitación): el anterior → 404, el nuevo funciona | Owner | P0 | ✅ tests/e2e/permissions/token-security.spec.ts | PASS |
| PERM-166 | portal | cápsula: token rotado → 404; cápsula NO publicada no muestra fotos ni mensajes | Owner | P1 | ✅ tests/e2e/permissions/token-security.spec.ts | PASS |
| PERM-167 | portal | micrositio deshabilitado → 404 aunque el token sea correcto | Invitada (token) | P2 | ✅ tests/e2e/permissions/token-security.spec.ts | PASS |
| PERM-168 | portal | /pago/resultado: firma inválida, ausente o de otro pago → 404; firma válida → 200 | Clienta (token) | P1 | ✅ tests/e2e/permissions/token-security.spec.ts | PASS |
| PERM-169 | portal | /pago/mock: checkout inexistente o malformado → 404; existente → 200 | Clienta (token) | P2 | ✅ tests/e2e/permissions/token-security.spec.ts | PASS |
| PERM-170 | portal | rutas por token: X-Robots-Tag noindex + Referrer-Policy same-origin (válidas e inválidas) | Anónimo | P1 | ✅ tests/e2e/permissions/token-security.spec.ts | PASS |
| PERM-171 | portal | calendar.ics: válido es text/calendar con el evento; token ajeno/rotado → 404 | Invitada (token) | P1 | ✅ tests/e2e/permissions/token-security.spec.ts | PASS |
| PERM-180 | portal | portal: quitar invitada de OTRO evento con mi token → NOT_FOUND y la invitada sigue | Clienta (token) | P0 | ✅ tests/e2e/permissions/public-actions-idor.spec.ts | PASS |
| PERM-181 | portal | RSVP: slug de mi evento + token personal de invitada de OTRO evento → NOT_FOUND y su RSVP no cambia | Invitada (token) | P0 | ✅ tests/e2e/permissions/public-actions-idor.spec.ts | PASS |
| PERM-182 | portal | RSVP: slug de mi evento + invitación general de OTRO evento → NOT_FOUND sin crear invitada | Invitada (token) | P1 | ✅ tests/e2e/permissions/public-actions-idor.spec.ts | PASS |
| PERM-183 | portal | portal: mensaje con token ROTADO → NOT_FOUND; con el vigente sí se envía | Clienta (token) | P1 | ✅ tests/e2e/permissions/public-actions-idor.spec.ts | PASS |
| PERM-184 | portal | portal: preferencias con token de INVITACIÓN o de invitada (otro tipo) → NOT_FOUND y el evento no cambia | Invitada (token) | P1 | ✅ tests/e2e/permissions/public-actions-idor.spec.ts | PASS |
| PERM-185 | portal | portal: agregar invitada con token de otro tipo → NOT_FOUND sin crear registros | Invitada (token) | P2 | ✅ tests/e2e/permissions/public-actions-idor.spec.ts | PASS |
| PERM-186 | portal | cápsula: libro de visitas con token de cápsula NO publicada o inexistente → NOT_FOUND; publicada → se crea | Invitada (token) | P1 | ✅ tests/e2e/permissions/public-actions-idor.spec.ts | PASS |
| PERM-187 | portal | cotización: aceptar/rechazar con token inexistente o de otro tipo → NOT_FOUND y sin reserva | Clienta (token) | P1 | ✅ tests/e2e/permissions/public-actions-idor.spec.ts | PASS |
| PERM-188 | portal | subida de foto a cápsula NO publicada o con token rotado → rechazada sin MediaAsset | Invitada (token) | P1 | ✅ tests/e2e/permissions/public-actions-idor.spec.ts | PASS |

## Totales por prioridad

| Prioridad | Resultado |
|---|---|
| P0 | PASS 132 · FAIL 2 |
| P1 | PASS 50 · FAIL 1 |
| P2 | PASS 53 |
| P3 | PASS 16 · FAIL 2 |

## Totales por módulo

| Módulo | Resultado |
|---|---|
| api | PASS 41 |
| auth | PASS 137 · FAIL 3 |
| memory | PASS 9 |
| navigation | PASS 19 · FAIL 2 |
| portal | PASS 21 |
| staff | PASS 20 |
| users | PASS 4 |
