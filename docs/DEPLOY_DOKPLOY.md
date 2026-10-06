# Despliegue en Dokploy (VPS en OcanDigital / DigitalOcean)

Guía paso a paso para publicar **Ivonne & Rosa** en un VPS administrado con **Dokploy**.
Todo corre dentro de Docker: el servidor **no necesita Node, pnpm ni el cliente de PostgreSQL**.

| Pieza         | Qué se usa                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| App           | Imagen construida desde el `Dockerfile` del repo (Next.js 15 _standalone_, Node 22, usuario no-root `nextjs`, uid 1001) |
| Base de datos | PostgreSQL 16 administrado por Dokploy (servicio _Database_)                                                            |
| Archivos      | Bucket S3 compatible (DigitalOcean Spaces, Cloudflare R2, AWS S3 o MinIO). **Nunca** el disco del contenedor            |
| Proxy / HTTPS | Traefik de Dokploy + Let's Encrypt                                                                                      |
| Migraciones   | `prisma migrate deploy` automático al arrancar el contenedor (`scripts/docker-entrypoint.sh`)                           |
| CI            | GitHub Actions (`.github/workflows/ci.yml`): lint, typecheck, unit, integración, build. **No despliega**                |
| Deploy        | Dokploy construye y despliega solo al hacer push a `main` (webhook / autodeploy)                                        |

> Los nombres de menús corresponden a Dokploy v0.2x. Si tu versión muestra etiquetas un poco
> distintas, la opción equivalente está en la misma pestaña.

---

## 0. Requisitos previos

1. **VPS**: Ubuntu 22.04/24.04 LTS. Mínimo **2 vCPU / 4 GB RAM / 60 GB SSD**; recomendado
   **4 vCPU / 8 GB** si el build se hace en el mismo servidor (ver [Dimensionamiento](#dimensionamiento-de-recursos)).
   Agrega 2–4 GB de _swap_ (el `next build` dentro de Docker usa ~2–3 GB de RAM):
   ```bash
   sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
2. **Dokploy instalado** (`curl -sSL https://dokploy.com/install.sh | sh`) y panel accesible en `http://<IP>:3000`
   (después de configurar un dominio para el panel, cierra el puerto 3000 en el firewall).
3. **Firewall** (DigitalOcean → Networking → Firewalls o `ufw`): entrada sólo **22, 80, 443**.
   No publiques el puerto 5432 de PostgreSQL.
4. **Dominio** con acceso a su DNS (p. ej. `ivonneyrosa.mx`).
5. **Bucket S3** creado (sección 9) y sus llaves de acceso.
6. Repositorio en GitHub con la rama `main` protegida (ver nota en la sección 2).

---

## 1. Crear la app

1. Dokploy → **Projects** → **Create Project** → nombre `ivonne-rosa` (opcional: un _environment_
   `production` y otro `staging`, ver [Staging vs producción](#staging-vs-producción)).
2. Dentro del proyecto → **Create Service** → **Application**.
   - Name: `ivonne-rosa-app`
   - Description: `Plataforma Ivonne & Rosa (Next.js)`
3. Crea también la base de datos **antes** del primer deploy (sección 5): la app la necesita al arrancar
   para aplicar migraciones.

> Alternativa: servicio **Compose** usando `docker-compose.prod.yml` (incluye un PostgreSQL opcional con el
> perfil `with-db`). Se recomienda el tipo **Application** + base administrada por Dokploy: respaldos,
> logs y dominios quedan integrados.

---

## 2. Conectar GitHub

1. Dokploy → **Settings → Git → GitHub → Create GitHub App** (una sola vez). Autoriza la app en tu
   cuenta/organización y dale acceso **sólo** al repositorio de Ivonne & Rosa.
2. En la aplicación → pestaña **General** → **Provider: GitHub**:
   - GitHub Account: la app creada en el paso anterior
   - Repository: `<org>/<repo>`
   - Branch: `main`
   - Build Path: `/`
   - Trigger Type: **On Push** (despliega cada push a `main`)
3. **Autodeploy** queda activo con la GitHub App (webhook automático). Si usas el provider _Git_ genérico,
   copia la **Webhook URL** de la pestaña **Deployments** y agrégala en GitHub → Settings → Webhooks
   (`application/json`, evento _push_).
4. **Importante — proteger `main`**: Dokploy despliega cualquier push a `main` aunque CI falle.
   En GitHub → Settings → Branches → _Branch protection rule_ para `main`: exigir PR + checks
   **"Lint · Typecheck · Unit · Build"** y **"Pruebas de integración"** en verde antes de hacer merge.

---

## 3. Configurar el build

Pestaña **General → Build Type**:

| Campo                | Valor                                                                               |
| -------------------- | ----------------------------------------------------------------------------------- |
| Build Type           | **Dockerfile**                                                                      |
| Docker File          | `Dockerfile`                                                                        |
| Docker Context Path  | `.`                                                                                 |
| Docker Build Stage   | _(vacío: usa la última etapa, `runner`)_                                            |
| Build-time arguments | _(ninguno; el build usa valores de marcador internos y nunca se conecta a la base)_ |

**Watch Paths** (pestaña General, opcional pero recomendado: evita redeploys por cambios sólo de docs):

```
src/**
prisma/**
public/**
scripts/docker-entrypoint.sh
scripts/seed-base/**
package.json
pnpm-lock.yaml
Dockerfile
.dockerignore
next.config.ts
tsconfig.json
postcss.config.mjs
```

Qué hace el `Dockerfile` (multi-stage):

1. `deps`: `pnpm install --frozen-lockfile` (pnpm 9.15.9 vía corepack, caché de BuildKit).
2. `builder`: `prisma generate` + `next build` con variables de marcador
   (`DATABASE_URL=postgresql://build:build@localhost:5432/build`, `AUTH_SECRET` de relleno) y empaqueta el
   seed BASE en `dist/seed.cjs`.
3. `prisma-cli`: instala `prisma@6.19.3` aislado para `migrate deploy` en runtime.
4. `runner`: `node:22-bookworm-slim` + `openssl` + `tini`, usuario `nextjs` (1001), `EXPOSE 3000`,
   `HEALTHCHECK` con `node` contra `http://127.0.0.1:3000/api/health` (la imagen no trae `curl`).

> Si en el futuro se agregan variables `NEXT_PUBLIC_*`, deben pasarse como **Build-time arguments**
> (se incrustan en el bundle del navegador en tiempo de build).

Prueba local de la imagen (en tu máquina, no en el VPS):

```bash
docker build -t ivonne-rosa .
docker run --rm -p 3000:3000 --env-file .env.production ivonne-rosa
curl http://localhost:3000/api/health      # {"status":"ok"}
curl http://localhost:3000/api/health/db   # {"status":"ok","database":"up",...}
```

---

## 4. Variables de entorno

Aplicación → pestaña **Environment** → pega las variables (formato `CLAVE=valor`, una por línea) →
**Save** → **Deploy** (los cambios de variables requieren redeploy).

Generar secretos (en el VPS o en tu máquina):

```bash
openssl rand -base64 32        # AUTH_SECRET
openssl rand -hex 32           # CRON_SECRET
# sin openssl:
docker run --rm node:22-alpine node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### Tabla completa (todas las variables de `.env.example` + las de operación)

| Variable                                   | Producción                                                                                                           | Notas                                                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                 | `production`                                                                                                         | Ya viene fijada en la imagen; no hace falta definirla.                                                                      |
| `APP_URL`                                  | `https://ivonneyrosa.mx`                                                                                             | URL pública con **https** y sin `/` final. Se usa en links de correos, WhatsApp, invitaciones y pagos.                      |
| `APP_NAME`                                 | `Ivonne & Rosa`                                                                                                      | Nombre de marca en correos/plantillas.                                                                                      |
| `APP_TIMEZONE`                             | `America/Mexico_City`                                                                                                | Zona horaria del negocio. No cambiar.                                                                                       |
| `DATABASE_URL`                             | `postgresql://<user>:<pass>@<host-interno>:5432/ivonne_rosa?schema=public`                                           | **Internal Connection URL** de la base de Dokploy (sección 5). Agrega `&connection_limit=10` si quieres acotar el pool (no menos de 10: cada pago en línea que se está abriendo retiene una conexión hasta 15 s mientras la pasarela crea la sesión). |
| `TEST_DATABASE_URL`                        | _(no definir)_                                                                                                       | Sólo desarrollo/CI.                                                                                                         |
| `E2E_DATABASE_URL`                         | _(no definir)_                                                                                                       | Sólo E2E local/CI.                                                                                                          |
| `AUTH_SECRET`                              | `openssl rand -base64 32`                                                                                            | **Obligatoria** (la app no arranca sin ella en producción). Cambiarla cierra todas las sesiones.                            |
| `AUTH_TRUST_HOST`                          | `true`                                                                                                               | Necesaria detrás del proxy Traefik de Dokploy.                                                                              |
| `AUTH_URL`                                 | `https://ivonneyrosa.mx`                                                                                             | Igual que `APP_URL`.                                                                                                        |
| `STORAGE_DRIVER`                           | `s3`                                                                                                                 | **Siempre `s3`** en producción (el disco del contenedor se borra en cada deploy).                                           |
| `STORAGE_ENDPOINT`                         | Spaces: `https://nyc3.digitaloceanspaces.com` · R2: `https://<account-id>.r2.cloudflarestorage.com` · AWS: _(vacío)_ | Endpoint S3 compatible (sección 9).                                                                                         |
| `STORAGE_REGION`                           | Spaces/AWS: `us-east-1` (o la región del bucket) · R2: `auto`                                                        |                                                                                                                             |
| `STORAGE_BUCKET`                           | `ivonne-rosa-prod`                                                                                                   | Bucket **privado**.                                                                                                         |
| `STORAGE_ACCESS_KEY`                       | llave del proveedor                                                                                                  | Llave con acceso **sólo** a ese bucket si el proveedor lo permite.                                                          |
| `STORAGE_SECRET_KEY`                       | secreto del proveedor                                                                                                |                                                                                                                             |
| `STORAGE_FORCE_PATH_STYLE`                 | Spaces/AWS: `false` · R2/MinIO: `true`                                                                               |                                                                                                                             |
| `STORAGE_PUBLIC_URL`                       | _(vacío)_ o URL de CDN                                                                                               | Si se omite, los archivos se sirven con URLs firmadas (recomendado).                                                        |
| `UPLOAD_MAX_MB`                            | `8`                                                                                                                  | Tamaño máximo por archivo.                                                                                                  |
| `PAYMENT_PROVIDER`                         | `stripe` o `mercadopago` (`mock` sólo staging)                                                                       | Con `mock` no se cobra dinero real.                                                                                         |
| `PAYMENT_SECRET_KEY`                       | llave secreta **live** del proveedor                                                                                 | En staging usa llaves de prueba.                                                                                            |
| `PAYMENT_PUBLIC_KEY`                       | llave pública del proveedor                                                                                          |                                                                                                                             |
| `PAYMENT_WEBHOOK_SECRET`                   | secreto de firma del webhook                                                                                         | Lo da el panel del proveedor al registrar el webhook (ver [Webhooks](#webhooks-de-pagos)). Nunca dejes el valor de ejemplo. |
| `EMAIL_PROVIDER`                           | `resend`                                                                                                             | `mock` sólo guarda en el "inbox" interno (NotificationLog).                                                                 |
| `EMAIL_API_KEY`                            | API key de Resend                                                                                                    |                                                                                                                             |
| `EMAIL_FROM`                               | `Ivonne & Rosa <hola@ivonneyrosa.mx>`                                                                                | Dominio verificado en Resend (SPF/DKIM).                                                                                    |
| `WHATSAPP_PROVIDER`                        | `cloud_api` o `mock`                                                                                                 | Con `mock` se usan deep links `wa.me`.                                                                                      |
| `WHATSAPP_TOKEN`                           | token permanente de Meta                                                                                             | Sólo con `cloud_api`.                                                                                                       |
| `WHATSAPP_PHONE_NUMBER_ID`                 | ID del número en Meta                                                                                                | Sólo con `cloud_api`.                                                                                                       |
| `WHATSAPP_BUSINESS_NUMBER`                 | `52155XXXXXXXX`                                                                                                      | Número público (formato internacional sin `+`).                                                                             |
| `AI_PROVIDER`                              | `anthropic`, `openai` o `mock`                                                                                       |                                                                                                                             |
| `AI_API_KEY`                               | API key del proveedor                                                                                                |                                                                                                                             |
| `AI_MODEL`                                 | _(vacío = default del adaptador)_                                                                                    |                                                                                                                             |
| `AI_DESIGNER_ENABLED`                      | `true` / `false`                                                                                                     | Feature flag.                                                                                                               |
| `PAYMENTS_ENABLED`                         | `true` / `false`                                                                                                     | Feature flag.                                                                                                               |
| `WHATSAPP_ENABLED`                         | `true` / `false`                                                                                                     | Feature flag.                                                                                                               |
| `MEMORY_CAPSULE_ENABLED`                   | `true` / `false`                                                                                                     | Feature flag.                                                                                                               |
| `CRON_SECRET`                              | `openssl rand -hex 32`                                                                                               | Protege `/api/cron/notifications` (sección [Jobs](#jobs-programados-notificaciones)).                                       |
| `SENTRY_DSN`                               | _(opcional)_                                                                                                         |                                                                                                                             |
| `LOG_LEVEL`                                | `info`                                                                                                               | `debug` sólo temporalmente para diagnosticar.                                                                               |
| **Operación (no están en `.env.example`)** |                                                                                                                      |                                                                                                                             |
| `RUN_MIGRATIONS`                           | `true` (default)                                                                                                     | `false` = no correr `prisma migrate deploy` al arrancar (migraciones manuales).                                             |
| `MIGRATION_MAX_ATTEMPTS`                   | `10`                                                                                                                 | Reintentos si la base aún no acepta conexiones.                                                                             |
| `MIGRATION_RETRY_DELAY`                    | `5`                                                                                                                  | Segundos entre reintentos.                                                                                                  |
| `RUN_SEED_BASE`                            | _(vacío)_                                                                                                            | `true` = corre el seed BASE (idempotente) al arrancar. Úsalo sólo en el primer deploy.                                      |
| `SEED_ADMIN_EMAIL`                         | correo de la primera SUPER_ADMIN                                                                                     | Sólo para el seed BASE; ver sección 8.                                                                                      |
| `SEED_ADMIN_PASSWORD`                      | contraseña temporal (≥ 10 caracteres)                                                                                | **Bórrala de Dokploy** después de crear la cuenta.                                                                          |
| `SEED_ADMIN_NAME`                          | `Administración`                                                                                                     | Opcional.                                                                                                                   |
| `PORT` / `HOSTNAME`                        | `3000` / `0.0.0.0`                                                                                                   | Ya vienen en la imagen; no cambiar (el dominio apunta al puerto 3000).                                                      |

> No subas nunca un `.env` real al repositorio. `.dockerignore` excluye `.env*` del contexto de build:
> las variables sólo existen en Dokploy.

---

## 5. PostgreSQL

1. Proyecto → **Create Service → Database → PostgreSQL**:
   - Name: `ivonne-rosa-db`
   - Database Name: `ivonne_rosa`
   - Database User: `ivonne`
   - Database Password: genera una larga (`openssl rand -base64 24`)
   - Docker Image: **`postgres:16`** (misma versión mayor que CI y los scripts de respaldo)
2. **Create** → **Deploy**. Dokploy crea un volumen persistente para `/var/lib/postgresql/data`
   (no lo borres al eliminar servicios).
3. En la base → pestaña **General → Internal Credentials** copia la **Internal Connection URL**
   (host interno tipo `ivonne-rosa-db-xxxxxx`). Úsala como `DATABASE_URL` agregando `?schema=public`:
   ```
   DATABASE_URL=postgresql://ivonne:<password>@ivonne-rosa-db-xxxxxx:5432/ivonne_rosa?schema=public
   ```
4. **No** configures _External Port_: la base sólo debe ser accesible desde la red interna de Dokploy.
   Para consultas manuales abre la terminal de la base en Dokploy (**Docker Terminal**) y usa
   `psql -U ivonne ivonne_rosa`.
5. Configura los respaldos programados de inmediato (sección 10).

---

## 6. Dominio

1. **DNS** (en tu registrador o Cloudflare):
   - `A  @    → <IP del VPS>`
   - `A  www  → <IP del VPS>` (o `CNAME www → ivonneyrosa.mx`)
   - Con Cloudflare: deja la nube **gris (DNS only)** hasta que se emita el certificado; después puedes
     activar el proxy con SSL/TLS en **Full (strict)**.
2. Aplicación → pestaña **Domains → Add Domain**:
   - Host: `ivonneyrosa.mx`
   - Path: `/`
   - Container Port: **`3000`**
   - HTTPS: **activado**
   - Certificate Provider: **Let's Encrypt**
3. Repite para `www.ivonneyrosa.mx` (o configura en **Advanced → Redirects** la redirección `www → raíz`).
4. Actualiza `APP_URL` y `AUTH_URL` con el dominio definitivo y redeploy.

---

## 7. SSL

- Traefik (incluido en Dokploy) emite y renueva automáticamente certificados **Let's Encrypt**
  (desafío HTTP-01 con el _certresolver_ `letsencrypt`) para cada dominio con HTTPS activado.
- Requisitos: el registro **A** ya debe apuntar al VPS y los puertos **80 y 443** abiertos.
- Configura el correo de avisos de Let's Encrypt en Dokploy → **Settings → Server / Web Server**.
- Verificación: `curl -I https://ivonneyrosa.mx/api/health` → `HTTP/2 200` con certificado válido.
- La app envía `Strict-Transport-Security` (HSTS) desde `next.config.ts`: activa HTTPS **antes** de
  compartir la URL. Si el certificado falla, revisa **Dokploy → Traefik → Logs** (rate limits de
  Let's Encrypt, DNS no propagado o proxy de Cloudflare activo durante la emisión).

---

## 8. Migraciones y datos iniciales

### Automático (default)

Cada vez que arranca el contenedor, `scripts/docker-entrypoint.sh`:

1. valida que exista `DATABASE_URL`;
2. ejecuta `prisma migrate deploy` (reintenta hasta `MIGRATION_MAX_ATTEMPTS` si la base aún no responde);
3. si falla, **no** inicia el servidor (el deploy queda marcado como no saludable y Dokploy conserva el
   contenedor anterior si usas _start-first_, ver [Cero downtime](#cero-downtime));
4. inicia `node server.js`.

`RUN_MIGRATIONS=false` desactiva el paso 2 (para correrlas a mano en ventanas de mantenimiento).

### Manual (terminal del contenedor)

Aplicación → **Docker Terminal** (o en el VPS: `docker exec -it $(docker ps -q -f name=ivonne-rosa-app) sh`):

```sh
docker-entrypoint.sh migrate          # prisma migrate deploy
docker-entrypoint.sh migrate-status   # estado de migraciones
prisma migrate status --schema prisma/schema.prisma
```

Migración fallida (`P3009`): corrige la causa, y marca la migración según corresponda
(`prisma migrate resolve --rolled-back <nombre> --schema prisma/schema.prisma` o `--applied <nombre>`),
luego redeploy. Nunca edites una migración ya aplicada en producción.

### Primer arranque: seed BASE + primera SUPER_ADMIN

El seed **BASE** es idempotente (upserts: settings, disponibilidad, presupuestos, estilos, zonas,
checklists) y crea la primera cuenta **SUPER_ADMIN** desde variables de entorno. No borra nada.

1. En **Environment** agrega temporalmente:
   ```
   SEED_ADMIN_EMAIL=ivonne@ivonneyrosa.mx
   SEED_ADMIN_PASSWORD=<contraseña temporal de 12+ caracteres>
   SEED_ADMIN_NAME=Ivonne
   ```
2. Ejecuta el seed (una de dos):
   - **Terminal del contenedor**: `docker-entrypoint.sh seed-base`
     (equivale a `node dist/seed.cjs --base`, el `pnpm db:seed:base` empaquetado; la imagen no trae pnpm ni tsx)
   - o define `RUN_SEED_BASE=true`, **Deploy**, y luego quítala.
3. Entra a `https://<dominio>/login`, cambia la contraseña y crea las cuentas OWNER/STAFF desde el panel.
4. **Borra `SEED_ADMIN_PASSWORD`** de Dokploy (el seed nunca sobrescribe la contraseña de una cuenta existente).

> El seed **DEMO** (`node dist/seed.cjs` sin `--base`) **vacía toda la base** y está bloqueado con
> `NODE_ENV=production` salvo `SEED_ALLOW_DEMO_IN_PRODUCTION=true`. Úsalo sólo en _staging_.

---

## 9. Storage (archivos subidos)

La app guarda fotos, comprobantes y PDFs en un bucket S3 compatible mediante `storeUpload`; el contenedor
**no** conserva archivos. Los archivos se sirven con **URLs firmadas** a través de la app, por lo que el
bucket es **privado** y **no requiere CORS** (las subidas pasan por el servidor).

### DigitalOcean Spaces (recomendado en OcanDigital/DigitalOcean)

1. DigitalOcean → **Spaces Object Storage → Create Bucket**: región `nyc3` (o la más cercana), nombre
   `ivonne-rosa-prod`, **File Listing: Restricted** (privado). CDN desactivado.
2. **Spaces Keys → Generate New Key** (idealmente con acceso limitado a ese bucket).
3. Variables:
   ```
   STORAGE_DRIVER=s3
   STORAGE_ENDPOINT=https://nyc3.digitaloceanspaces.com
   STORAGE_REGION=us-east-1
   STORAGE_BUCKET=ivonne-rosa-prod
   STORAGE_ACCESS_KEY=DO00...
   STORAGE_SECRET_KEY=...
   STORAGE_FORCE_PATH_STYLE=false
   ```

### Cloudflare R2

`STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `STORAGE_REGION=auto`,
`STORAGE_FORCE_PATH_STYLE=true`, token de API R2 con permiso _Object Read & Write_ sólo para el bucket.

### MinIO / RustFS propio

Despliégalo como servicio aparte (con volumen persistente y su propio dominio HTTPS) y usa
`STORAGE_FORCE_PATH_STYLE=true`. Para producción se prefiere un servicio administrado.

### Versionado y ciclo de vida

- Activa **versionado** del bucket para poder recuperar archivos borrados o sobrescritos
  (Spaces y AWS lo soportan vía API; ver `docs/BACKUP_RESTORE.md` → "Bucket de archivos").
  R2 no tiene versionado de objetos: compénsalo con una copia periódica a otro bucket.
- Regla de ciclo de vida: expirar **versiones no actuales** después de 30 días.

### Verificación

Desde el panel admin sube una imagen de prueba y ábrela; o en la terminal del contenedor:

```sh
node -e "fetch('http://127.0.0.1:3000/api/health/db').then(r=>r.text()).then(console.log)"
```

(El bucket debe existir antes del primer upload; la imagen de producción no lo crea automáticamente.
En desarrollo, `pnpm storage:init` lo crea.)

---

## 10. Backup

Resumen (detalle completo en **[docs/BACKUP_RESTORE.md](./BACKUP_RESTORE.md)**):

1. Dokploy → **Settings → S3 Destinations → Add**: bucket **distinto** al de archivos
   (p. ej. `ivonne-rosa-backups`), región, endpoint y llaves. **Test Connection**.
2. Base `ivonne-rosa-db` → pestaña **Backups → Create Backup**:
   - Destination: el S3 anterior · Prefix: `postgres/prod/`
   - Schedule (cron, UTC): `15 9 * * *` (03:15 hora CDMX) · Keep latest: `7`
   - **Enabled** → luego **Run manual backup** para validar.
3. Retención extendida (4 semanales / 6 mensuales): reglas de ciclo de vida en el bucket o
   `scripts/backup/pg-backup.sh` (GFS 7/4/6).
4. Prueba de restauración **mensual** en staging (procedimiento en `BACKUP_RESTORE.md`).

---

## 11. Rollback

Las imágenes son inmutables por commit; volver atrás = desplegar un commit anterior.

1. **Revertir el código (recomendado)**: `git revert <commit>` → PR → merge a `main` → Dokploy redeploya.
   Deja historial y pasa por CI.
2. **Rollback desde Dokploy**: en **Deployments** cada deployment muestra su commit; si tu instancia tiene
   **Rollbacks** habilitado (Advanced → Rollbacks, requiere un _registry_ configurado) usa **Rollback** en el
   deployment anterior. Si no, apunta temporalmente la app a un tag/commit estable (General → Branch, o
   crea una rama `hotfix/rollback` en el commit bueno) y pulsa **Deploy**.
3. **Migraciones**: son _forward-only_ (`migrate deploy` nunca deshace). Para que el rollback de código sea
   seguro, cada cambio de esquema sigue el patrón **expand / contract**:
   - _Expand_ (deploy N): sólo agregar (columnas _nullable_ o con default, tablas nuevas, índices
     `CONCURRENTLY` en migraciones separadas). El código N‑1 sigue funcionando con el esquema N.
   - _Migrar datos_ (script o job) y desplegar el código que usa lo nuevo.
   - _Contract_ (deploy N+1 o posterior): eliminar columnas/tablas viejas cuando ya nadie las usa.
   - Nunca renombrar/eliminar columnas en el mismo deploy que deja de usarlas.
4. **Restaurar la base** sólo si hubo corrupción o pérdida de datos (no por un bug de código):
   `docs/BACKUP_RESTORE.md` → _Recuperación ante desastres_. Antes, pon la app en mantenimiento
   (detén la app en Dokploy) para no perder escrituras.

---

## 12. Logs y monitoreo

- **Logs**: Aplicación → pestaña **Logs** (stdout/stderr del contenedor en vivo). En producción la app
  escribe **JSON estructurado** por línea:
  ```json
  {
    "level": "error",
    "time": "2026-10-01T15:04:05.000Z",
    "msg": "health.db_down",
    "error": { "name": "...", "message": "..." }
  }
  ```
  Las pantallas de error muestran una **referencia** (`errorId`): búscala en los logs para ver el detalle.
  Desde el VPS: `docker service logs -f --since 1h <servicio>` o `docker logs -f <contenedor>`.
- `LOG_LEVEL`: `info` (default), `debug` temporalmente para diagnosticar, `warn` para reducir ruido.
- El entrypoint deja líneas `[entrypoint] …` con el resultado de las migraciones en cada arranque.
- **Health checks**:
  - `GET /api/health` → `{"status":"ok"}` (liveness, usado por el `HEALTHCHECK` de Docker).
  - `GET /api/health/db` → `{"status":"ok","database":"up","latencyMs":3}` o `503` si PostgreSQL no responde (readiness).
- **Monitoreo externo**: UptimeRobot / Better Stack cada 1–5 min sobre ambos endpoints con alerta por
  correo/WhatsApp.
- **Métricas**: pestaña **Monitoring** de Dokploy (CPU, RAM, red por contenedor).
- **Alertas de deploy**: Dokploy → **Settings → Notifications** (correo, Slack, Telegram o Discord) para
  _build failed_ / _deploy_ / _backup failed_.

---

## Jobs programados (notificaciones)

Los recordatorios (anticipos, RSVP, checklists) se procesan con `GET|POST /api/cron/notifications`,
protegido con `Authorization: Bearer $CRON_SECRET`. Programarlo **cada 15 minutos**:

**Opción A — Schedule de la aplicación (recomendado; corre dentro del contenedor, sin curl):**
Aplicación → pestaña **Schedules → Create Schedule**:

- Name: `cron-notificaciones` · Cron: `*/15 * * * *` · Shell: `sh`
- Command:
  ```sh
  node -e "fetch('http://127.0.0.1:3000/api/cron/notifications',{headers:{Authorization:'Bearer '+process.env.CRON_SECRET}}).then(async r=>{console.log(r.status,await r.text());process.exit(r.ok?0:1)}).catch(e=>{console.error(e);process.exit(1)})"
  ```

**Opción B — Schedule del servidor / cron del VPS (usa el dominio público):**

```sh
*/15 * * * * curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://ivonneyrosa.mx/api/cron/notifications > /dev/null
```

Revisa el resultado en la pestaña **Schedules → Logs** o en los logs de la app.

---

## Webhooks de pagos

Registra en el panel del proveedor (modo **live** en producción, **test** en staging):

| Proveedor    | URL del webhook                                            | Eventos                                                                                    |
| ------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Stripe       | `https://ivonneyrosa.mx/api/webhooks/payments/stripe`      | Checkout completado / expirado, pago fallido y reembolso (los que pida el módulo de Pagos) |
| Mercado Pago | `https://ivonneyrosa.mx/api/webhooks/payments/mercadopago` | Pagos (`payment`)                                                                          |
| Mock         | `/api/webhooks/payments/mock`                              | Sólo desarrollo/staging; se deshabilita en producción con proveedor real                   |

Copia el **secreto de firma** que te da el proveedor en `PAYMENT_WEBHOOK_SECRET` y redeploy.
Los webhooks se verifican por firma y son idempotentes (tabla `WebhookEvent`).

---

## Staging vs producción

|                          | Staging                                                                                       | Producción                   |
| ------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------- |
| Proyecto/entorno Dokploy | `ivonne-rosa` → `staging`                                                                     | `ivonne-rosa` → `production` |
| Rama                     | `staging` (o `develop`)                                                                       | `main`                       |
| Dominio                  | `staging.ivonneyrosa.mx`                                                                      | `ivonneyrosa.mx`             |
| Base                     | `ivonne-rosa-db-staging` (propia)                                                             | `ivonne-rosa-db`             |
| Bucket                   | `ivonne-rosa-staging`                                                                         | `ivonne-rosa-prod`           |
| Pagos                    | `PAYMENT_PROVIDER=mock` o llaves _test_                                                       | llaves _live_                |
| Email / WhatsApp         | `mock` o sandbox                                                                              | reales                       |
| Datos                    | seed DEMO permitido (`SEED_ALLOW_DEMO_IN_PRODUCTION=true`) o restauración mensual de respaldo | seed BASE únicamente         |
| Acceso                   | Basic Auth en **Advanced → Security**                                                         | público                      |

Nunca compartas secretos, base ni bucket entre staging y producción.

---

## Cero downtime

Dokploy despliega las aplicaciones como servicios de Docker Swarm. Para que el contenedor nuevo arranque
(y pase su health check) **antes** de apagar el anterior, en **Advanced → Cluster / Swarm Settings**:

- **Health Check**:
  ```json
  {
    "Test": [
      "CMD",
      "node",
      "-e",
      "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
    ],
    "Interval": 10000000000,
    "Timeout": 5000000000,
    "StartPeriod": 90000000000,
    "Retries": 3
  }
  ```
- **Update Config**:
  ```json
  { "Parallelism": 1, "Delay": 10000000000, "FailureAction": "rollback", "Order": "start-first" }
  ```

Con `start-first` conviven brevemente la versión vieja y la nueva: por eso las migraciones deben ser
compatibles hacia atrás (expand/contract, sección 11). Si el contenedor nuevo nunca queda sano
(p. ej. migración fallida), Swarm revierte al anterior.

---

## Dimensionamiento de recursos

| Componente           | Reserva           | Límite            | Notas                                                             |
| -------------------- | ----------------- | ----------------- | ----------------------------------------------------------------- |
| App (Next.js)        | 512 MB / 0.5 vCPU | 1.5 GB / 1.5 vCPU | Advanced → Resources. Una réplica basta para el volumen esperado. |
| PostgreSQL 16        | 512 MB            | 1–2 GB            | `shared_buffers` ≈ 25% de su límite si se ajusta.                 |
| Build (`next build`) | —                 | ~3 GB pico        | Ocurre en el VPS en cada deploy; con 4 GB de RAM agrega swap.     |
| Dokploy + Traefik    | ~600 MB           | —                 |                                                                   |

Escalar: primero vertical (8 GB). Para varias réplicas no hace falta nada especial en la app
(sesiones JWT, archivos en S3, rate limit en PostgreSQL).

### Disco (importante)

Cada deploy construye la imagen en el VPS y deja capas y caché de build (~2–4 GB por build completo).
Si el disco se llena, Docker empieza a fallar con errores de E/S **y la base de datos puede dañarse**.

- Mantén siempre **≥ 20 % libre** (`df -h /`) y una alerta de disco en el monitoreo.
- Dokploy → **Settings → Server**: activa la **limpieza diaria** (_Daily Docker Cleanup_) o usa los botones
  _Clean unused images_ / _Clean Docker builder_ periódicamente.
- Manual (no toca contenedores en marcha ni volúmenes):
  ```bash
  docker builder prune -af --filter "until=72h"   # caché de builds de más de 3 días
  docker image prune -af --filter "until=168h"     # imágenes sin usar de más de 7 días
  docker system df                                 # verificar
  ```
- **Nunca** uses `docker volume prune` ni `docker system prune --volumes`: borraría el volumen de PostgreSQL.
- Los respaldos locales del script (`BACKUP_DIR`) deben vivir en un disco/volumen con espacio suficiente
  y subirse a S3; la retención GFS los acota.

---

## Checklist de salida a producción

- [ ] CI en verde en `main`; rama protegida.
- [ ] Base `postgres:16` creada, sin puerto externo, respaldo programado y probado.
- [ ] Bucket privado creado, versionado activado, llaves con permisos mínimos.
- [ ] Variables completas (tabla de la sección 4) con secretos nuevos (`AUTH_SECRET`, `CRON_SECRET`, `PAYMENT_WEBHOOK_SECRET`).
- [ ] Dominio + HTTPS válidos; `APP_URL`/`AUTH_URL` con `https://`.
- [ ] Primer deploy: logs muestran `[entrypoint] Migraciones al día.`; `/api/health` y `/api/health/db` en 200.
- [ ] Seed BASE ejecutado, SUPER_ADMIN creada y `SEED_ADMIN_PASSWORD` eliminada.
- [ ] Schedule de notificaciones cada 15 min funcionando.
- [ ] Webhooks de pagos registrados y probados con un evento de prueba.
- [ ] Monitoreo externo de health + notificaciones de Dokploy configuradas.
- [ ] Swarm _start-first_ + health check configurados.
