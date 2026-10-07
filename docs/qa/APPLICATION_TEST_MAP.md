# Application Test Map — Ivonne & Rosa

Fuente: inventario `docs/qa/.discovery/inventory.json` del 2026-10-06 (generado 06:45 UTC, commit `f26b1a1`; 83 páginas, 13 APIs, 169 Server Actions; drift: ninguno) + mapas por carril de la auditoría FULL E2E `docs/qa/findings/{access,sales,commercial,events,operations,transversal}-map.md` y sus matrices `*-coverage.md`. Prioridades: P0 crítico · P1 principal · P2 secundario · P3 menor.

**Actualización 2026-10-07 (estado final, `b47437b`).** Se agregaron las pruebas nuevas desde `8020b91`: ronda 1 de correcciones (merges `d144ce7`…`41db385`), endurecimiento (merges `f8797e0`…`c3ba279`) y formularios antes de hidratar (`e2f3699`, `d96a82a`, `b47437b`). Son **48 IDs nuevos**: 46 en esta actualización, más SET-023/024, que `ae846ec` ya había agregado a MAP-488. Con ellas hay **19 filas nuevas (MAP-510…MAP-528)** y se actualizaron filas existentes. El inventario se regeneró el 2026-10-07T04:02Z (`2fbe8d4`) con los mismos 83 / 13 / 169 y sin drift.

## Prioridades

| Prioridad | Definición | Exigencia del Quality Gate |
|---|---|---|
| **P0 — crítico** | Recorrido crítico de negocio o control de seguridad: login/logout y sesión, autorización por rol (UI y backend), aislamiento por token, precio calculado en servidor, cotización → pago → evento confirmado, dinero (pagos manuales, reembolsos, cierre financiero) y exposición de datos de terceros. Si falla, el negocio no puede vender u operar o se filtran datos. | 100 % PASS (cualquier fallo ⇒ 🟠 NOT RECOMMENDED; un recorrido crítico roto ⇒ 🔴 BLOCKED) |
| **P1 — principal** | Función principal de un módulo: altas, ediciones, transiciones de estado, validaciones de servidor que protegen la integridad, avisos y vistas que el equipo usa a diario. Si falla hay una alternativa incómoda. | ≥ 95 % PASS para 🟢 READY |
| **P2 — secundario** | Validaciones de formulario, filtros, orden y paginación, estados vacíos, casos límite, accesibilidad automática (axe) y responsive del panel. | Se reporta; abre bugs MEDIUM/LOW |
| **P3 — menor** | Cosmético, textos, orden por defecto, métodos HTTP no soportados (405) y detalles sin impacto funcional. | Se reporta |

## Cómo se consolidó

- **Origen:** 719 filas en los 6 carriles (acceso 256, venta pública 89, comercial 91, eventos 72, operación 154, transversal 57) → **509 filas consolidadas** (`MAP-001`…`MAP-509`), agrupadas por módulo. La actualización del 2026-10-07 suma **19 filas (`MAP-510`…`MAP-528`)**. La numeración continúa, pero cada fila nueva se ubicó dentro de su módulo, al final del grupo; por eso el resumen muestra dos rangos en esos módulos. **Total: 528 filas.**
- **Deduplicación entre carriles:** cuando dos o más carriles describen el mismo flujo con el mismo rol (p. ej. smoke + prueba funcional + recorrido crítico, o la matriz de permisos + la prueba de IDOR del módulo) queda una sola fila; su columna **Pruebas** lista todos los IDs y su prioridad es la más alta de los orígenes.
- **Agrupación dentro de un carril:** la matriz rol × página se agrupa por sección del panel (cada ruta aparece explícita); también se agrupan los métodos HTTP no soportados, las variantes de `callbackUrl` malicioso y las acciones de administración expuestas en páginas públicas o del portal. Las 169 Server Actions se nombran en la columna «Página/Flujo» del flujo que las ejerce.
- **Pruebas:** IDs de las matrices `docs/qa/findings/*-coverage.md` y, para las nuevas, de los títulos `[XXX-NNN]` de `tests/e2e` (`git diff 8020b91..HEAD -- tests/e2e`). Hay 886 IDs y cada uno aparece al menos una vez: los 838 de la auditoría (836 pruebas automatizadas más M3-106 y M3-107, que son IDs de cobertura) y los 48 nuevos. Las 884 pruebas automatizadas coinciden con los IDs ejecutados en la regresión final (`test-results/l1…l6`, `global` y `ratelimit`). NAV-034 está duplicado en el código (nota ¹ al pie del mapa). Los resultados (PASS/FAIL/FLAKY) viven en `TEST_COVERAGE_MATRIX.md` y en los hallazgos de cada carril, no en este mapa.
- **Roles:** Anónimo (sin sesión) · Clienta (token) = anfitriona con enlace de cotización/portal · Invitada (token) = enlace del micrositio o de la cápsula · Staff (Lupita = `staff@`, Carlos = `staff2@`) · Owner (Ivonne = `ivonne@`, Rosa = `rosa@`) · SuperAdmin · Proveedor/Cron = llamadas máquina a máquina. «A → B» indica un flujo que cruza roles.
- **«(global)»** marca escenarios que cambian ajustes globales (suite `E2E_SUITE=global`, 1 worker).

## Cobertura del inventario

| Elemento del inventario | En el mapa | Detalle |
|---|---|---|
| Páginas | 83/83 | Todas en la matriz rol × página (módulo Autorización) y 83/83 además con al menos una fila funcional. |
| APIs (route handlers) | 13/13 | `/admin/finance/export`, `/e/[slug]/[token]/calendar.ics`, `/api/admin/leads-export`, `/api/analytics/track`, `/api/auth/[...nextauth]`, `/api/cron/notifications`, `/api/events/[id]/guests.csv`, `/api/health/db`, `/api/health`, `/api/media/upload`, `/api/media/[id]`, `/api/memory/[token]/upload`, `/api/webhooks/payments/[provider]` |
| Server Actions | 169/169 | 148 protegidas + 21 públicas, más `loginAction` (función de servidor sin wrapper); cada una se nombra en la columna «Página/Flujo» del flujo que la ejerce (`searchCustomersAction` existe en eventos y en cotizaciones y aparece en ambos). |
| Pruebas de la auditoría | 838/838 | IDs de los 6 `*-coverage.md` |
| Pruebas nuevas desde `8020b91` | 48/48 | AUTH-033…038, AUTH-053…059, AUTH-064…072, CONF-024, CONF-025, EVT-039, GST-023…028, MEM-021, NAV-034…036, PAY-023…025, PORT-021…025, PUB-048, PUB-049, SET-023, SET-024, STF-025 |
| **Total de IDs** | **886/886** | 884 pruebas automatizadas + M3-106/M3-107; NAV-034 = 2 pruebas con el mismo ID (¹) |

## Resumen por módulo y prioridad

| Módulo | Filas | P0 | P1 | P2 | P3 | Pruebas distintas |
|---|---:|---:|---:|---:|---:|---:|
| Autenticación (MAP-001–036, MAP-510–514) | 41 | 18 | 11 | 11 | 1 | 82 |
| Autorización (MAP-037–069) | 33 | 23 | 6 | 4 | 0 | 110 |
| Accesos por token (MAP-070–080) | 11 | 5 | 5 | 1 | 0 | 17 |
| API (route handlers) (MAP-081–104) | 24 | 9 | 6 | 7 | 2 | 40 |
| Navegación (MAP-105–124, MAP-515–516) | 22 | 1 | 6 | 11 | 4 | 37 |
| Sitio público y contacto (MAP-125–147, MAP-517–518) | 25 | 7 | 12 | 6 | 0 | 55 |
| Configurador (MAP-148–171, MAP-519) | 25 | 4 | 15 | 5 | 1 | 29 |
| Diseñador IA (MAP-172–180) | 9 | 0 | 7 | 2 | 0 | 10 |
| Leads (MAP-181–210) | 30 | 1 | 15 | 12 | 2 | 38 |
| Clientas (MAP-211–221) | 11 | 0 | 8 | 1 | 2 | 14 |
| Catálogo (MAP-222–239) | 18 | 0 | 13 | 4 | 1 | 32 |
| Cotizaciones (MAP-240–279) | 40 | 9 | 24 | 5 | 2 | 61 |
| Pagos (MAP-280–302, MAP-521–522) | 25 | 5 | 16 | 4 | 0 | 33 |
| Eventos (MAP-303–319, MAP-520) | 18 | 4 | 10 | 3 | 1 | 33 |
| Calendario y disponibilidad (MAP-320–327) | 8 | 0 | 4 | 4 | 0 | 14 |
| Portal de la clienta (MAP-328–338, MAP-523–524) | 13 | 3 | 8 | 2 | 0 | 25 |
| Invitadas y RSVP (MAP-339–354, MAP-525–527) | 19 | 6 | 9 | 4 | 0 | 32 |
| Memory Capsule (MAP-355–369, MAP-528) | 16 | 5 | 9 | 2 | 0 | 27 |
| Operaciones (MAP-370–394) | 25 | 3 | 16 | 6 | 0 | 29 |
| Portal staff (MAP-395–416) | 22 | 6 | 9 | 7 | 0 | 37 |
| Equipo (staff) (MAP-417–424) | 8 | 1 | 6 | 1 | 0 | 9 |
| Inventario (MAP-425–443) | 19 | 1 | 16 | 2 | 0 | 25 |
| Compras y proveedores (MAP-444–459) | 16 | 2 | 11 | 3 | 0 | 21 |
| Finanzas (MAP-460–468) | 9 | 3 | 5 | 0 | 1 | 14 |
| Dashboard y analítica (MAP-469–470) | 2 | 0 | 1 | 1 | 0 | 2 |
| Notificaciones (MAP-471–475) | 5 | 1 | 3 | 1 | 0 | 5 |
| Contenido (MAP-476–486) | 11 | 0 | 7 | 4 | 0 | 14 |
| Ajustes y usuarios (MAP-487–503) | 17 | 4 | 10 | 3 | 0 | 24 |
| Transversal (responsive y accesibilidad) (MAP-504–509) | 6 | 0 | 1 | 5 | 0 | 17 |
| **Total** | **528** | **121** | **269** | **121** | **17** | **886** |

«Pruebas distintas» cuenta IDs únicos por módulo; cada prueba quedó asignada a un solo módulo, así que la suma coincide con los 886 IDs únicos (838 de la auditoría + 48 nuevos). Una prueba puede aparecer en varias filas del mismo módulo cuando cubre varios flujos.

## Mapa

| ID | Módulo | Página/Flujo | Rol | Acción | Resultado esperado | Prioridad | Pruebas |
|---|---|---|---|---|---|---|---|
| MAP-001 | Autenticación | `/login` · `loginAction` | SuperAdmin | Iniciar sesión con credenciales válidas | Redirige a `/admin` con «Hola, Admin»; el `Set-Cookie` real del login lleva `HttpOnly`, `SameSite=Lax` y `Path=/` (3 motores) | P0 | AUTH-001, SMK-002 |
| MAP-002 | Autenticación | `/login` · `loginAction` | Owner (Ivonne, Rosa) | Iniciar sesión con credenciales válidas | Redirige a `/admin` con «Hola, Ivonne» / «Hola, Rosa»; `Set-Cookie` con `HttpOnly`, `SameSite=Lax` y `Path=/` | P0 | AUTH-002, AUTH-003, SMK-003, SMK-004 |
| MAP-003 | Autenticación | `/login` · `loginAction` | Staff (Lupita, Carlos) | Iniciar sesión con credenciales válidas | Redirige a `/staff` «Mis próximos eventos»; `Set-Cookie` con `HttpOnly`, `SameSite=Lax` y `Path=/` | P0 | AUTH-004, AUTH-005, SMK-005, SMK-006 |
| MAP-004 | Autenticación | `/login` | Anónimo | Abrir la página de login | 200, H1 «Bienvenida de vuelta», noindex, contraseña enmascarada y autocompletado correcto, sin errores de consola/red | P0 | SMK-019, AUTH-016 |
| MAP-005 | Autenticación | `/login` | Anónimo | Contraseña incorrecta | Mensaje genérico; sin sesión y sin actualizar `lastLoginAt` | P0 | AUTH-006 |
| MAP-006 | Autenticación | `/login` | Anónimo | Usuario inexistente | Exactamente el mismo mensaje que con contraseña incorrecta (sin enumeración de cuentas) | P0 | AUTH-007 |
| MAP-007 | Autenticación | `/login` | Anónimo | Enviar con campos vacíos | El navegador exige ambos campos y el servidor también valida | P1 | AUTH-008 |
| MAP-008 | Autenticación | `/login` | Anónimo | Correo con formato inválido saltando la validación del navegador | Rechazado en el servidor sin crear sesión | P2 | AUTH-009 |
| MAP-009 | Autenticación | `/login` | Anónimo | Iniciar sesión con una cuenta desactivada | No inicia sesión; mismo mensaje genérico | P0 | AUTH-010 |
| MAP-010 | Autenticación | `/login` | Anónimo | Iniciar sesión con una cuenta CUSTOMER y contraseña correcta | No entra al panel del equipo | P1 | AUTH-011 |
| MAP-011 | Autenticación | `/login` | Anónimo | Iniciar sesión con una ficha sin contraseña (sin acceso) | No puede iniciar sesión | P2 | AUTH-012 |
| MAP-012 | Autenticación | `/login` | Anónimo · Staff · Owner · SuperAdmin | Abrir `/login` con sesión abierta | Anónimo ✅ 200; Staff ↪ `/staff`; Owner y SuperAdmin ↪ `/admin` | P2 | AUTH-013, PERM-071 |
| MAP-013 | Autenticación | `/login` | Anónimo | Correo con mayúsculas y espacios | Se normaliza y permite entrar | P2 | AUTH-014 |
| MAP-014 | Autenticación | `/login` | Anónimo | Operar el formulario sólo con teclado | Tab ordenado, foco visible, labels asociados; Enter envía | P1 | AUTH-015, A11Y-020 |
| MAP-015 | Autenticación | `/login` | Anónimo | Buscar recuperación pública de contraseña | No existe; el restablecimiento sólo lo hace la administración | P3 | AUTH-017 |
| MAP-016 | Autenticación | `/login` (límite por cuenta) | Anónimo | 9 intentos fallidos sobre la misma cuenta | Se permiten 8; el 9.º se bloquea y ni la contraseña correcta entra mientras dura el bloqueo | P0 | AUTH-060 |
| MAP-017 | Autenticación | `/login` (límite por cuenta) | Anónimo | Entrar con otra cuenta desde el mismo navegador durante el bloqueo | Entra normalmente (el bloqueo es por cuenta) | P1 | AUTH-061 |
| MAP-018 | Autenticación | `/login` (límite por cuenta) | Anónimo | Fuerza bruta con un correo inexistente | También se limita, con el mismo mensaje (sin enumeración por el limitador) | P1 | AUTH-062 |
| MAP-019 | Autenticación | `/login` (límite por cuenta) | Anónimo | Variar mayúsculas/espacios del correo | No evade el límite (misma cubeta normalizada) | P2 | AUTH-063 |
| MAP-020 | Autenticación | Logout del panel (`/admin` → «Cerrar sesión») | Owner · SuperAdmin | Login → request directo con la cookie → «Cerrar sesión» → URL privada, request directo y «Atrás» | Antes del logout 200; después se elimina la cookie, la UI va a `/login?callbackUrl=…`, el request directo recibe 3xx a `/login` y «Atrás» no muestra datos privados del panel | P0 | AUTH-020, AUTH-021, CRIT-009, CRIT-011 |
| MAP-021 | Autenticación | Panel autenticado | Owner | Inspeccionar cabeceras de respuesta | `Cache-Control: no-store` en las respuestas del panel | P2 | AUTH-022 |
| MAP-022 | Autenticación | Rutas privadas (`/admin*`, `/staff*`) | Anónimo | Request directo sin cookies | Redirigen a `/login` | P0 | AUTH-023 |
| MAP-023 | Autenticación | Rutas privadas (`/admin*`, `/staff*`) | Anónimo | Cookie de sesión manipulada o falsificada | No autoriza; redirige a login | P0 | AUTH-024 |
| MAP-024 | Autenticación | Logout del panel | Owner | Reutilizar la cookie anterior al logout | La sesión queda invalidada en el servidor: la cookie copiada recibe 307 a `/login` (`@regression` BUG-004) | P1 | AUTH-025 |
| MAP-025 | Autenticación | Logout en dos pestañas | Owner | Cerrar sesión en una pestaña y seguir en la otra | La otra pestaña pierde acceso en el siguiente request | P1 | AUTH-026 |
| MAP-026 | Autenticación | Logout con request en vuelo (panel y portal staff) | Owner · Staff | Cerrar sesión mientras otra pestaña o un prefetch autenticado sigue cargando | La cookie de sesión no reaparece al llegar la respuesta; `/admin` y `/staff` vuelven a exigir login; si la cookie anterior reapareciera, ya está revocada (`@regression` BUG-001) | P0 | AUTH-032, CRIT-014 |
| MAP-027 | Autenticación | Desactivar acceso con sesión abierta (`/admin/settings/users`, `/admin/staff/[id]` · `setStaffAccessActiveAction`) | Owner | Desactivar la cuenta o el acceso de staff mientras tiene sesión abierta; luego reactivar | El siguiente request (páginas y acciones, p. ej. `markAllNotificationsReadAction`) queda sin autorización y el login falla; reactivar devuelve el acceso | P0 | AUTH-027, STF-021 |
| MAP-028 | Autenticación | Cambio de rol con sesión abierta | Owner | Bajar a una OWNER a STAFF mientras tiene sesión | El siguiente request ya no autoriza el panel ni sus acciones (`setUserActiveAction` → FORBIDDEN) | P0 | AUTH-028 |
| MAP-029 | Autenticación | Cambio de rol con sesión abierta | Staff | Subir de STAFF a OWNER | Aplica en el siguiente request sin volver a iniciar sesión | P2 | AUTH-029 |
| MAP-030 | Autenticación | Portal staff: `/staff` → `/admin/finance` → logout | Staff (móvil) | Login → abrir `/admin/finance` (UI y request) → «Cerrar sesión» → `/staff` | `/admin*` → `/staff` (UI y 3xx); tras el logout `/staff` pide login | P0 | AUTH-030, CRIT-012 |
| MAP-031 | Autenticación | `/sin-acceso` | Anónimo · Staff · Owner · SuperAdmin | Abrir la página | 200 para todos los roles; página 403 clara, noindex y con salidas | P2 | AUTH-031, PERM-080 |
| MAP-032 | Autenticación | `callbackUrl` (`/admin/events` → `/login?callbackUrl`) | Anónimo → Owner | Abrir una ruta privada sin sesión e iniciar sesión | Login con `callbackUrl`; tras entrar regresa a la ruta solicitada | P0 | AUTH-040, CRIT-013 |
| MAP-033 | Autenticación | `callbackUrl` | Staff | Iniciar sesión con `callbackUrl` a `/admin` | Termina en `/staff` | P1 | AUTH-041 |
| MAP-034 | Autenticación | `callbackUrl` | Staff | Iniciar sesión con `callbackUrl` interno permitido (`/staff/...`) | Se respeta | P2 | AUTH-042 |
| MAP-035 | Autenticación | `callbackUrl` malicioso | Owner | Iniciar sesión con `https://evil.example/robo`, `//evil.example/robo`, `/\evil.example/robo`, `\\evil.example`, `javascript:alert(document.domain)`, `/%2F%2Fevil.example`, `/<TAB>/evil.example`, `http://localhost@evil.example/` | Nunca redirige fuera de la app (termina en el inicio del rol); el valor TAB es `@regression` BUG-005. La validación propia de `loginAction` se cubre en MAP-514 | P0 | AUTH-043, AUTH-044, AUTH-045, AUTH-046, AUTH-047, AUTH-048, AUTH-049, AUTH-050, CRIT-013 |
| MAP-036 | Autenticación | Middleware (`callbackUrl`) | Anónimo | Abrir una ruta privada con query string | `callbackUrl` conserva ruta + query y nunca incluye host | P2 | AUTH-051 |
| MAP-510 | Autenticación | Revocación al administrar la cuenta (`/admin/settings/users` · `resetUserPasswordAction`, `changeUserRoleAction`, `setUserActiveAction`; `/admin/staff/[id]` · `resetStaffPasswordAction`) | SuperAdmin · Owner → Owner / Staff con sesión abierta | Restablecer la contraseña (Usuarios y Staff), cambiar el rol, desactivar y reactivar una cuenta mientras tiene sesión abierta | La sesión abierta deja de autorizar en el siguiente request (↪ login); al volver a entrar aplica el rol nuevo; reactivar no revive la cookie anterior (`sessionVersion`) | P1 | AUTH-033, AUTH-034, AUTH-035, AUTH-036 |
| MAP-511 | Autenticación | Restablecer la **propia** contraseña (`/admin/settings/users` · `resetUserPasswordAction`; propia ficha en `/admin/staff/[id]` · `resetStaffPasswordAction`) | Owner (fundadora con ficha de staff) | Restablecer su propia contraseña | Aviso «Se cerrarán todas tus sesiones, incluida ésta»; la cookie actual se borra y la UI va a `/login`; la cookie vieja queda revocada; auditoría `self: true` (Staff); la contraseña nueva entra | P1 | AUTH-037, AUTH-064 |
| MAP-512 | Autenticación | `/api/auth/signout` con una cookie ya revocada | Owner | Usar la cookie anterior a un logout contra `/api/auth/signout` mientras hay una sesión nueva abierta | La sesión nueva sigue vigente: la revocación compara e incrementa, así que una cookie revocada no cierra sesiones nuevas | P2 | AUTH-038 |
| MAP-513 | Autenticación | Renovación del JWT en el middleware (GET de documento, GET RSC, POST de Server Action) | Owner (JWT forjado con `iat` de hace 2 h, reciente, inválido o revocado) | Pedir páginas y acciones del panel con cada tipo de cookie | ≥ 1 h: el GET de documento y el RSC renuevan (`iat` nuevo, mismos `uid`, rol y `sessionVersion`) y la renovada autoriza; el POST de Server Action no re-emite aunque corre autenticado; un JWT reciente no se re-emite; una cookie inválida conserva su borrado y ↪ login; un JWT revocado sigue sin autorizar aunque se renueve | P1 | AUTH-053, AUTH-054, AUTH-055, AUTH-056, AUTH-057, AUTH-058 |
| MAP-514 | Autenticación | `/login` · `loginAction` (campo oculto `callbackUrl` alterado) | Owner | Enviar el formulario con los mismos 8 valores maliciosos de MAP-035 escritos en el campo oculto, como un POST forjado | `x-action-redirect` del mismo origen: inicio del rol (`/admin`); `/%2F%2Fevil.example` se conserva como ruta interna legítima; el valor TAB (`/<TAB>/evil.example`) se descarta (`@regression` BUG-005) | P0 | AUTH-065, AUTH-066, AUTH-067, AUTH-068, AUTH-069, AUTH-070, AUTH-071, AUTH-072 |
| MAP-037 | Autorización | Zona pública: `/`, `/como-funciona`, `/contacto`, `/crear-experiencia`, `/crear-experiencia/ai`, `/experiencias`, `/experiencias/[slug]`, `/nuestra-historia`, `/privacidad`, `/terminos` | Anónimo · Staff · Owner · SuperAdmin | GET sin seguir redirects con la cookie de cada rol | ✅ 200 para los 4 roles; sin pantalla de error ni errores de consola/red | P2 | PERM-001, PERM-063, PERM-064, PERM-066, PERM-067, PERM-069, PERM-070, PERM-076, PERM-079, PERM-083 |
| MAP-038 | Autorización | Zona por token: `/cotizacion/[token]`, `/e/[slug]/[token]`, `/memory/[token]`, `/mi-evento`, `/mi-evento/[token]`, `/mi-evento/[token]/resumen`, `/pago/mock/[checkoutId]`, `/pago/resultado` | Anónimo · Staff · Owner · SuperAdmin | GET con token o firma válidos | ✅ 200 para los 4 roles (el acceso lo da el token, no la sesión) | P1 | PERM-065, PERM-068, PERM-072, PERM-073, PERM-074, PERM-075, PERM-077, PERM-078 |
| MAP-039 | Autorización | Panel — inicio: `/admin` (`dashboard:view`) | Anónimo · Staff · Owner · SuperAdmin | GET sin seguir redirects con la cookie de cada rol + carga de la UI con Owner | Anónimo ↪ `/login?callbackUrl=<ruta>` · Staff ↪ `/staff` · Owner y SuperAdmin ✅ 200 con encabezado, sin pantalla de error ni errores de consola/red | P0 | PERM-002 |
| MAP-040 | Autorización | Panel — analítica y finanzas: `/admin/analytics` (`analytics:read`), `/admin/finance` (`financials:read`) | Anónimo · Staff · Owner · SuperAdmin | GET sin seguir redirects con la cookie de cada rol + carga de la UI con Owner | Anónimo ↪ `/login?callbackUrl=<ruta>` · Staff ↪ `/staff` · Owner y SuperAdmin ✅ 200 con encabezado, sin pantalla de error ni errores de consola/red | P0 | PERM-003, PERM-029 |
| MAP-041 | Autorización | Panel — catálogo (`catalog:read` / `catalog:write`): `/admin/catalog`, `/admin/catalog/addons`, `/admin/catalog/addons/[id]`, `/admin/catalog/addons/new`, `/admin/catalog/areas`, `/admin/catalog/budgets`, `/admin/catalog/experiences/[id]`, `/admin/catalog/experiences/new`, `/admin/catalog/menus`, `/admin/catalog/menus/[id]`, `/admin/catalog/menus/new`, `/admin/catalog/styles` | Anónimo · Staff · Owner · SuperAdmin | GET sin seguir redirects con la cookie de cada rol + carga de la UI con Owner | Anónimo ↪ `/login?callbackUrl=<ruta>` · Staff ↪ `/staff` · Owner y SuperAdmin ✅ 200 con encabezado, sin pantalla de error ni errores de consola/red | P0 | PERM-005, PERM-006, PERM-007, PERM-008, PERM-009, PERM-010, PERM-011, PERM-012, PERM-013, PERM-014, PERM-015, PERM-016 |
| MAP-042 | Autorización | Panel — contenido (`content:write`): `/admin/content`, `/admin/content/faq`, `/admin/content/gallery` | Anónimo · Staff · Owner · SuperAdmin | GET sin seguir redirects con la cookie de cada rol + carga de la UI con Owner | Anónimo ↪ `/login?callbackUrl=<ruta>` · Staff ↪ `/staff` · Owner y SuperAdmin ✅ 200 con encabezado, sin pantalla de error ni errores de consola/red | P0 | PERM-017, PERM-018, PERM-019 |
| MAP-043 | Autorización | Panel — clientas y leads: `/admin/customers`, `/admin/customers/[id]` (`customers:read`), `/admin/leads`, `/admin/leads/[id]` (`leads:read`) | Anónimo · Staff · Owner · SuperAdmin | GET sin seguir redirects con la cookie de cada rol + carga de la UI con Owner | Anónimo ↪ `/login?callbackUrl=<ruta>` · Staff ↪ `/staff` · Owner y SuperAdmin ✅ 200 con encabezado, sin pantalla de error ni errores de consola/red | P0 | PERM-020, PERM-021, PERM-035, PERM-036 |
| MAP-044 | Autorización | Panel — eventos y calendario: `/admin/calendar`, `/admin/events`, `/admin/events/[id]` (`events:read_all`), `/admin/events/new` (`events:write`), `/admin/events/[id]/financials` (`financials:read`), `/admin/events/[id]/guests` (`guests:read`), `/admin/events/[id]/memory` (`memory:write`), `/admin/events/[id]/operations` (`operations:read`) | Anónimo · Staff · Owner · SuperAdmin | GET sin seguir redirects con la cookie de cada rol + carga de la UI con Owner | Anónimo ↪ `/login?callbackUrl=<ruta>` · Staff ↪ `/staff` · Owner y SuperAdmin ✅ 200 con encabezado, sin pantalla de error ni errores de consola/red | P0 | PERM-004, PERM-022, PERM-023, PERM-024, PERM-025, PERM-026, PERM-027, PERM-028 |
| MAP-045 | Autorización | Panel — inventario (`inventory:read`): `/admin/inventory`, `/admin/inventory/[id]`, `/admin/inventory/conflicts`, `/admin/inventory/events`, `/admin/inventory/events/[eventId]` | Anónimo · Staff · Owner · SuperAdmin | GET sin seguir redirects con la cookie de cada rol + carga de la UI con Owner | Anónimo ↪ `/login?callbackUrl=<ruta>` · Staff ↪ `/staff` · Owner y SuperAdmin ✅ 200 con encabezado, sin pantalla de error ni errores de consola/red (aunque STAFF tiene `inventory:read`, el middleware la envía a `/staff`) | P0 | PERM-030, PERM-031, PERM-032, PERM-033, PERM-034 |
| MAP-046 | Autorización | Panel — notificaciones y operaciones: `/admin/notifications` (`notifications:read`), `/admin/operations`, `/admin/operations/templates`, `/admin/operations/templates/[id]` (`operations:read`) | Anónimo · Staff · Owner · SuperAdmin | GET sin seguir redirects con la cookie de cada rol + carga de la UI con Owner | Anónimo ↪ `/login?callbackUrl=<ruta>` · Staff ↪ `/staff` · Owner y SuperAdmin ✅ 200 con encabezado, sin pantalla de error ni errores de consola/red | P0 | PERM-037, PERM-038, PERM-039, PERM-040 |
| MAP-047 | Autorización | Panel — compras y proveedores: `/admin/purchases`, `/admin/purchases/[id]`, `/admin/purchases/new` (`purchases:*`), `/admin/vendors`, `/admin/vendors/[id]`, `/admin/vendors/[id]/edit`, `/admin/vendors/new` (`vendors:*`) | Anónimo · Staff · Owner · SuperAdmin | GET sin seguir redirects con la cookie de cada rol + carga de la UI con Owner | Anónimo ↪ `/login?callbackUrl=<ruta>` · Staff ↪ `/staff` · Owner y SuperAdmin ✅ 200 con encabezado, sin pantalla de error ni errores de consola/red | P0 | PERM-041, PERM-042, PERM-043, PERM-059, PERM-060, PERM-061, PERM-062 |
| MAP-048 | Autorización | Panel — cotizaciones: `/admin/quotes`, `/admin/quotes/[id]`, `/admin/quotes/[id]/print` (`quotes:read`), `/admin/quotes/new` (`quotes:write`) | Anónimo · Staff · Owner · SuperAdmin | GET sin seguir redirects con la cookie de cada rol + carga de la UI con Owner | Anónimo ↪ `/login?callbackUrl=<ruta>` · Staff ↪ `/staff` · Owner y SuperAdmin ✅ 200 con encabezado, sin pantalla de error ni errores de consola/red | P0 | PERM-044, PERM-045, PERM-046, PERM-047 |
| MAP-049 | Autorización | Panel — ajustes: `/admin/settings`, `/admin/settings/availability`, `/admin/settings/flags`, `/admin/settings/integrations`, `/admin/settings/notifications`, `/admin/settings/pricing` (`settings:read`), `/admin/settings/audit` (`audit:read`), `/admin/settings/users` (`users:manage`) | Anónimo · Staff · Owner · SuperAdmin | GET sin seguir redirects con la cookie de cada rol + carga de la UI con Owner | Anónimo ↪ `/login?callbackUrl=<ruta>` · Staff ↪ `/staff` · Owner y SuperAdmin ✅ 200 con encabezado, sin pantalla de error ni errores de consola/red | P0 | PERM-048, PERM-049, PERM-050, PERM-051, PERM-052, PERM-053, PERM-054, PERM-055 |
| MAP-050 | Autorización | Panel — equipo: `/admin/staff`, `/admin/staff/[id]` (`staff:read`), `/admin/staff/new` (`staff:write`) | Anónimo · Staff · Owner · SuperAdmin | GET sin seguir redirects con la cookie de cada rol + carga de la UI con Owner | Anónimo ↪ `/login?callbackUrl=<ruta>` · Staff ↪ `/staff` · Owner y SuperAdmin ✅ 200 con encabezado, sin pantalla de error ni errores de consola/red | P0 | PERM-056, PERM-057, PERM-058 |
| MAP-051 | Autorización | Portal staff: `/staff`, `/staff/events/[id]` (`events:read_assigned`) | Anónimo · Staff · Owner · SuperAdmin | GET sin seguir redirects con la cookie de cada rol | Anónimo ↪ `/login?callbackUrl=<ruta>`; Staff, Owner y SuperAdmin ✅ 200 | P0 | PERM-081, PERM-082 |
| MAP-052 | Autorización | Inventario de rutas vs. matriz | Owner | Comparar `inventory.json` con la matriz de páginas | Las 83 páginas del inventario tienen fila en la matriz (sin drift) | P2 | PERM-090 |
| MAP-053 | Autorización | `/admin/settings/users` · `createUserAction`, `changeUserRoleAction` | Owner | Forzar por request la creación o la promoción de una cuenta SUPER_ADMIN | FORBIDDEN y sin cambios (OWNER no tiene `roles:assign_super_admin`); SuperAdmin sí puede | P0 | PERM-140, PERM-141 |
| MAP-054 | Autorización | `/admin/settings/users` · `changeUserRoleAction`, `setUserActiveAction`, `resetUserPasswordAction` | Owner | Modificar rol, estado o contraseña de una cuenta SUPER_ADMIN (UI y request) | La UI oculta esas acciones y el backend responde FORBIDDEN sin cambios | P0 | PERM-142 |
| MAP-055 | Autorización | `/admin/settings/users` | Owner | Administrar cuentas de fundadoras y staff | Permitido y auditado (la restricción no es excesiva) | P1 | PERM-143 |
| MAP-056 | Autorización | `/admin/settings/users` · `changeUserRoleAction` | Staff · Anónimo | Replay del cambio de rol | Anónimo ↪ login, Staff ↪ `/staff`; el rol no cambia | P0 | PERM-156 |
| MAP-057 | Autorización | `/admin/events/[id]` · `recordManualPaymentAction`, `refundPaymentAction` | Staff · Anónimo | Replay de pago manual y de reembolso | Denegados (↪ login / ↪ `/staff`); sin pagos nuevos ni cambios de estado; con Owner el pago manual sí se registra con auditoría | P0 | PERM-150, PERM-151, EVT-030 |
| MAP-058 | Autorización | `/admin/quotes/[id]` · `saveQuotePricingAction` (con descuento) | Staff · Anónimo | Replay de aplicar descuento | Denegado y la cotización no cambia; con Owner se aplica y se audita `quote.discount_applied` | P0 | PERM-152 |
| MAP-059 | Autorización | `/admin/events*` · `createEventAction`, `cancelEventAction` | Staff · Anónimo | Abrir `/admin/events*` y replay de crear y cancelar eventos | Redirect a `/staff` o a login; acciones denegadas; base intacta; con Owner la cancelación sí ocurre con auditoría | P0 | PERM-153, EVT-036 |
| MAP-060 | Autorización | `/admin/events/[id]/financials` · `closeEventAction` | Staff · Anónimo | Replay del cierre financiero | Denegado; el evento sigue abierto | P1 | PERM-154 |
| MAP-061 | Autorización | `/admin/events/[id]` · `rotateEventTokenAction` | Staff · Anónimo | Replay de rotar el token del portal | Denegado; el token sigue vigente | P0 | PERM-155 |
| MAP-062 | Autorización | `/admin/settings*` · `updateBusinessSettingsAction`, `updatePricingSettingsAction`, `setFeatureFlagAction` | Staff · Anónimo | Replay de ajustes del negocio, precios y feature flags | Denegados; la configuración no cambia | P0 | PERM-157 |
| MAP-063 | Autorización | `/admin/calendar` · `createAvailabilityExceptionAction` | Staff · Anónimo | Abrir el calendario y replay de crear excepción | Redirect a `/staff` o login; acción denegada; sin excepciones nuevas | P1 | CAL-006 |
| MAP-064 | Autorización | `/admin/events/[id]/guests` · `saveGuestAction`, `deleteGuestAction` | Staff · Anónimo | Abrir invitadas del evento y replay | Redirect a `/staff` o login; acciones denegadas; base intacta | P1 | GST-010 |
| MAP-065 | Autorización | Cápsula — 7 acciones de administración (`createCapsuleAction`, `updateCapsuleAction`, `rotateShareTokenAction`, `setCoverAction`, `setMediaApprovalAction`, `deleteCapsuleMediaAction`, `setMessageHiddenAction`) vía `/memory/[token]` y `/admin/events/[id]/memory` | Anónimo · Staff | Replay de cada acción desde la página pública y desde el panel | Anónimo UNAUTHORIZED, Staff FORBIDDEN; nada cambia en la base | P0 | PERM-131, PERM-132, PERM-133, PERM-134, PERM-135, PERM-136, PERM-137, MEM-011 |
| MAP-066 | Autorización | `/memory/[token]` (superficie) | Anónimo | Inventariar las acciones que importa la página pública | La página importa las 7 acciones de administración de la cápsula (superficie documentada; protegidas por permiso) | P2 | PERM-130 |
| MAP-067 | Autorización | `/memory/[token]` (control positivo) | Owner | Ejecutar `updateCapsuleAction` desde la página pública | Se ejecuta (la protección es por permiso, no por página) | P2 | PERM-138 |
| MAP-068 | Autorización | Acción de admin enviada a una página que no la importa (`/staff`, `/`) | Staff · Anónimo | Replay del request a otra página | Next no ejecuta la acción; sin cambios | P1 | PERM-158 |
| MAP-069 | Autorización | Server Actions con `Origin` ajeno (CSRF) | Owner | Replay con sesión válida y `Origin` de otro sitio | Rechazada sin escribir en la base | P0 | PERM-159 |
| MAP-070 | Accesos por token | Rutas por token: `/cotizacion/[token]`, `/mi-evento/[token]`, `/e/[slug]/[token]`, `/memory/[token]` | Anónimo | Abrir con un token inexistente (formato válido) o rotado | 404 genérico («Este enlace no es válido») sin datos de ningún evento | P0 | PERM-160, SMK-035, PORT-003 |
| MAP-071 | Accesos por token | Rutas por token | Anónimo | Token malformado (corto, traversal, inyección, unicode) | 404 sin error 500 | P1 | PERM-161 |
| MAP-072 | Accesos por token | `/e/[slug]/[token]` | Invitada (token) | Slug de un evento con token de invitación general o personal de OTRO evento; slug equivocado; micrositio deshabilitado | 404 «Esta invitación no está disponible» sin datos de ninguno de los eventos | P0 | PERM-162, PERM-163, PERM-167, GST-017 |
| MAP-073 | Accesos por token | Rutas por token | Clienta (token) | Usar un token de otro tipo (portal ↔ invitación ↔ cotización ↔ cápsula) | No abre otras zonas (404) | P0 | PERM-164 |
| MAP-074 | Accesos por token | Rutas por token (válidas e inválidas) | Anónimo | Inspeccionar cabeceras | `X-Robots-Tag: noindex` y `Referrer-Policy: same-origin` | P1 | PERM-170 |
| MAP-075 | Accesos por token | `/mi-evento/[token]` · `removeHostGuestAction` y demás acciones del portal | Clienta (token) | Con mi token, quitar una invitada o tocar datos de OTRO evento (IDOR) | NOT_FOUND; la invitada y el otro evento no cambian | P0 | PERM-180, PORT-015 |
| MAP-076 | Accesos por token | `/e/[slug]/[token]` · `submitRsvpAction` | Invitada (token) | Slug de mi evento + token personal de invitada de OTRO evento | NOT_FOUND; el RSVP de la otra invitada no cambia | P0 | PERM-181 |
| MAP-077 | Accesos por token | `/e/[slug]/[token]` · `submitRsvpAction` | Invitada (token) | Slug de mi evento + invitación general de OTRO evento | NOT_FOUND sin crear invitada | P1 | PERM-182 |
| MAP-078 | Accesos por token | `/mi-evento/[token]` · `sendHostMessageAction` | Clienta (token) | Enviar mensaje con un token ROTADO | NOT_FOUND; con el token vigente sí se envía | P1 | PERM-183 |
| MAP-079 | Accesos por token | `/mi-evento/[token]` · `updatePreferencesAction` | Invitada (token) | Guardar preferencias con token de invitación o de invitada (otro tipo) | NOT_FOUND; el evento no cambia | P1 | PERM-184 |
| MAP-080 | Accesos por token | `/mi-evento/[token]` · `addHostGuestAction` | Invitada (token) | Agregar invitada con token de otro tipo | NOT_FOUND sin crear registros | P2 | PERM-185 |
| MAP-081 | API (route handlers) | `/api/health`, `/api/health/db` | Anónimo | GET | 200 `{status: "ok"}` sin caché; `/api/health/db` verifica PostgreSQL (`database: "up"`, latencia numérica) | P0 | API-001, API-002, SMK-001 |
| MAP-082 | API (route handlers) | Métodos no soportados: `POST /api/health`, `DELETE /api/health/db`, `DELETE /api/admin/leads-export`, `POST /api/events/[id]/guests.csv`, `PUT /api/media/upload`, `POST /api/media/[id]`, `GET /api/analytics/track`, `DELETE /api/cron/notifications`, `GET /api/webhooks/payments/[provider]`, `GET /api/memory/[token]/upload` | Anónimo | Llamar con un método no permitido | 405 sin efectos | P3 | API-003, API-004, API-005, API-006, API-007, API-008, API-009, API-010, API-011, API-012 |
| MAP-083 | API (route handlers) | `/api/cron/notifications` | Anónimo | Llamar sin `Authorization` | 401 con `WWW-Authenticate: Bearer` | P0 | API-020 |
| MAP-084 | API (route handlers) | `/api/cron/notifications` | Anónimo | Secreto incorrecto, otro esquema o vacío | 401 y no ejecuta nada | P0 | API-021 |
| MAP-085 | API (route handlers) | `/api/cron/notifications` | Cron (secreto correcto) | `POST` con `Authorization: Bearer $CRON_SECRET` dos veces | 200 `{ok: true}`; ejecuta las reglas (7 días, 48 h) y la 2.ª corrida no duplica avisos | P1 | API-022, NOT-006 |
| MAP-086 | API (route handlers) | `/api/webhooks/payments/[provider]` | Proveedor / atacante | Entregar sin firma, con firma inválida, de otro secreto, malformada o vencida (> 300 s) | 400 `invalid_signature`; no se registra ni se procesa | P0 | API-030, API-031, PAY-012 |
| MAP-087 | API (route handlers) | `/api/webhooks/payments/[provider]` | Proveedor | Entregar `payment.succeeded` y reenviarlo con firma válida | Se procesa una sola vez (`duplicate: true`); otro evento sobre un pago ya cobrado → `already_paid` | P0 | API-032, PAY-009 |
| MAP-088 | API (route handlers) | `/api/webhooks/payments/[provider]` | Atacante | Proveedor desconocido o con caracteres inválidos | 404 | P2 | API-033, PAY-012 |
| MAP-089 | API (route handlers) | `/api/webhooks/payments/[provider]` | Proveedor | Cuerpo > 256 KB; JSON inválido con firma válida | 413 sin procesar; 400 | P2 | API-034 |
| MAP-090 | API (route handlers) | `/api/webhooks/payments/[provider]` | Proveedor | Evento válido de un pago inexistente | 200 registrado con nota `payment_not_found`, sin efectos | P2 | API-035, PAY-012 |
| MAP-091 | API (route handlers) | `/api/analytics/track` | Anónimo | Beacon sin `Origin`, con `Origin` ajeno o `Sec-Fetch-Site: cross-site` | 403 sin registrar (CSRF) | P1 | API-040 |
| MAP-092 | API (route handlers) | `/api/analytics/track` | Anónimo | Beacon del mismo origen con cuerpo válido | 204 y `AnalyticsEvent` con `origin=client` | P2 | API-041 |
| MAP-093 | API (route handlers) | `/api/analytics/track` | Anónimo | Tipo no permitido, campos extra, JSON roto; cuerpo > 4 KB | 400; 413 | P2 | API-042 |
| MAP-094 | API (route handlers) | `/api/auth/[...nextauth]` (`/api/auth/session`) | Anónimo · Owner | GET de la sesión con un JWT reciente y con uno de ≥ 1 h | Anónimo sin usuario; Owner sin datos sensibles (sin hash de contraseña); la respuesta nunca re-emite la cookie de sesión (`withoutSessionCookieRenewal`) | P1 | API-050, AUTH-059 |
| MAP-095 | API (route handlers) | `/api/auth/[...nextauth]` (`/api/auth/callback/credentials`) | Anónimo | `POST` directo sin token CSRF | No crea sesión | P1 | API-051 |
| MAP-096 | API (route handlers) | `/api/auth/[...nextauth]` (`/api/auth/signin`, providers) | Anónimo | GET | `signin` redirige al login propio; providers sólo expone credenciales | P3 | API-052 |
| MAP-097 | API (route handlers) | `/api/media/[id]` | Anónimo | Archivo privado sin firma o con firma inválida, ajena o vencida | 403; con firma vigente → redirect al archivo | P0 | API-060 |
| MAP-098 | API (route handlers) | `/api/media/[id]` | Anónimo | Archivo público; id malformado o inexistente | Público libre; 404 genérico | P2 | API-061 |
| MAP-099 | API (route handlers) | `/api/media/upload` | Anónimo · Owner | Subir sin sesión; con sesión pero `Origin` ajeno o ausente | 401; 403 (CSRF); nada se guarda | P0 | API-062 |
| MAP-100 | API (route handlers) | `/api/media/upload` | Owner | Magic bytes falsos (texto `.jpg`), SVG con script y HTML | Rechazados (422) sin `MediaAsset` | P0 | API-063 |
| MAP-101 | API (route handlers) | `/api/media/upload` | Owner | Archivo que supera `UPLOAD_MAX_MB` | Rechazado con mensaje de tamaño | P1 | API-064 |
| MAP-102 | API (route handlers) | `/api/media/upload` | Owner | Sin archivo o con propósito inexistente | 400 | P2 | API-065 |
| MAP-103 | API (route handlers) | `/api/media/upload` | Owner | Subir un PNG real | `MediaAsset` privado en base; se sirve sólo con URL firmada | P1 | API-066 |
| MAP-104 | API (route handlers) | `/api/media/upload` | Staff | Subir evidencia de checklist | Sólo para eventos ASIGNADOS; otro propósito o evento ajeno → 403 | P0 | API-067 |
| MAP-105 | Navegación | Ruta pública inexistente | Anónimo | Abrir | 404 «Esta mesa no está puesta» con regreso al inicio | P2 | NAV-001 |
| MAP-106 | Navegación | Ruta inexistente dentro de `/admin` | Owner | Abrir | HTTP 404 con la página 404 general | P2 | NAV-003 |
| MAP-107 | Navegación | Detalle con id inexistente o malformado: `/admin/leads/[id]`, `/admin/customers/[id]`, `/admin/events/[id]`, `/admin/events/[id]/operations`, `/admin/quotes/[id]`, `/admin/quotes/[id]/print`, `/admin/purchases/[id]`, `/admin/inventory/[id]`, `/admin/operations/templates/[id]`, `/admin/staff/[id]` | Owner | Abrir la URL manipulada | «No encontramos…» / «no encontrado» sin error 500 | P2 | NAV-004, LEAD-015, CUST-013, EVT-004, OPS-020, QUO-030, INV-023, OPS-028, STF-022 |
| MAP-108 | Navegación | Ruta inexistente en `/staff` | Staff | Abrir | 404 y la navegación del portal sigue disponible | P3 | NAV-005 |
| MAP-109 | Navegación | 404 de experiencia por token | Clienta (token) | Abrir un enlace inválido | Ofrece salida y no muestra la navegación de marketing | P3 | NAV-006 |
| MAP-110 | Navegación | Sitio público | Anónimo | Recorrer todos los enlaces internos | Ninguno responde 404/500 | P1 | NAV-010 |
| MAP-111 | Navegación | Panel (sidebar y secciones) | Owner | Recorrer los enlaces de cada sección | Ninguno responde 404/500 | P1 | NAV-011 |
| MAP-112 | Navegación | Detalles del panel (evento, cotización, lead, clienta, catálogo, configuración) | Owner | Recorrer sus enlaces | Sin enlaces rotos | P2 | NAV-012 |
| MAP-113 | Navegación | Portal staff (`/staff`, `/staff/events/[id]`) | Staff | Recorrer «Mis eventos» y el detalle | Los enlaces responden | P1 | NAV-013 |
| MAP-114 | Navegación | Experiencias por token (cotización, portal, micrositio, cápsula) | Clienta (token) | Recorrer los enlaces internos | Los enlaces responden | P2 | NAV-014 |
| MAP-115 | Navegación | Enlaces de acción del buzón (`NotificationLog.actionUrl`) en `/admin/notifications` | Owner · Staff | Abrir cada enlace; STAFF_ASSIGNED abierto por la persona asignada (Lupita) | Apuntan a rutas existentes; STAFF_ASSIGNED lleva a `/staff/events/<id>` | P3 | NAV-015, NOT-007 |
| MAP-116 | Navegación | Sidebar del panel | Owner | Navegar cada sección | Navega, marca `aria-current` y muestra el encabezado de la sección | P1 | NAV-020 |
| MAP-117 | Navegación | Sidebar del panel | SuperAdmin · Staff | Comparar secciones visibles | SuperAdmin ve las mismas 17 secciones; Staff no ve el panel | P2 | NAV-021 |
| MAP-118 | Navegación | Menú móvil del panel (390 y 768 px) | Owner | Abrir, cerrar con Escape y navegar | La hoja de navegación abre, navega y se cierra | P2 | NAV-022, RESP-019 |
| MAP-119 | Navegación | Historial del navegador en el panel | Owner | Atrás/adelante entre secciones | Conserva la página correcta | P2 | NAV-023 |
| MAP-120 | Navegación | Enlaces «Volver» (detalle de lead, detalle del portal staff) | Owner · Staff | Pulsar «Volver» | Regresan al listado | P2 | NAV-024 |
| MAP-121 | Navegación | Cabecera y pie públicos | Anónimo | Navegar el menú principal, el CTA y los enlaces legales del pie | Cada enlace llega a su página y marca `aria-current`; el CTA lleva al configurador | P1 | NAV-030, PUB-011 |
| MAP-122 | Navegación | Menú móvil público (390 y 768 px) | Anónimo | Abrir, navegar y cerrar | `aria-expanded` correcto, el foco regresa al botón, navega y cierra; en 1440 px la navegación es visible sin botón | P1 | NAV-031, PUB-012, RESP-007 |
| MAP-123 | Navegación | Migas de pan en `/experiencias/[slug]` | Anónimo | Leer | Inicio › Experiencias › nombre | P2 | NAV-032 |
| MAP-124 | Navegación | Enlace «Saltar al contenido» | Anónimo | Tab + Enter | Es el primer foco y lleva a `main#contenido` | P2 | NAV-033, A11Y-023 |
| MAP-515 | Navegación | 404 real en rutas públicas y por token: `/experiencias/[slug]`, `/cotizacion/[token]`, `/mi-evento/[token]`, `/mi-evento/[token]/resumen`, `/e/[slug]/[token]`, `/memory/[token]`, `/pago/mock/[checkoutId]`, `/pago/resultado` | Anónimo | GET directo (sin seguir redirects) con un slug o token inexistente | HTTP 404 en las 8 rutas, no soft-404. Lo complementa el contrato estático `tests/unit/route-not-found-contract.test.ts` (`@regression` BUG-013) | P3 | NAV-034 ¹ |
| MAP-516 | Navegación | Hidratación con el chunk de `error.tsx` del segmento retrasado: `/pago/mock/[checkoutId]`, `/crear-experiencia`, `/admin/quotes` | Clienta (token) · Anónimo · Owner | Abrir la página reteniendo sólo el chunk de `error.tsx` (en Firefox llegaba tarde) | Sin `pageerror` (React #418); `<main id=contenido>` es el mismo nodo que llegó del servidor (no se vuelve a pintar en el cliente) | P0 | NAV-034 ¹, NAV-035, NAV-036 |
| MAP-125 | Sitio público y contacto | `/` | Anónimo | Abrir el inicio | 200, un H1, landmarks (banner, nav, main, footer), sin errores de consola/red | P0 | PUB-001, SMK-010 |
| MAP-126 | Sitio público y contacto | `/experiencias` | Anónimo | Abrir el catálogo | 200 y exactamente las experiencias activas de la base, cada una enlazada a su detalle | P0 | PUB-002, PUB-014, SMK-011, SMK-020 |
| MAP-127 | Sitio público y contacto | `/experiencias/[slug]` | Anónimo | Abrir el detalle de una experiencia activa | H1 = nombre, «Desde» con precio base en MXN, rango de personas, JSON-LD Service y CTA «Diseña esta experiencia» → configurador con la experiencia preseleccionada | P0 | PUB-003, PUB-015, SMK-012 |
| MAP-128 | Sitio público y contacto | `/experiencias/[slug]` inexistente, inactiva o con HTML | Anónimo | Abrir | «Esta mesa ya no está puesta», HTTP 404 (no soft-404), noindex, sin datos; no aparece en el catálogo | P1 | PUB-016, NAV-002 |
| MAP-129 | Sitio público y contacto | `/experiencias?ocasion&personas&tipo&estilo` | Anónimo | Filtrar el catálogo | Resultados = consulta equivalente en base; grupo grande → nota «consulta especial»; sin resultados → estado vacío; parámetros basura ignorados | P2 | PUB-017 |
| MAP-130 | Sitio público y contacto | `/crear-experiencia`, `/crear-experiencia/ai` | Anónimo | Abrir | 200, H1, landmarks, sin errores de consola/red | P0 | PUB-009, PUB-010, SMK-013 |
| MAP-131 | Sitio público y contacto | `/contacto` | Anónimo | Abrir | 200, H1, main y footer, sin errores de consola/red | P0 | PUB-006, SMK-014 |
| MAP-132 | Sitio público y contacto | `/como-funciona`, `/nuestra-historia` | Anónimo | Abrir páginas informativas | 200, H1, landmarks, sin errores | P1 | PUB-004, PUB-005, SMK-015, SMK-016 |
| MAP-133 | Sitio público y contacto | `/privacidad`, `/terminos` | Anónimo | Abrir páginas legales | 200, H1, enlazadas desde el pie | P1 | PUB-007, PUB-008, SMK-017, SMK-018 |
| MAP-134 | Sitio público y contacto | Hero de `/` | Anónimo | Usar los CTAs principales | «Diseña tu experiencia» → paso 1 del configurador; «Ver experiencias» → catálogo | P1 | PUB-013 |
| MAP-135 | Sitio público y contacto | SEO (`<head>` de las páginas indexables) | Rastreador sin JS | Leer el `<head>` | title con marca, description ≥ 40 caracteres, canonical, `og:title`, `og:image` absoluta que responde imagen, `og:locale` es_MX; sin noindex | P2 | PUB-018 |
| MAP-136 | Sitio público y contacto | Indexación: `robots.txt`, sitemap y páginas con token/pago | Rastreador | Leer robots, sitemap y cabeceras | `/cotizacion/*` y pago con meta noindex + `X-Robots-Tag`; robots.txt bloquea zonas privadas; sitemap con experiencias activas, sin inactivas ni tokens | P1 | PUB-019 |
| MAP-137 | Sitio público y contacto | Accesibilidad pública: `/`, `/experiencias`, `/experiencias/[slug]`, `/como-funciona`, `/contacto`, `/nuestra-historia`, `/login` | Anónimo | axe WCAG 2.1 AA | 0 violaciones critical/serious (moderate/minor = observación) | P2 | PUB-020, A11Y-001, A11Y-002, A11Y-003, A11Y-005, A11Y-006, A11Y-017 |
| MAP-138 | Sitio público y contacto | Responsive público: `/`, `/experiencias`, detalle, `/crear-experiencia`, `/contacto`, `/login` | Anónimo | 1440×900, 1366×768, 768×1024, 390×844 | Sin scroll horizontal (≤ 1 px), H1 y CTA principal visibles, dentro del ancho y no tapados | P1 | PUB-021, RESP-001, RESP-002, RESP-003, RESP-004, RESP-005, RESP-006 |
| MAP-139 | Sitio público y contacto | `/contacto` · `submitContactForm` → `/admin/leads/[id]` | Anónimo (móvil) → Owner | Enviar el formulario completo con consentimiento; la fundadora busca el folio | «¡Gracias…» con folio = `Lead.code`; Lead NEW `CONTACT_FORM` con notas + Customer + `LeadActivity` CREATED + `LEAD_RECEIVED` (email y WhatsApp) + aviso al equipo + `SUBMIT_LEAD`; el detalle del lead muestra el mensaje | P0 | PUB-040, CRIT-010 |
| MAP-140 | Sitio público y contacto | `/contacto` | Anónimo | Enviar vacío | Error por campo con `aria-invalid` + alerta; todos los campos con label y requeridos marcados; nada en base | P1 | PUB-041, A11Y-024 |
| MAP-141 | Sitio público y contacto | `/contacto` | Anónimo | Teléfono, correo, mensaje corto o fecha pasada inválidos | Rechazados en el navegador; nada en base | P1 | PUB-042 |
| MAP-142 | Sitio público y contacto | `submitContactForm` (request directo) | Anónimo | Payload manipulado | `VALIDATION_ERROR` con el campo; base sin cambios | P1 | PUB-043 |
| MAP-143 | Sitio público y contacto | `/contacto` | Anónimo | Doble clic en «Enviar mensaje» | Un solo lead y una sola clienta | P1 | PUB-044 |
| MAP-144 | Sitio público y contacto | `submitContactForm` | Bot | Llenar el honeypot | Éxito aparente con folio falso; nada en base | P2 | PUB-045 |
| MAP-145 | Sitio público y contacto | `/contacto` (mismo correo dos veces) | Anónimo | Reenviar | Dos leads y una sola clienta | P2 | PUB-046 |
| MAP-146 | Sitio público y contacto | `/contacto` → `/admin/leads/[id]` | Anónimo → Owner | Enviar texto con HTML/script | Se muestra escapado en el panel; no se ejecuta | P2 | PUB-047 |
| MAP-147 | Sitio público y contacto | `submitContactForm` (rate limit) | Anónimo | 6 envíos reales en la ventana | Los 5 primeros crean 5 leads; el 6.º se rechaza con mensaje de límite y no crea lead | P1 | API-080 |
| MAP-517 | Sitio público y contacto | `/contacto` · `submitContactForm` (teléfono de una clienta registrada) → `/admin/leads/[id]` | Anónimo → Owner | Enviar con el teléfono de otra clienta, sin el correo de ella y con un correo ajeno | El lead se liga a esa clienta (no se duplica), pero su perfil no toma el correo escrito: sus enlaces de cotización, portal y pago no se desvían. El timeline avisa al equipo que el correo «No se agregó a su perfil» | P1 | PUB-048 |
| MAP-518 | Sitio público y contacto | `/contacto` antes de hidratar → `/admin/leads/[id]` | Anónimo (móvil) | Escribir todo el formulario mientras el chunk de la página aún no llega; hidrata; consentimiento; «Enviar mensaje» | «Enviar mensaje» deshabilitado hasta hidratar; nada de lo escrito se borra y el lead llega completo | P0 | PUB-049 |
| MAP-148 | Configurador | `/crear-experiencia` (10 pasos) · `submitConfiguratorAction` → `/admin/leads/[id]` | Anónimo (móvil) → Owner | Recorrido completo (ocasión, fecha, zona, invitadas, estilo, experiencia, menú, extras, homenajeada, presupuesto) + datos + consentimiento → «Consultar disponibilidad»; la fundadora abre el lead por folio | Resumen con estimado = `estimateAction` sin costos; Lead NEW `CONFIGURATOR` con selección y `estimatedTotalCents` del servidor = total mostrado; Customer con teléfono `+52…`; timeline CREATED; `ConfigurationSnapshot` (data + estimate + submissionId); `LEAD_RECEIVED` + aviso al equipo; analítica de embudo; visible en `/admin/leads` | P0 | CONF-001, CRIT-001 |
| MAP-149 | Configurador | `estimateAction` | Anónimo | Pedir estimado | Cálculo en servidor con las reglas del motor (base, extras, menú/extra por persona, logística, IVA 16 % incluido, anticipo 50 %), en centavos enteros y sin costos ni márgenes | P0 | CONF-013 |
| MAP-150 | Configurador | HTML/RSC de las páginas públicas | Anónimo | Inspeccionar lo que llega al navegador | El catálogo enviado no contiene costos internos | P0 | CONF-014 |
| MAP-151 | Configurador | `submitConfiguratorAction` (request directo) | Anónimo | Enviar un `estimatedTotalCents` inventado | El servidor lo ignora y guarda el recalculado | P0 | CONF-015 |
| MAP-152 | Configurador | Resumen → «Editar» | Anónimo | Cambiar invitadas o extras | El estimado se recalcula en el servidor; respuestas sin llaves internas | P1 | CONF-002 |
| MAP-153 | Configurador | Paso 4 (invitadas) | Anónimo | Valores fuera de rango | Clamp 2–40, botones deshabilitados en los límites, aviso «Consulta especial» > 12 | P1 | CONF-003 |
| MAP-154 | Configurador | Paso 2 (calendario) | Anónimo | Intentar fechas no disponibles | Pasadas, lunes, bloqueadas y llenas no se pueden elegir; el paso exige fecha | P1 | CONF-004 |
| MAP-155 | Configurador | `getAvailabilityAction` | Anónimo | Consultar un rango | BLOCKED/FULL/PAST/CLOSED correctos; sólo `date, status, acceptsRequests, remaining` (sin datos de otros eventos); entradas inválidas rechazadas | P1 | CONF-016 |
| MAP-156 | Configurador | Resumen (datos de contacto) | Anónimo | Datos inválidos | Errores por campo; sin lead | P1 | CONF-005 |
| MAP-157 | Configurador | `submitConfiguratorAction` (request directo) | Anónimo | Fecha pasada, bloqueada o imposible | Rechazo con mensaje de negocio; sin lead | P1 | CONF-017 |
| MAP-158 | Configurador | `submitConfiguratorAction` (request directo) | Anónimo | Payloads inválidos (teléfono, consentimiento, invitadas, horario, ids incompatibles, experiencia inactiva, zona, presupuesto) | `VALIDATION_ERROR` con el campo; sin lead | P1 | CONF-018 |
| MAP-159 | Configurador | Resumen | Anónimo | Doble clic en enviar | Un solo lead, una clienta y un aviso | P1 | CONF-006 |
| MAP-160 | Configurador | `submitConfiguratorAction` | Anónimo | Reintentar con el mismo `submissionId` | Mismo folio, sin duplicados | P1 | CONF-019 |
| MAP-161 | Configurador | Recarga a mitad del recorrido | Anónimo | Continuar el borrador | Banner «Tienes una experiencia a medio armar»; restaura paso y valores; tras enviar se limpia | P2 | CONF-007 |
| MAP-162 | Configurador | Paso 3 «Otra zona» | Anónimo | Elegir zona fuera de cobertura | Lead `outOfArea` con colonia; logística «Por confirmar»; nota en la confirmación | P1 | CONF-008 |
| MAP-163 | Configurador | Grupo > 12 invitadas | Anónimo | Enviar consulta especial | `specialRequest` + nota interna + mensaje | P1 | CONF-009 |
| MAP-164 | Configurador | `/crear-experiencia?experiencia=&ocasion=` | Anónimo | Llegar con preselección | Ocasión y experiencia preseleccionadas; parámetros inválidos ignorados | P1 | CONF-010 |
| MAP-165 | Configurador | Pasos 1–10 | Anónimo | Avanzar sin completar | Mensaje en cada paso obligatorio | P2 | CONF-011 |
| MAP-166 | Configurador | Accesibilidad y teclado del configurador | Anónimo | axe; Tab al grupo, flechas, Espacio y Enter | 0 violaciones critical/serious; las flechas seleccionan, Enter avanza y el foco va al título del paso; las líneas por persona del resumen («· N × $precio») sin texto atenuado bajo AA (`@regression` BUG-009) | P1 | CONF-012, A11Y-004, A11Y-021, CONF-024 |
| MAP-167 | Configurador | Día lleno | Anónimo | Enviar con fecha FULL | Se acepta como consulta con nota «Fecha llena» para el equipo | P2 | CONF-020 |
| MAP-168 | Configurador | Clienta recurrente | Anónimo | Enviar con el mismo teléfono | Misma Customer; su perfil **no** toma el correo escrito en el sitio, que queda en el lead (antes se completaba; cambio de requisito del endurecimiento, `@regression`) | P2 | CONF-021 |
| MAP-169 | Configurador | Entre canales (configurador, diseñador IA, contacto) | Anónimo | Usar el mismo teléfono | Misma Customer | P2 | CONF-022 |
| MAP-170 | Configurador | `trackConfiguratorAction` | Anónimo | Analítica del embudo | START/COMPLETE con el id de sesión; tipos no permitidos rechazados | P3 | CONF-023 |
| MAP-171 | Configurador | `submitConfiguratorAction` (rate limit) | Anónimo | 6.º envío en 10 minutos | `RATE_LIMITED` aunque el payload sea inválido; sin lead | P1 | API-081 |
| MAP-519 | Configurador | `/crear-experiencia?experiencia=…` antes de hidratar | Anónimo | Pulsar «Siguiente» (clic y Enter) antes de que el configurador hidrate | No hay envío nativo: no recarga ni pierde la experiencia de partida; botón deshabilitado con `aria-busy` y `method="post"`; tras hidratar avanza normal | P1 | CONF-025 |
| MAP-172 | Diseñador IA | `/crear-experiencia/ai` · `generateDesignAction` | Anónimo | Generar propuesta | Propuesta con experiencia activa real y estimado del motor; `AiDesign` persistido; `AI_DESIGN_GENERATED`; sin costos en la respuesta | P1 | AI-001 |
| MAP-173 | Diseñador IA | «Quiero esta experiencia» · `convertDesignToLeadAction` | Anónimo → Owner | Convertir el diseño en lead | Lead `AI_DESIGNER` ligado al diseño, snapshot y avisos; visible en el panel | P1 | AI-002 |
| MAP-174 | Diseñador IA | `/crear-experiencia/ai` (formulario) | Anónimo | Enviar vacío | Errores por campo; sin `AiDesign` | P1 | AI-003 |
| MAP-175 | Diseñador IA | `generateDesignAction` (request directo) | Anónimo | Entradas inválidas | `VALIDATION_ERROR` por campo | P1 | AI-004 |
| MAP-176 | Diseñador IA | `convertDesignToLeadAction` | Anónimo | Convertir repetido o simultáneo | Mismo folio, un solo lead | P1 | AI-005 |
| MAP-177 | Diseñador IA | `convertDesignToLeadAction` | Anónimo | Diseño inexistente, fecha pasada, sin consentimiento, teléfono o id inválido | Rechazo; sin lead | P1 | AI-006 |
| MAP-178 | Diseñador IA | Diseño de más de 30 días | Anónimo | Convertir | `DESIGN_EXPIRED` | P2 | AI-007 |
| MAP-179 | Diseñador IA | Coherencia de precio | Anónimo | Presupuesto bajo con 12 invitadas | Mismo total que el configurador; `withinBudget` coherente | P2 | AI-008 |
| MAP-180 | Diseñador IA | `/admin/settings/flags` (`AI_DESIGNER_ENABLED`) → `/crear-experiencia/ai` | Owner → Anónimo | Apagar «Diseñador con IA»; abrir, generar y convertir; restablecer | Página en pausa, configurador sin enlace, backend `FEATURE_DISABLED`, nada en base; al restablecer vuelve a funcionar | P1 | AI-009, SET-010 |
| MAP-181 | Leads | `/admin/leads` | Owner | Abrir el listado | Resumen por estado = conteos de la base (ignora el filtro de estado); tabla con los leads del filtro | P1 | LEAD-001 |
| MAP-182 | Leads | `/admin/leads?q=` | Owner | Buscar por nombre, correo, código o teléfono con formato | Encuentra el lead (insensible a mayúsculas; compara dígitos del teléfono); el lead NEW sembrado aparece | P1 | LEAD-008, SMK-022 |
| MAP-183 | Leads | `/admin/leads` (filtros) | Owner | Aplicar y limpiar filtros de estado, origen, asignada y señales | Sólo los leads que cumplen; URL compartible; estado vacío «Ningún lead coincide» | P2 | LEAD-009 |
| MAP-184 | Leads | `/admin/leads` (fecha del evento) | Owner | Filtrar por rango de fechas | Incluye los extremos; un rango invertido se corrige | P2 | LEAD-010 |
| MAP-185 | Leads | `/admin/leads` (paginación) | Owner | Ir a la página 2 y a una página fuera de rango | 25 por página; conserva la búsqueda; página > última = última | P2 | LEAD-011 |
| MAP-186 | Leads | `/admin/leads` (orden) | Owner | Ordenar `created_asc` / `event_asc` / por defecto | Orden correcto; leads sin fecha al final | P3 | LEAD-012 |
| MAP-187 | Leads | `/admin/leads` (enlaces) | Owner | «Siguiente» y «Limpiar filtros» por clic | La URL cambia y se muestra el destino | P2 | LEAD-037 |
| MAP-188 | Leads | `/admin/leads` (kanban) · `changeLeadStatusAction` | Owner | Mover una tarjeta | Sólo transiciones válidas; persiste y registra STATUS_CHANGE | P2 | LEAD-013 |
| MAP-189 | Leads | `/admin/leads` (kanban → Perdido) | Owner | Mover a «Perdido» | El diálogo exige motivo; guarda `lostReason` | P1 | LEAD-014 |
| MAP-190 | Leads | «Nuevo lead» · `createLeadAction` | Owner | Crear un lead manual | Toast «Lead L-… creado» y detalle; Lead NEW con clienta vinculada (correo normalizado), asignado a quien captura, timeline CREATED | P1 | LEAD-002 |
| MAP-191 | Leads | «Nuevo lead» | Owner | Enviar vacío o con formatos inválidos | Errores por campo, sin llamada al servidor | P1 | LEAD-003, LEAD-004 |
| MAP-192 | Leads | `createLeadAction` (request directo) | Owner | Datos inválidos saltando el formulario | `VALIDATION_ERROR` por campo; nada en base | P1 | LEAD-005 |
| MAP-193 | Leads | «Nuevo lead» (clienta existente) | Owner | Crear lead con correo o teléfono (con o sin formato) de una clienta existente | Reutiliza la clienta; no la duplica | P1 | LEAD-006, CUST-016 |
| MAP-194 | Leads | «Nuevo lead» (señales) | Owner | 13 invitadas + otra zona | `specialRequest` y `outOfArea` con sus insignias | P2 | LEAD-007 |
| MAP-195 | Leads | «Nuevo lead» (avisos) | Owner | Crear con origen «Captura manual» u otro origen | No se envían avisos de «lead entrante» | P2 | LEAD-035, LEAD-036 |
| MAP-196 | Leads | «Nuevo lead» | Owner | Doble clic en «Crear lead» | Un solo lead | P2 | LEAD-033 |
| MAP-197 | Leads | `/admin/leads/[id]` (Seguimiento › Mover a) · `changeLeadStatusAction` | Owner | Cambiar de estado con nota | Badge actualizado, timeline «A → B», auditoría `lead.status_changed` | P1 | LEAD-016 |
| MAP-198 | Leads | `/admin/leads/[id]` (máquina de estados) | Owner | Revisar opciones por estado | Coinciden con `leadStatusMachine.next`; WON es final | P1 | LEAD-017 |
| MAP-199 | Leads | `changeLeadStatusAction` (request directo) | Owner | Transición inválida, mismo estado o lead inexistente | CONFLICT / NOT_FOUND sin cambios | P1 | LEAD-018 |
| MAP-200 | Leads | `/admin/leads/[id]` (motivo de pérdida) | Owner | Pasar a LOST sin motivo (UI y backend); con motivo; reactivar | Sin motivo se rechaza; con motivo se guarda; al reactivar se limpia | P1 | LEAD-019, LEAD-020 |
| MAP-201 | Leads | `/admin/leads/[id]` (responsable) · `assignLeadAction` | Owner | Asignar y desasignar | `assignedToId` actualizado, timeline ASSIGNED, auditoría | P1 | LEAD-021 |
| MAP-202 | Leads | `assignLeadAction` (request directo) | SuperAdmin | Asignar a una cuenta STAFF o a un id inexistente | `VALIDATION_ERROR`; sin cambios | P1 | LEAD-022 |
| MAP-203 | Leads | `/admin/leads/[id]` (registrar contacto) · `logLeadActivityAction` | Owner | Registrar WhatsApp sobre un lead NEW | Pasa solo a CONTACTED, actualiza `lastContactedAt` y el timeline | P1 | LEAD-023 |
| MAP-204 | Leads | `/admin/leads/[id]` (nota interna) · `logLeadActivityAction` | Owner | Agregar nota; mensaje de 1 carácter | No cambia el estado; < 2 caracteres se rechaza | P2 | LEAD-024 |
| MAP-205 | Leads | `/admin/leads/[id]` (editar datos) · `updateLeadAction` | Owner | Guardar cambios; guardar sin cambios | Timeline «Datos actualizados: …» y auditoría before/after; sin cambios → «No hubo cambios» | P1 | LEAD-025 |
| MAP-206 | Leads | `/admin/leads/[id]` (editar datos) | Owner | Notas con HTML/script | Se muestran escapadas | P2 | LEAD-026 |
| MAP-207 | Leads | `updateLeadAction` (request directo) | Owner | Referencias de catálogo inexistentes | `VALIDATION_ERROR` por campo | P2 | LEAD-027 |
| MAP-208 | Leads | `/admin/leads/[id]` (multiusuario) | Owner (Rosa) | Operar un lead creado por Ivonne | Visible y operable; la auditoría registra al actor real | P2 | LEAD-034 |
| MAP-209 | Leads | `/api/admin/leads-export` (botón «Exportar CSV» de `/admin/leads`) | Owner · Staff · Anónimo | Exportar CSV | Anónimo 401, Staff 403; Owner obtiene CSV con BOM, encabezados y filas = filtro, fórmulas `= + - @` neutralizadas con apóstrofo y auditoría `leads.exported` | P0 | API-070, LEAD-028, LEAD-029, LEAD-030 |
| MAP-210 | Leads | `/admin/leads` (botón «Exportar CSV») | Owner | Exportar con filtros activos | El `href` lleva los mismos filtros | P3 | LEAD-031 |
| MAP-211 | Clientas | `/admin/customers` | Owner | Abrir el listado filtrado | «N clientas para …» con leads/eventos por fila | P1 | CUST-001 |
| MAP-212 | Clientas | `/admin/customers?q=` | Owner | Buscar por nombre, correo, teléfono, Instagram o referido; sin coincidencias | Encuentra a la clienta; sin coincidencias muestra estado vacío con «Ver todas» | P1 | CUST-002 |
| MAP-213 | Clientas | `/admin/customers` (orden y paginación) | Owner | Nombre A–Z, recientes, página 2 | Orden y paginación correctos | P3 | CUST-003, CUST-004 |
| MAP-214 | Clientas | `/admin/customers/[id]` | Owner | Abrir ficha con historial (seed) | Leads, cotizaciones, eventos, pagos, total pagado y motivos que bloquean el borrado | P1 | CUST-005 |
| MAP-215 | Clientas | `/admin/customers/[id]` (perfil) · `updateCustomerAction` | Owner | Editar el perfil | Normaliza correo e Instagram, guarda opt-in, auditoría before/after | P1 | CUST-006 |
| MAP-216 | Clientas | `/admin/customers/[id]` (perfil) | Owner | Usar el correo de otra clienta | Error de campo; sin cambios | P1 | CUST-007 |
| MAP-217 | Clientas | `/admin/customers/[id]` (perfil) | Owner | Datos inválidos (formulario y request directo) | Errores por campo; sin cambios | P1 | CUST-008, CUST-015 |
| MAP-218 | Clientas | `/admin/customers/[id]` (teléfono) | Owner | Usar el teléfono de otra clienta | Se permite: no hay regla de unicidad de teléfono (ambigüedad documentada) | P3 | CUST-009 |
| MAP-219 | Clientas | `/admin/customers/[id]` (eliminar) · `deleteCustomerAction` | Owner | Eliminar una clienta sin historial comercial | Se borra, sus leads quedan sin clienta, auditoría; no reaparece | P1 | CUST-010 |
| MAP-220 | Clientas | `/admin/customers/[id]` (eliminar) | Owner | Cancelar el diálogo de borrado | Nada cambia | P2 | CUST-014 |
| MAP-221 | Clientas | `/admin/customers/[id]` · `deleteCustomerAction` | Owner · SuperAdmin | Eliminar una clienta con cotización o evento (UI y request) | Botón oculto; el backend responde CONFLICT con los motivos | P1 | CUST-011, CUST-012 |
| MAP-222 | Catálogo | `/admin/catalog` | Owner | Abrir el listado de experiencias | Tarjetas con precio base, switch de activa y «Editar» para cada experiencia de la base | P1 | CAT-001 |
| MAP-223 | Catálogo | `/admin/catalog` (pestañas) | Owner | Navegar entre secciones | Cada pestaña carga su sección, con `aria-current` y encabezado | P3 | CAT-034 |
| MAP-224 | Catálogo | `/admin/catalog/experiences/new` · `createExperienceAction` | Owner | Crear una experiencia por UI | Slug automático, precios en centavos, nace inactiva y queda auditada | P1 | CAT-002 |
| MAP-225 | Catálogo | Slug de experiencia · `checkSlugAction` | Owner | Usar un slug repetido (UI y request) | Aviso «No disponible» en vivo; el backend responde CONFLICT y no crea duplicado | P1 | CAT-003, CAT-004 |
| MAP-226 | Catálogo | `/admin/catalog/experiences/[id]` (validaciones) | Owner | Mínimo > máximo; activar con precio $0 | Errores de campo | P1 | CAT-005 |
| MAP-227 | Catálogo | `createExperienceAction` / `updateExperienceAction` (request directo) | Owner | Montos negativos, con más de 2 decimales o enormes; personas fuera de rango | `VALIDATION_ERROR`; sin cambios | P1 | CAT-006 |
| MAP-228 | Catálogo | `/admin/catalog/experiences/[id]` · `updateExperienceAction` | Owner | Cambiar nombre y precio | Se guarda; el cambio de precio queda en auditoría `catalog.price_changed` | P1 | CAT-007 |
| MAP-229 | Catálogo | `/admin/catalog` (switch) · `toggleCatalogActiveAction` → `/experiencias/[slug]` | Owner → Anónimo | Activar y desactivar desde el listado | Cambia la visibilidad en el sitio público; auditoría | P1 | CAT-008 |
| MAP-230 | Catálogo | `/admin/catalog` (switch) | Owner | Activar una experiencia con precio base $0 | Rechazo y rollback del switch | P2 | CAT-009 |
| MAP-231 | Catálogo | `/admin/catalog/experiences/[id]` · `deleteExperienceAction` | Owner | Eliminar experiencia sin uso y ligada a un lead | Sin uso: se borra y se audita; ligada: se desactiva con motivo (integridad) | P1 | CAT-010, CAT-011 |
| MAP-232 | Catálogo | `/admin/catalog/experiences/[id]` (imágenes) · `addExperienceImageAction`, `reorderExperienceImagesAction`, `removeExperienceImageAction` | Owner | Subir dos fotos, reordenar, quitar una; subir un archivo que no es imagen | `ExperienceImage`/`MediaAsset` con orden y limpieza de huérfanos; archivo falso rechazado por magic bytes (422) | P2 | CAT-012, CAT-013 |
| MAP-233 | Catálogo | `/admin/catalog/menus`, `/admin/catalog/menus/new` · `createMenuAction` | Owner | Crear menú por UI con upgrade por persona; menú «Incluido» con monto | Precio y costo en centavos; «Incluido» guarda $0 aunque se envíe otro monto | P1 | CAT-016, CAT-017 |
| MAP-234 | Catálogo | `/admin/catalog/menus/[id]` (platillos) · `updateMenuAction`, `createMenuItemAction`, `updateMenuItemAction`, `deleteMenuItemAction`, `reorderMenuItemsAction` | Owner | Agregar, editar, eliminar y reordenar platillos; reorden manipulado | Persisten (incluido «Ordenar por tiempo»); reorden con ids ajenos o incompletos rechazado sin cambiar el orden | P1 | CAT-018, CAT-019, CAT-020 |
| MAP-235 | Catálogo | `/admin/catalog/menus/[id]` · `deleteMenuAction` | Owner | Eliminar menú libre y ligado a una experiencia | Libre: se borra; ligado: se desactiva | P1 | CAT-021 |
| MAP-236 | Catálogo | `/admin/catalog/addons`, `/admin/catalog/addons/new`, `/admin/catalog/addons/[id]` · `createAddOnAction`, `updateAddOnAction`, `deleteAddOnAction` | Owner | Crear add-on por persona, editar su precio, eliminar en uso y libre; montos inválidos por request | Precio/costo en centavos y categoría de costo; cambio de precio auditado (`catalog.price_changed`); en uso se desactiva, libre se borra; montos/cantidades inválidas → `VALIDATION_ERROR` | P1 | CAT-022, CAT-023, CAT-024, CAT-025 |
| MAP-237 | Catálogo | `/admin/catalog/styles` · `createStyleAction`, `updateStyleAction`, `deleteStyleAction` | Owner | Crear estilo con paleta, editarlo y eliminarlo; colores no hex o slug inválido | Persisten; paleta/slug inválidos rechazados en el backend | P2 | CAT-026, CAT-027 |
| MAP-238 | Catálogo | `/admin/catalog/areas` · `createServiceAreaAction`, `updateServiceAreaAction`, `deleteServiceAreaAction` | Owner | Crear zona con códigos postales y tarifa; CP inválido; CP que ya cubre otra zona; eliminar | Persiste; CP inválido marcado y no agregado; traslape guardado con aviso; ligada a un lead se desactiva, libre se borra | P1 | CAT-028, CAT-029, CAT-030 |
| MAP-239 | Catálogo | `/admin/catalog/budgets` · `createBudgetRangeAction`, `updateBudgetRangeAction`, `deleteBudgetRangeAction` | Owner | Crear (con etiqueta sugerida), editar y eliminar; máximo ≤ mínimo; montos negativos; rango en uso | Persisten; validación en UI y backend; ligado a un lead se desactiva | P2 | CAT-031, CAT-032, CAT-033 |
| MAP-240 | Cotizaciones | `/admin/quotes` | Owner | Pestañas por estado, búsqueda y parámetros basura | Filtra por estado, código, clienta y título; estado vacío; aparece el folio sembrado de Lucía | P1 | QUO-001, SMK-023 |
| MAP-241 | Cotizaciones | `/admin/quotes?expiring=1` | Owner | Filtro «Por vencer (48 h)» | Sólo SENT cuya vigencia termina en las próximas 48 h | P2 | QUO-032 |
| MAP-242 | Cotizaciones | `/admin/leads/[id]` → `/admin/quotes/new?leadId` · `previewQuoteAction`, `createQuoteAction` | Owner | Crear cotización desde un lead | Precarga; cálculo en vivo = oráculo; DRAFT con líneas; lead → QUOTED + QUOTE_CREATED; auditoría `quote.created` | P0 | QUO-002 |
| MAP-243 | Cotizaciones | `/admin/quotes/new` · `searchCustomersAction` | Owner | Clienta existente (buscador con ↓/Enter, sin coincidencias, «Cambiar»), clienta nueva, correo repetido | `customerId` correcto; la nueva se crea con origen manual; un correo repetido reutiliza la existente | P1 | QUO-003, QUO-004, QUO-036 |
| MAP-244 | Cotizaciones | `/admin/quotes/new` (validaciones) | Owner | Formulario y request directo con clienta, contacto, invitadas, anticipo > 100 % o add-ons inválidos | Errores por campo; nada creado | P1 | QUO-005, QUO-006 |
| MAP-245 | Cotizaciones | `/admin/quotes/new` (invitadas > máximo) | Owner | Cotizar 13 invitadas | Avisos de validación y consulta especial; se cotiza por invitada | P1 | QUO-007 |
| MAP-246 | Cotizaciones | `previewQuoteAction` (QuoteEngine) | Owner | Combinaciones de menú, add-ons, zona e invitadas | Vista previa = oráculo (líneas, subtotal, IVA en bps, total, anticipo, avisos) | P0 | QUO-008 |
| MAP-247 | Cotizaciones | `/admin/quotes/[id]` (totales) | Owner | Abrir un borrador | Subtotal, IVA, total, anticipo y saldo exactamente como en la base | P0 | QUO-009 |
| MAP-248 | Cotizaciones | `/admin/quotes/[id]` (editor) · `buildCatalogLineAction`, `previewQuotePricingAction`, `saveQuotePricingAction` | Owner | Agregar add-on de catálogo y concepto personalizado; guardar | Recalculado y guardado en el servidor; el servidor fija precio/costo de catálogo, invitadas facturables y tope de cantidad | P1 | QUO-010, QUO-011 |
| MAP-249 | Cotizaciones | `/admin/quotes/[id]` (descuento) · `saveQuotePricingAction` | Owner (Ivonne, Rosa) | Descuento %, monto > subtotal, sin motivo, > 100 % o negativo | Total recalculado; tope al subtotal (total $0, no enviable); sin motivo/> 100 %/negativo rechazado sin tocar la cotización; auditoría `quote.discount_applied` before/after con el actor real. Ningún rol con acceso al panel carece de `quotes:discount` (M3-107: NOT APPLICABLE; la denegación se prueba por replay en Autorización) | P0 | QUO-012, QUO-013, QUO-014, QUO-033, M3-107 |
| MAP-250 | Cotizaciones | `saveQuotePricingAction` (líneas inválidas) | Owner | Cantidades ≤ 0, precios negativos o con decimales, conceptos vacíos | Rechazo sin cambios | P1 | QUO-015 |
| MAP-251 | Cotizaciones | `saveQuotePricingAction` (líneas fijas) | Owner | Manipular la cantidad de experiencia base, menú o logística | Se ignora | P1 | QUO-016 |
| MAP-252 | Cotizaciones | `/admin/quotes/[id]` (precio unitario) | Owner | Cambiar el precio de una línea de catálogo | Auditoría `quote.price_changed` | P1 | QUO-017 |
| MAP-253 | Cotizaciones | `/admin/quotes/[id]` (datos de la propuesta) · `updateQuoteDetailsAction` | Owner | Cambiar invitadas, título y vigencia (pasada) | Recalcula extras y add-ons por persona; vigencia pasada rechazada | P1 | QUO-018 |
| MAP-254 | Cotizaciones | `/admin/quotes/[id]` · `sendQuoteAction` | Owner | «Enviar a la clienta» | SENT con vigencia; lead QUOTED + QUOTE_SENT; notificaciones EMAIL + WHATSAPP con el token; auditoría; enlace público activo | P0 | QUO-019 |
| MAP-255 | Cotizaciones | `sendQuoteAction` (inválido) | Owner | Enviar sin fecha, con fecha pasada o una cotización ya enviada/aceptada/rechazada | Rechazo (queda en borrador o CONFLICT) sin notificar de nuevo | P1 | QUO-020, QUO-021 |
| MAP-256 | Cotizaciones | `/admin/quotes/[id]` · `markQuoteExpiredAction` | Owner | Marcar expirada y reactivar/reenviar; expirar desde otro estado | EXPIRED → SENT con nueva vigencia; sólo SENT puede expirar (resto CONFLICT) | P1 | QUO-022, QUO-023 |
| MAP-257 | Cotizaciones | `/admin/quotes/[id]` · `duplicateQuoteAction` | Owner | Duplicar una enviada con descuento | Nuevo DRAFT v1 con código y token propios, mismos conceptos y totales | P1 | QUO-024 |
| MAP-258 | Cotizaciones | `/admin/quotes/[id]` · `createNewVersionAction` | Owner | Nueva versión desde SENT; desde DRAFT o ACCEPTED | DRAFT v+1 con el mismo token y enlace público en 404; desde DRAFT/ACCEPTED → CONFLICT | P1 | QUO-025, QUO-026 |
| MAP-259 | Cotizaciones | `/admin/quotes/[id]` (guardas de estado) | Owner | Editar una SENT; abrir una ACCEPTED | SENT sin editor y el servidor rechaza cambios; ACCEPTED sin enviar/expirar/nueva versión | P1 | QUO-027, QUO-028 |
| MAP-260 | Cotizaciones | `/admin/quotes/[id]/print` | Owner | Abrir la vista de impresión | Datos y totales de la base; sin costos, márgenes ni notas internas | P1 | QUO-029 |
| MAP-261 | Cotizaciones | `/admin/leads/[id]` (lead perdido) | Owner | Buscar «Crear cotización» | No se ofrece | P3 | QUO-031 |
| MAP-262 | Cotizaciones | `/admin/quotes/[id]` (historial) | Owner | Abrir tras enviar | Lista la auditoría y las notificaciones enviadas | P2 | QUO-037 |
| MAP-263 | Cotizaciones | `/admin/quotes/new` | Owner | Doble clic en «Crear cotización» | Una sola cotización | P2 | QUO-034 |
| MAP-264 | Cotizaciones | IVA configurable (`/admin/settings/pricing` → cotización) | Owner | `pricesIncludeTax=false`; tasa 8 % con IVA incluido | Sin IVA incluido el 16 % se suma («+IVA»); con tasa 8 % el desglose usa la tasa (bps) sin cambiar el total | P1 | QUO-038, QUO-039 |
| MAP-265 | Cotizaciones | `/cotizacion/[token]` (SENT) | Clienta (token) | Ver la propuesta | Título + CTA «Aceptar propuesta»; conceptos y totales en MXN = base; vigencia; sin costos, márgenes ni notas internas en HTML ni RSC; `viewedAt` + `VIEW_QUOTE` una sola vez | P0 | QPUB-001, SMK-031 |
| MAP-266 | Cotizaciones | `/cotizacion/[token]` · `acceptQuoteAction` | Clienta (token) | Aceptar con nombre y términos | Quote ACCEPTED; Booking (total, anticipo, firmante, términos, saldo vence −3 días); Event PENDING_PAYMENT con token de portal; lead WON; auditoría; avisos; `ACCEPT_QUOTE` | P0 | QPUB-002 |
| MAP-267 | Cotizaciones | `/cotizacion/[token]` · `rejectQuoteAction` → `/admin/quotes/[id]` | Clienta (token, móvil) → Owner | «No por ahora» → motivo → «Rechazar propuesta» → recargar; la fundadora abre la cotización | «Recibimos tu respuesta» sin botón de aceptar; REJECTED con motivo y fecha; sin Booking ni Event; actividad del lead con el folio (el lead sigue QUOTED); auditoría `quote.rejected`; aviso al equipo; el panel muestra «Rechazada» + motivo | P0 | QPUB-003, CRIT-003 |
| MAP-268 | Cotizaciones | `/cotizacion/[token]` (aceptar) | Clienta (token) | Datos inválidos | Formulario y backend exigen nombre + apellido y términos | P1 | QPUB-004 |
| MAP-269 | Cotizaciones | `/cotizacion/[token]` (vencida) | Clienta (token) | Abrir, aceptar o rechazar | Pantalla «expiró»; EXPIRED en base; acciones CONFLICT | P1 | QPUB-005 |
| MAP-270 | Cotizaciones | `/cotizacion/[token]` (ya aceptada) | Clienta (token) | Volver a aceptar o rechazar | CONFLICT; una sola reserva | P1 | QPUB-006 |
| MAP-271 | Cotizaciones | `/cotizacion/[token]` (rechazada) | Clienta (token) | Aceptar o volver a rechazar | CONFLICT / idempotente sin sobrescribir | P1 | QPUB-007 |
| MAP-272 | Cotizaciones | `/cotizacion/[token]` (versión reemplazada) | Clienta (token) | Aceptar desde una pestaña vieja | CONFLICT «se actualizó…» y refresca a la vigente; la v2 sí se acepta con el monto nuevo | P1 | QPUB-008 |
| MAP-273 | Cotizaciones | `/cotizacion/[token]` | Clienta (token) | Doble clic en «Aceptar» | Una reserva y un evento | P1 | QPUB-009 |
| MAP-274 | Cotizaciones | `/cotizacion/[token]` (token inválido, inexistente, de otro tipo o DRAFT) | Anónimo | Abrir, aceptar o rechazar | 404 genérico sin datos; acciones NOT_FOUND sin reserva | P1 | QPUB-010, PERM-187 |
| MAP-275 | Cotizaciones | `/cotizacion/[token]` (fecha ocupada) | Clienta (token) | Aceptar | «La fecha ya no está disponible»; sigue SENT; actividad + aviso «Fecha no disponible». Por diseño el panel no valida disponibilidad al cotizar/enviar: se valida al aceptar (M3-106: NOT APPLICABLE en el panel) | P1 | QPUB-011, M3-106 |
| MAP-276 | Cotizaciones | `/cotizacion/[token]` (vista de la fundadora) | Owner | Abrir la propuesta con sesión | No marca `viewedAt` | P3 | QPUB-012 |
| MAP-277 | Cotizaciones | `acceptQuoteAction` (respuesta) | Clienta (token) | Inspeccionar la respuesta | Sólo devuelve `portalToken` | P2 | QPUB-013 |
| MAP-278 | Cotizaciones | `/cotizacion/[token]` (accesibilidad) | Clienta (token) | axe y teclado en la propuesta y el diálogo de aceptar | 0 violaciones critical/serious; Enter abre el diálogo y enfoca el nombre; foco atrapado; Escape cierra y devuelve el foco al botón | P2 | QPUB-014, QPUB-015, A11Y-007, A11Y-028 |
| MAP-279 | Cotizaciones | Venta completa: `/admin/leads/[id]` → `/admin/quotes/new?leadId` → `/admin/quotes/[id]` → `/cotizacion/[token]` → `/pago/mock/[checkoutId]` → `/pago/resultado` → `/mi-evento/[token]` → `/admin/events/[id]` | Owner → Clienta (móvil) → Owner | Crear, calcular y enviar la cotización; la clienta acepta y paga el anticipo (mock); la fundadora abre el evento | DRAFT con base = precio de catálogo y totales del servidor; SENT + QUOTE_SENT; propuesta sin costos; ACCEPTED + Booking + Event PENDING_PAYMENT; lead WON; DEPOSIT PAID con `WebhookEvent` procesado; Event CONFIRMED + `event.confirmed_by_payment`; checklist instanciado; BOOKING_CONFIRMED + PAYMENT_RECEIVED; portal «¡Fecha confirmada!» con Pagado = anticipo y Saldo = total − anticipo; el panel muestra el saldo | P0 | CRIT-002 |
| MAP-280 | Pagos | `/cotizacion/[token]` → `/pago/mock/[checkoutId]` → `/pago/resultado` · `startCheckoutAction`, `mockCheckoutAction` | Clienta (token) | Pagar el anticipo en el checkout simulado | Payment PAID (monto = anticipo; comisión 3.6 % + $3); `WebhookEvent` firmado procesado; Event CONFIRMED + auditoría; `onEventConfirmed` (checklists, inventario); avisos BOOKING_CONFIRMED, PAYMENT_RECEIVED y al equipo; analítica; propuesta «Anticipo recibido»; portal accesible | P0 | PAY-001 |
| MAP-281 | Pagos | `/pago/mock/[checkoutId]` (rechazo) | Clienta (token) | Simular pago rechazado y reintentar | FAILED con motivo; el evento sigue pendiente; se genera un checkout nuevo | P0 | PAY-002 |
| MAP-282 | Pagos | `/pago/mock/[checkoutId]` (cancelar) | Clienta (token) | Cancelar en la pasarela | Regresa a la propuesta; el pago sigue PENDING | P1 | PAY-003 |
| MAP-283 | Pagos | `/pago/mock/[checkoutId]` (inexistente o malformado) | Anónimo | Abrir o accionar | 404 «No encontramos este pago»; NOT_FOUND / VALIDATION; un checkout existente → 200 | P1 | PAY-004, PERM-169 |
| MAP-284 | Pagos | `/pago/mock/[checkoutId]` (pagado) | Clienta (token) | Reabrir o reintentar un pago ya procesado | «Este pago ya fue procesado»; sin segundo cobro ni avisos; DEPOSIT_COVERED | P1 | PAY-005 |
| MAP-285 | Pagos | `startCheckoutAction` (reintento) | Clienta (token) | Iniciar de nuevo; dos solicitudes simultáneas | Reutiliza el pago pendiente; en paralelo no se duplica | P1 | PAY-006, PAY-019 |
| MAP-286 | Pagos | `startCheckoutAction` (request directo) | Anónimo | Token sin reserva o inexistente; `kind` inválido | NOT_FOUND genérico / VALIDATION; sin pagos | P1 | PAY-007 |
| MAP-287 | Pagos | `/pago/resultado` · `getPaymentStatusAction` | Clienta (token) · Anónimo | Firma ausente, inválida, alterada o de otro pago | 404 / NOT_FOUND sin datos de otro pago; firma válida → 200 | P1 | PAY-008, PERM-168 |
| MAP-288 | Pagos | `/pago/resultado` | Clienta (token) | Esperar el webhook | La página se actualiza sola a «¡Pago recibido!» | P1 | PAY-014 |
| MAP-289 | Pagos | `/api/webhooks/payments/[provider]` (`payment.failed`) | Proveedor | failed → succeeded → failed tardío | FAILED, luego PAID; el failed tardío se ignora | P1 | PAY-010 |
| MAP-290 | Pagos | `/api/webhooks/payments/[provider]` (monto menor) | Proveedor | Cobro parcial | No pasa a PAID; nota «Revisión manual», `amount_mismatch` y aviso | P1 | PAY-011 |
| MAP-291 | Pagos | `/api/webhooks/payments/[provider]` (`refund.succeeded`) | Proveedor | Reembolso parcial | PARTIAL_REFUND + fila REFUND + auditoría; idempotente | P2 | PAY-013 |
| MAP-292 | Pagos | `/pago/mock/[checkoutId]` (enlace > 1 h) | Clienta (token) | Pagar | «expiró»; CHECKOUT_EXPIRED; nuevo checkout distinto | P1 | PAY-015 |
| MAP-293 | Pagos | `/pago/mock/[checkoutId]` (saldo cambiado) | Clienta (token) | Pagar con un enlace viejo | «ya no está vigente»; CHECKOUT_STALE | P2 | PAY-016 |
| MAP-294 | Pagos | `startCheckoutAction` (reserva cancelada) | Clienta (token) | Iniciar pago | EVENT_CANCELLED; sin pagos | P1 | PAY-017 |
| MAP-295 | Pagos | `/mi-evento/[token]` → checkout BALANCE | Clienta (token) | Pagar el saldo desde el portal | Monto = total − anticipo; después NO_BALANCE | P2 | PAY-018 |
| MAP-296 | Pagos | Flag `PAYMENTS_ENABLED` apagado (global) | Clienta (token) | «Pagar anticipo» | Aviso de pausa; backend PAYMENTS_DISABLED sin pagos; al restaurar se puede pagar | P1 | PAY-020 |
| MAP-297 | Pagos | `/pago/mock/[checkoutId]`, `/pago/resultado` (accesibilidad) | Clienta (token) | axe WCAG 2.1 AA | 0 violaciones critical/serious | P2 | PAY-022, A11Y-008 |
| MAP-298 | Pagos | `/admin/events/[id]` (Pagos) · `recordManualPaymentAction` → `/mi-evento/[token]` | Owner → Clienta (token) | «Registrar pago manual» del anticipo o del saldo (transferencia, notas) | Anticipo: PAID manual, evento CONFIRMED y saldo recalculado. Saldo: BALANCE PAID con `recordedById` = fundadora, cobrado = total, panel sin saldo ni botón, portal Pagado = total, Saldo $0, «liquidada». Siempre auditoría `payment.manual_recorded` + PAYMENT_RECEIVED | P0 | EVT-025, CRIT-006 |
| MAP-299 | Pagos | `recordManualPaymentAction` (inválido) | Owner | Monto > saldo, fecha futura, < $1, decimales, evento cancelado o sin reserva (UI y backend) | Rechazo con mensaje; sin filas nuevas | P1 | EVT-026, EVT-027 |
| MAP-300 | Pagos | `/admin/events/[id]` (Pagos) · `refundPaymentAction` | Owner | Reembolso parcial o total de un pago cobrado | PARTIAL_REFUND / REFUNDED, fila REFUND, auditoría y saldo recalculado | P0 | EVT-028 |
| MAP-301 | Pagos | `refundPaymentAction` (inválido) | Owner | Reembolso mayor a lo disponible, de un pago pendiente, de una fila de reembolso o doble total | Rechazo; sin efectos | P1 | EVT-029 |
| MAP-302 | Pagos | `cancelEventAction` con checkout abierto → `/pago/mock/[checkoutId]` | Owner → Clienta (token) | Cancelar el evento con un pago PENDING de checkout y luego intentar pagar | El checkout deja de ser cobrable; nunca se registra PAID en un evento cancelado (`@regression` BUG-002) | P0 | EVT-024, PAY-021 |
| MAP-521 | Pagos | `cancelEventAction` → `/api/webhooks/payments/[provider]` (cobro tardío) → `/pago/resultado` | Owner → Proveedor → Clienta (token) | Con un checkout abierto, la fundadora cancela y la pasarela reporta el cobro igualmente (webhook firmado, repetido) | El cobro se registra PAID con la nota «Reembolso requerido»; el evento sigue CANCELLED; sin `event.confirmed_by_payment` ni avisos a la clienta; auditoría `payment.collected_after_cancellation`; un solo aviso «Revisar pago» al equipo; el reenvío es `duplicate`; la clienta ve «Recibimos tu pago, pero tu evento está cancelado» y el panel, «Reembolso requerido» | P1 | PAY-023 |
| MAP-522 | Pagos | `/pago/resultado` con el evento cancelado | Clienta (token) → Owner | (a) La fundadora cancela mientras la clienta espera la confirmación. (b) La clienta reabre el resultado de un anticipo pagado antes de la cancelación | (a) La página se actualiza sola a «Este pago se anuló», sin afirmar «No se realizó ningún cobro» ni ofrecer «Intentar de nuevo». (b) «¡Pago recibido!» con «Tu celebración está cancelada», sin nota de reembolso ni invitación a compartir | P1 | PAY-024, PAY-025 |
| MAP-303 | Eventos | `/admin/events` | Owner | Listar y filtrar por estado, periodo («Pasados») y búsqueda; «Limpiar filtros» | Filtros en URL compartible y resultados correctos; «Pasados» sólo completados; estado vacío «No hay eventos con estos filtros»; «Limpiar filtros» vuelve al listado sin filtros | P1 | EVT-001, EVT-002, EVT-038 |
| MAP-304 | Eventos | `/admin/events/[id]` (+ pestañas) | Owner | Ver el detalle y navegar Resumen / Invitadas / Operaciones / Finanzas / Memory | Encabezado y estado; pestaña activa con `aria-current`; «Cumpleaños de Sofía» con panel de Pagos | P1 | EVT-003, SMK-024 |
| MAP-305 | Eventos | `/admin/events/new` · `createEventAction`, `searchCustomersAction` | Owner | Alta manual con nueva clienta y con clienta existente (búsqueda) | Evento INQUIRY con tokens de 256 bits; clienta creada o vinculada sin duplicar; auditoría `event.created`; aparece en el listado | P0 | EVT-005, EVT-006 |
| MAP-306 | Eventos | `/admin/events/new` · `checkEventAvailabilityAction` | Owner | Disponibilidad en vivo (lleno, cerrado, pasado, fuera de horario, anticipación) | Indicador correcto; una fecha no disponible exige «Crear de todos modos» y el override se audita | P1 | EVT-007, EVT-010 |
| MAP-307 | Eventos | `/admin/events/new` (validaciones) | Owner | Formulario y request directo inválidos (clienta, título, fecha) | Errores por campo; la base no cambia | P1 | EVT-008, EVT-009 |
| MAP-308 | Eventos | `/admin/events/new` | Owner | Doble clic en «Crear evento» | Un solo evento | P3 | EVT-011 |
| MAP-309 | Eventos | `/admin/events/new` | Owner | Título con HTML | Se muestra escapado | P2 | EVT-012 |
| MAP-310 | Eventos | `/admin/events/[id]` · `updateEventAction` | Owner | Editar datos, reprogramar a una fecha llena, apagar/encender el micrositio | Persiste; `event.updated` con before/after en campos sensibles; la fecha llena pide confirmación; con el micrositio apagado el link de invitación deja de funcionar y al reactivarlo vuelve | P1 | EVT-013, EVT-014, EVT-016 |
| MAP-311 | Eventos | `updateEventAction` (COMPLETED / CANCELLED) | Owner | Reprogramar | `SCHEDULE_LOCKED` (409) y fecha de sólo lectura en la UI | P1 | EVT-015 |
| MAP-312 | Eventos | `/admin/events/[id]` · `transitionEventAction` | Owner | Confirmar un evento en consulta y recorrer los estados hasta «Completado» | Estado + auditoría; al confirmar se dispara `onEventConfirmed` (checklists e inventario) | P0 | EVT-017, EVT-018 |
| MAP-313 | Eventos | `transitionEventAction` (inválidas) | Owner | Transiciones no permitidas; confirmar en fecha llena | La UI sólo ofrece las válidas y el backend rechaza el resto (`INVALID_TRANSITION`); fecha llena → conflicto que sólo procede con confirmación explícita | P1 | EVT-019, EVT-020 |
| MAP-314 | Eventos | `/admin/events/[id]` · `cancelEventAction` | Owner | Cancelar con motivo y aviso; sin motivo; un evento completado | CANCELLED + booking cancelado + auditoría + notificación (sin el motivo interno) + portal y micrositio cancelados; sin motivo → `REASON_REQUIRED` (UI y backend); no aplica a completados | P0 | EVT-021, EVT-023 |
| MAP-315 | Eventos | `cancelEventAction` (con inventario reservado) | Owner | Cancelar | Reservas CANCELLED + movimientos RELEASE | P1 | EVT-022 |
| MAP-316 | Eventos | `/admin/events/[id]` · `rotateEventTokenAction` | Owner → Clienta / Invitada | Rotar el enlace del portal y la invitación general | El token anterior responde 404 y el nuevo funciona; los links personales siguen; auditoría sin el token completo | P0 | EVT-031, EVT-032, PERM-165 |
| MAP-317 | Eventos | `/admin/events/[id]` (programa) · `saveTimelineItemAction`, `deleteTimelineItemAction` | Owner | Agregar, editar y eliminar momentos (visibles / sólo equipo); ids de otro evento; título vacío | El micrositio sólo muestra los visibles y el portal todos; IDOR → NOT_FOUND; título vacío rechazado | P1 | EVT-033, EVT-034 |
| MAP-318 | Eventos | `/admin/events/[id]` (conversación) · `addAdminMessageAction` | Owner → Clienta (token) | Responder a la clienta con aviso | Mensaje ADMIN en la conversación + notificación; visible en su portal | P1 | EVT-035 |
| MAP-319 | Eventos | `/admin/events`, `/admin/events/new`, `/admin/events/[id]` (accesibilidad) | Owner | axe WCAG 2.1 AA | 0 violaciones critical/serious | P2 | EVT-037, A11Y-014 |
| MAP-520 | Eventos | `/admin/events?q=`, `/admin/quotes?q=` (búsqueda por teléfono) | Owner | Buscar a la clienta por su teléfono como «+52 1 55…», «(55) 1234-5678» y «55 1234 5678» | Encuentra su evento y su cotización en cualquier formato, tanto para un teléfono guardado con separadores (dato antiguo) como para uno canónico `+52…` | P2 | EVT-039 |
| MAP-320 | Calendario y disponibilidad | `/admin/calendar?month=` | Owner | Ver eventos del mes, capacidad por día y abrir un evento | Chip en la celda del día que abre el detalle; «Lleno / Cerrado / N libres»; H1 «Calendario» | P1 | CAL-001, SMK-025 |
| MAP-321 | Calendario y disponibilidad | `/admin/calendar` | Owner | Navegar con «Anterior», «Siguiente» y «Hoy» | Cambia el mes y la URL | P1 | CAL-002 |
| MAP-322 | Calendario y disponibilidad | `/admin/calendar?month=<inválido>` | Owner | Parámetro inválido o lejano | Vuelve al mes actual | P2 | CAL-003 |
| MAP-323 | Calendario y disponibilidad | `/admin/calendar` | Owner | Revisar cancelados y usar el «+» de un día abierto | Cancelados ocultos pero contados «(no se muestran)»; días cerrados «Cerrado»; «+» abre `/admin/events/new?date=` con la fecha | P2 | CAL-004, CAL-005 |
| MAP-324 | Calendario y disponibilidad | `/admin/calendar` · `createAvailabilityExceptionAction`, `deleteAvailabilityExceptionAction` (global) | Owner → Anónimo | Bloquear un día, blackout con motivo, capacidad especial; eliminar la excepción | Configurador y alta reflejan el cambio (el blackout explica el motivo); la capacidad especial admite el máximo configurado; al eliminar se reabre; auditoría | P1 | CAL-008, CAL-009, CAL-010 |
| MAP-325 | Calendario y disponibilidad | `/admin/calendar` (horario semanal) · `saveWeeklyRulesAction` (global) | Owner → Anónimo | Cerrar un día de la semana | Configurador CLOSED, alta bloqueada, calendario «Cerrado»; auditoría | P1 | CAL-012 |
| MAP-326 | Calendario y disponibilidad | Reglas y excepciones inválidas (global) | Owner | Excepción duplicada, en el pasado o capacidad sin máximo; horario con fin < inicio, día repetido o reglas de más | Rechazo en el formulario y en el backend; base intacta | P2 | CAL-011, CAL-013 |
| MAP-327 | Calendario y disponibilidad | `/admin/calendar` (accesibilidad) | Owner | axe WCAG 2.1 AA | 0 violaciones critical/serious | P2 | CAL-007, A11Y-015 |
| MAP-328 | Portal de la clienta | `/mi-evento/[token]` (evento confirmado) | Clienta (token) | Ver evento, pago, invitadas y programa | H1 del evento con secciones Pago e Invitadas; datos correctos, sin notas internas ni datos de otros eventos; noindex | P0 | PORT-001, SMK-032 |
| MAP-329 | Portal de la clienta | `/mi-evento/[token]` (PENDING_PAYMENT) | Clienta (token) | Ver el anticipo pendiente | CTA «Pagar anticipo · $X» con X = anticipo − pagado | P1 | PORT-002 |
| MAP-330 | Portal de la clienta | `/mi-evento/[token]/resumen` | Clienta (token) | Abrir el resumen imprimible | Datos del evento listos para imprimir | P2 | PORT-004 |
| MAP-331 | Portal de la clienta | `/mi-evento` · `requestPortalAccessAction` | Anónimo | Pedir el enlace por correo; correo inválido | Respuesta neutral; PORTAL_ACCESS sólo a correos registrados (sin enumeración); correo inválido rechazado en formulario y backend | P1 | PORT-005, PORT-006 |
| MAP-332 | Portal de la clienta | `/mi-evento/[token]` · `updatePreferencesAction` | Clienta (token) | Guardar preferencias válidas e inválidas (playlist, colores, enlace `javascript:`) | Persisten, mensaje SYSTEM al equipo, auditoría y reflejo en la invitación; inválidas rechazadas | P1 | PORT-007, PORT-008 |
| MAP-333 | Portal de la clienta | `/mi-evento/[token]` · `updateAddressAction` | Clienta (token) | Editar la dirección a más y a menos de 48 h | > 48 h: persiste con auditoría; < 48 h: `ADDRESS_LOCKED` (UI y backend) | P1 | PORT-009, PORT-010 |
| MAP-334 | Portal de la clienta | `/mi-evento/[token]` · `sendHostMessageAction` | Clienta (token) | Enviar mensaje al equipo | Aparece en la conversación del panel + aviso al equipo | P0 | PORT-011 |
| MAP-335 | Portal de la clienta | `/mi-evento/[token]` · `addHostGuestAction`, `removeHostGuestAction` | Clienta (token) | Agregar y quitar invitadas; duplicados, contactos inválidos y más de 60 | Invitadas HOST + PENDING; sólo puede quitar pendientes que ella agregó; duplicados/ inválidos rechazados; `GUEST_LIMIT` en 60 | P1 | PORT-012, PORT-013, PORT-014 |
| MAP-336 | Portal de la clienta | `/mi-evento/[token]` · `submitReviewAction` | Clienta (token) | Opinar tras COMPLETED (dos veces) y antes de completar | Review creada una sola vez (2.º envío CONFLICT); antes de completar `REVIEW_NOT_AVAILABLE` (UI y backend) | P1 | PORT-017, PORT-018 |
| MAP-337 | Portal de la clienta | `/mi-evento/[token]` (evento cancelado) | Clienta (token) | Ver e intentar cambios | Aviso amable de cancelación; acciones `EVENT_CLOSED` | P1 | PORT-016 |
| MAP-338 | Portal de la clienta | `/mi-evento`, `/mi-evento/[token]` (seguridad de contenido y accesibilidad) | Clienta (token) | Preferencias con HTML; axe WCAG 2.1 AA | HTML escapado en portal e invitación; 0 violaciones critical/serious | P2 | PORT-019, PORT-020, A11Y-009 |
| MAP-523 | Portal de la clienta | `/mi-evento` antes de hidratar · `requestPortalAccessAction` | Anónimo (móvil) | Escribir el correo mientras el chunk de la página aún no llega; pulsar Enter o clic en «Enviarme mi enlace»; hidrata; enviar | Lo escrito no se borra y el enlace llega; antes de hidratar no hay envío nativo por GET: el correo nunca termina en la URL (botón deshabilitado con `aria-busy` y `method="post"`) | P1 | PORT-021, PORT-023 |
| MAP-524 | Portal de la clienta | `/mi-evento/[token]` antes de hidratar · `sendHostMessageAction`, `updateAddressAction`, `submitReviewAction` | Clienta (token) | Con el JS retenido, escribir un mensaje, la dirección (evento sin dirección) y la opinión (evento COMPLETED); pulsar Enter o los botones; hidrata; enviar | El mensaje escrito antes de hidratar no se borra y llega al equipo; ningún formulario se envía por GET: dirección, mensaje y comentario nunca terminan en la URL; tras hidratar se guardan normal | P0 | PORT-022, PORT-024, PORT-025 |
| MAP-339 | Invitadas y RSVP | `/admin/events/[id]/guests` · `saveGuestAction`, `deleteGuestAction` | Owner | Agregar, editar (RSVP, acompañante, dieta) y quitar invitadas | Link personal generado; resumen actualizado; auditoría `guest.rsvp_changed` / `guest.deleted`; tras la baja el link personal responde 404 | P1 | GST-001, GST-002, GST-003 |
| MAP-340 | Invitadas y RSVP | `/admin/events/[id]/guests` · `saveGuestAction` (inválidos) | Owner | Contacto duplicado; datos inválidos; invitada de otro evento (IDOR) | Aviso confirmable `DUPLICATE_GUEST`; rechazo por campo; NOT_FOUND cruzado | P2 | GST-004, GST-005 |
| MAP-341 | Invitadas y RSVP | `/api/events/[id]/guests.csv` | Owner · Staff · Anónimo | Exportar CSV de invitadas | Anónimo 401, Staff 403 (incluso de su evento), evento inexistente 404; Owner 200 con BOM, columnas, fórmulas neutralizadas y auditoría `guests.exported` | P0 | API-071, GST-006 |
| MAP-342 | Invitadas y RSVP | `/admin/events/[id]/guests` · `sendRsvpRemindersAction` | Owner | Enviar recordatorios a pendientes; en evento cancelado o con micrositio apagado | RSVP_REMINDER por canal, uno por día, auditoría; bloqueado en cancelado / micrositio apagado (UI y backend) | P1 | GST-007, GST-008 |
| MAP-343 | Invitadas y RSVP | `/admin/events/[id]/guests` · `moderateHonoreeMessageAction` | Owner | Ocultar y mostrar un mensaje para la homenajeada | `hidden` + auditoría; el conteo del portal se actualiza | P2 | GST-009 |
| MAP-344 | Invitadas y RSVP | `/e/[slug]/[token]` (link personal) · `submitRsvpAction` | Invitada (token) | Confirmar con acompañante y restricción; declinar y cambiar con «Editar mi respuesta»; editar sin cambiar «No podré ir» | Respuesta persistida y confirmación visible; la dirección exacta sólo al confirmar; se refleja en panel y portal; con «No podré ir» guarda aunque las notas para la cocina sigan ocultas | P0 | GST-011, GST-012, GST-027 |
| MAP-345 | Invitadas y RSVP | `/e/[slug]/[token]` (link general) | Invitada (token) | Registrarse sola | Invitada SELF_RSVP y redirección a su link personal | P1 | GST-013 |
| MAP-346 | Invitadas y RSVP | `/e/[slug]/[token]` (link general) | Invitada (token) | Escribir el nombre de otra invitada | No sobrescribe su respuesta ni entrega su link personal: crea una sola invitada `SELF_RSVP` nueva y la lleva a *su* link; los datos de la original (nombre, email, restricciones, nota y comentario) quedan intactos (`@regression` BUG-003) | P0 | GST-014 |
| MAP-347 | Invitadas y RSVP | `/e/[slug]/[token]` (mensaje a la homenajeada) | Invitada (token) | Crear y editar el mensaje | Un mensaje HONOREE por invitada que se actualiza al editar; sorpresa (no visible en el portal) | P1 | GST-015 |
| MAP-348 | Invitadas y RSVP | `/e/[slug]/[token]/calendar.ics` | Invitada (token) | Descargar el .ics | `text/calendar` con el evento; dirección sólo si confirmó; 404 si el evento está cancelado o el token es ajeno, rotado o inválido | P1 | GST-016, PERM-171 |
| MAP-349 | Invitadas y RSVP | `/e/[slug]/[token]` (privacidad) | Invitada (token) | Revisar el HTML | Sin dirección exacta antes de confirmar, sin datos de otras invitadas; correo enmascarado | P1 | GST-018 |
| MAP-350 | Invitadas y RSVP | `/e/[slug]/[token]` (validaciones y límites) · `submitRsvpAction` | Invitada (token) | Envíos inválidos; registro número 61 con el link general; 11 respuestas por el link general desde la misma IP en 10 min | Errores de campo (formulario y backend); `GUEST_LIMIT` en 60; la 11.ª responde `RATE_LIMITED` y no crea invitada (suite `ratelimit`) | P2 | GST-019, GST-021, GST-024 |
| MAP-351 | Invitadas y RSVP | `/e/[slug]/[token]` (evento cerrado) | Invitada (token) | Responder en evento COMPLETED o CANCELLED | `RSVP_CLOSED` / `EVENT_CANCELLED` (UI y backend) | P1 | GST-020 |
| MAP-352 | Invitadas y RSVP | `/e/[slug]/[token]` (invitación sembrada de Sofía / Camila) | Invitada (token) | Abrir la invitación general y el RSVP personal | Micrositio correcto y RSVP personal prellenado | P0 | SMK-033, GST-022 |
| MAP-525 | Invitadas y RSVP | `/e/[slug]/[token]` (link general) · `submitRsvpAction` → `/admin/events/[id]/guests`, `/mi-evento/[token]` | Invitada (token) → Owner · Clienta (token) | Responder (replay) con el nombre de otra invitada y, aparte, con su email | El link general pide a quien ya tiene link personal que responda desde ahí. La original no cambia y su token nunca aparece en la respuesta; se crean 2 `SELF_RSVP` con su propio link; 2 auditorías `guest.possible_duplicate` con `matchedGuestIds`; en el panel y en el portal las 2 nuevas dicen «Posible duplicado» y «Coincide con «…»», y la original no lleva la marca (`@regression` BUG-003) | P1 | GST-023 |
| MAP-526 | Invitadas y RSVP | `/mi-evento/[token]` → `/e/[slug]/[token]` (link general) → `/admin/events/[id]/guests` | Clienta (token) → Invitada (token) → Owner | La anfitriona agrega a una amiga (pendiente); la amiga responde por el link general; la anfitriona quita el registro pendiente | El portal sugiere quitar el registro pendiente (no «escríbenos») y el panel muestra con quién coincide; al quitar el pendiente desaparece la marca | P2 | GST-025 |
| MAP-527 | Invitadas y RSVP | `/e/[slug]/[token]` antes de hidratar · `submitRsvpAction` | Invitada (token, móvil) | Con el JS de la página retenido, escribir nombre y correo; pulsar Enter o «Enviar mi respuesta»; hidrata; «¡Sí, ahí estaré!» y enviar | Lo escrito no se borra y se guarda con su respuesta; antes de hidratar no hay envío nativo por GET: nombre y correo nunca terminan en la URL | P0 | GST-026, GST-028 |
| MAP-353 | Invitadas y RSVP | `/e/[slug]/[token]` (accesibilidad) | Invitada (token) | axe; elegir respuesta sólo con teclado | 0 violaciones critical/serious; radios con Espacio/flechas, foco visible, labels asociados | P1 | A11Y-010, A11Y-022 |
| MAP-354 | Invitadas y RSVP | Anfitriona → invitada → panel: `/mi-evento/[token]` → `/e/[slug]/[token]` → `/admin/events/[id]/guests` | Clienta (token, móvil) → Invitada (token, móvil) → Owner | La anfitriona agrega una invitada; la invitada confirma; la fundadora y la anfitriona revisan | Toast «Agregamos a…»; `EventGuest` HOST/PENDING; «¡Gracias…! Te esperamos»; ATTENDING + `respondedAt` sin duplicados; panel «Asiste»; portal «Asiste» | P0 | CRIT-004 |
| MAP-355 | Memory Capsule | `/admin/events/[id]/memory` · `createCapsuleAction`, `updateCapsuleAction` | Owner | Crear la cápsula (en preparación) y publicarla; cápsula duplicada, título corto o inexistente | En preparación: enlace con aviso y sin fotos; publicada: título y mensaje públicos; auditoría; inválidas rechazadas en el backend | P1 | MEM-001, MEM-002, MEM-003 |
| MAP-356 | Memory Capsule | `/admin/events/[id]/memory` · `rotateShareTokenAction` | Owner | Generar un nuevo enlace | El enlace anterior responde 404; auditoría con pista de 4 caracteres (sin el token); una cápsula no publicada no muestra fotos ni mensajes | P1 | MEM-004, PERM-166 |
| MAP-357 | Memory Capsule | `/admin/events/[id]/memory` · `setMediaApprovalAction`, `setCoverAction`, `deleteCapsuleMediaAction` | Owner | Aprobar, ocultar, elegir portada y eliminar fotos | La galería pública refleja cada cambio con URL firmada; portada de una foto oculta la aprueba; eliminar borra base y almacenamiento (la URL firmada deja de servir); auditoría | P1 | MEM-005, MEM-006, MEM-007, MEM-008 |
| MAP-358 | Memory Capsule | `/admin/events/[id]/memory` · `setMessageHiddenAction` | Owner | Ocultar y mostrar mensajes del libro | El muro público refleja el cambio; auditoría | P1 | MEM-009 |
| MAP-359 | Memory Capsule | `/admin/events/[id]/memory` (subida del equipo vía `/api/media/upload`) | Owner | Subir un PNG | Publicada aprobada con `uploadedBy` | P2 | MEM-010 |
| MAP-360 | Memory Capsule | Moderación de la cápsula (IDOR) | Owner | Usar ids de foto o mensaje de otro evento | NOT_FOUND | P1 | MEM-012 |
| MAP-361 | Memory Capsule | `/memory/[token]` · `submitGuestbookMessageAction` | Invitada (token) | Dejar un mensaje en el libro de visitas | Mensaje GUESTBOOK visible en el muro y en la moderación | P0 | MEM-013 |
| MAP-362 | Memory Capsule | `/api/memory/[token]/upload` | Invitada (token) | Subir una foto con consentimiento | 201; `MediaAsset` PRIVATE con `approved=false` y autora; no visible hasta aprobarla | P0 | MEM-014, API-068 |
| MAP-363 | Memory Capsule | `/api/memory/[token]/upload` (rechazos) | Anónimo | Tipo falso, PDF, sin consentimiento, `Origin` ajeno, token inexistente o rotado, cápsula no publicada | 422 / 400 / 403 / 404 sin `MediaAsset` ni archivos | P1 | MEM-015, API-068, PERM-188 |
| MAP-364 | Memory Capsule | `/memory/[token]` · `submitGuestbookMessageAction` (rechazos) | Anónimo | Cápsula en preparación o inexistente, token inválido, mensaje vacío, HTML | NOT_FOUND / errores de campo (publicada → se crea); HTML escapado | P1 | MEM-016, PERM-186 |
| MAP-365 | Memory Capsule | `/memory/[token]` (cápsula sembrada de Valeria) | Invitada (token) · Clienta (token) | Abrir la cápsula pública y desde el portal | Título + libro de visitas; acceso desde su portal | P0 | SMK-034, MEM-018 |
| MAP-366 | Memory Capsule | `/memory/[token]` (aislamiento) | Anónimo | Revisar la galería pública; token inválido | Sólo lo aprobado y visible; token inválido 404 | P1 | MEM-017 |
| MAP-367 | Memory Capsule | `/memory/[token]` (accesibilidad) | Invitada (token) | axe WCAG 2.1 AA | 0 violaciones critical/serious | P2 | MEM-019, A11Y-011 |
| MAP-368 | Memory Capsule | Flag `MEMORY_CAPSULE_ENABLED=false` (global) | Anónimo · Owner · Clienta (token) | Abrir la cápsula, subir, escribir en el libro, abrir el panel y el portal | Aviso amable; 404 / NOT_FOUND; alerta en el panel; sin enlace en el portal | P1 | MEM-020 |
| MAP-528 | Memory Capsule | `/memory/[token]` antes de hidratar (libro de visitas y subida de fotos) | Invitada (token, móvil) | Con el chunk de la página retenido, escribir nombre y mensaje; hidrata; enviar y preparar la subida | Lo escrito no se borra; la subida se habilita y el mensaje queda en la base. En WebKit es NOT APPLICABLE (no revela el contenido en streaming mientras falta un script); CRIT-008 cubre WebKit de punta a punta | P0 | MEM-021 |
| MAP-369 | Memory Capsule | Cápsula de punta a punta: `/memory/[token]` → `/admin/events/[id]/memory` → `/memory/[token]` | Invitada (token, móvil) → Owner → Anónimo | Mensaje + foto con consentimiento; la fundadora aprueba; el público recarga | Mensaje visible; `MediaAsset` PRIVATE `approved=false` con autora; la foto no se ve antes de moderar; «Foto aprobada» → `approved=true`; galería pública con 1 foto cargada (alt con la autora) | P0 | CRIT-008 |
| MAP-370 | Operaciones | `/admin/operations` | Owner | Abrir el tablero y entrar a una orden de producción | Eventos de los próximos 14 días con enlace a su orden de producción | P1 | OPS-001 |
| MAP-371 | Operaciones | `/admin/operations` (tareas vencidas) | Owner | Revisar tareas vencidas | Aparecen en el tablero con enlace al checklist del evento | P2 | OPS-021 |
| MAP-372 | Operaciones | `/admin/events/[id]/operations` · `instantiateChecklistAction` | Owner | «Generar desde plantillas» dos veces | Crea las tareas activas una sola vez (idempotente) | P0 | OPS-002 |
| MAP-373 | Operaciones | `instantiateChecklistAction` (evento cancelado) | Owner | Replay con el id de un evento cancelado | Botón oculto y backend CONFLICT | P1 | OPS-003 |
| MAP-374 | Operaciones | `/admin/events/[id]/operations` (checklist) · `createChecklistItemAction` | Owner | Agregar tarea personalizada; título corto | Se guarda con fase, área y evidencia y persiste al recargar; < 3 caracteres se rechaza sin registro | P1 | OPS-004, OPS-005 |
| MAP-375 | Operaciones | `/admin/events/[id]/operations` (checklist) · `updateChecklistItemAction` | Owner | Pendiente → Hecho → Pendiente | Hecho registra fecha y autora; reabrir las limpia | P1 | OPS-006 |
| MAP-376 | Operaciones | `updateChecklistItemAction` (evidencia obligatoria) | Owner | Marcar Hecho sin foto (UI y replay con status DONE) | No se puede cerrar sin evidencia | P1 | OPS-007 |
| MAP-377 | Operaciones | `/admin/events/[id]/operations` (detalles de tarea) | Owner | Guardar responsable, notas y fecha límite | Se guardan por separado; las notas no se borran | P2 | OPS-008 |
| MAP-378 | Operaciones | `/admin/events/[id]/operations` · `deleteChecklistItemAction` | Owner | Eliminar una tarea | Desaparece del checklist y queda en auditoría | P1 | OPS-009 |
| MAP-379 | Operaciones | `/admin/events/[id]/operations` (staff) · `createAssignmentAction` → `/staff/events/[id]` | Owner → Staff | Asignar a Lupita y abrir el enlace del aviso | Asignación con su tarifa; STAFF_ASSIGNED en `NotificationLog`; el enlace lleva a `/staff/events/<id>` | P0 | OPS-010 |
| MAP-380 | Operaciones | `createAssignmentAction` (duplicado) | Owner | Asignar dos veces a la misma persona con la misma función (UI y replay) | Rechazado; sin asignación duplicada | P2 | OPS-011, OPS-030 |
| MAP-381 | Operaciones | `createAssignmentAction` (horario) | Owner | Asignar con horario invertido | La salida debe ser posterior a la entrada | P2 | OPS-012 |
| MAP-382 | Operaciones | `/admin/events/[id]/operations` (staff) · `setAssignmentFlagsAction` | Owner | Switches «Confirmada» y «Pagada» | Persisten; el pago queda auditado | P1 | OPS-013 |
| MAP-383 | Operaciones | `/admin/events/[id]/operations` (staff) · `updateAssignmentAction` | Owner | Editar función y monto acordado | Cambia en centavos y se audita | P1 | OPS-014 |
| MAP-384 | Operaciones | `/admin/events/[id]/operations` (staff) · `deleteAssignmentAction` → `/staff/events/[id]` | Owner → Staff | Quitar a Lupita; ella abre el evento | Sus tareas abiertas se liberan y deja de ver el evento | P1 | OPS-015 |
| MAP-385 | Operaciones | `/admin/events/[id]/operations` (transporte y montaje) · `updateLogisticsAction` | Owner | Guardar salida, montaje y desmontaje; montaje posterior al inicio | Persisten en hora CDMX con auditoría; montaje 13:00 para evento de 12:00 → rechazo del servidor sin cambios | P1 | OPS-016, OPS-017 |
| MAP-386 | Operaciones | `/admin/events/[id]/operations` (add-ons) · `updateAddOnNotesAction` → `/staff/events/[id]` | Owner → Staff | Guardar notas operativas de un add-on | Se guardan y el staff asignado las ve en su portal | P2 | OPS-018 |
| MAP-387 | Operaciones | `/admin/events/[id]/operations` (evento cancelado) | Owner | Abrir la orden de producción | Sólo referencia: sin asignar ni editar logística | P2 | OPS-019 |
| MAP-388 | Operaciones | `/admin/operations/templates`, `/admin/operations/templates/[id]` | Owner | Abrir la lista y el detalle | Plantillas del seed agrupadas por fase; el detalle muestra sus tareas | P1 | OPS-022 |
| MAP-389 | Operaciones | `/admin/operations/templates` · `createTemplateAction` | Owner | Nueva plantilla (Activa = no) | Redirige a su detalle, persiste y se audita | P1 | OPS-023 |
| MAP-390 | Operaciones | `/admin/operations/templates/[id]` · `updateTemplateAction` | Owner | Editar nombre, orden y descripción | Persiste y se audita | P1 | OPS-024 |
| MAP-391 | Operaciones | `/admin/operations/templates/[id]` · `createTemplateItemAction`, `updateTemplateItemAction`, `deleteTemplateItemAction` | Owner | Agregar tarea con desfase, editarla y eliminarla; desfase de 400 días | Cambios auditados; el desfase máximo es 365 días (validación del servidor) | P1 | OPS-025, OPS-026 |
| MAP-392 | Operaciones | `/admin/operations/templates/[id]` · `deleteTemplateAction` | Owner | Eliminar una plantilla | Borra sus tareas modelo, regresa a la lista y se audita | P1 | OPS-027 |
| MAP-393 | Operaciones | Plantilla activa vs. inactiva | Owner | Generar en el evento A, desactivar la plantilla y generar en el evento B | Activa se copia; desactivada deja de copiarse | P1 | OPS-029 |
| MAP-394 | Operaciones | Asignación → portal staff → orden de producción: `/admin/events/[id]/operations` → `/login` → `/staff` → `/staff/events/[id]` | Owner → Staff nuevo (móvil) → Owner | Asignar a un integrante nuevo; el staff entra, intenta un evento ajeno y `/admin`, y marca su tarea; la fundadora recarga | Asignación + auditoría + STAFF_ASSIGNED con ruta real; el staff ve SÓLO su evento; evento ajeno «No encontramos este evento»; `/admin` → `/staff`; tarea DONE con `completedById`; el panel muestra «Hecho» | P0 | CRIT-005 |
| MAP-395 | Portal staff | `/staff` | Staff (Lupita) | Abrir «Mis próximos eventos» | Sólo sus eventos asignados (Sofía y Daniela), ninguno ajeno (no Mariana) | P0 | PERM-100, STF-001, SMK-030 |
| MAP-396 | Portal staff | `/staff` | Staff (Carlos) | Abrir su lista; comparar con un evento asignado sólo a Lupita | Ve sus eventos asignados y no los ajenos | P0 | PERM-102, STF-002 |
| MAP-397 | Portal staff | `/staff/events/[id]` (evento NO asignado) | Staff | Abrir por URL | «No encontramos este evento» sin datos del evento | P0 | PERM-101, STF-008 |
| MAP-398 | Portal staff | `/staff`, `/staff/events/[id]` (evento cancelado) | Staff | Abrir un evento asignado pero CANCELADO | Deja de aparecer y no se puede abrir | P1 | PERM-103, STF-023 |
| MAP-399 | Portal staff | `/staff/events/[id]` (id inexistente o malformado) | Staff | Abrir | No encontrado, sin error 500 | P2 | PERM-104 |
| MAP-400 | Portal staff | `/staff/events/[id]` (vista staff) | Owner · SuperAdmin | Abrir la vista staff de cualquier evento | Se ve sin montos | P2 | PERM-105 |
| MAP-401 | Portal staff | `/staff/events/[id]` (equipo y datos) | Staff (coordinación y chef) | Revisar horario, equipo y contacto | Horario y equipo visibles, nunca montos; el teléfono de la clienta sólo para coordinación/chofer | P1 | STF-009 |
| MAP-402 | Portal staff | `/staff/events/[id]` · `staffUpdateChecklistItemAction` → `/admin/events/[id]/operations` | Staff → Owner | «Marcar como hecha»; la fundadora revisa la orden de producción | Persiste y la fundadora la ve completada por Lupita | P0 | STF-003 |
| MAP-403 | Portal staff | `/staff/events/[id]` · `staffUpdateChecklistItemAction` | Staff | Empezar, volver a pendiente y reabrir | El estado cambia en la base | P1 | STF-004 |
| MAP-404 | Portal staff | `/staff/events/[id]` (nota) → `/admin/events/[id]/operations` | Staff → Owner | Agregar nota para coordinación | Se guarda y la fundadora la ve en los detalles de la tarea | P1 | STF-005 |
| MAP-405 | Portal staff | `/staff/events/[id]` (tarea de otra persona del mismo evento) | Staff | Intentar cambiarla (UI y replay) | Sólo lectura en la UI; el backend rechaza el cambio | P1 | PERM-111, STF-006 |
| MAP-406 | Portal staff | `/staff/events/[id]` (evidencia obligatoria) | Staff | Marcar como hecha sin foto | No se permite sin evidencia | P1 | STF-007 |
| MAP-407 | Portal staff | `/staff/events/[id]` (evidencia) · `/api/media/upload` | Staff | Tomar o subir la foto obligatoria y marcar como hecha | La foto queda ligada a la tarea y entonces sí se cierra | P1 | STF-010 |
| MAP-408 | Portal staff | `staffUpdateChecklistItemAction` (IDOR) | Staff (Lupita, Carlos) | Replay con el id de una tarea de un evento NO asignado | FORBIDDEN y la base no cambia | P0 | PERM-110, PERM-113 |
| MAP-409 | Portal staff | `staffUpdateChecklistItemAction` (omitir) | Staff | Marcar como SKIPPED una tarea propia | Rechazado (omitir es sólo del panel) | P2 | PERM-112 |
| MAP-410 | Portal staff | `staffUpdateChecklistItemAction` (evidencia ajena) | Staff | Adjuntar como evidencia una foto subida por otra persona | Rechazado | P1 | PERM-114 |
| MAP-411 | Portal staff | `staffUpdateChecklistItemAction` (tarea inexistente) | Staff · Anónimo | Replay con id inexistente; sin sesión | NOT_FOUND controlado; anónimo → login | P2 | PERM-115 |
| MAP-412 | Portal staff | `/staff/events/[id]` (superficie) | Staff | Inventariar las acciones que importa la página | La página expone acciones de admin de staff (superficie documentada; protegidas por permiso) | P2 | PERM-120 |
| MAP-413 | Portal staff | `/staff/events/[id]` · `resetStaffPasswordAction`, `setStaffAccessActiveAction`, `createStaffAccessAction`, `createStaffMemberAction`, `updateStaffMemberAction`, `deleteStaffMemberAction` | Staff | Ejecutar cada acción de administración desde el portal | FORBIDDEN y sin cambios | P0 | PERM-121, PERM-122, PERM-123, PERM-124, PERM-125, PERM-126 |
| MAP-414 | Portal staff | `/staff/events/[id]` (control positivo) | Owner | Ejecutar la misma acción con OWNER | Se ejecuta (la protección es por permiso) | P2 | PERM-127 |
| MAP-415 | Portal staff | `/staff`, `/staff/events/[id]` (responsive) | Staff | 390×844, 768×1024, 1366×768, 1440×900 | Sin scroll horizontal; tarjeta de evento usable y CTA visible | P1 | STF-011, RESP-020 |
| MAP-416 | Portal staff | `/staff`, `/staff/events/[id]` (accesibilidad) | Staff | axe WCAG 2.1 AA; «Agregar nota» y «Cancelar» sólo con teclado | 0 violaciones critical/serious en lista y detalle con checklist; «Agregar nota» lleva el foco al campo (sin `aria-controls` roto) y «Cancelar» lo regresa al botón sin guardar (`@regression` BUG-011) | P2 | STF-024, A11Y-016, STF-025 |
| MAP-417 | Equipo (staff) | `/admin/staff` | Owner | Buscar y filtrar por estado | Muestra al equipo y filtra por nombre y estado | P1 | STF-012 |
| MAP-418 | Equipo (staff) | `/admin/staff/new` · `createStaffMemberAction` | Owner | «Agregar al equipo» | Guarda tarifa en centavos, días y función; auditoría | P1 | STF-013 |
| MAP-419 | Equipo (staff) | `/admin/staff/new` (validaciones) | Owner | Nombre, teléfono o correo inválidos | Errores de campo; sin registro | P2 | STF-014 |
| MAP-420 | Equipo (staff) | `/admin/staff/[id]` · `updateStaffMemberAction` | Owner | Editar tarifa y tipo; desactivar; luego asignar en un evento | Persiste; desactivado deja de ofrecerse al asignar | P1 | STF-015 |
| MAP-421 | Equipo (staff) | `/admin/staff/[id]` · `deleteStaffMemberAction` | Owner | Eliminar integrante sin historial; replay con uno con asignaciones | Sin historial: se borra y se audita; con historial: botón oculto y backend CONFLICT. Con una ficha ligada a una cuenta, eliminarla desactiva y revoca esa cuenta y aplica las reglas de Usuarios: una OWNER recibe FORBIDDEN sobre una SUPER_ADMIN y CONFLICT sobre sí misma, sin borrar nada; no se ofrece sobre la propia ficha (integración `operations-staff.test.ts`, sin ID E2E) | P1 | STF-016, STF-017 |
| MAP-422 | Equipo (staff) | `/admin/staff/[id]` · `createStaffAccessAction` → `/login` → `/staff` | Owner → Staff | «Crear acceso» y entrar con la cuenta nueva | Cuenta STAFF ligada a la ficha que inicia sesión en `/staff` | P0 | STF-018 |
| MAP-423 | Equipo (staff) | `createStaffAccessAction` (correo existente) | Owner | Crear acceso con el correo de Lupita | Rechazado: el correo ya tiene cuenta | P1 | STF-019 |
| MAP-424 | Equipo (staff) | `/admin/staff/[id]` · `resetStaffPasswordAction` | Owner → Staff | Restablecer contraseña; probar la vieja y la nueva | La anterior deja de servir y la nueva entra; las sesiones abiertas de esa cuenta se cierran (ver MAP-510 y MAP-511) | P1 | STF-020 |
| MAP-425 | Inventario | `/admin/inventory?q=` | Owner | Listar y buscar por SKU | Artículos con indicadores; la búsqueda filtra; el artículo activo sembrado aparece | P1 | INV-001, SMK-026 |
| MAP-426 | Inventario | `/admin/inventory` (filtros en el cliente) | Owner | Escribir en «Buscar» y activar «Incluir inactivos» | La URL y la lista se actualizan sin recargar | P1 | INV-025 |
| MAP-427 | Inventario | `/admin/inventory` · `createInventoryItemAction` | Owner | «Nuevo artículo» | SKU en mayúsculas, movimiento de alta y auditoría; aparece al recargar | P1 | INV-002 |
| MAP-428 | Inventario | `createInventoryItemAction` (validaciones) | Owner | SKU existente en minúsculas; SKU inválido y nombre vacío | SKU único sin distinguir mayúsculas (no duplica); formato de SKU y nombre validados en formulario y backend | P2 | INV-003, INV-004 |
| MAP-429 | Inventario | `/admin/inventory/[id]` · `updateInventoryItemAction` | Owner | Editar un artículo | Cambia datos sin tocar cantidades; audita sólo lo que cambió | P1 | INV-005 |
| MAP-430 | Inventario | `/admin/inventory` (inactivos) · `addReservationAction` | Owner | Incluir inactivos; replay de reservar un artículo inactivo | El inactivo se oculta del listado y el backend no permite reservarlo | P1 | INV-006 |
| MAP-431 | Inventario | `/admin/inventory/[id]` · `adjustStockAction` (entrada) | Owner | Entrada por compra +5 | Suma al total, registra el movimiento y audita | P0 | INV-007 |
| MAP-432 | Inventario | `adjustStockAction` (pérdida) | Owner | Pérdida de 50 con 6 utilizables; replay con LOSS 999 | Bloqueado en la UI y en el backend (nunca negativo) | P1 | INV-008 |
| MAP-433 | Inventario | `adjustStockAction` (mantenimiento y conteo) | Owner | Enviar 3 a mantenimiento, regresar 1, ajuste −2 | Se mantiene 0 ≤ mantenimiento ≤ total | P1 | INV-009 |
| MAP-434 | Inventario | `/admin/inventory/[id]` (stock bajo) | Owner | Llegar al umbral y reponer | El indicador aparece en el umbral y desaparece al reponer | P1 | INV-010 |
| MAP-435 | Inventario | `/admin/inventory/events/[eventId]` · `addReservationAction` | Owner | Agregar un artículo al evento; agregar uno ya reservado | Crea la reserva y su movimiento; no se puede reservar dos veces el mismo artículo | P1 | INV-011, INV-024 |
| MAP-436 | Inventario | `/admin/inventory/events/[eventId]` · `updateReservationQuantityAction` | Owner | Editar cantidad 3 → 7 | Registra el delta y lo audita | P1 | INV-012 |
| MAP-437 | Inventario | `/admin/inventory/events/[eventId]` · `checkOutReservationAction`, `returnReservationAction` | Owner | Entregar y registrar regreso (4 buenas + 1 dañada); suma incorrecta | Reserva RETURNED, baja del total y auditoría de merma; buenas + dañadas deben sumar lo entregado | P1 | INV-013, INV-014 |
| MAP-438 | Inventario | `/admin/inventory/events/[eventId]` · `cancelReservationAction` | Owner | Liberar una reserva | Queda cancelada, registra RELEASE y se lista como liberada | P1 | INV-015 |
| MAP-439 | Inventario | `/admin/inventory/events/[eventId]` · `checkOutAllAction` | Owner | «Entregar todo» | Todas las reservas pendientes pasan a «En evento» | P1 | INV-016 |
| MAP-440 | Inventario | `/admin/inventory/events/[eventId]` · `releaseAllForEventAction` | Owner | «Liberar todo» en un evento CANCELLED que aún aparta piezas | Se liberan todas las reservas | P1 | INV-017 |
| MAP-441 | Inventario | `/admin/inventory/events/[eventId]` · `recalculateEventReservationsAction` | Owner | Recalcular desde requerimientos; replay en evento COMPLETED | Reserva por invitada y fijos según la experiencia; un evento completado no se recalcula (botón oculto + CONFLICT) | P1 | INV-018, INV-019 |
| MAP-442 | Inventario | `/admin/inventory/conflicts` | Owner | Dos eventos el mismo día sobre-reservan un artículo; cambiar rango 30 / 60 / 90 días | El conflicto aparece; el rango se elige entre 30, 60 y 90 días | P1 | INV-020, INV-021 |
| MAP-443 | Inventario | `/admin/inventory/events` | Owner | Abrir «Reservas por evento» | Lista el evento próximo con su conteo y abre su detalle | P2 | INV-022 |
| MAP-444 | Compras y proveedores | `/admin/purchases`, `/admin/purchases?event=<id>` | Owner | Abrir la lista y filtrar por evento | H1, totales y filtro por evento | P1 | PUR-001, SMK-027 |
| MAP-445 | Compras y proveedores | `/admin/purchases/new?eventId=<id>` · `createPurchaseAction` | Owner | Registrar compra para un evento | Monto en centavos y auditoría | P0 | PUR-002 |
| MAP-446 | Compras y proveedores | `/admin/purchases/new` (validaciones) | Owner | Enviar vacío | Exige concepto (3+) y monto esperado | P2 | PUR-003 |
| MAP-447 | Compras y proveedores | `/admin/purchases/new` (proveedor bloqueado) | Owner | Revisar el combo; replay con `vendorId` bloqueado | No se ofrece ni se acepta en el backend | P2 | PUR-014 |
| MAP-448 | Compras y proveedores | `/admin/purchases/[id]` · `markPurchaseOrderedAction`, `reopenPurchaseAction` | Owner | «Marcar como ordenada» → «Volver a solicitada» | Actualiza estado y fecha de orden | P1 | PUR-004 |
| MAP-449 | Compras y proveedores | `/admin/purchases/[id]` · `receivePurchaseAction` → `/admin/events/[id]/financials` | Owner | «Marcar como recibida» con $1,450.75 | Monto real en centavos que suma al costo real del evento | P0 | PUR-005 |
| MAP-450 | Compras y proveedores | `/admin/purchases/[id]` · `cancelPurchaseAction`, `reopenPurchaseAction` | Owner | Cancelar con motivo → reabrir | El motivo queda en notas e historial; reabrir la regresa a solicitada | P1 | PUR-006 |
| MAP-451 | Compras y proveedores | `markPurchaseOrderedAction` / `receivePurchaseAction` (transiciones inválidas) | Owner | Replay sobre compras RECEIVED / CANCELLED | Recibida → ordenada y cancelada → recibida rechazadas en el backend | P1 | PUR-007 |
| MAP-452 | Compras y proveedores | `/admin/purchases/[id]` · `updateActualAmountAction` | Owner | Corregir el monto real de una recibida; replay sobre una REQUESTED | Exige motivo y queda auditado; sobre una no recibida se rechaza | P1 | PUR-008, PUR-009 |
| MAP-453 | Compras y proveedores | `/admin/purchases/[id]` · `attachReceiptAction` | Owner | Adjuntar ticket/factura y quitarlo; adjuntar texto con extensión `.png` | El comprobante queda ligado y se puede quitar; lo que no es imagen ni PDF se rechaza | P1 | PUR-010, PUR-011 |
| MAP-454 | Compras y proveedores | `/admin/purchases/[id]` (evento cerrado) · `receivePurchaseAction` | Owner | Recibir una compra de un evento cerrado (UI y replay) | No se permite | P1 | PUR-012 |
| MAP-455 | Compras y proveedores | `/admin/purchases/[id]` · `updatePurchaseAction` | Owner | Detalles → «Guardar cambios» | Persiste y aparece en el historial | P2 | PUR-013 |
| MAP-456 | Compras y proveedores | `/admin/vendors`, `/admin/vendors?q=` | Owner | Abrir la lista y buscar | Muestra los proveedores del seed y filtra | P1 | PUR-020, SMK-027 |
| MAP-457 | Compras y proveedores | `/admin/vendors/new` · `createVendorAction` | Owner | Crear proveedor con contacto y calificación; datos inválidos | Persiste y se audita; correo, teléfono y WhatsApp validados sin crear registro | P1 | PUR-021, PUR-022 |
| MAP-458 | Compras y proveedores | `/admin/vendors/[id]/edit` · `updateVendorAction` | Owner | Estado = Bloqueado | Queda auditado y oculta «Nueva compra» | P1 | PUR-023 |
| MAP-459 | Compras y proveedores | `/admin/vendors/[id]` · `deleteVendorAction` | Owner | Eliminar proveedor sin compras; con compras (UI y replay) | Sin compras: se borra y se audita; con compras: botón deshabilitado + backend CONFLICT | P1 | PUR-024, PUR-025 |
| MAP-460 | Finanzas | `/admin/events/[id]/financials` · `createEventCostAction` | Owner | Agregar costo manual; datos inválidos | Se guarda en centavos, suma al total y se audita; exige descripción (3+) y monto > $0 | P1 | FIN-001, FIN-002 |
| MAP-461 | Finanzas | `/admin/events/[id]/financials` · `updateEventCostAction` | Owner | Editar costo | Actualiza monto y categoría con auditoría before/after | P1 | FIN-003 |
| MAP-462 | Finanzas | `/admin/events/[id]/financials` · `deleteEventCostAction` | Owner | Eliminar costo | Sale del costo real y queda en auditoría | P1 | FIN-004 |
| MAP-463 | Finanzas | `/admin/events/[id]/financials` (rentabilidad) | Owner | Evento con venta $23,200 (IVA $3,200), compra recibida, staff, costo manual y comisión | Cuadra con la base: venta − IVA − costos reales = margen | P0 | FIN-005 |
| MAP-464 | Finanzas | `/admin/events/[id]/financials` · `closeEventAction` → `/admin/finance?status=CLOSED` | Owner | Agregar costos (Alimentos $5,000; Flores $2,000.00) a un evento COMPLETED → «Cerrar evento» → Finanzas; replay de `createEventCostAction` | 2 `EventCost` + `cost.created`; `closedAt` y `closingSnapshot` (venta $23,200, neto $20,000, costo real $7,000, margen $13,000 = 65 %); `event.closed`; POST_EVENT a la clienta; costos bloqueados y no se puede volver a cerrar; fila «Cerrado» con $23,200, $7,000 y 65.0 % | P0 | FIN-006, CRIT-007 |
| MAP-465 | Finanzas | `/admin/events/[id]` (evento cerrado) | Owner | Revisar el encabezado en Resumen y Operaciones | Todas las pestañas indican que el evento está cerrado | P3 | FIN-007 |
| MAP-466 | Finanzas | `closeEventAction` (estado) | Owner | Replay sobre un evento CONFIRMED y doble cierre | Sólo se cierran completados; el doble cierre se rechaza en el backend | P1 | FIN-008 |
| MAP-467 | Finanzas | `/admin/finance`, `/admin/finance?status=CLOSED` | Owner | Abrir finanzas y filtrar «Cerrados» | KPIs, eventos con totales (fila de Sofía) y el evento cerrado en el filtro | P1 | FIN-010, SMK-028 |
| MAP-468 | Finanzas | `/admin/finance/export` | Owner · Staff · Anónimo | Exportar CSV (`?status=CLOSED`) | Anónimo ↪ login (request sin sesión 401), Staff ↪ `/staff`; Owner CSV con BOM, encabezados, montos en pesos, títulos con fórmulas neutralizados (`=1+1`) y auditoría `finance.exported` | P0 | API-072, FIN-011, FIN-013 |
| MAP-469 | Dashboard y analítica | `/admin` | Owner | Abrir el dashboard | Saludo «Hola, Ivonne» y panel «Próximos 7 días» con datos reales | P1 | SMK-021 |
| MAP-470 | Dashboard y analítica | `/admin/analytics` | Owner | Abrir analítica | Renderiza con datos reales sin errores de consola | P2 | FIN-012 |
| MAP-471 | Notificaciones | `/admin/notifications?q=…&channel=…&status=…` | Owner | Buscar por asunto y filtrar por canal, tipo y estado | La bandeja filtra correctamente | P1 | NOT-001 |
| MAP-472 | Notificaciones | `/admin/notifications?id=<id>` · `markNotificationReadAction` | Owner | Abrir un mensaje y «Marcar como no leído» | Abrir lo marca como leído; se puede volver a no leído | P1 | NOT-002 |
| MAP-473 | Notificaciones | `/admin/notifications?unread=1` | Owner | Filtro «Sin leer» | Sólo pendientes y respeta la lectura | P2 | NOT-003 |
| MAP-474 | Notificaciones | `/admin/notifications` · `markAllNotificationsReadAction` | Owner | «Marcar todo como leído» | La bandeja queda sin pendientes | P1 | NOT-004 |
| MAP-475 | Notificaciones | `/admin/notifications` · `runRemindersNowAction` | Owner | «Ejecutar recordatorios ahora» dos veces con eventos a 5 días y a 30 h | Genera los avisos de 7 días y 48 h una sola vez (idempotente) y se audita | P0 | NOT-005 |
| MAP-476 | Contenido | `/admin/content` · `saveTestimonialAction` | Owner | Nuevo testimonio; vacío | Guarda autora, calificación y visibilidad con auditoría; exige autora (2+) y texto (10+) | P1 | CNT-001, CNT-002 |
| MAP-477 | Contenido | `/admin/content` · `saveTestimonialAction`, `setTestimonialActiveAction`, `deleteTestimonialAction` | Owner | Editar → Visible off → Eliminar | Cada cambio persiste con auditoría | P1 | CNT-003 |
| MAP-478 | Contenido | `/admin/content` → `/` | Owner → Anónimo | Testimonio visible con orden 0; luego ocultarlo | Aparece primero en la portada; oculto desaparece | P1 | CNT-020 |
| MAP-479 | Contenido | `/admin/content` · `moveTestimonialAction` | Owner | Bajar y subir un testimonio | El orden persiste y la lista se actualiza en pantalla | P2 | CNT-023 |
| MAP-480 | Contenido | `/admin/content/faq` · `saveFaqAction` | Owner | Nueva pregunta con categoría y filtro «Pagos»; vacía | Se guarda, se audita y se filtra por categoría; exige pregunta y respuesta (5+) | P1 | CNT-006, CNT-008 |
| MAP-481 | Contenido | `/admin/content/faq` · `saveFaqAction`, `setFaqActiveAction`, `deleteFaqAction` | Owner | Editar → Visible off → Eliminar | Cada cambio persiste con auditoría | P1 | CNT-007 |
| MAP-482 | Contenido | `/admin/content/faq` → `/como-funciona` | Owner → Anónimo | Pregunta general visible con orden 0; luego ocultarla | Aparece en «Cómo funciona»; oculta desaparece | P1 | CNT-021 |
| MAP-483 | Contenido | `/admin/content/faq` · `moveFaqAction` | Owner | Subir / Bajar | Intercambia la posición con la vecina | P2 | CNT-022 |
| MAP-484 | Contenido | `/admin/content/gallery` · `finalizeGalleryUploadAction`, `updateGalleryAltAction`, `setGalleryFeaturedAction`, `deleteGalleryItemAction` | Owner | Subir foto → texto alternativo → «Destacada» → eliminar | Cada paso persiste | P1 | CNT-010 |
| MAP-485 | Contenido | `/admin/content/gallery` (validaciones) | Owner | Alt de 2 caracteres; subir texto con extensión `.png` | Alt exige 3+ caracteres sin cambios en base; el archivo que no es imagen se rechaza | P2 | CNT-011, CNT-012 |
| MAP-486 | Contenido | `/admin/content/gallery` · `moveGalleryItemAction` | Owner | Bajar la imagen 1 y volver a subirla | El orden persiste y la tarjeta cambia de posición | P2 | CNT-024 |
| MAP-487 | Ajustes y usuarios | `/admin/settings` | Owner | Abrir la configuración | «Nombre de la marca» y demás valores guardados | P1 | SMK-029 |
| MAP-488 | Ajustes y usuarios | `/admin/settings` (navegación lateral) | SuperAdmin | Abrir cada sección del menú; saltar rápido entre secciones y volver con Atrás o con el enlace | Todas las secciones de configuración cargan; al volver se ve la página, no el esqueleto de carga | P1 | SET-001, SET-023, SET-024 |
| MAP-489 | Ajustes y usuarios | `/admin/settings` (Negocio) · `updateBusinessSettingsAction` | Owner | Guardar la versión de términos; WhatsApp con letras | Persiste y queda auditado; WhatsApp inválido se rechaza sin guardar | P1 | SET-002, SET-003 |
| MAP-490 | Ajustes y usuarios | `/admin/settings/pricing` · `updatePricingSettingsAction` | Owner | IVA 16 → 17 %; mínimo 10 / máximo 8 invitadas | Se guarda en bps, se describe el cambio y se audita; el máximo no puede ser menor al mínimo | P0 | SET-004, SET-005 |
| MAP-491 | Ajustes y usuarios | `/admin/settings/availability` · `updateAvailabilitySettingsAction` | Owner | Cambiar la anticipación mínima; mínimo 60 / máximo 30 | Persiste y se restaura; «Reservas con hasta» debe superar la anticipación mínima | P1 | SET-006, SET-007 |
| MAP-492 | Ajustes y usuarios | `/admin/settings/notifications` · `updateNotificationSettingsAction` | Owner | Cambiar el correo del equipo | Se guarda validado y se restaura | P1 | SET-008 |
| MAP-493 | Ajustes y usuarios | `/admin/settings/flags` · `setFeatureFlagAction`, `resetFeatureFlagAction` | Owner | Apagar «Mensajes por WhatsApp», enviar WhatsApp de prueba, «Restablecer» | Los mensajes quedan OMITIDOS; restablecer vuelve al valor de entorno (auditado) | P0 | SET-009 |
| MAP-494 | Ajustes y usuarios | `/admin/settings/integrations` | Owner | Abrir integraciones | Muestra proveedores, webhooks, cron y prueba de mensajes | P2 | SET-021 |
| MAP-495 | Ajustes y usuarios | `/admin/settings/integrations` · `sendTestEmailAction`, `sendTestWhatsAppAction` | Owner | Enviar email y WhatsApp de prueba | Quedan registrados (simulados) en la bandeja: el email a nombre de quien lo pide y el WhatsApp hacia el número del negocio | P1 | SET-011, SET-012 |
| MAP-496 | Ajustes y usuarios | `/admin/settings/users` · `createUserAction` → `/login` | SuperAdmin | Nueva usuaria Fundadora e iniciar sesión con ella | Puede entrar al panel | P0 | SET-013 |
| MAP-497 | Ajustes y usuarios | `/admin/settings/users` · `createUserAction` → `/staff` | SuperAdmin | Nueva usuaria Staff vinculada a su ficha e iniciar sesión | Ve su portal staff | P1 | SET-022 |
| MAP-498 | Ajustes y usuarios | `/admin/settings/users` · `changeUserRoleAction` | SuperAdmin | Cambiar rol Staff → Fundadora | Persiste y queda auditado | P1 | SET-014 |
| MAP-499 | Ajustes y usuarios | `/admin/settings/users` · `setUserActiveAction` | SuperAdmin | Desactivar → login falla → reactivar → login ok | El login refleja el estado; cambios auditados | P0 | SET-015 |
| MAP-500 | Ajustes y usuarios | `/admin/settings/users` · `resetUserPasswordAction` | SuperAdmin | Restablecer contraseña | Invalida la anterior y cierra las sesiones abiertas de la cuenta (ver MAP-510); la contraseña no se guarda en la auditoría | P1 | SET-016 |
| MAP-501 | Ajustes y usuarios | `/admin/settings/users` (validaciones) | SuperAdmin | Correo existente; contraseña que contiene el correo | No se crean cuentas duplicadas ni con esa contraseña | P2 | SET-017 |
| MAP-502 | Ajustes y usuarios | `/admin/settings/users` (fila «(tú)») | SuperAdmin | Intentar cambiar el propio rol o desactivarse | No se permite desde la lista | P2 | SET-018 |
| MAP-503 | Ajustes y usuarios | `/admin/settings/audit` (`?entityId=<user>`) | SuperAdmin | Revisar la bitácora tras acciones sensibles; parámetros basura | Aparecen con actor, diff y filtros; filtros inválidos se ignoran sin romper la página | P1 | SET-019, SET-020 |
| MAP-504 | Transversal (responsive y accesibilidad) | Responsive por token: `/cotizacion/[token]`, `/pago/mock/[checkoutId]`, `/mi-evento/[token]`, `/e/[slug]/[token]`, `/memory/[token]`, `/mi-evento` | Clienta (token) · Invitada (token) | 1440×900, 1366×768, 768×1024, 390×844 | Sin scroll horizontal (≤ 1 px), H1 y CTA principal visibles, dentro del ancho y no tapados | P1 | RESP-008, RESP-009, RESP-010, RESP-011, RESP-012, RESP-013 |
| MAP-505 | Transversal (responsive y accesibilidad) | Responsive del panel: `/admin`, `/admin/leads`, `/admin/events/[id]`, `/admin/calendar`, `/admin/finance` | Owner | 1440×900, 1366×768, 768×1024, 390×844 | Sin scroll horizontal de página; tablas anchas con scroll interno | P2 | RESP-014, RESP-015, RESP-016, RESP-017, RESP-018 |
| MAP-506 | Transversal (responsive y accesibilidad) | Accesibilidad del panel: `/admin`, `/admin/leads`, `/admin/finance` | Owner | axe WCAG 2.1 AA | 0 violaciones critical/serious | P2 | A11Y-012, A11Y-013, A11Y-018 |
| MAP-507 | Transversal (responsive y accesibilidad) | Landmarks (público y panel) | Anónimo · Owner | Revisar la estructura | banner, nav, main y footer en público; main y nav en el panel; `lang="es"` | P2 | A11Y-025 |
| MAP-508 | Transversal (responsive y accesibilidad) | Imágenes (sitio público) | Anónimo | Buscar `<img>` sin alt | Ninguna (o marcada como decorativa) | P2 | A11Y-026 |
| MAP-509 | Transversal (responsive y accesibilidad) | `prefers-reduced-motion` | Anónimo | Emular reduce | Animaciones y transiciones ≤ 1 ms | P2 | A11Y-027 |

¹ **NAV-034 está duplicado en el código.** Dos pruebas distintas usan el mismo ID: `tests/e2e/navigation/not-found.spec.ts` (404 real, MAP-515, agregada en `4a7a780`) y `tests/e2e/navigation/hydration.spec.ts` (hidratación de `/pago/mock`, MAP-516, agregada en `a3309b7`). Ambas pasan en la regresión final. Hay que renombrar una, por ejemplo la de hidratación a NAV-037, en `tests/e2e`; mientras tanto, en este mapa NAV-034 cuenta como un solo ID y dos pruebas.

## Recorridos críticos (P0)

Los 14 recorridos críticos se automatizan en `tests/e2e/critical/*.spec.ts` (Chromium escritorio; los recorridos con rol «(móvil)» también en 390×844; Firefox y WebKit con `E2E_CROSS_BROWSER=1`). Cada uno verifica la UI y, según el caso, la base de datos (estados, auditoría, notificaciones) o las respuestas HTTP y cookies. Un recorrido FAIL o BLOCKED deja el gate en 🔴 BLOCKED.

| Recorrido | Roles | Filas del mapa |
|---|---|---|
| CRIT-001 — Configurador → lead visible para la fundadora | Anónima (móvil 390×844) → Owner | MAP-148, MAP-149, MAP-151, MAP-182 |
| CRIT-002 — Venta completa: lead → cotización → aceptación → anticipo → evento confirmado → portal | Owner → Clienta (móvil) → Owner | MAP-242, MAP-254, MAP-265, MAP-266, MAP-279, MAP-280, MAP-328 |
| CRIT-003 — La clienta rechaza la propuesta | Clienta (móvil) → Owner | MAP-267 |
| CRIT-004 — La anfitriona agrega una invitada y la invitada confirma | Clienta (móvil) → Invitada (móvil) → Owner | MAP-335, MAP-344, MAP-354 |
| CRIT-005 — Asignación de staff → portal staff → tarea hecha | Owner → Staff nuevo (móvil) → Owner | MAP-379, MAP-394, MAP-397, MAP-402 |
| CRIT-006 — Pago manual del saldo | Owner → Clienta | MAP-298 |
| CRIT-007 — Cierre financiero del evento | Owner | MAP-463, MAP-464, MAP-467 |
| CRIT-008 — Memory Capsule: mensaje y foto de invitada aprobados por la fundadora | Invitada (móvil) → Owner → público | MAP-357, MAP-361, MAP-362, MAP-369 |
| CRIT-009 — Owner: login, sesión y logout | Owner | MAP-002, MAP-020, MAP-022 |
| CRIT-010 — Formulario de contacto → lead visible en el panel | Anónima (móvil) → Owner | MAP-139 |
| CRIT-011 — SuperAdmin: login, sesión y logout | SuperAdmin | MAP-001, MAP-020 |
| CRIT-012 — Staff: login, barrera del panel y logout | Staff (móvil) | MAP-003, MAP-030, MAP-040 |
| CRIT-013 — callbackUrl: regreso a la ruta privada sin salir del dominio | Anónima → Owner | MAP-032, MAP-035 |
| CRIT-014 — Logout definitivo con una respuesta en vuelo | Staff | MAP-020, MAP-026 |

### CRIT-001 — Configurador → lead visible para la fundadora

**Roles:** Anónima (móvil 390×844) → Owner · **Ruta:** `/crear-experiencia` → `/admin/leads` → `/admin/leads/[id]` · **Fila principal:** MAP-148 · **Filas relacionadas:** MAP-149, MAP-151, MAP-182

**Precondiciones:** Catálogo consistente (experiencia activa con menú y zona); fecha disponible en el calendario del configurador.

**Pasos**

1. Abrir `/crear-experiencia` en móvil.
2. Paso 1: elegir la ocasión.
3. Paso 2: elegir una fecha disponible en el calendario.
4. Paso 3: elegir la zona.
5. Paso 4: indicar el número de invitadas.
6. Pasos 5–8: elegir estilo, experiencia, menú y extras.
7. Pasos 9–10: datos de la homenajeada y presupuesto.
8. Revisar el resumen: estimado calculado en el servidor, sin costos internos.
9. Capturar nombre, teléfono, correo y consentimiento → «Consultar disponibilidad».
10. Anotar el folio de la confirmación.
11. La fundadora inicia sesión, busca el folio en `/admin/leads` y abre el detalle.

**Verificación:** Folio visible; `Lead` NEW/CONFIGURATOR con teléfono normalizado `+52…` y clienta por correo; `ConfigurationSnapshot` cuyo `estimate.totalCents` = `estimatedTotalCents` = total mostrado; actividad CREATED; `NotificationLog` LEAD_RECEIVED + aviso GENERIC al equipo; el lead aparece y abre en el panel.

### CRIT-002 — Venta completa: lead → cotización → aceptación → anticipo → evento confirmado → portal

**Roles:** Owner → Clienta (móvil) → Owner · **Ruta:** `/admin/leads/[id]` → `/admin/quotes/new?leadId` → `/admin/quotes/[id]` → `/cotizacion/[token]` → `/pago/mock/[checkoutId]` → `/pago/resultado` → `/mi-evento/[token]` → `/admin/events/[id]` · **Fila principal:** MAP-279 · **Filas relacionadas:** MAP-242, MAP-254, MAP-265, MAP-266, MAP-280, MAP-328

**Precondiciones:** Lead NEW con fecha disponible; proveedor de pagos mock con `PAYMENTS_ENABLED`.

**Pasos**

1. La fundadora abre el lead y pulsa «Crear cotización» (formulario prellenado).
2. Revisa el precio calculado en vivo y guarda el borrador.
3. «Enviar a la clienta».
4. La clienta abre el enlace `/cotizacion/[token]`, pulsa «Aceptar propuesta», escribe nombre y apellido y acepta términos.
5. La clienta pulsa «Pagar anticipo».
6. En el checkout simulado pulsa «Pagar (simulado)».
7. `/pago/resultado` muestra el pago recibido.
8. «Ir a mi evento» abre `/mi-evento/[token]`.
9. La fundadora abre `/admin/events/[id]`.

**Verificación:** DRAFT con línea base = precio de catálogo, subtotal = Σ líneas, total/IVA según `pricesIncludeTax`, anticipo = total × bps; lead QUOTED y auditoría `quote.created`; SENT + QUOTE_SENT; propuesta pública sin costos ni márgenes; ACCEPTED + Booking (anticipo, aceptó) + Event PENDING_PAYMENT; lead WON; pago DEPOSIT PAID (mock) con `WebhookEvent` procesado; evento CONFIRMED + auditoría `event.confirmed_by_payment`; checklist instanciado (`onEventConfirmed`); BOOKING_CONFIRMED + PAYMENT_RECEIVED; portal «¡Fecha confirmada!» con Pagado = anticipo y Saldo = total − anticipo; el panel muestra el saldo.

### CRIT-003 — La clienta rechaza la propuesta

**Roles:** Clienta (móvil) → Owner · **Ruta:** `/cotizacion/[token]` → `/admin/quotes/[id]` · **Fila principal:** MAP-267

**Precondiciones:** Cotización SENT vigente con lead QUOTED.

**Pasos**

1. La clienta abre `/cotizacion/[token]` y pulsa «No por ahora».
2. Escribe el motivo y pulsa «Rechazar propuesta».
3. Recarga la página.
4. La fundadora abre la cotización en el panel.

**Verificación:** «Recibimos tu respuesta» sin botón de aceptar; Quote REJECTED con motivo y fecha; sin Booking ni Event; actividad del lead con el folio y el lead sigue QUOTED (regla actual); auditoría `quote.rejected`; aviso al equipo; el panel muestra «Rechazada» + motivo.

### CRIT-004 — La anfitriona agrega una invitada y la invitada confirma

**Roles:** Clienta (móvil) → Invitada (móvil) → Owner · **Ruta:** `/mi-evento/[token]` → `/e/[slug]/[token]` → `/admin/events/[id]/guests` · **Fila principal:** MAP-354 · **Filas relacionadas:** MAP-335, MAP-344

**Precondiciones:** Evento CONFIRMED con micrositio activo.

**Pasos**

1. La anfitriona abre su portal y pulsa «Agregar invitada» (nombre y contacto).
2. La invitada abre su link personal `/e/[slug]/[token]`.
3. Elige «¡Sí, ahí estaré!» y pulsa «Enviar mi respuesta».
4. Recarga su página.
5. La fundadora abre las invitadas del evento en el panel.
6. La anfitriona recarga su portal.

**Verificación:** Toast «Agregamos a…»; `EventGuest` HOST/PENDING; confirmación «¡Gracias…! Te esperamos»; ATTENDING + `respondedAt` sin duplicados; la fila del panel dice «Asiste»; el portal dice «Asiste».

### CRIT-005 — Asignación de staff → portal staff → tarea hecha

**Roles:** Owner → Staff nuevo (móvil) → Owner · **Ruta:** `/admin/events/[id]/operations` → `/login` → `/staff` → `/staff/events/[id]` · **Fila principal:** MAP-394 · **Filas relacionadas:** MAP-379, MAP-397, MAP-402

**Precondiciones:** Evento CONFIRMED con una tarea asignada al integrante nuevo; otro evento CONFIRMED no asignado (control de IDOR).

**Pasos**

1. La fundadora abre la orden de producción, pulsa «Asignar staff», elige al integrante y confirma.
2. El integrante inicia sesión en `/login` desde el celular.
3. Revisa su lista en `/staff`.
4. Abre por URL el evento ajeno `/staff/events/<otro>`.
5. Abre `/admin/events`.
6. Abre su evento y pulsa «Marcar como hecha» en su tarea.
7. La fundadora recarga la orden de producción.

**Verificación:** «Staff asignado y notificado»; `StaffAssignment` + auditoría `staff_assignment.created`; STAFF_ASSIGNED con enlace a `/staff/events/<id>`; la lista del staff sólo contiene su evento; el evento ajeno muestra «No encontramos este evento» sin datos; `/admin` regresa a `/staff`; tarea DONE con `completedById` y `completedAt`; el panel muestra la tarea en «Hecho».

### CRIT-006 — Pago manual del saldo

**Roles:** Owner → Clienta · **Ruta:** `/admin/events/[id]` (Pagos) → `/mi-evento/[token]` · **Fila principal:** MAP-298

**Precondiciones:** Evento CONFIRMED con anticipo pagado y saldo pendiente.

**Pasos**

1. La fundadora abre el evento y, en «Pagos», pulsa «Registrar pago manual».
2. Verifica monto = saldo y concepto BALANCE; escribe la nota (transferencia) y pulsa «Registrar pago».
3. Recarga el panel.
4. La clienta abre su portal.

**Verificación:** Pago BALANCE PAID manual (TRANSFER) con `recordedById` = fundadora; auditoría `payment.manual_recorded` con el monto; PAYMENT_RECEIVED a la clienta; cobrado = total; el panel muestra saldo $0 y ya no ofrece el botón; el portal muestra Pagado = total, Saldo $0 y «¡Tu celebración está liquidada!».

### CRIT-007 — Cierre financiero del evento

**Roles:** Owner · **Ruta:** `/admin/events/[id]/financials` → `/admin/finance?status=CLOSED` · **Fila principal:** MAP-464 · **Filas relacionadas:** MAP-463, MAP-467

**Precondiciones:** Evento COMPLETED liquidado: venta $23,200 con IVA incluido ($3,200), sin comisiones.

**Pasos**

1. Abrir las finanzas del evento y pulsar «Agregar costo»: Alimentos, $5,000.
2. Agregar otro costo: Flores, $2,000.00.
3. Pulsar «Cerrar evento» y confirmar.
4. Abrir `/admin/finance?status=CLOSED`.

**Verificación:** 2 `EventCost` en centavos + 2 auditorías `cost.created`; `closedAt` y `closingSnapshot` (venta $23,200, neto $20,000, costo real $7,000, margen $13,000 = 65 %); auditoría `event.closed`; aviso POST_EVENT; ya no se puede cerrar de nuevo; finanzas muestra la fila «Cerrado» con $23,200, $7,000 y 65.0 %.

### CRIT-008 — Memory Capsule: mensaje y foto de invitada aprobados por la fundadora

**Roles:** Invitada (móvil) → Owner → público · **Ruta:** `/memory/[token]` → `/api/memory/[token]/upload` → `/admin/events/[id]/memory` → `/memory/[token]` · **Fila principal:** MAP-369 · **Filas relacionadas:** MAP-357, MAP-361, MAP-362

**Precondiciones:** Cápsula publicada con `MEMORY_CAPSULE_ENABLED`.

**Pasos**

1. La invitada abre la cápsula y deja un mensaje en el libro de visitas.
2. Sube una foto PNG marcando el consentimiento.
3. El público recarga la cápsula: la foto todavía no aparece.
4. La fundadora abre la moderación de la cápsula y pulsa «Aprobar».
5. El público recarga la cápsula.

**Verificación:** Mensaje GUESTBOOK visible; `MediaAsset` PRIVATE con `approved=false` y autora; foto invisible antes de moderar; «Foto aprobada» → `approved=true`; la galería pública muestra 1 foto cargada con alt que nombra a la autora.

### CRIT-009 — Owner: login, sesión y logout

**Roles:** Owner · **Ruta:** `/login` → `/admin` → «Cerrar sesión» · **Fila principal:** MAP-020 · **Filas relacionadas:** MAP-002, MAP-022

**Precondiciones:** Cuenta OWNER propia de la prueba (`createBackofficeUser`). Desde BUG-001/BUG-004, cerrar sesión revoca todas las sesiones de la cuenta, así que no se usa la cuenta DEMO compartida `ivonne@`.

**Pasos**

1. Iniciar sesión en `/login`.
2. Comprobar el inicio «Hola, <nombre>» y que `lastLoginAt` se actualizó.
3. Hacer un request directo a una ruta privada con la cookie: 200.
4. Pulsar «Cerrar sesión».
5. Abrir una URL privada en el navegador.
6. Repetir el request directo con la cookie anterior.
7. Pulsar «Atrás».

**Verificación:** Antes del logout 200; después la UI va a `/login?callbackUrl=…`, el request directo recibe 3xx a `/login` y «Atrás» no muestra datos privados.

### CRIT-010 — Formulario de contacto → lead visible en el panel

**Roles:** Anónima (móvil) → Owner · **Ruta:** `/contacto` → `/admin/leads` → `/admin/leads/[id]` · **Fila principal:** MAP-139

**Precondiciones:** Notificaciones en modo mock (buzón).

**Pasos**

1. Abrir `/contacto` en móvil.
2. Llenar el formulario completo y marcar el consentimiento.
3. Pulsar «Enviar mensaje» y anotar el folio.
4. La fundadora busca el folio en `/admin/leads` y abre el detalle.

**Verificación:** «¡Gracias…» con folio; `Lead` NEW/CONTACT_FORM con notas, clienta, actividad CREATED y LEAD_RECEIVED; el detalle muestra el mensaje.

### CRIT-011 — SuperAdmin: login, sesión y logout

**Roles:** SuperAdmin · **Ruta:** `/login` → `/admin` → «Cerrar sesión» · **Fila principal:** MAP-020 · **Filas relacionadas:** MAP-001

**Precondiciones:** Cuenta SUPER_ADMIN propia de la prueba (`createBackofficeUser`), no la DEMO `superadmin@`, porque el logout revoca todas las sesiones de la cuenta.

**Pasos**

1. Iniciar sesión en `/login`.
2. Comprobar el inicio «Hola, <nombre>».
3. Hacer un request directo a una ruta privada con la cookie: 200.
4. Pulsar «Cerrar sesión».
5. Abrir una URL privada y repetir el request directo.
6. Pulsar «Atrás».

**Verificación:** Igual que CRIT-009: tras el logout la UI va a `/login?callbackUrl=…`, el request recibe 3xx a `/login` y «Atrás» no muestra datos.

### CRIT-012 — Staff: login, barrera del panel y logout

**Roles:** Staff (móvil) · **Ruta:** `/login` → `/staff` → `/admin/finance` → «Cerrar sesión» → `/staff` · **Fila principal:** MAP-030 · **Filas relacionadas:** MAP-003, MAP-040

**Precondiciones:** Cuenta STAFF propia de la prueba (`createStaffUser`) con un evento asignado. Su tarjeta en `/staff` dispara el prefetch RSC que, en vuelo durante el logout, revivía la sesión: era la reproducción natural de BUG-001.

**Pasos**

1. Iniciar sesión en `/login` desde el celular: llega a `/staff` y ve su evento asignado.
2. Abrir `/admin/finance` en el navegador.
3. Hacer el request directo a `/admin/finance` con la cookie.
4. Pulsar «Cerrar sesión».
5. Abrir `/staff`.

**Verificación:** `/admin*` → `/staff` en la UI y 3xx a `/staff` en el request; tras el logout `/staff` pide login (`/login?callbackUrl=%2Fstaff`). Lleva `@regression` BUG-001; en la regresión final pasa en los 4 proyectos.

### CRIT-013 — callbackUrl: regreso a la ruta privada sin salir del dominio

**Roles:** Anónima → Owner · **Ruta:** `/admin/events` → `/login?callbackUrl` → `/admin/events` · **Fila principal:** MAP-032, MAP-035

**Precondiciones:** Sin sesión.

**Pasos**

1. Abrir `/admin/events` sin sesión: redirige a `/login?callbackUrl=%2Fadmin%2Fevents`.
2. Iniciar sesión como Owner.
3. Repetir el login con `callbackUrl=https://evil.example`.

**Verificación:** Tras el primer login vuelve a `/admin/events`; con el `callbackUrl` externo termina en el panel y nunca sale del dominio.

### CRIT-014 — Logout definitivo con una respuesta en vuelo

**Roles:** Staff · **Ruta:** `/staff` (2 pestañas) → «Cerrar sesión» → `/staff` · **Fila principal:** MAP-026 · **Filas relacionadas:** MAP-020

**Precondiciones:** Sesión de una cuenta STAFF propia de la prueba (`createStaffUser`) abierta en dos pestañas. No se usa la DEMO compartida, porque el logout revoca todas las sesiones de la cuenta.

**Pasos**

1. Abrir `/staff` en dos pestañas.
2. En la pestaña B lanzar una petición autenticada (navegación o prefetch) que quede en vuelo.
3. En la pestaña A pulsar «Cerrar sesión».
4. Dejar que llegue la respuesta de la pestaña B.
5. Abrir `/staff`.

**Verificación:** El servidor ya no re-emite la cookie en una respuesta autenticada con JWT reciente; antes, la precondición del bug era que sí la re-emitía. Ninguna respuesta posterior al logout vuelve a escribir la cookie `authjs.session-token` y `/staff` exige login. Defensa en profundidad: aunque se restaure a mano la cookie anterior al logout, `/staff` sigue pidiendo login, porque la sesión está revocada en el servidor. Lleva `@regression` BUG-001 (TRV-BUG-06 / ACC-BUG-01); en la regresión final pasa en Chromium, Firefox y WebKit.
