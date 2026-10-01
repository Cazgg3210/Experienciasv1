# Respaldos de PostgreSQL — scripts

Scripts en bash para respaldar y restaurar la base de Ivonne & Rosa. Funcionan en el VPS
**sin Node ni cliente de PostgreSQL instalados**: si `pg_dump`/`pg_restore`/`psql` no existen,
se ejecutan dentro de la imagen `postgres:16-alpine` vía Docker (y `aws` vía `amazon/aws-cli`).

> La opción recomendada en producción es el respaldo programado **nativo de Dokploy** hacia S3
> (ver `docs/BACKUP_RESTORE.md`). Estos scripts son la alternativa / complemento.

## `pg-backup.sh`

```bash
# Respaldo + subida a S3 (DigitalOcean Spaces) + retención local 7/4/6
export BACKUP_DATABASE_URL='postgresql://usuario:pass@host:5432/ivonne_rosa'
export BACKUP_DIR=/var/backups/ivonne-rosa
export BACKUP_S3_URI=s3://ivonne-rosa-backups/postgres
export BACKUP_S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_DEFAULT_REGION=us-east-1
./scripts/backup/pg-backup.sh
```

- Archivo: `<BACKUP_PREFIX>_<AAAAMMDDTHHMMSSZ>.dump` (formato custom `pg_dump -Fc`, comprimido) + `.sha256`.
- Valida el respaldo con `pg_restore --list` antes de darlo por bueno (si falla, borra el parcial).
- Retención local **GFS por conteo**: el más reciente de cada uno de los últimos 7 días, 4 semanas ISO y
  6 meses que tengan respaldos (`BACKUP_KEEP_DAILY/WEEKLY/MONTHLY`). Si los respaldos se detienen,
  no se borra todo. La retención **remota** se configura con reglas de ciclo de vida del bucket.
- `--dry-run` muestra qué haría; `--prune-only` sólo aplica la retención; `--no-upload` no sube.
- Si la base corre en la red de Dokploy y no está publicada, usa `PG_DOCKER_NETWORK=dokploy-network`
  y el host interno del servicio en la URL.
- `flock` evita dos respaldos simultáneos.

Cron sugerido en el VPS (03:15 hora CDMX = 09:15 UTC):

```cron
15 9 * * * cd /opt/ivonne-rosa && set -a && . ./backup.env && set +a && ./scripts/backup/pg-backup.sh >> /var/log/ir-backup.log 2>&1
```

## `pg-restore.sh`

```bash
# Restaurar en una base de STAGING (interactivo: pide escribir el nombre de la base)
./scripts/backup/pg-restore.sh /var/backups/ivonne-rosa/ivonne-rosa_20261001T091500Z.dump \
  --target 'postgresql://usuario:pass@host:5432/ivonne_rosa_staging'

# Directo desde S3 y sin preguntas (prueba mensual automatizada)
RESTORE_CONFIRM=ivonne_rosa_restore_test ./scripts/backup/pg-restore.sh \
  s3://ivonne-rosa-backups/postgres/ivonne-rosa_20261001T091500Z.dump \
  --target 'postgresql://usuario:pass@host:5432/ivonne_rosa_restore_test' --yes
```

Salvaguardas:

- Nunca usa `DATABASE_URL` como destino implícito; si el destino **es** la base de `DATABASE_URL`
  exige `--allow-production`.
- Pide escribir el nombre de la base (o `--yes` + `RESTORE_CONFIRM=<base>`).
- Verifica el `.sha256` si existe y que el archivo sea un respaldo válido.
- Restaura en **una sola transacción** (`--single-transaction --exit-on-error`): si falla, no cambia nada.
- `--no-clean` exige una base vacía; por defecto reemplaza los objetos existentes (`--clean --if-exists`).
- Al final imprime la última migración de Prisma y conteos de tablas clave para compararlos.

Pruebas: `tests/integration/devops.test.ts` valida la retención y la semana ISO del script.
