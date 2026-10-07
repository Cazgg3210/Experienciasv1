# Guía paso a paso — Producción nueva + el servidor actual como staging

Complementa `docs/DEPLOY_DOKPLOY.md` (referencia técnica completa de variables, build, migraciones, seeds, jobs y respaldos).

**Decisión:**
- **Staging = lo que ya tienes:** proyecto `first-project`, droplet `ubuntu-s-2vcpu-4gb-nyc1` con Dokploy, tus demos y otros proyectos. Ahí sigue Ivonne & Rosa como ambiente de pruebas.
- **Producción = proyecto y droplet NUEVOS, con su propio Dokploy.** Sólo Ivonne & Rosa vive ahí. Si una demo se cae, consume memoria, compila o se ve comprometida, producción no se entera, y el panel que despliega producción no comparte máquina con las demos.

Contenido: [Resumen](#resumen-de-ambientes) · [1. Proyecto y droplet](#1-proyecto-y-droplet-de-producción) · [2. Endurecer](#2-endurecer-el-droplet-de-producción) · [3. Dokploy](#3-instalar-dokploy-en-producción) · [4. Dominio](#4-dominio-y-https) · [5. Bucket](#5-almacenamiento-spaces) · [6. App y base](#6-app-base-y-variables) · [7. Primer arranque](#7-primer-arranque-seed-base--super_admin) · [8. Integraciones](#8-integraciones-en-orden) · [9. Jobs](#9-jobs-respaldos-y-monitoreo) · [10. Panel admin](#10-configuración-en-el-panel-admin) · [11. Verificación](#11-verificación-antes-de-abrir) · [12. Staging](#12-convertir-el-despliegue-actual-en-staging) · [13. GitHub](#13-ramas-y-protección-en-github) · [14. Rutina](#14-rutina-de-publicación)

---

## Resumen de ambientes

| | **Staging** (actual) | **Producción** (nuevo) |
|---|---|---|
| Proyecto DigitalOcean | `first-project` (con tus demos) | **`ivonne-rosa-prod`** (sólo esto) |
| Droplet | `ubuntu-s-2vcpu-4gb-nyc1` (existente) | **nuevo**, 2 vCPU / 4 GB o más, + swap |
| Panel Dokploy | el actual | **uno nuevo e independiente** |
| Rama de GitHub | `develop` | `main` |
| Dominio | `staging.ivonneyrosa.mx` (+ Basic Auth) | `ivonneyrosa.mx` / `www` |
| Base de datos | la actual (datos demo permitidos) | nueva y vacía → seed **BASE** |
| Bucket | `ivonne-rosa-staging` (nuevo) | `ivonne-rosa-prod` (el que ya existe, vacío) |
| Pagos / Email / WhatsApp / IA | `mock` o llaves **test**/sandbox | llaves **live** |
| Secretos | propios | **propios, nunca copiados de staging** |

---

## 1. Proyecto y droplet de producción
1. **Projects → New Project** con nombre `ivonne-rosa-prod`, propósito «Web application» y ambiente **Production**.
2. **Create → Droplets** dentro de ese proyecto:
   - **Región**: la misma que el bucket de producción. Como `ivonne-rosa-prod` está en **SFO3**, elige **SFO3**: el droplet y las fotos quedan juntos y la latencia desde CDMX es buena.
   - **Imagen**: Ubuntu 24.04 LTS.
   - **Tamaño**: mínimo *Basic › Regular › 2 vCPU / 4 GB* (~24 USD/mes). Si el presupuesto lo permite, **4 GB Premium o 8 GB**: Dokploy compila Next.js en el mismo servidor (picos de 2–3 GB).
   - **Autenticación**: **SSH key** (no contraseña).
   - Activa **Monitoring** y **Backups**.
   - Hostname `ivonne-rosa-prod`, tag `prod`.
3. **Mueve el bucket** `ivonne-rosa-prod` al proyecto nuevo. «Move Resources» se usa desde el proyecto **destino**: abre el proyecto **`ivonne-rosa-prod`** → **Move Resources** → selecciona el bucket `ivonne-rosa-prod` (hoy aparece en `first-project`) → **Move**. Está vacío (0 items) y su nombre ya corresponde a producción.

## 2. Endurecer el droplet de producción
1. **IP reservada**: Networking → Reserved IPs → Assign al droplet nuevo. El DNS apunta a esa IP.
2. **Firewall** (Networking → Firewalls → Create, aplicado al tag `prod`):
   - Entrada: `22/tcp` (SSH), `80/tcp` (HTTP) y `443/tcp` (HTTPS) desde **All IPv4 / All IPv6**.
   - **No abras el `3000`** (panel de Dokploy): se entra con un túnel SSH (paso 3.2) y luego con su dominio HTTPS (paso 4.4).
   - Salida: déjala como viene (todo permitido).

   SSH queda abierto a todas las IPs porque trabajas desde redes distintas: casa, la laptop de otra empresa, redes corporativas. Lo que protege es que el droplet **sólo acepta llaves SSH**, no contraseñas, más **fail2ban** (paso 2.3). Si tu red es fija, puedes restringir el 22 a tu IP; pero si esa IP cambia, edita el firewall o entra por la consola web.
3. **Swap de 4 GB** (consola del droplet, como root):
   ```bash
   fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
   echo '/swapfile none swap sw 0 0' >> /etc/fstab
   sysctl vm.swappiness=10 && echo 'vm.swappiness=10' >> /etc/sysctl.conf
   apt update && apt -y upgrade && apt -y install unattended-upgrades fail2ban
   systemctl enable --now fail2ban   # bloquea a quien intente adivinar accesos por SSH
   ```
4. **Alertas** (Monitoring → Create Alert Policy, tag `prod`), por correo:
   - CPU > 85 % por 10 min;
   - memoria > 90 %;
   - disco > 80 %.

### Acceso desde otras redes o equipos
- **Consola web de DigitalOcean** (Droplet → *Web Console*, o *Access → Recovery Console*): funciona desde cualquier navegador, sin llave ni instalar nada, aunque la red de una empresa bloquee el puerto 22. Por eso conviene el **2FA en tu cuenta de DigitalOcean**: es la llave maestra.
- **Otra laptop (p. ej. de otra empresa):** genera **una llave SSH propia de ese equipo** (`ssh-keygen -t ed25519`) y agrega su `.pub` al droplet (`~/.ssh/authorized_keys`) o a tu cuenta. **Nunca** copies tu llave privada personal a un equipo ajeno; quita la llave de ese equipo cuando dejes de usarlo.

## 3. Instalar Dokploy en producción
1. En la consola del droplet nuevo:
   ```bash
   curl -sSL https://dokploy.com/install.sh | sh
   ```
2. Entra al panel con un **túnel SSH** (el puerto 3000 no está abierto en el firewall). Desde tu computadora:
   ```bash
   ssh -L 3000:localhost:3000 root@IP_RESERVADA
   ```
   Deja esa ventana abierta, entra en el navegador a `http://localhost:3000` y crea el usuario administrador **con una contraseña distinta a la de staging**. Activa **2FA** en Profile.
3. **Settings → Git**: conecta GitHub (GitHub App) con acceso **sólo** al repositorio `Cazgg3210/Experienciasv1`.

## 4. Dominio y HTTPS
1. Compra el dominio (p. ej. `ivonneyrosa.mx`). Tienes dos opciones de DNS:
   - **DigitalOcean DNS** (Networking → Domains; apunta los nameservers del registrador a `ns1/ns2/ns3.digitalocean.com`);
   - el DNS del propio registrador.
2. Registros:
   - `A @` y `A www` → **IP reservada de producción**;
   - `A panel` → IP reservada de producción (panel de Dokploy);
   - `A staging` → **IP del droplet actual** (staging).
3. El dominio de la app se configura en el paso 6.5.
4. **Panel con dominio**: en Dokploy de producción entra a Settings → **Server Domain** → `panel.ivonneyrosa.mx` con HTTPS. Comprueba que entras por `https://panel…`. Desde ahí ya no necesitas el túnel, y el puerto 3000 nunca se abre en el firewall.

## 5. Almacenamiento (Spaces)
1. **Spaces → Access Keys → Create** una llave **limitada** al bucket `ivonne-rosa-prod` (Read/Write/Delete sólo en ese bucket). Guárdala: el secreto sólo se muestra una vez.
2. Otro bucket o carpeta para **respaldos de la base**, p. ej. `ivonne-rosa-backups` en SFO3 (privado), con su propia llave limitada.
3. El bucket de fotos queda **privado**: la app sirve las imágenes con URLs firmadas.

## 6. App, base y variables
Detalle de cada opción en `DEPLOY_DOKPLOY.md` (secciones de build, variables y health check).
1. **Create Project** `ivonne-rosa` → entorno `production`.
2. **Base de datos**: Create Service → **Database → PostgreSQL 16**, nombre `ivonne-rosa-db`. Usa una contraseña generada y **no** expongas el puerto externo. Copia la *Internal Connection URL*.
3. **Aplicación**: Create Service → Application:
   - fuente GitHub, repo `Experienciasv1`, rama **`main`**, **Autodeploy** encendido;
   - build type **Dockerfile** (el que trae el repo).
4. **Environment**: copia la plantilla de `DEPLOY_DOKPLOY.md` § 4 y llénala con valores **nuevos de producción**:
   - `NODE_ENV=production`;
   - `DATABASE_URL` = la URL interna del paso 2;
   - `APP_URL=https://ivonneyrosa.mx` y `AUTH_URL=https://ivonneyrosa.mx`;
   - `AUTH_SECRET` y `CRON_SECRET` **nuevos** (`node scripts/generate-secrets.mjs` o `openssl rand -base64 32` / `openssl rand -hex 32`);
   - `STORAGE_DRIVER=s3`, más `STORAGE_ENDPOINT`/`STORAGE_REGION`/`STORAGE_BUCKET`/llaves del paso 5.1, con `STORAGE_ENDPOINT=https://sfo3.digitaloceanspaces.com`;
   - proveedores en `mock` por ahora (se cambian en el paso 8);
   - `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` (≥ 12 caracteres) **sólo** para el primer arranque.

   Que **nunca** existan en producción: `RATE_LIMIT_DISABLED`, `E2E_*`, `SEED_ALLOW_DEMO_IN_PRODUCTION`.
5. **Domains → Add Domain**: `ivonneyrosa.mx` y `www.ivonneyrosa.mx`, puerto `3000`, **HTTPS con Let's Encrypt**.
6. **Advanced → Cluster/Swarm**: health check y despliegue sin caída, según `DEPLOY_DOKPLOY.md` § Cero downtime.
7. **Deploy**. Al arrancar, el contenedor corre `prisma migrate deploy` solo.

## 7. Primer arranque: seed BASE + SUPER_ADMIN
1. En la terminal del contenedor (Dokploy → app → Terminal), corre `docker-entrypoint.sh seed-base`. Carga ajustes, disponibilidad, estilos, zonas, presupuestos, plantillas y la primera SUPER_ADMIN. Es idempotente y no borra nada.
2. Entra a `https://ivonneyrosa.mx/login` con esa cuenta.
3. **Borra `SEED_ADMIN_PASSWORD`** de las variables y vuelve a desplegar.
4. **Nunca** corras el seed DEMO en producción: borra toda la base, y por eso está bloqueado.

## 8. Integraciones (en orden)
Mientras una integración siga en `mock`, el panel muestra el aviso «proveedores simulados». Prueba **siempre primero en staging con llaves test** y después pasa a producción con llaves live.

| # | Integración | Producción | Mientras tanto |
|---|---|---|---|
| 1 | **Email (Resend)** | Dominio verificado (SPF, DKIM y DMARC en tu DNS), `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, `EMAIL_FROM="Ivonne & Rosa <hola@ivonneyrosa.mx>"`. Prueba en *Ajustes › Integraciones* | Los avisos sólo quedan en la bandeja simulada |
| 2 | **Pagos** | MercadoPago (OXXO, SPEI, MSI) o Stripe: `PAYMENT_PROVIDER`, `PAYMENT_SECRET_KEY` y `PAYMENT_WEBHOOK_SECRET` **live**; webhook `https://ivonneyrosa.mx/api/webhooks/payments/<proveedor>` | **Apaga el flag «Pagos en línea»** y registra los anticipos con «Pago manual». Con el proveedor `mock` una clienta podría «pagar» sin dinero real |
| 3 | **WhatsApp Cloud API** | **Inicia ya** la verificación del negocio y las plantillas en Meta (tarda días o semanas); luego `WHATSAPP_PROVIDER=cloud_api`, `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` | Apaga el flag de WhatsApp; los enlaces `wa.me` siguen funcionando |
| 4 | **IA (diseñadora)** | `AI_PROVIDER` y `AI_API_KEY`, con un **límite de gasto** en el proveedor | Apaga el flag de la diseñadora IA |

## 9. Jobs, respaldos y monitoreo
1. **Cron de recordatorios** (Dokploy → app → Schedules): `*/15 * * * *` hacia `/api/cron/notifications` con `Authorization: Bearer $CRON_SECRET` (comando listo en `DEPLOY_DOKPLOY.md` § Jobs).
2. **Respaldo diario** de `ivonne-rosa-db` (Dokploy → base → Backups) al bucket de respaldos: `15 9 * * *` (03:15 CDMX), conservar 7. **Restauración de prueba mensual en staging** (`BACKUP_RESTORE.md`).
3. **Backups del droplet** activados en el paso 1.
4. **Monitoreo externo**: check gratuito (UptimeRobot, Better Stack) a `https://ivonneyrosa.mx/api/health` y `/api/health/db` cada 5 min, con alerta.

## 10. Configuración en el panel admin
Como SUPER_ADMIN en producción (detalle en el manual PDF):
1. **Usuarios**: crea a Ivonne y Rosa (OWNER) y al staff, cada uno con su correo real. No existe ninguna cuenta demo.
2. **Negocio**: correo y WhatsApp **reales** (por defecto vienen `hola@ivonne-rosa.test` y `5215512345678`), Instagram, política de cancelación y términos.
3. **Notificaciones**: correo interno del equipo (por defecto `equipo@ivonne-rosa.test`), días del recordatorio RSVP y horas antes de que venza una cotización.
4. **Precios**:
   - IVA y si está incluido;
   - anticipo (50 %);
   - vigencia (7 días);
   - margen mínimo (35 %);
   - comisión de pago;
   - días para el saldo;
   - rango de invitadas.
5. **Disponibilidad y calendario**: días y horarios, tiempo entre eventos, anticipación mínima y fechas bloqueadas.
6. **Catálogo**:
   - experiencias, menús y extras con precio **y costo**;
   - zonas con su costo de traslado;
   - estilos y rangos de presupuesto.
   Sin experiencias activas, el configurador queda vacío.
7. **Contenido**: FAQ, testimonios y galería (con texto alternativo).
8. **Operación**: staff con acceso, proveedores, inventario con umbral de reposición y plantillas de checklist.
9. **Flags**: enciende sólo lo que ya esté configurado de verdad.

> Puedes armar el catálogo y el contenido primero en staging para revisarlos, pero en producción se capturan aparte: **nunca copies la base de staging a producción**.

## 11. Verificación antes de abrir
- [ ] `https://ivonneyrosa.mx` carga con candado; `http://` y `www` redirigen bien.
- [ ] `/api/health` → `{"status":"ok"}`, y `/api/health/db` → `database: up`.
- [ ] Login, logout y barreras: un staff no entra a `/admin`.
- [ ] Recorrido completo desde el celular:
  1. configurador → lead;
  2. cotización y su envío;
  3. aceptar;
  4. pago manual (o live, si ya está);
  5. portal;
  6. RSVP de una invitada.
- [ ] Llega el correo de prueba (y el WhatsApp, si aplica).
- [ ] El cron se ejecuta y hay un respaldo de hoy en el bucket de respaldos.
- [ ] Las alertas de DigitalOcean y el monitoreo externo están activos; el puerto 3000 no está abierto en el firewall.
- [ ] 2FA activo en tu cuenta de DigitalOcean (Settings → Security) y en el panel de Dokploy.

## 12. Convertir el despliegue actual en staging
En el **Dokploy actual** (droplet `ubuntu-s-2vcpu-4gb-nyc1`):
1. App de Ivonne & Rosa → rama **`develop`** (Autodeploy encendido).
2. **Domains**: `staging.ivonneyrosa.mx` con HTTPS; quita el de `sslip.io` cuando funcione.
3. **Advanced → Security → Basic Auth**: usuario y contraseña para que ni el público ni los buscadores lo vean.
4. **Variables de staging**:
   - `APP_URL`/`AUTH_URL=https://staging.ivonneyrosa.mx`;
   - `AUTH_SECRET` y `CRON_SECRET` **distintos** a los de producción;
   - proveedores en `mock` o con llaves **test**/sandbox;
   - `SEED_ALLOW_DEMO_IN_PRODUCTION=true` si quieres datos demo.
5. **Bucket de staging**: crea `ivonne-rosa-staging` (NYC3, cerca del droplet), con su llave limitada, y ajusta `STORAGE_*`. El bucket `ivonne-rosa-prod` ya pertenece a producción.
6. Al dejar de ser producción, aquí puedes resembrar la demo cuando quieras. Para probar restauraciones, usa un respaldo de producción **sólo en una base aparte**, y no lo dejes expuesto.
7. **Recursos**: este droplet comparte RAM con tus demos. Agrégale también **swap de 4 GB** (paso 2.3) y pon **límites de memoria** a los contenedores en Dokploy (Advanced → Resources) para que un build no tumbe las demos.

## 13. Ramas y protección en GitHub
1. Crea la rama `develop` desde `main` y súbela.
2. **Settings → Branches → Add rule** para `main`:
   - exige PR;
   - exige el CI en verde (jobs `quality`, `integration`, `docker`);
   - prohíbe el force push y el borrado.
3. Opcional: la misma regla, más ligera, para `develop`.

## 14. Rutina de publicación
```text
1. feature/*  ──PR──▶  develop  ──deploy automático──▶  STAGING (droplet actual)
2. En staging: integraciones en modo test + /e2e-quality-gate regression (local)
3. develop ──PR (CI verde)──▶ main ──deploy automático──▶ PRODUCCIÓN (nuevo)
```
- Antes de cada PR a `main`: `/e2e-quality-gate regression` en local (veredicto READY o READY WITH CONDITIONS) y un recorrido rápido en staging.
- Migraciones siempre aditivas: `migrate deploy` corre al arrancar y nunca deshace. Si borras o renombras columnas, hazlo en dos despliegues.
- **Hotfix**: rama `hotfix/*` desde `main` → PR a `main` → después fusiona `main` en `develop`.
- **Pendiente con decisión tuya**: actualizar a **Next ≥ 16.3** para retirar la mitigación de navegación de BUG-006. Es una actualización mayor: pruébala primero en staging con el quality gate completo.
