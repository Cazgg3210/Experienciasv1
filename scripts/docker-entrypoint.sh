#!/bin/sh
# =============================================================================
# Ivonne & Rosa — entrypoint del contenedor de producción
#
#   docker-entrypoint.sh start          (default) migraciones + servidor Next.js
#   docker-entrypoint.sh migrate        sólo `prisma migrate deploy`
#   docker-entrypoint.sh migrate-status estado de migraciones
#   docker-entrypoint.sh seed-base      seed BASE idempotente (settings, catálogos, SUPER_ADMIN)
#   docker-entrypoint.sh <cmd...>       ejecuta cualquier otro comando (p. ej. sh)
#
# Variables:
#   RUN_MIGRATIONS=false        no aplica migraciones al arrancar (default: true)
#   RUN_SEED_BASE=true          corre el seed BASE al arrancar (idempotente; default: false)
#   MIGRATION_MAX_ATTEMPTS=10   reintentos mientras la base aún no acepta conexiones
#   MIGRATION_RETRY_DELAY=5     segundos entre reintentos
# =============================================================================
set -eu

APP_DIR="${APP_DIR:-/app}"
SCHEMA="${PRISMA_SCHEMA:-$APP_DIR/prisma/schema.prisma}"
SEED_BUNDLE="${SEED_BUNDLE:-$APP_DIR/dist/seed.cjs}"

log() {
  printf '%s [entrypoint] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

require_database_url() {
  if [ -z "${DATABASE_URL:-}" ]; then
    log "ERROR: DATABASE_URL no está definida. Configúrala en Dokploy → Environment."
    exit 1
  fi
}

run_migrations() {
  require_database_url
  attempts="${MIGRATION_MAX_ATTEMPTS:-10}"
  delay="${MIGRATION_RETRY_DELAY:-5}"
  i=1
  log "Aplicando migraciones (prisma migrate deploy)…"
  while :; do
    if prisma migrate deploy --schema "$SCHEMA"; then
      log "Migraciones al día."
      return 0
    fi
    if [ "$i" -ge "$attempts" ]; then
      log "ERROR: prisma migrate deploy falló tras $attempts intentos. El servidor NO se inicia."
      log "Revisa DATABASE_URL, que PostgreSQL esté arriba y el log de arriba (P3009 = migración fallida: ver docs/DEPLOY_DOKPLOY.md)."
      return 1
    fi
    log "migrate deploy falló (intento $i/$attempts). Reintentando en ${delay}s…"
    sleep "$delay"
    i=$((i + 1))
  done
}

run_seed_base() {
  require_database_url
  if [ ! -f "$SEED_BUNDLE" ]; then
    log "ERROR: no existe $SEED_BUNDLE (la imagen no incluye el seed empaquetado)."
    return 1
  fi
  log "Ejecutando seed BASE (idempotente)…"
  (cd "$APP_DIR" && node "$SEED_BUNDLE" --base)
}

# La imagen es de producción: un NODE_ENV distinto (p. ej. heredado de un .env de desarrollo)
# habilitaría comportamientos de desarrollo (seed DEMO, logs no estructurados).
if [ "${NODE_ENV:-production}" != "production" ]; then
  log "AVISO: NODE_ENV=${NODE_ENV} ignorado; esta imagen siempre corre con NODE_ENV=production."
fi
export NODE_ENV=production

cmd="${1:-start}"

case "$cmd" in
  start)
    if [ "${RUN_MIGRATIONS:-true}" != "false" ]; then
      run_migrations
    else
      log "RUN_MIGRATIONS=false: se omiten las migraciones."
    fi
    if [ "${RUN_SEED_BASE:-false}" = "true" ]; then
      run_seed_base
    fi
    log "Iniciando Next.js en ${HOSTNAME:-0.0.0.0}:${PORT:-3000} (NODE_ENV=${NODE_ENV:-production})."
    cd "$APP_DIR"
    exec node server.js
    ;;
  migrate)
    run_migrations
    ;;
  migrate-status)
    require_database_url
    exec prisma migrate status --schema "$SCHEMA"
    ;;
  seed-base)
    run_seed_base
    ;;
  *)
    exec "$@"
    ;;
esac
