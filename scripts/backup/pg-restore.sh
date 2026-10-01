#!/usr/bin/env bash
# =============================================================================
# Ivonne & Rosa — restauración de un respaldo de PostgreSQL (pg_dump -Fc) con confirmaciones
#
# Uso:
#   scripts/backup/pg-restore.sh <archivo.dump | s3://bucket/ruta/archivo.dump> --target <URL> [opciones]
#
# Opciones:
#   --target <URL>        base DESTINO (o variable RESTORE_DATABASE_URL). Nunca se asume DATABASE_URL.
#   --no-clean            no borra objetos existentes (exige una base destino vacía)
#   --allow-production    permite restaurar sobre la base configurada en DATABASE_URL
#   --yes                 sin preguntas; exige RESTORE_CONFIRM=<nombre-de-la-base> (automatización)
#   --skip-verify         no corre las consultas de verificación al final
#   -h, --help
#
# Variables: PG_DOCKER_IMAGE=postgres:16-alpine, PG_DOCKER_NETWORK (si pg_restore/psql no están
# instalados se usan vía Docker), BACKUP_S3_ENDPOINT + AWS_* para descargar desde S3.
#
# La restauración corre en UNA transacción (--single-transaction --exit-on-error): si algo
# falla, la base destino queda como estaba. Ver docs/BACKUP_RESTORE.md
# =============================================================================
set -Eeuo pipefail
trap 'rc=$?; printf "%s [restore] ERROR: falló un comando (línea %s, código %s). No se completó la restauración.\n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$LINENO" "$rc" >&2' ERR

PG_DOCKER_IMAGE="${PG_DOCKER_IMAGE:-postgres:16-alpine}"
PG_DOCKER_NETWORK="${PG_DOCKER_NETWORK:-}"

SOURCE=""
TARGET="${RESTORE_DATABASE_URL:-}"
CLEAN=1
ALLOW_PROD=0
ASSUME_YES=0
VERIFY=1
TMP_DOWNLOAD=""

log() { printf '%s [restore] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }
usage() { sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'; }
cleanup() { [[ -n "$TMP_DOWNLOAD" ]] && rm -f -- "$TMP_DOWNLOAD" "$TMP_DOWNLOAD.sha256"; return 0; }
trap cleanup EXIT

while (( $# > 0 )); do
  case "$1" in
    --target) [[ $# -ge 2 ]] || die "--target requiere una URL"; TARGET="$2"; shift ;;
    --target=*) TARGET="${1#--target=}" ;;
    --no-clean) CLEAN=0 ;;
    --allow-production) ALLOW_PROD=1 ;;
    --yes|-y) ASSUME_YES=1 ;;
    --skip-verify) VERIFY=0 ;;
    -h|--help) usage; exit 0 ;;
    -*) die "opción desconocida: $1 (usa --help)" ;;
    *) [[ -z "$SOURCE" ]] || die "sólo se acepta un archivo de origen"; SOURCE="$1" ;;
  esac
  shift
done

[[ -n "$SOURCE" ]] || { usage; die "falta el archivo de respaldo"; }
[[ -n "$TARGET" ]] || die "falta la base destino: usa --target <URL> o RESTORE_DATABASE_URL"

# --- utilidades -------------------------------------------------------------------------------
pg_tool() { # pg_restore|psql args... (stdin/stdout se transmiten)
  local tool=$1; shift
  if command -v "$tool" >/dev/null 2>&1; then
    "$tool" "$@"
  elif command -v docker >/dev/null 2>&1; then
    local net=()
    [[ -n "$PG_DOCKER_NETWORK" ]] && net=(--network "$PG_DOCKER_NETWORK")
    docker run --rm -i ${net[@]+"${net[@]}"} "$PG_DOCKER_IMAGE" "$tool" "$@"
  else
    die "no se encontró $tool ni docker. Instala postgresql-client-16 o Docker."
  fi
}
strip_prisma_params() { printf '%s' "$1" | sed -E 's/([?&])schema=[^&]*&?/\1/; s/[?&]$//'; }
mask_url() { printf '%s' "$1" | sed -E 's#(://[^:/@]+):[^@]*@#\1:****@#'; }
# host:puerto/base (para comparar destinos sin credenciales ni parámetros)
db_identity() {
  printf '%s' "$1" | sed -E 's#^[a-z]+://##; s#^[^@]*@##; s#\?.*$##' | sed -E 's#^([^/:]+)/#\1:5432/#'
}
db_name() { local id; id="$(db_identity "$1")"; printf '%s' "${id##*/}"; }
sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  else echo ""; fi
}
psql_q() { pg_tool psql "$TARGET_URL" -v ON_ERROR_STOP=1 -X -q -A -t -c "$1"; }

# --- origen -----------------------------------------------------------------------------------
if [[ "$SOURCE" == s3://* ]]; then
  TMP_DOWNLOAD="$(mktemp "${TMPDIR:-/tmp}/ir-restore-XXXXXX.dump")"
  endpoint=()
  [[ -n "${BACKUP_S3_ENDPOINT:-}" ]] && endpoint=(--endpoint-url "$BACKUP_S3_ENDPOINT")
  log "Descargando $SOURCE…"
  if command -v aws >/dev/null 2>&1; then
    aws s3 cp "$SOURCE" "$TMP_DOWNLOAD" ${endpoint[@]+"${endpoint[@]}"} --only-show-errors
    aws s3 cp "$SOURCE.sha256" "$TMP_DOWNLOAD.sha256" ${endpoint[@]+"${endpoint[@]}"} --only-show-errors 2>/dev/null || true
  elif command -v docker >/dev/null 2>&1; then
    docker run --rm -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION -e AWS_SESSION_TOKEN \
      amazon/aws-cli s3 cp "$SOURCE" - ${endpoint[@]+"${endpoint[@]}"} > "$TMP_DOWNLOAD"
  else
    die "para descargar de S3 se necesita aws CLI o docker"
  fi
  FILE="$TMP_DOWNLOAD"
  EXPECTED_NAME="$(basename "$SOURCE")"
else
  [[ -f "$SOURCE" ]] || die "no existe el archivo $SOURCE"
  FILE="$SOURCE"
  EXPECTED_NAME="$(basename "$SOURCE")"
fi
[[ -s "$FILE" ]] || die "el archivo de respaldo está vacío"

# Verificación de integridad (si existe el .sha256 generado por pg-backup.sh)
SUM_FILE=""
[[ -f "$FILE.sha256" ]] && SUM_FILE="$FILE.sha256"
if [[ -n "$SUM_FILE" ]]; then
  expected="$(awk '{print $1}' "$SUM_FILE")"
  actual="$(sha256_of "$FILE")"
  if [[ -n "$actual" && "$expected" != "$actual" ]]; then die "sha256 no coincide: el respaldo está corrupto"; fi
  log "Integridad sha256 OK."
else
  log "AVISO: no hay archivo .sha256 junto al respaldo; se omite la verificación de integridad."
fi

ENTRIES="$(pg_tool pg_restore --list < "$FILE" | grep -cE '^[0-9]+;' || true)"
(( ENTRIES > 0 )) || die "$EXPECTED_NAME no es un respaldo válido de pg_dump (formato custom)"

# --- destino ----------------------------------------------------------------------------------
TARGET_URL="$(strip_prisma_params "$TARGET")"
TARGET_DB="$(db_name "$TARGET_URL")"
[[ -n "$TARGET_DB" ]] || die "no pude leer el nombre de la base en la URL destino"

if [[ -n "${DATABASE_URL:-}" ]] && [[ "$(db_identity "$(strip_prisma_params "$DATABASE_URL")")" == "$(db_identity "$TARGET_URL")" ]]; then
  if (( ! ALLOW_PROD )); then
    die "el destino es la MISMA base que DATABASE_URL ($(db_identity "$TARGET_URL")). Si de verdad quieres sobrescribirla, agrega --allow-production."
  fi
  log "⚠️  ATENCIÓN: vas a sobrescribir la base configurada en DATABASE_URL (producción)."
fi

TABLES="$(psql_q "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")" \
  || die "no pude conectarme a la base destino $(mask_url "$TARGET_URL")"
TABLES="${TABLES//[[:space:]]/}"

if (( TABLES > 0 && ! CLEAN )); then
  die "la base destino tiene $TABLES tablas y usaste --no-clean. Usa una base vacía o quita --no-clean."
fi

cat <<EOF

  Respaldo:   $EXPECTED_NAME ($ENTRIES objetos)
  Destino:    $(mask_url "$TARGET_URL")
  Tablas hoy: $TABLES  $( (( CLEAN && TABLES > 0 )) && echo '→ se BORRARÁN y reemplazarán por el contenido del respaldo' )

EOF

if (( ASSUME_YES )); then
  [[ "${RESTORE_CONFIRM:-}" == "$TARGET_DB" ]] \
    || die "--yes exige RESTORE_CONFIRM=$TARGET_DB (confirmación explícita del nombre de la base)"
else
  [[ -t 0 ]] || die "sin terminal interactiva: usa --yes con RESTORE_CONFIRM=$TARGET_DB"
  read -r -p "Escribe el nombre de la base destino ($TARGET_DB) para continuar: " answer
  [[ "$answer" == "$TARGET_DB" ]] || die "confirmación incorrecta; no se hizo ningún cambio"
fi

# --- restauración -----------------------------------------------------------------------------
started=$(date +%s)
log "Restaurando en una sola transacción…"
args=(--no-owner --no-privileges --single-transaction --exit-on-error --dbname="$TARGET_URL")
(( CLEAN )) && args=(--clean --if-exists "${args[@]}")
pg_tool pg_restore "${args[@]}" < "$FILE"
log "Restauración completa en $(( $(date +%s) - started )) s."

# --- verificación -----------------------------------------------------------------------------
if (( VERIFY )); then
  log "Verificación:"
  psql_q "SELECT '  última migración: ' || migration_name || ' (' || to_char(finished_at, 'YYYY-MM-DD HH24:MI') || ')'
          FROM \"_prisma_migrations\" WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1" \
    || log "AVISO: no se encontró _prisma_migrations (¿es un respaldo de esta app?)"
  psql_q "SELECT '  ' || rpad(t, 14) || n FROM (
            SELECT 'User' AS t, count(*) AS n FROM \"User\" UNION ALL
            SELECT 'Customer', count(*) FROM \"Customer\" UNION ALL
            SELECT 'Lead', count(*) FROM \"Lead\" UNION ALL
            SELECT 'Quote', count(*) FROM \"Quote\" UNION ALL
            SELECT 'Event', count(*) FROM \"Event\" UNION ALL
            SELECT 'Payment', count(*) FROM \"Payment\" UNION ALL
            SELECT 'MediaAsset', count(*) FROM \"MediaAsset\" UNION ALL
            SELECT 'AuditLog', count(*) FROM \"AuditLog\") s" \
    || log "AVISO: no se pudieron contar las tablas principales."
  psql_q "SELECT '  actividad más reciente (AuditLog): ' || coalesce(to_char(max(\"createdAt\"), 'YYYY-MM-DD HH24:MI'), 'sin registros') FROM \"AuditLog\"" \
    || true
  log "Compara estos conteos con producción / con el reporte del respaldo antes de dar por buena la restauración."
fi
log "Listo."
