# Seguridad

## Autenticación y sesiones

- **Equipo** (SUPER_ADMIN, OWNER, STAFF): Auth.js v5 con Credentials (bcrypt cost 10) y sesión **JWT** en cookie
  `httpOnly`, `sameSite=lax` y `secure` automáticamente bajo HTTPS (`__Secure-` prefix). Duración 12 h.
- Login con rate limit por email (8 intentos / 15 min), comparación de tiempo constante (hash dummy para
  usuarios inexistentes) y mensajes genéricos (no enumeración).
- **Clientas e invitadas** no tienen contraseña: acceso por **tokens opacos de 256 bits** (`generateToken`) en URL
  (portal, micrositio, RSVP personal, cotización, memory capsule). Se validan con formato antes de consultar
  (`isPlausibleToken`), responden 404 genérico si no existen y pueden **rotarse** desde el admin (auditado).
  Recuperación de acceso por email en `/mi-evento` sin revelar si el correo existe.
- Páginas por token envían `X-Robots-Tag: noindex` y `Referrer-Policy: no-referrer` (el token no se filtra a terceros).

## Autorización (RBAC server-side)

- Permisos centralizados en `src/server/auth/permissions.ts` (`ROLE_PERMISSIONS`, `can()`), probados en
  `tests/unit/permissions.test.ts`.
- Middleware (edge) bloquea `/admin` (SUPER_ADMIN/OWNER) y `/staff` (STAFF/OWNER/SUPER_ADMIN); **además** cada
  página llama `requirePagePermission(...)` y cada Server Action usa `protectedAction({ permission })`.
- STAFF sólo ve eventos donde tiene `StaffAssignment` y sólo modifica tareas asignadas a ella (o sin asignar) de
  esos eventos; nunca ve información financiera.
- OWNER no puede crear SUPER_ADMIN; nadie puede cambiar su propio rol ni desactivar al último SUPER_ADMIN.

## Validación y errores

- Todo input se valida con **Zod** en servidor (los esquemas se comparten con el cliente sólo para UX).
- Los precios **siempre** se recalculan en servidor (`QuoteEngine`); el total enviado por el cliente se ignora.
- Errores: el wrapper de acciones devuelve mensajes seguros en español y un `errorId` correlacionable en logs;
  nunca stack traces. Páginas de error muestran `digest`.

## CSRF

- Server Actions: protección nativa de Next (verificación Origin/Host).
- Route Handlers con efectos (`/api/media/upload`, `/api/memory/[token]/upload`, `/api/analytics/track`): `isSameOrigin`.
- Auth.js: token CSRF propio en el flujo de credenciales.
- Webhooks y cron: autenticados por firma/secreto (no por cookies).

## Rate limiting

`rateLimit(key, { limit, windowMs })` persistido en PostgreSQL (`RateLimitBucket`, compartido entre réplicas,
degradación a memoria si la DB falla). Aplicado a login, acciones públicas (`publicAction` por defecto 30/min por IP),
configurador, IA, RSVP, mensajes, subidas, acceso al portal y tracking.

## Pagos y webhooks

- **Nunca** se confía en el redirect del navegador: sólo un webhook verificado (o un pago manual auditado) marca `PAID`.
- Firmas: Mock (HMAC-SHA256 `t.body`, tolerancia 300 s), Stripe (`Stripe-Signature`), Mercado Pago (`x-signature` + consulta del pago a la API).
- **Idempotencia**: `WebhookEvent (provider, externalId)` único; reintentos duplicados responden 200 sin reprocesar.
  `Payment.idempotencyKey` único; checkout con `Idempotency-Key` hacia el proveedor.
- La página de resultado usa parámetros firmados (HMAC) para no permitir enumeración de pagos.

## Archivos

- Tipos permitidos: JPG, PNG, WEBP (y PDF para comprobantes), verificados por **magic bytes** (no por extensión ni
  Content-Type) — SVG/HTML rechazados. Tamaño máximo configurable (`UPLOAD_MAX_MB`).
- Claves de objeto generadas por el servidor (sin nombres de usuario, sin path traversal).
- Bucket **privado**; lectura mediante URLs firmadas de la app (`/api/media/[id]?exp&sig`, HMAC con `AUTH_SECRET`) que
  redirigen a URLs prefirmadas S3 de 5 minutos. Nada se guarda en el filesystem efímero del contenedor.
- Fotos de invitadas requieren **consentimiento** explícito y quedan pendientes de moderación.

## Secretos

- Sólo en variables de entorno (`.env` fuera de git; `.env.example` sin secretos). `AUTH_SECRET` obligatorio en producción.
- Proveedores sin credenciales caen a Mock **visible** en el admin ("Modo demo").

## Auditoría

`AuditLog` para acciones sensibles: cambios de precio/costo del catálogo, descuentos y precios en cotizaciones,
nuevas versiones y aceptación, cambios de evento (fecha/hora/invitadas), cancelaciones, rotación de tokens,
pagos manuales y reembolsos, ajustes de inventario, cambios de montos de compras, costos manuales, cierre de evento,
eliminaciones, configuración de precios/flags, usuarios y roles. Visor en `/admin/settings/audit`.

## Privacidad (México)

- Datos mínimos; alergias/restricciones sólo para operación del evento.
- Direcciones completas sólo visibles para invitadas que confirman asistencia.
- Aviso de privacidad (LFPDPPP, derechos ARCO) y términos incluidos como borrador — **validar con asesor legal**.
- `noindex` en admin y portales; `robots.txt` excluye zonas privadas.

## Cabeceras

`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` restrictiva, `Strict-Transport-Security`, `poweredByHeader: false`.

## Checklist de producción

- [ ] `AUTH_SECRET`, `CRON_SECRET`, `PAYMENT_WEBHOOK_SECRET` generados con `openssl rand -base64 32`.
- [ ] `APP_URL`/`AUTH_URL` con HTTPS y dominio final; `AUTH_TRUST_HOST=true` detrás de Traefik.
- [ ] Bucket privado con versionado; credenciales con permisos mínimos.
- [ ] Respaldos diarios verificados (ver `BACKUP_RESTORE.md`).
- [ ] Cambiar/eliminar cuentas demo; nunca correr el seed demo en producción.
