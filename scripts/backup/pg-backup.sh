#!/usr/bin/env bash
# =============================================================================
# Ivonne & Rosa — respaldo de PostgreSQL (pg_dump formato custom) + subida a S3 + retención
#
# Uso:
#   scripts/backup/pg-backup.sh                 respaldo + (subida) + retención local
#   scripts/backup/pg-backup.sh --no-upload     respaldo + retención, sin subir
#   scripts/backup/pg-backup.sh --prune-only    sólo aplica la retención local
#   scripts/backup/pg-backup.sh --dry-run       muestra lo que haría (no borra ni sube)
#
# Variables:
#   BACKUP_DATABASE_URL | DATABASE_URL   base a respaldar (postgresql://usuario:pass@host:5432/db)
#   BACKUP_DIR=./backups                 carpeta local de respaldos
#   BACKUP_PREFIX=ivonne-rosa            prefijo de archivo: <prefijo>_<AAAAMMDDTHHMMSSZ>.dump
#   BACKUP_KEEP_DAILY=7  BACKUP_KEEP_WEEKLY=4  BACKUP_KEEP_MONTHLY=6   retención GFS local
#   BACKUP_S3_URI=s3://bucket/ruta       destino con aws CLI (o imagen amazon/aws-cli vía Docker)
#   BACKUP_S3_ENDPOINT=https://nyc3.digitaloceanspaces.com   endpoint S3 compatible (Spaces/R2/MinIO)
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_DEFAULT_REGION     credenciales del bucket
#   BACKUP_RCLONE_REMOTE=remoto:bucket/ruta   alternativa con rclone (si no hay BACKUP_S3_URI)
#   PG_DOCKER_IMAGE=postgres:16-alpine   si pg_dump no está instalado se usa esta imagen
#   PG_DOCKER_NETWORK=dokploy-network    red Docker para alcanzar la base (fallback Docker)
#
# Programación sugerida (cron del VPS, diario 03:15 CDMX = 09:15 UTC):
#   15 9 * * * cd /opt/ivonne-rosa && ./scripts/backup/pg-backup.sh >> /var/log/ir-backup.log 2>&1
# Ver docs/BACKUP_RESTORE.md
# =============================================================================
set -Eeuo pipefail
trap 'rc=$?; printf "%s [backup] ERROR: falló un comando (línea %s, código %s). No se completó el respaldo.\n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$LINENO" "$rc" >&2' ERR

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_PREFIX="${BACKUP_PREFIX:-ivonne-rosa}"
KEEP_DAILY="${BACKUP_KEEP_DAILY:-7}"
KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-4}"
KEEP_MONTHLY="${BACKUP_KEEP_MONTHLY:-6}"
PG_DOCKER_IMAGE="${PG_DOCKER_IMAGE:-postgres:16-alpine}"
PG_DOCKER_NETWORK="${PG_DOCKER_NETWORK:-}"

DO_UPLOAD=1
PRUNE_ONLY=0
DRY_RUN=0
PARTIAL_FILE=""

# Si algo falla a mitad del respaldo (incluido die), no deja archivos .partial
cleanup() { [[ -n "$PARTIAL_FILE" ]] && rm -f -- "$PARTIAL_FILE"; return 0; }
trap cleanup EXIT

log() { printf '%s [backup] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

usage() { sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; }

for arg in "$@"; do
  case "$arg" in
    --no-upload) DO_UPLOAD=0 ;;
    --prune-only) PRUNE_ONLY=1 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help) usage; exit 0 ;;
    *) die "opción desconocida: $arg (usa --help)" ;;
  esac
done

for n in "$KEEP_DAILY" "$KEEP_WEEKLY" "$KEEP_MONTHLY"; do
  [[ "$n" =~ ^[0-9]+$ ]] || die "BACKUP_KEEP_* deben ser enteros >= 0"
done
(( KEEP_DAILY + KEEP_WEEKLY + KEEP_MONTHLY > 0 )) || die "la retención no puede ser 0/0/0 (borraría todo)"

# ---------------------------------------------------------------------------------------------
# Semana ISO-8601 (AAAA-Www) en bash puro, sin subshells: no depende de GNU date
# (sirve igual en Debian, Alpine o macOS). Resultado en la variable global ISO_WEEK.
# ---------------------------------------------------------------------------------------------
_weeks_in_year() { # año -> WEEKS (52 | 53)
  local y=$1 p1 p0
  p1=$(( (y + y/4 - y/100 + y/400) % 7 ))
  p0=$(( ((y-1) + (y-1)/4 - (y-1)/100 + (y-1)/400) % 7 ))
  if (( p1 == 4 || p0 == 3 )); then WEEKS=53; else WEEKS=52; fi
}
iso_week() { # AAAA MM DD -> ISO_WEEK=AAAA-Www
  local y=$((10#$1)) m=$((10#$2)) d=$((10#$3))
  local cum=(0 31 59 90 120 151 181 212 243 273 304 334) t=(0 3 2 5 0 3 5 1 4 6 2 4)
  local ordinal=$(( cum[m-1] + d ))
  if (( m > 2 && ((y % 4 == 0 && y % 100 != 0) || y % 400 == 0) )); then ordinal=$(( ordinal + 1 )); fi
  local yy=$y
  (( m < 3 )) && yy=$(( y - 1 ))
  local wd=$(( (yy + yy/4 - yy/100 + yy/400 + t[m-1] + d) % 7 )) # 0 = domingo
  (( wd == 0 )) && wd=7
  local week=$(( (ordinal - wd + 10) / 7 )) year=$y
  if (( week < 1 )); then
    year=$(( y - 1 )); _weeks_in_year "$year"; week=$WEEKS
  else
    _weeks_in_year "$y"
    if (( week > WEEKS )); then year=$(( y + 1 )); week=1; fi
  fi
  printf -v ISO_WEEK '%04d-W%02d' "$year" "$week"
}

# ---------------------------------------------------------------------------------------------
# Retención GFS local: conserva el respaldo más reciente de cada uno de los últimos
# KEEP_DAILY días, KEEP_WEEKLY semanas ISO y KEEP_MONTHLY meses (que tengan respaldos).
# Basada en conteo (no en la fecha actual): si los respaldos se detienen, no se borra todo.
# Imprime una línea KEEP/DELETE por archivo.
# ---------------------------------------------------------------------------------------------
prune_local() {
  [[ -d "$BACKUP_DIR" ]] || { log "Retención: $BACKUP_DIR no existe, nada que podar."; return 0; }
  local files=() doomed=() f
  while IFS= read -r f; do files+=("$f"); done < <(
    find "$BACKUP_DIR" -maxdepth 1 -type f -name "${BACKUP_PREFIX}_*.dump" -print | LC_ALL=C sort -r
  )
  local seen_days=" " seen_weeks=" " seen_months=" " nd=0 nw=0 nm=0 kept=0
  local name stamp y m d day month keep
  for f in ${files[@]+"${files[@]}"}; do
    name="${f##*/}"
    stamp="${name%.dump}"
    stamp="${stamp#"${BACKUP_PREFIX}"_}"
    if [[ ! "$stamp" =~ ^([0-9]{4})([0-9]{2})([0-9]{2})T[0-9]{6}Z$ ]]; then
      log "Retención: se ignora $name (nombre fuera de formato)."
      continue
    fi
    y="${BASH_REMATCH[1]}"; m="${BASH_REMATCH[2]}"; d="${BASH_REMATCH[3]}"
    day="$y$m$d"; month="$y$m"; keep=0
    iso_week "$y" "$m" "$d"
    if [[ "$seen_days" != *" $day "* ]]; then
      seen_days+="$day "
      if (( nd < KEEP_DAILY )); then keep=1; nd=$(( nd + 1 )); fi
    fi
    if [[ "$seen_weeks" != *" $ISO_WEEK "* ]]; then
      seen_weeks+="$ISO_WEEK "
      if (( nw < KEEP_WEEKLY )); then keep=1; nw=$(( nw + 1 )); fi
    fi
    if [[ "$seen_months" != *" $month "* ]]; then
      seen_months+="$month "
      if (( nm < KEEP_MONTHLY )); then keep=1; nm=$(( nm + 1 )); fi
    fi
    if (( keep )); then
      kept=$(( kept + 1 ))
      echo "KEEP $name"
    else
      doomed+=("$f" "$f.sha256")
      echo "DELETE $name"
    fi
  done
  local removed=$(( ${#doomed[@]} / 2 )) suffix=""
  if (( DRY_RUN )); then
    suffix=" (dry-run: no se borró nada)"
  elif (( removed > 0 )); then
    rm -f -- "${doomed[@]}"
  fi
  log "Retención (${KEEP_DAILY}d/${KEEP_WEEKLY}s/${KEEP_MONTHLY}m): conservados $kept, eliminados $removed$suffix."
}

# ---------------------------------------------------------------------------------------------
# Herramientas de PostgreSQL: binario local o imagen Docker (el VPS no necesita tenerlas).
# ---------------------------------------------------------------------------------------------
pg_tool() { # pg_dump|pg_restore args...  (stdin/stdout se transmiten)
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

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  else echo ""; fi
}

human_size() { du -h "$1" 2>/dev/null | awk '{print $1}'; }

mask_url() { printf '%s' "$1" | sed -E 's#(://[^:/@]+):[^@]*@#\1:****@#'; }

upload() {
  local file=$1 name
  name="$(basename "$file")"
  if [[ -n "${BACKUP_S3_URI:-}" ]]; then
    local dest="${BACKUP_S3_URI%/}/$name" endpoint=()
    [[ -n "${BACKUP_S3_ENDPOINT:-}" ]] && endpoint=(--endpoint-url "$BACKUP_S3_ENDPOINT")
    log "Subiendo a $dest…"
    if (( DRY_RUN )); then log "(dry-run) no se sube."; return 0; fi
    if command -v aws >/dev/null 2>&1; then
      aws s3 cp "$file" "$dest" ${endpoint[@]+"${endpoint[@]}"} --only-show-errors
      [[ -f "$file.sha256" ]] && aws s3 cp "$file.sha256" "$dest.sha256" ${endpoint[@]+"${endpoint[@]}"} --only-show-errors
    elif command -v docker >/dev/null 2>&1; then
      local dir; dir="$(cd "$(dirname "$file")" && pwd)"
      docker run --rm -v "$dir:/backups:ro" \
        -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION -e AWS_SESSION_TOKEN \
        amazon/aws-cli s3 cp "/backups/$name" "$dest" ${endpoint[@]+"${endpoint[@]}"} --only-show-errors
      [[ -f "$file.sha256" ]] && docker run --rm -v "$dir:/backups:ro" \
        -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION -e AWS_SESSION_TOKEN \
        amazon/aws-cli s3 cp "/backups/$name.sha256" "$dest.sha256" ${endpoint[@]+"${endpoint[@]}"} --only-show-errors
    else
      die "BACKUP_S3_URI definido pero no hay aws CLI ni docker."
    fi
    log "Subida completa."
  elif [[ -n "${BACKUP_RCLONE_REMOTE:-}" ]]; then
    command -v rclone >/dev/null 2>&1 || die "BACKUP_RCLONE_REMOTE definido pero rclone no está instalado."
    log "Subiendo con rclone a ${BACKUP_RCLONE_REMOTE}…"
    if (( DRY_RUN )); then log "(dry-run) no se sube."; return 0; fi
    rclone copy "$file" "$BACKUP_RCLONE_REMOTE"
    [[ -f "$file.sha256" ]] && rclone copy "$file.sha256" "$BACKUP_RCLONE_REMOTE"
    log "Subida completa."
  else
    log "AVISO: sin BACKUP_S3_URI ni BACKUP_RCLONE_REMOTE: el respaldo queda SÓLO en este servidor."
  fi
}

backup() {
  local url="${BACKUP_DATABASE_URL:-${DATABASE_URL:-}}"
  [[ -n "$url" ]] || die "define BACKUP_DATABASE_URL o DATABASE_URL"
  # Prisma usa ?schema=public; libpq no reconoce ese parámetro.
  url="$(printf '%s' "$url" | sed -E 's/([?&])schema=[^&]*&?/\1/; s/[?&]$//')"

  mkdir -p "$BACKUP_DIR"
  local stamp file tmp
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  file="$BACKUP_DIR/${BACKUP_PREFIX}_${stamp}.dump"
  tmp="$file.partial"

  log "Respaldando $(mask_url "$url") → $file"
  if (( DRY_RUN )); then log "(dry-run) no se ejecuta pg_dump."; return 0; fi

  PARTIAL_FILE="$tmp"
  pg_tool pg_dump --format=custom --compress=9 --no-owner --no-privileges --dbname="$url" > "$tmp"
  [[ -s "$tmp" ]] || die "pg_dump generó un archivo vacío"

  # Valida que el archivo sea un respaldo legible (lista el índice del archivo custom)
  local entries
  entries="$(pg_tool pg_restore --list < "$tmp" | grep -cE "^[0-9]+;" || true)"
  (( entries > 0 )) || die "el respaldo no es legible por pg_restore"
  mv -f -- "$tmp" "$file"
  PARTIAL_FILE=""

  local sum; sum="$(sha256_of "$file")"
  [[ -n "$sum" ]] && printf '%s  %s\n' "$sum" "$(basename "$file")" > "$file.sha256"
  log "Respaldo OK: $(basename "$file") ($(human_size "$file"), $entries entradas, sha256 ${sum:0:12}…)"

  if (( DO_UPLOAD )); then upload "$file"; fi
}

# Evita dos respaldos simultáneos (cron + manual)
if command -v flock >/dev/null 2>&1 && (( ! PRUNE_ONLY )); then
  mkdir -p "$BACKUP_DIR"
  exec 9>"$BACKUP_DIR/.pg-backup.lock"
  flock -n 9 || die "ya hay un respaldo en curso"
fi

if (( ! PRUNE_ONLY )); then backup; fi
prune_local
log "Listo."
