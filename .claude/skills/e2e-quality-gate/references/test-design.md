# Diseño de pruebas — convenciones y patrones

Contenido: [Anatomía](#anatomía-de-una-prueba) · [IDs y etiquetas](#ids-y-etiquetas) · [Locators y espera](#locators-y-sincronización) · [Datos](#datos-de-prueba) · [Persistencia](#persistencia) · [Autorización](#autorización) · [Autenticación](#autenticación) · [Negativas](#negativas-y-formularios) · [Antes de hidratar](#antes-de-hidratar) · [API](#api) · [Responsive](#responsive) · [Accesibilidad](#accesibilidad) · [Cross-browser](#recetas-cross-browser) · [Estados especiales](#blocked-not-applicable-flaky) · [Qué evitar](#qué-evitar)

## Anatomía de una prueba

```ts
import { expect, test, TOKENS, uniq, createLead } from "../fixtures";

test.describe("Leads", { tag: ["@module:leads"] }, () => {
  test("[LEAD-003] crear lead manual persiste y aparece tras recargar", { tag: ["@P1", "@regression"] },
    async ({ rolePage, db, evidence }) => {
      evidence("owner", "Leads › Nuevo lead");
      const page = await rolePage("owner");
      const name = uniq("Clienta E2E");
      await page.goto("/admin/leads");
      await page.getByRole("button", { name: "Nuevo lead" }).click();
      await page.getByLabel("Nombre").fill(name);
      // …
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.getByText("Lead creado")).toBeVisible();          // 1. UI
      const lead = await db.lead.findFirst({ where: { customer: { name } } }); // 2. base
      expect(lead?.status).toBe("NEW");
      await page.reload();                                                    // 3. persiste
      await expect(page.getByRole("link", { name })).toBeVisible();
    });
});
```

Reglas: un comportamiento por prueba, título en español que diga qué se valida, `evidence(rol, pasos)` siempre, importar **sólo** desde `../fixtures` (o `../../fixtures`).

## IDs y etiquetas

- **ID** en el título entre corchetes: `[PREFIJO-NNN]` (3 dígitos), único en toda la suite. Prefijos por paquete (runbook §Paquetes): `AUTH PERM NAV API PUB CONF AI QUO-C PAY LEAD CUST CAT QUO EVT CAL PORT GST MEM OPS STF INV PUR FIN SET CNT NOT SMK CRIT RESP A11Y REG`. El mismo ID aparece en `TEST_COVERAGE_MATRIX.md` y, si falla, en el BUG. Al agregar pruebas desde carriles en paralelo pueden chocar los IDs. Antes de entregar, comprueba que no haya duplicados (los títulos van entre comillas dobles): `grep -rhoE '"\[[A-Z]+(-[A-Z]+)?-[0-9]{3}\]' tests/e2e | sort | uniq -d` no debe imprimir nada.
- **Etiquetas** (`{ tag: [...] }` en `test` o `describe`):
  - prioridad, exactamente una: `@P0` (recorrido de negocio/seguridad sin el cual no se opera), `@P1` (función principal), `@P2` (secundaria), `@P3` (cosmético/borde).
  - tipo: `@smoke`, `@critical` (recorridos críticos P0 del perfil), `@auth`, `@permissions`, `@negative`, `@regression` (protege un bug corregido).
  - módulo: `@module:<nombre>` (`leads`, `quotes`, `events`, `portal`, `guests`, `memory`, `staff`, `inventory`, `purchases`, `finance`, `settings`, `catalog`, `configurator`, `payments`, `public`, `content`, `notifications`, `customers`, `operations`, `calendar`, `vendors`, `users`, `ai`, `api`, `auth`, `navigation`).
  - interfaz: `@mobile` (corre también en 390×844), `@responsive`, `@a11y`.
- El gate cuenta por prioridad: una prueba sin `@P*` sale como UNTAGGED y baja el veredicto.

## Locators y sincronización

Orden de preferencia: `getByRole` (con `name`) → `getByLabel` → `getByPlaceholder` → `getByText` → `getByTestId`. CSS/XPath sólo si no hay alternativa y con comentario de por qué.
- Lee el texto real del componente (`src/features/<m>/components/*`) antes de escribir el locator; el copy es español con acentos.
- Acota por región: `page.getByRole("main")`, `page.getByRole("dialog")`, `row = page.getByRole("row", { name: /E2E-xyz/ })`.
- Sincroniza con web-first assertions (`await expect(locator).toBeVisible()`), `page.waitForURL`, `page.waitForResponse`, `expect.poll(() => db…)`. **Nunca** `waitForTimeout` como estrategia.
- Toasts (sonner): `page.getByText("Guardado")` o `getByRole("status")`; valida además el efecto en base. Si el mismo texto también aparece en el Historial o el timeline («Datos actualizados», «Asignado a Rosa»), acota el toast a la región «Notificaciones» de sonner y la entrada a su propia región. Si no, el strict mode falla o no falla según el momento en que se evalúa (QUO-018, LEAD-021, MEM-001). Para textos que se repiten dentro de otro texto, usa `{ exact: true }` (AUTH-004/005).
- **Interactúa sólo con la página hidratada.** Lo que se escribe o se elige antes de hidratar puede perderse; en el panel, react-hook-form no ve el cambio. Para formularios públicos, espera `await expect(boton).toBeEnabled()` (se habilita al hidratar). Para el panel, usa `gotoReady(page, url)` o `waitForHydration(page)` (`tests/e2e/quotes/_helpers.ts`: comprueba que `<main>` y todos los controles tengan `__reactProps$`), `ready(locator)` (`operations/_helpers.ts`) o `waitHydrated(locator)` (`events/_helpers.ts`). **No uses `waitForLoadState("networkidle")`**: Playwright lo desaconseja y en Firefox puede no cumplirse nunca aunque la red esté quieta (QUO-019).
- Si no hay forma accesible de ubicar un control, eso es un hallazgo de accesibilidad (UX ISSUE), no una razón para usar CSS frágil.

## Datos de prueba

- Las pruebas son **independientes y repetibles**: crean lo que necesitan con nombres únicos (`uniq("E2E Lead")`, `uniqEmail()`, `uniqPhone()`) y no dependen del orden.
- Seed = sólo lectura (tokens y registros compartidos por todos los workers del carril).
- Factories disponibles: `createCustomer`, `createLead`, `createUnreadNotification`. Para el resto crea helpers en `tests/e2e/<área>/_helpers.ts` usando Prisma (`db`) y las utilidades del dominio (`generateToken`, `generateCode`, `dateOnly`) — importables desde `../../../src/lib/...` cuando no dependan de `server-only`.
- Fechas futuras disponibles: calcula con la regla de disponibilidad real (lee `availability-service` / settings) o toma una fecha libre que el propio configurador ofrezca.
- No hace falta limpieza: la base del carril se re-siembra por corrida. Sí evita colisiones dentro de la corrida (nombres únicos).
- Estado global (flags, ajustes, reglas de disponibilidad, precios globales): sólo en `*.global.spec.ts` (la suite `E2E_SUITE=global` corre con 1 worker, así que ya es secuencial; **no** uses `mode: "serial"`, que deja sin ejecutar el resto del archivo cuando una prueba falla) y restaura el valor en `finally`/`afterEach`.

## Persistencia

Toda prueba que escribe valida las tres capas:
1. **UI**: mensaje de éxito + el dato visible donde corresponde.
2. **Base**: `db.<modelo>.findFirst/findUnique` con los campos clave (montos en centavos, estado, relaciones, auditoría `auditLog`, notificaciones `notificationLog`).
3. **Recarga / búsqueda / detalle**: `page.reload()`, filtro o búsqueda del listado, abrir el detalle; tras eliminar, que no reaparezca.
Cuando aplique, también logout/login y otro rol (p. ej. lo que registra la fundadora lo ve el staff asignado).

## Autorización

Prueba en **dos niveles**: UI (no se ve/redirige/404) **y** backend (aunque se fuerce el request, no cambia nada).

1. **Matriz de páginas**: para cada ruta del inventario y cada rol (anónimo, staff, owner, superadmin) → resultado esperado (permitido / redirect login con `callbackUrl` / redirect `/staff` / `/sin-acceso` / 404). Usa datos parametrizados; rutas dinámicas con IDs reales obtenidos de la base.
2. **Replay de Server Actions** (`captureServerAction` / `replayServerAction` / `wasDenied` / `wasBlocked` / `wasAccepted`):
   ```ts
   const captured = await captureServerAction(owner, () => owner.getByRole("button", { name: "Guardar" }).click());
   const res = await replayServerAction(await apiAs("staff"), captured);       // misma ruta
   expect(wasDenied(res), `${res.outcome} ${res.status}`).toBe(true);
   expect(await db.x.findUnique(...)).toEqual(antes);                          // nada cambió
   const ok = await replayServerAction(await apiAs("owner"), captured);        // control positivo
   expect(wasAccepted(ok)).toBe(true);
   ```
   - Staff/anónimo en rutas `/admin/*` son detenidos por el middleware (redirect = `denied`): eso prueba la barrera, no el permiso de la acción.
   - Para el **permiso de la acción**, usa un rol que pase el middleware sin tener el permiso: OWNER intentando `roles:assign_super_admin` (crear usuario SUPER_ADMIN, promover a SUPER_ADMIN) desde `/admin/settings/users`.
   - Para **IDOR**: staff con `staffUpdateChecklistItemAction` sobre una tarea de un evento **no asignado** (captura sobre su evento y cambia el id en `body`), tokens de otro evento en acciones públicas del portal/RSVP/cápsula, IDs inexistentes.
   - `body` del replay: el request de una Server Action es JSON (`[args]`) o multipart; reemplaza IDs con cuidado y documenta la variante.
   - Resultados: `wasDenied` = `denied` (sin sesión/permiso) **o** `not-found` (recurso ajeno/inexistente, respuesta genérica); `wasForbidden` = sólo `denied`; `wasBlocked` = `wasDenied` o `not-executed` (Next no ejecutó la acción en esa ruta).
3. **APIs restringidas**: `apiAs(null)` y `apiAs("staff")` contra `/api/admin/leads-export`, `/api/events/<id>/guests.csv`, `/admin/finance/export`, `/api/media/upload` (sin sesión / origen ajeno), `/api/cron/notifications` (sin/con secreto incorrecto), webhooks sin firma.
4. **Acciones ocultas**: si la UI esconde un botón para un rol, verifica además el backend con replay.
5. **Tokens**: token inexistente, token con formato inválido, token de otro evento, token rotado (el viejo deja de funcionar) → 404 genérico sin filtrar datos.

## Autenticación

Login válido por rol (redirige a su home), contraseña incorrecta y usuario inexistente (mismo mensaje genérico, sin enumerar usuarios), campos vacíos, usuario desactivado (crea uno propio, desactívalo con Prisma o UI), logout (cookie eliminada; volver atrás no muestra datos privados; request directo a página privada → login), `callbackUrl` respetado y **sólo** rutas internas (`callbackUrl=https://evil.example` no debe redirigir fuera), sesión en dos pestañas (logout en una ⇒ la otra pierde acceso al siguiente request), cambio de rol/desactivación con sesión abierta (el siguiente request ya no autoriza). Contraseña: no hay recuperación por correo pública (verifica y marca NOT APPLICABLE si no existe); reset de contraseña de staff/usuarios por admin sí existe.

**Logout = revocación de todas las sesiones de la cuenta** (`sessionVersion`, project-profile §Sesión). Toda prueba que cierra sesión, restablece una contraseña, desactiva o cambia un rol usa **su propia cuenta** (`createTeamUser(db, { role })` de `tests/e2e/permissions/_helpers.ts`), nunca `ACCOUNTS.*`, porque eso tumbaría las sesiones compartidas del carril. Para probar la revocación, copia la cookie antes del logout (`sessionCookie(page)`). Después repítela en un contexto propio, `` playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: `${SESSION_COOKIE}=${copia}` } }) ``, y pide la página con `probe(api, "/admin/…")`: debe dar `307` a `/login` (AUTH-025, AUTH-038).

**Atributos de la cookie**: valídalos en el `Set-Cookie` real del `POST /login`, no en el almacén del navegador (ver [Recetas cross-browser](#recetas-cross-browser), WebKit).

### Forjar un JWT para probar la renovación
La renovación deslizante (el middleware re-emite la cookie sólo en GET cuando el JWT tiene ≥ 1 h) no se puede probar esperando una hora. `tests/e2e/auth/_jwt.ts` forja JWT auténticos con el mismo secreto del servidor:
- `forgeSessionToken({ uid, role, name, email, sessionVersion }, ageSeconds)` usa `encode` de `next-auth/jwt` con `AUTH_SECRET` (de `.env`, cargado por `playwright.config`), la sal igual al nombre de la cookie (`authjs.session-token`) y `maxAge` de 12 h. Como `encode` siempre fija `iat` = ahora, corre el reloj del proceso de la prueba sólo mientras cifra. El servidor no se toca.
- `readSessionToken(valor)` descifra una cookie emitida por el servidor (`null` si no es válida). `sessionSetCookies(res.headersArray())` extrae los `Set-Cookie` de sesión; `""` significa borrado.

```ts
const user = await createTeamUser(db, { role: "OWNER" });                       // cuenta propia
const old = await forgeSessionToken(claims(user), 2 * 3600);                    // iat de hace 2 h
const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { cookie: `authjs.session-token=${old}` } });
const res = await api.get("/admin", { maxRedirects: 0 });
expect(res.status()).toBe(200);
const renewed = sessionSetCookies(res.headersArray()).filter(Boolean);
expect(renewed).toHaveLength(1);                                                // exígelo explícito: nunca afirmes dentro de un for sobre un arreglo que puede venir vacío
expect(await readSessionToken(renewed[0]!)).toMatchObject({ uid: user.id, role: "OWNER", sessionVersion: 0 }); // + iat reciente, exp ≈ +12 h
```
Controles que acompañan a esa prueba (AUTH-053..059 en `tests/e2e/auth/session-renewal.spec.ts`):
- un GET RSC también renueva;
- un POST de Server Action no re-emite, aunque corre autenticado;
- un JWT reciente no se renueva, y la cookie renovada no se vuelve a emitir antes de 1 h;
- una cookie inválida conserva su borrado;
- un JWT revocado (`sessionVersion` vieja) no autoriza aunque el middleware lo renueve;
- `/api/auth/session` no re-emite.

Prueba de mutación: con el middleware sin renovar, AUTH-053/054 deben fallar.

Precauciones:
- `forgeSessionToken` reemplaza `globalThis.Date` en el worker durante un `await`. No lances otro trabajo asíncrono en paralelo en ese worker mientras forja.
- No imprimas el token ni el secreto en adjuntos o logs.
- Requiere `AUTH_SECRET` en el `.env` local; nunca forjes contra un entorno que no sea la build E2E.

## Negativas y formularios

Por cada formulario importante: requeridos vacíos, formatos (email, teléfono, montos negativos, fechas pasadas), límites (min/max de invitadas, longitud de textos), caracteres especiales y HTML/script (que se muestre escapado), duplicados (slug, email de usuario), doble click / doble envío (un solo registro en base), cancelar (no persiste), recarga a mitad (no duplica), atrás/adelante. Valida el mensaje de error de campo **y** que el backend rechace (replay con datos inválidos o `page.route` para saltar la validación del cliente → la base no cambia). Solo prueba códigos HTTP que el sistema realmente produce.

## Antes de hidratar

Los formularios públicos y por token llegan en el HTML del servidor. En un celular lento, la persona escribe o toca «Enviar» antes de que React hidrate. Hay dos riesgos: que se borre lo escrito, y que el formulario se envíe de forma nativa por GET con datos personales en la URL. El patrón de la app está en project-profile §Formularios públicos. Una regresión de esto debe **escenificar el celular lento de forma determinista**, no depender de la suerte. Los ayudantes están en `tests/e2e/events/_helpers.ts`:

| Ayudante | Qué hace |
|---|---|
| `holdPageChunk(page, segmento)` | Retiene con `page.route` el chunk `/_next/static/chunks/app/<segmento>/page-<hash>.js` hasta `release()`. El HTML se ve, el runtime y el layout cargan, pero los componentes cliente de la página no hidratan. El segmento es la ruta del build con sus grupos: `"(public)/contacto"`, `"(experience)/e/[slug]/[token]"`, `"(experience)/mi-evento/[token]"`. `requested()` espera a que el navegador lo pida. |
| `fillBeforeHydration(campo, valor, browserName)` | `fill` como la persona. En WebKit, si el campo sigue oculto, asigna el valor en el DOM y anota la prueba (ver abajo). |
| `watchRequests(page)` | Se instala **antes** de `goto`. `documents` lista las navegaciones del marco principal (método + ruta con query) y `leaking(...valores)` devuelve las URLs pedidas que contienen esos valores. |
| `trySubmitBeforeHydration({ submit, enterIn, requests }, browserName)` | Intenta enviar como alguien con prisa: Enter en un campo y clic forzado en el botón, tras comprobar que nada lo tapa. En WebKit con el formulario oculto devuelve `false` y anota la prueba. |
| `expectGuardedBeforeHydration(form, submit)` | Aserciones *soft* del HTML sin hidratar: botón deshabilitado, `aria-busy="true"` y `method="post"`. |

```ts
const requests = watchRequests(page);
const held = await holdPageChunk(page, "(experience)/e/[slug]/[token]");
await page.goto(path, { waitUntil: "domcontentloaded" });       // "load" esperaría al chunk retenido
await held.requested();
const form = page.getByRole("region", { name: "Confirmación de asistencia", includeHidden: true });
const name = form.getByRole("textbox", { name: "Tu nombre", includeHidden: true });
const submit = form.getByRole("button", { name: "Enviar mi respuesta", includeHidden: true });
await fillBeforeHydration(name, valor, browserName);
await trySubmitBeforeHydration({ enterIn: name, submit, requests }, browserName);
await expectGuardedBeforeHydration(form.locator("form"), submit);
held.release();
await expect(submit).toBeEnabled();                                 // hidrató
expect(requests.documents).toEqual([{ method: "GET", path }]);      // ningún envío nativo
expect(new URL(page.url()).search).toBe("");
await expect(name).toHaveValue(valor);                              // lo escrito sigue ahí
// … envío normal ya hidratado → validar en base; al final requests.leaking(valor) === []
```

Reglas:
- **Demuestra que no estaba hidratado** al escribir: `toBeDisabled()` del botón, o que el campo no tenga `__reactFiber$`. Sin eso, si el componente pasa a un chunk compartido, la prueba pasa sin probar nada.
- Fuera de WebKit, antes del intento el botón tiene que estar **visible**. React revela con retraso (`requestAnimationFrame`) el contenido que llega en streaming. Si la prueba no escribe antes (p. ej. sólo intenta «Siguiente»), espera el título del paso o el botón. Si no, el botón mide 0×0 y el chequeo de «nada lo tapa» encuentra el header fijo (CONF-025).
- **WebKit** no pinta los segmentos en streaming (Suspense) mientras quede un script pendiente: su `requestAnimationFrame` no corre hasta el `load`. El formulario existe pero está oculto, y retener `main-app` en lugar de la página no ayuda. Usa locators con `includeHidden: true` (`getByLabel` ya incluye los ocultos). `fillBeforeHydration` asigna el valor en el DOM, que es lo que el formulario debe respetar al hidratar. `trySubmitBeforeHydration` no escenifica ningún intento, porque nadie puede tocar un formulario oculto. `expectGuardedBeforeHydration` sí aplica. Con esto la prueba corre en WebKit y **no** es NOT APPLICABLE. (MEM-021 todavía se salta en WebKit con una justificación anterior a estos ayudantes; puede migrarse.)
- Para el defecto «se borra lo escrito», basta con escribir, liberar, `toBeEnabled()` y `toHaveValue(valor)`, y después enviar y validar en base (PUB-049, GST-026/027, PORT-021/022, MEM-021). Para «envío por GET», agrega `watchRequests` y el intento de envío (GST-028, PORT-023..025, CONF-025).
- Firefox y WebKit sólo corren `@P0` con la configuración normal. Si tocas uno de estos formularios y su regresión es `@P1`, córrela también en esos motores con una configuración temporal fuera del repo.

**Hidratación que falla (React #418).** Para el defecto de `error.tsx` tardío (project-profile §Hidratación en Firefox), `tests/e2e/navigation/hydration.spec.ts` retrasa sólo el chunk de `error.tsx` del segmento con `page.route` (2 s). Con `addInitScript` guarda en `DOMContentLoaded` el `<main id="contenido">` del servidor. Después del `load` exige que React lo haya hidratado (`__reactFiber$`) y que siga siendo **el mismo nodo**: tras un #418, React lo reemplaza. Úsalo como plantilla para cualquier sospecha de re-pintado completo en el cliente.

## API

`request`/`apiAs` contra route handlers: método no permitido, sin sesión, rol insuficiente, `Origin` ajeno (CSRF), payload inválido (400/422), recurso inexistente (404), éxito (200 + contenido correcto: CSV con encabezados, ICS válido, JSON de health). Webhooks: sin firma / firma inválida → rechazado; evento repetido → idempotente (un solo efecto en base). Uploads: tipo por magic bytes (un `.jpg` que en realidad es texto → rechazado), tamaño máximo, imagen válida → `MediaAsset` creado; `/api/media/[id]` sin firma o con firma vencida → denegado.

## Responsive

Proyecto `mobile-chrome` (390×844) corre todo lo etiquetado `@mobile`: marca así los recorridos que la clienta/invitada/staff hace desde el celular (configurador, cotización, pago, portal, RSVP, cápsula, staff). Para 1440×900, 1366×768 y 768×1024 usa pruebas `@responsive` con `page.setViewportSize` en un bucle:
```ts
for (const vp of [{ w: 1440, h: 900 }, { w: 1366, h: 768 }, { w: 768, h: 1024 }, { w: 390, h: 844 }]) {
  await page.setViewportSize({ width: vp.w, height: vp.h });
  await page.goto(ruta);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `scroll horizontal en ${vp.w}×${vp.h}`).toBeLessThanOrEqual(1);
  await expect(page.getByRole("button", { name: CTA })).toBeInViewport();
}
```
Valida también que el menú móvil abra/cierre y que tablas admin no rompan el layout (scroll contenido en su contenedor).

## Accesibilidad

`const { blocking } = await scanA11y(page, testInfo)` en páginas clave (públicas, configurador, cotización, portal, RSVP, login, dashboard admin, un formulario admin). `blocking` (critical + serious) ⇒ FAIL con el detalle adjunto; `moderate/minor` ⇒ observación en el informe. Además: navegación por teclado del formulario crítico (Tab llega al CTA, foco visible), labels asociados (`getByLabel` funciona), landmarks (`main`, `nav`), `prefers-reduced-motion` respetado cuando haya animaciones.

## Recetas cross-browser

Aprendidas en la regresión con Firefox, WebKit y mobile-chrome. Antes de declarar un bug, compara el síntoma con esta tabla. Una prueba que sólo falla en un motor suele tener la causa en la prueba; las excepciones son el #418 y el formulario que borra lo escrito.

| Síntoma | Causa | Receta |
|---|---|---|
| Firefox: `page.reload: NS_BINDING_ABORTED` justo después de una acción (OPS-010) | El componente llama `router.refresh()` tras la Server Action. La prueba recarga mientras el cuerpo RSC de ese refresh sigue llegando en streaming. Firefox lo aborta, Next registra «Failed to fetch RSC payload … Falling back to browser navigation» y esa navegación aborta la recarga. | Registra `routerRefreshed(page, pathname)` (`tests/e2e/operations/_helpers.ts`) **antes** de disparar la acción y espéralo antes de `page.reload()`. Espera `response.finished()`, es decir, el cuerpo completo: con sólo los encabezados siguió fallando 2/5. La misma receta sirve para cualquier `reload` o `goto` inmediato tras una acción que refresca. |
| WebKit: `expect(cookie.sameSite).toBe("Lax")` recibe `"None"` (AUTH-001..005) | WebKit de Playwright en Windows guarda las cookies sin SameSite y `context.cookies()` devuelve `"None"`. Es una limitación del motor, no de la app. | Valida el encabezado real: `const set = waitForSessionSetCookie(page)` antes de enviar el login, y luego exige `HttpOnly`, `SameSite=Lax` y `Path=/` en `(await set).attributes` (`parseSetCookie`, en `tests/e2e/permissions/_helpers.ts`). Del almacén, comprueba sólo que la cookie guardada tiene el mismo valor y es `httpOnly`, y que no aparece en `document.cookie`. Si quieres conservar la aserción del almacén, que sea con `browserName !== "webkit"`. |
| Firefox: error de consola `downloadable font: download failed … status=2152398850` (AUTH-046/047) | `2152398850` = `0x804B0002` = `NS_BINDING_ABORTED`: una navegación inmediata (p. ej. `page.goto` tras la redirección del login) canceló el woff2 de `next/font`. | Ya está en `BENIGN` (`tests/e2e/fixtures/guard.ts`), **sólo** con ese código y para `/_next/static/media/*.woff2`. No lo amplíes ni agregues `guard.allow` de fuentes: otro fallo de fuente (404, CORS) sigue siendo error. |
| Firefox: `pageerror` React #418 intermitente | Chunk de `error.tsx` tardío en un layout sin `<SegmentChildren>` (project-profile §Hidratación en Firefox). | Es **APPLICATION BUG**: no lo silencies. Reprodúcelo retrasando ese chunk (NAV-034..036 en `hydration.spec.ts`). |
| Firefox: `waitForLoadState("networkidle")` excede el timeout (QUO-019) | `networkidle` no es confiable en Firefox. | Usa `gotoReady`/`waitForHydration` o una aserción web-first del estado esperado. `auth/session.spec.ts` todavía lo usa en varias pruebas: es un riesgo conocido. |
| WebKit/Firefox: lo escrito desaparece o el formulario «no se envía» | La prueba interactuó antes de hidratar (CRIT-010 en `/contacto`), o hay una regresión del patrón de formularios. | Espera `toBeEnabled()` del botón antes de escribir. Si la escritura antes de hidratar se pierde en un formulario **público**, es bug de la app (project-profile §Formularios públicos), no de la prueba. |
| WebKit: un formulario en streaming «no existe» o no se puede tocar con JS retenido | WebKit no revela el streaming hasta el `load`. | `includeHidden: true` + `fillBeforeHydration`/`trySubmitBeforeHydration` (ver [Antes de hidratar](#antes-de-hidratar)). |
| Strict mode que falla «a veces» (QUO-018, MEM-001) | El texto del toast coincide con el Historial, o una ayuda contiene la misma frase. Según el momento hay 1 o varias coincidencias. | Acota por región o usa `{ exact: true }` (ver [Locators](#locators-y-sincronización)). |
| `worker process exited unexpectedly` (código `0xC0000409` / `3221226505`) a los 0 ms, antes del cuerpo de la prueba | Caída del worker de Node en Windows. | ENVIRONMENT: repite la prueba sola con `--retries=0`. No la cuentes como FAIL ni como FLAKY de la app. |

## BLOCKED, NOT APPLICABLE, FLAKY

- Dependencia caída (p. ej. S3): `test.skip(true, "BLOCKED: …")` + `test.info().annotations.push({ type: "blocked", description: "ENVIRONMENT ISSUE: …" })`.
- No aplica al sistema (p. ej. recuperación de contraseña pública): `{ type: "not-applicable", description: "por qué" }` + skip.
- Bug conocido que hace fallar una prueba: **no** la marques skip ni `test.fail()` para que "pase": déjala fallar y anota `{ type: "bug", description: "BUG-007" }`.
- Inestable: reproduce con `--repeat-each=5 --retries=0`; busca la causa (carrera, dato compartido, animación). Si es de la prueba, corrígela; si es de la app, es bug (a menudo una carrera real).

## Qué evitar

`waitForTimeout`; `waitForLoadState("networkidle")`; asserts que sólo miran un toast; depender de otra prueba; mutar datos del seed (incluido cerrar sesión o restablecer contraseñas de `ACCOUNTS.*`); interactuar antes de hidratar fuera de una prueba que lo escenifica a propósito; `page.reload()` con un `router.refresh()` en vuelo; leer `sameSite` del almacén de WebKit; subir timeouts para "estabilizar"; `force: true` en clicks sin explicar; selectores por clases de Tailwind; `test.only`; silenciar el guard de consola con patrones amplios (cada `guard.allow(/…/)` lleva comentario con la razón; nunca `[navegación]` ni `#418`).
