# Diseño de pruebas — convenciones y patrones

Contenido: [Anatomía](#anatomía-de-una-prueba) · [IDs y etiquetas](#ids-y-etiquetas) · [Locators y espera](#locators-y-sincronización) · [Datos](#datos-de-prueba) · [Persistencia](#persistencia) · [Autorización](#autorización) · [Autenticación](#autenticación) · [Negativas](#negativas-y-formularios) · [API](#api) · [Responsive](#responsive) · [Accesibilidad](#accesibilidad) · [Estados especiales](#blocked-not-applicable-flaky) · [Qué evitar](#qué-evitar)

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

- **ID** en el título entre corchetes: `[PREFIJO-NNN]` (3 dígitos), único en toda la suite. Prefijos por paquete (runbook §Paquetes): `AUTH PERM NAV API PUB CONF AI QUO-C PAY LEAD CUST CAT QUO EVT CAL PORT GST MEM OPS STF INV PUR FIN SET CNT NOT SMK CRIT RESP A11Y REG`. El mismo ID aparece en `TEST_COVERAGE_MATRIX.md` y, si falla, en el BUG.
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
- Toasts (sonner): `page.getByText("Guardado")` o `getByRole("status")`; valida además el efecto en base.
- Si no hay forma accesible de ubicar un control, eso es un hallazgo de accesibilidad (UX ISSUE), no una razón para usar CSS frágil.

## Datos de prueba

- Las pruebas son **independientes y repetibles**: crean lo que necesitan con nombres únicos (`uniq("E2E Lead")`, `uniqEmail()`, `uniqPhone()`) y no dependen del orden.
- Seed = sólo lectura (tokens y registros compartidos por todos los workers del carril).
- Factories disponibles: `createCustomer`, `createLead`, `createUnreadNotification`. Para el resto crea helpers en `tests/e2e/<área>/_helpers.ts` usando Prisma (`db`) y las utilidades del dominio (`generateToken`, `generateCode`, `dateOnly`) — importables desde `../../../src/lib/...` cuando no dependan de `server-only`.
- Fechas futuras disponibles: calcula con la regla de disponibilidad real (lee `availability-service` / settings) o toma una fecha libre que el propio configurador ofrezca.
- No hace falta limpieza: la base del carril se re-siembra por corrida. Sí evita colisiones dentro de la corrida (nombres únicos).
- Estado global (flags, ajustes, reglas de disponibilidad, precios globales): sólo en `*.global.spec.ts`, `test.describe.configure({ mode: "serial" })` y restaurar en `finally`/`afterEach`.

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
3. **APIs restringidas**: `apiAs(null)` y `apiAs("staff")` contra `/api/admin/leads-export`, `/api/events/<id>/guests.csv`, `/admin/finance/export`, `/api/media/upload` (sin sesión / origen ajeno), `/api/cron/notifications` (sin/con secreto incorrecto), webhooks sin firma.
4. **Acciones ocultas**: si la UI esconde un botón para un rol, verifica además el backend con replay.
5. **Tokens**: token inexistente, token con formato inválido, token de otro evento, token rotado (el viejo deja de funcionar) → 404 genérico sin filtrar datos.

## Autenticación

Login válido por rol (redirige a su home), contraseña incorrecta y usuario inexistente (mismo mensaje genérico, sin enumerar usuarios), campos vacíos, usuario desactivado (crea uno propio, desactívalo con Prisma o UI), logout (cookie eliminada; volver atrás no muestra datos privados; request directo a página privada → login), `callbackUrl` respetado y **sólo** rutas internas (`callbackUrl=https://evil.example` no debe redirigir fuera), sesión en dos pestañas (logout en una ⇒ la otra pierde acceso al siguiente request), cambio de rol/desactivación con sesión abierta (el siguiente request ya no autoriza). Contraseña: no hay recuperación por correo pública (verifica y marca NOT APPLICABLE si no existe); reset de contraseña de staff/usuarios por admin sí existe.

## Negativas y formularios

Por cada formulario importante: requeridos vacíos, formatos (email, teléfono, montos negativos, fechas pasadas), límites (min/max de invitadas, longitud de textos), caracteres especiales y HTML/script (que se muestre escapado), duplicados (slug, email de usuario), doble click / doble envío (un solo registro en base), cancelar (no persiste), recarga a mitad (no duplica), atrás/adelante. Valida el mensaje de error de campo **y** que el backend rechace (replay con datos inválidos o `page.route` para saltar la validación del cliente → la base no cambia). Solo prueba códigos HTTP que el sistema realmente produce.

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

## BLOCKED, NOT APPLICABLE, FLAKY

- Dependencia caída (p. ej. S3): `test.skip(true, "BLOCKED: …")` + `test.info().annotations.push({ type: "blocked", description: "ENVIRONMENT ISSUE: …" })`.
- No aplica al sistema (p. ej. recuperación de contraseña pública): `{ type: "not-applicable", description: "por qué" }` + skip.
- Bug conocido que hace fallar una prueba: **no** la marques skip ni `test.fail()` para que "pase": déjala fallar y anota `{ type: "bug", description: "BUG-007" }`.
- Inestable: reproduce con `--repeat-each=5 --retries=0`; busca la causa (carrera, dato compartido, animación). Si es de la prueba, corrígela; si es de la app, es bug (a menudo una carrera real).

## Qué evitar

`waitForTimeout`; asserts que sólo miran un toast; depender de otra prueba; mutar datos del seed; subir timeouts para "estabilizar"; `force: true` en clicks sin explicar; selectores por clases de Tailwind; `test.only`; silenciar el guard de consola con patrones amplios (cada `guard.allow(/…/)` lleva comentario con la razón).
