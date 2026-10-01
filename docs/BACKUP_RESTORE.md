# Respaldos, restauración y recuperación ante desastres

Cómo se protege la información de Ivonne & Rosa (clientas, cotizaciones, pagos, eventos, archivos) y
cómo se recupera. Complementa a [DEPLOY_DOKPLOY.md](./DEPLOY_DOKPLOY.md) §10–§11.

## Objetivos (RPO / RTO)

| Activo                       | RPO (pérdida máxima tolerable)                                      | RTO (tiempo para volver a operar) | Mecanismo                                                |
| ---------------------------- | ------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------- |
| PostgreSQL (todo el negocio) | **24 h** (diario). Opcional: **6 h** programando 4 respaldos al día | **2 h**                           | Respaldo programado de Dokploy → S3 (+ script `pg_dump`) |
| Archivos subidos (bucket S3) | **≈ 0** (versionado)                                                | **1 h**                           | Versionado + ciclo de vida + copia externa semanal       |
| Configuración (variables)    | Cambio a cambio                                                     | **30 min**                        | Copia en el gestor de contraseñas del negocio            |
| Código / imagen              | Cada commit                                                         | **30 min**                        | GitHub + redeploy en Dokploy                             |

> La operación diaria (cotizaciones y pagos) se concentra en horario laboral; el respaldo de las
> **03:15 (CDMX)** captura el día completo. Si el volumen crece, baja el RPO agregando horarios.

## Qué se respalda y dónde

| Qué                                  | Dónde vive                                           | Respaldo                                                              |
| ------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------- |
| Base PostgreSQL 16                   | Servicio _Database_ de Dokploy (volumen persistente) | `pg_dump` formato custom diario a bucket **`ivonne-rosa-backups`**    |
| Archivos (fotos, comprobantes, PDFs) | Bucket **`ivonne-rosa-prod`** (privado)              | Versionado + copia semanal a otro proveedor/región                    |
| Variables de entorno / secretos      | Dokploy → Environment                                | Copia cifrada en el gestor de contraseñas (actualizar en cada cambio) |
| Código, migraciones, Dockerfile      | GitHub                                               | Historial de git                                                      |

El bucket de respaldos es **distinto** del de archivos y sus llaves son **distintas** de las que usa la app
(si se filtran las llaves de la app, no se pueden borrar los respaldos).

---

## 1. Respaldo diario de PostgreSQL

### Opción A — Respaldos nativos de Dokploy (recomendada)

1. Crea el bucket `ivonne-rosa-backups` (privado) en Spaces/R2/S3 y una llave sólo para él.
2. Dokploy → **Settings → S3 Destinations → Add Destination**: nombre `backups-s3`, bucket, región,
   endpoint (`https://nyc3.digitaloceanspaces.com` en Spaces) y llaves → **Test Connection**.
3. Base `ivonne-rosa-db` → pestaña **Backups → Create Backup**. Crea **tres** trabajos para obtener la
   retención 7/4/6 sin scripts:

   | Trabajo | Schedule (cron, UTC)      | Prefix              | Keep latest |
   | ------- | ------------------------- | ------------------- | ----------- |
   | Diario  | `15 9 * * *` (03:15 CDMX) | `postgres/daily/`   | `7`         |
   | Semanal | `30 9 * * 0` (domingo)    | `postgres/weekly/`  | `4`         |
   | Mensual | `45 9 1 * *` (día 1)      | `postgres/monthly/` | `6`         |

4. En cada trabajo pulsa **Run manual backup** y confirma que el archivo aparece en el bucket.
5. Dokploy → **Settings → Notifications**: activa alertas de _Database Backup_ (éxito/falla) por correo,
   Telegram o Slack. **Revisa semanalmente** que lleguen.

### Opción B — Script `pg_dump` (alternativa / segundo respaldo)

`scripts/backup/pg-backup.sh` (ver `scripts/backup/README.md`) genera `ivonne-rosa_<AAAAMMDDTHHMMSSZ>.dump`
(`pg_dump -Fc`), lo valida con `pg_restore --list`, crea su `.sha256`, lo sube a S3 y aplica retención
**GFS 7 diarios / 4 semanales / 6 mensuales** en la carpeta local. No necesita PostgreSQL ni AWS CLI
instalados en el VPS: los ejecuta vía Docker.

```bash
# /opt/ivonne-rosa/backup.env  (chmod 600)
BACKUP_DATABASE_URL=postgresql://ivonne:<pass>@<host-interno>:5432/ivonne_rosa
PG_DOCKER_NETWORK=dokploy-network
BACKUP_DIR=/var/backups/ivonne-rosa
BACKUP_S3_URI=s3://ivonne-rosa-backups/postgres/script
BACKUP_S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=us-east-1
```

```cron
# crontab -e (root) — diario 03:15 CDMX
15 9 * * * cd /opt/ivonne-rosa && set -a && . ./backup.env && set +a && ./scripts/backup/pg-backup.sh >> /var/log/ir-backup.log 2>&1
```

Para el script, la retención **remota** se maneja con reglas de ciclo de vida del bucket (sección 4).

---

## 2. Retención

| Nivel     | Cantidad | Cobertura                  |
| --------- | -------- | -------------------------- |
| Diarios   | **7**    | última semana, día por día |
| Semanales | **4**    | último mes                 |
| Mensuales | **6**    | último semestre            |

- Con Dokploy: los tres trabajos de la tabla anterior (_Keep latest_ 7 / 4 / 6).
- Con el script: GFS local por conteo (si los respaldos se detienen, **no** se borra todo) y en S3 una regla
  de ciclo de vida que expire `postgres/script/` a los **190 días**.
- Respaldos previos a cambios grandes (migraciones con _contract_, importaciones masivas): ejecuta
  **Run manual backup** y consérvalo con prefijo `postgres/manual/` (sin expiración automática).
- Los respaldos contienen datos personales: acceso sólo para fundadoras/administración, bucket privado,
  cifrado en reposo del proveedor. Retención máxima de 6 meses salvo obligación legal/fiscal.

---

## 3. Prueba de restauración mensual (staging)

**Cuándo**: primer lunes de cada mes. **Responsable**: administración técnica. **Duración**: ~30 min.
Un respaldo que nunca se restauró no es un respaldo.

1. **Prepara una base vacía de prueba** en Dokploy: Create Service → Database → PostgreSQL 16 →
   `ivonne-rosa-restore-test` (sin puerto externo). Copia su _Internal Connection URL_.
2. **Elige el respaldo**: el diario más reciente (`postgres/daily/…`).
3. **Restaura**, con cualquiera de estas opciones:
   - Dokploy → base `ivonne-rosa-restore-test` → **Backups → Restore** (si tu versión lo trae) eligiendo el
     archivo del S3 destino; o
   - el script, desde el VPS (no requiere herramientas instaladas):
     ```bash
     cd /opt/ivonne-rosa && set -a && . ./backup.env && set +a
     RESTORE_CONFIRM=ivonne_rosa_restore_test PG_DOCKER_NETWORK=dokploy-network \
       ./scripts/backup/pg-restore.sh s3://ivonne-rosa-backups/postgres/daily/<archivo>.dump \
       --target 'postgresql://<user>:<pass>@<host-restore-test>:5432/ivonne_rosa_restore_test' --yes
     ```
     El script verifica el `.sha256`, restaura en **una sola transacción** y al final imprime la última
     migración y conteos de tablas clave. Nunca usa `DATABASE_URL` como destino implícito.
4. **Verifica** (Docker Terminal de la base de prueba → `psql -U <user> ivonne_rosa_restore_test`):
   ```sql
   -- 1) Esquema al día: debe coincidir con la última migración del repo (prisma/migrations)
   SELECT migration_name, finished_at FROM "_prisma_migrations"
   WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 3;

   -- 2) Volumen por tabla clave (compáralo con producción; debe ser igual o apenas menor)
   SELECT 'User' t, count(*) FROM "User" UNION ALL
   SELECT 'Customer', count(*) FROM "Customer" UNION ALL
   SELECT 'Lead', count(*) FROM "Lead" UNION ALL
   SELECT 'Quote', count(*) FROM "Quote" UNION ALL
   SELECT 'Booking', count(*) FROM "Booking" UNION ALL
   SELECT 'Event', count(*) FROM "Event" UNION ALL
   SELECT 'Payment', count(*) FROM "Payment" UNION ALL
   SELECT 'MediaAsset', count(*) FROM "MediaAsset";

   -- 3) Frescura: la actividad más reciente debe ser de pocas horas antes del respaldo
   SELECT max("createdAt") AS ultima_auditoria FROM "AuditLog";
   SELECT max("createdAt") AS ultimo_lead FROM "Lead";

   -- 4) Dinero: cobrado por mes (compáralo con el reporte de pagos del admin)
   SELECT date_trunc('month', "paidAt")::date AS mes, round(sum("amountCents" - "refundedCents") / 100.0, 2) AS mxn
   FROM "Payment" WHERE status IN ('PAID', 'PARTIAL_REFUND') GROUP BY 1 ORDER BY 1 DESC LIMIT 3;

   -- 5) Integridad referencial básica: eventos sin clienta (debe ser 0)
   SELECT count(*) FROM "Event" e LEFT JOIN "Customer" c ON c.id = e."customerId" WHERE c.id IS NULL;
   ```
   Ejecuta las consultas 2–4 también en producción (sólo lectura) y compara.
5. **Prueba de humo opcional**: apunta la app de _staging_ a esta base (`DATABASE_URL`, `RUN_MIGRATIONS=true`),
   redeploy y revisa `/api/health/db`, `/admin` (login), una cotización y un evento.
6. **Registra** el resultado en la bitácora de operación: fecha, archivo, tamaño, duración de la
   restauración, conteos, diferencias y responsable.
7. **Elimina** la base `ivonne-rosa-restore-test` (contiene datos personales).

Si cualquier paso falla: abre un incidente, corrige el respaldo (credenciales, bucket, versión de
PostgreSQL) y repite la prueba esa misma semana.

---

## 4. Bucket de archivos: versionado y ciclo de vida

Los archivos no están en la base: viven en `ivonne-rosa-prod`. Protégelos así (ejemplos con AWS CLI;
en Spaces agrega `--endpoint-url https://nyc3.digitaloceanspaces.com`; también funciona con
`docker run --rm -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY amazon/aws-cli …`):

```bash
# Versionado (recupera archivos borrados o sobrescritos)
aws s3api put-bucket-versioning --bucket ivonne-rosa-prod \
  --versioning-configuration Status=Enabled --endpoint-url https://nyc3.digitaloceanspaces.com

# Ciclo de vida: versiones no actuales 30 días; subidas incompletas 7 días
cat > lifecycle-prod.json <<'JSON'
{ "Rules": [
  { "ID": "versiones-antiguas", "Status": "Enabled", "Filter": { "Prefix": "" },
    "NoncurrentVersionExpiration": { "NoncurrentDays": 30 },
    "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 } }
] }
JSON
aws s3api put-bucket-lifecycle-configuration --bucket ivonne-rosa-prod \
  --lifecycle-configuration file://lifecycle-prod.json --endpoint-url https://nyc3.digitaloceanspaces.com

# Bucket de respaldos: expira los dumps del script a los 190 días (Dokploy ya poda los suyos)
cat > lifecycle-backups.json <<'JSON'
{ "Rules": [
  { "ID": "dumps-script", "Status": "Enabled", "Filter": { "Prefix": "postgres/script/" },
    "Expiration": { "Days": 190 } }
] }
JSON
aws s3api put-bucket-lifecycle-configuration --bucket ivonne-rosa-backups \
  --lifecycle-configuration file://lifecycle-backups.json --endpoint-url https://nyc3.digitaloceanspaces.com
```

- **Copia externa semanal** (protege contra borrado de la cuenta o del bucket completo):
  `rclone sync spaces:ivonne-rosa-prod r2:ivonne-rosa-prod-copia` (otro proveedor o región).
  Cloudflare R2 no ofrece versionado de objetos: si usas R2 como almacenamiento principal, esta copia es obligatoria.
- **Recuperar un archivo borrado**: lista versiones y restaura la anterior:
  ```bash
  aws s3api list-object-versions --bucket ivonne-rosa-prod --prefix <storageKey> --endpoint-url …
  aws s3api copy-object --bucket ivonne-rosa-prod --key <storageKey> \
    --copy-source "ivonne-rosa-prod/<storageKey>?versionId=<versionId>" --endpoint-url …
  ```
  La columna `MediaAsset.storageKey` indica la llave de cada archivo.
- **Coherencia base ↔ archivos**: si restauras la base a un punto anterior, quedan objetos huérfanos en el
  bucket (inofensivos). Si un objeto falta, la app muestra un marcador de posición; recupéralo por versión.

---

## 5. Recuperación ante desastres

### a) Borrado accidental de datos (p. ej. se eliminó un evento)

1. **No** restaures sobre producción. Restaura el respaldo más reciente anterior al incidente en una base
   temporal (sección 3, pasos 1–3).
2. Extrae sólo las filas necesarias (`COPY … TO STDOUT` / `INSERT … SELECT` vía `dblink` o exportando CSV)
   y reinsértalas en producción dentro de una transacción. Registra la operación en `AuditLog`/bitácora.
3. Elimina la base temporal.

### b) Base de datos corrupta o perdida

1. Detén la app (Dokploy → app → **Stop**) para evitar escrituras parciales.
2. Crea una base nueva PostgreSQL 16 (o vacía la existente) y restaura el último respaldo válido:
   ```bash
   RESTORE_CONFIRM=ivonne_rosa ./scripts/backup/pg-restore.sh s3://ivonne-rosa-backups/postgres/daily/<archivo>.dump \
     --target '<URL interna de la base nueva>' --yes            # agrega --allow-production si el destino es DATABASE_URL
   ```
3. Actualiza `DATABASE_URL` si cambió el host, **Deploy** (el entrypoint aplica migraciones pendientes).
4. Verifica `/api/health/db`, login, pagos del día y eventos próximos. Comunica a las clientas afectadas si
   se perdieron cambios entre el respaldo y el incidente (revisa pagos en el panel del proveedor y
   regístralos manualmente).

### c) Pérdida total del VPS

1. Crea un VPS nuevo (mismo tamaño) e instala Dokploy.
2. Recrea servicios siguiendo `DEPLOY_DOKPLOY.md` (§1–§7): base, app desde GitHub, variables desde el
   gestor de contraseñas, dominios.
3. Restaura la base (punto b) **antes** de abrir el tráfico.
4. Cambia el registro DNS **A** a la IP nueva (TTL bajo, 300 s, ayuda a propagar rápido).
5. Reconfigura respaldos programados, schedules (cron de notificaciones) y notificaciones.

### d) Secretos comprometidos

Rota de inmediato y redeploy: `AUTH_SECRET` (cierra todas las sesiones), contraseña de PostgreSQL
(actualiza `DATABASE_URL`), llaves del bucket, `PAYMENT_*`, `EMAIL_API_KEY`, `WHATSAPP_TOKEN`,
`AI_API_KEY`, `CRON_SECRET`. Revisa `AuditLog` y los logs de acceso.

### e) Bucket de archivos borrado o cifrado por un atacante

Restaura desde la copia externa semanal (`rclone sync` en sentido inverso) y, para los cambios
posteriores, desde las versiones del bucket si sigue existiendo.

---

## 6. Calendario de operación

| Frecuencia                 | Tarea                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| Diario (automático)        | Respaldo de PostgreSQL; alerta si falla                                                             |
| Semanal                    | Revisar que llegaron las alertas de respaldo; copia externa del bucket de archivos                  |
| Mensual                    | **Prueba de restauración** en staging (sección 3) y registro en bitácora                            |
| Trimestral                 | Simulacro de recuperación ante desastres (punto c, en un VPS temporal); revisar retención y accesos |
| En cada cambio de secretos | Actualizar la copia en el gestor de contraseñas                                                     |
