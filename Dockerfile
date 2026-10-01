# syntax=docker/dockerfile:1
# =============================================================================
# Ivonne & Rosa — imagen de producción (Next.js standalone + Prisma)
#
#   docker build -t ivonne-rosa .
#   docker run --env-file .env.production -p 3000:3000 ivonne-rosa
#
# Etapas:
#   base       node:22 bookworm-slim + openssl/ca-certificates + pnpm (corepack)
#   deps       pnpm install --frozen-lockfile (con caché de BuildKit)
#   builder    prisma generate + next build (env de marcador: el build NUNCA necesita
#              una base de datos ni secretos reales) + seed BASE empaquetado (dist/seed.cjs)
#   prisma-cli Prisma CLI aislado para `prisma migrate deploy` en runtime
#   runner     imagen final mínima, usuario no-root (uid 1001), HEALTHCHECK con node
#
# Los archivos subidos NUNCA se guardan en el contenedor: usar STORAGE_DRIVER=s3.
# Ver docs/DEPLOY_DOKPLOY.md
# =============================================================================

ARG NODE_VERSION=22
ARG PNPM_VERSION=9.15.9
ARG PRISMA_VERSION=6.19.3

# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    npm_config_update_notifier=false
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

# -----------------------------------------------------------------------------
FROM base AS deps
# El postinstall del proyecto ejecuta `prisma generate`: necesita el schema.
COPY package.json pnpm-lock.yaml ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN --mount=type=cache,id=ivonne-rosa-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store

# -----------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Variables de marcador SÓLO para compilar (no llegan a la imagen final).
# Las páginas que leen la base son dinámicas: el build no se conecta a PostgreSQL.
RUN pnpm exec prisma generate \
 && NODE_ENV=production \
    SKIP_ENV_VALIDATION=1 \
    DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" \
    AUTH_SECRET="build-only-placeholder-secret-0000" \
    AUTH_URL="http://localhost:3000" \
    APP_URL="http://localhost:3000" \
    STORAGE_DRIVER=s3 \
    pnpm build \
 && node scripts/seed-base/build.mjs \
 && test -f .next/standalone/server.js
# La imagen final es Debian (glibc): el engine de Prisma para musl/Alpine sobra (~17 MB).
RUN find .next/standalone -name 'libquery_engine-linux-musl*' -delete

# -----------------------------------------------------------------------------
# Prisma CLI aislado (con su schema-engine) para `prisma migrate deploy` en runtime.
FROM base AS prisma-cli
ARG PRISMA_VERSION
WORKDIR /opt/prisma-cli
RUN npm init -y >/dev/null \
 && npm install --omit=dev --no-audit --no-fund --loglevel=error "prisma@${PRISMA_VERSION}" \
 && rm -rf /root/.npm \
 && ./node_modules/.bin/prisma --version

# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runner
LABEL org.opencontainers.image.title="ivonne-rosa" \
      org.opencontainers.image.description="Ivonne & Rosa — plataforma (Next.js standalone + Prisma)" \
      org.opencontainers.image.licenses="UNLICENSED"

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 nodejs \
 && useradd --uid 1001 --gid nodejs --no-log-init --create-home --home-dir /home/nextjs nextjs

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    STORAGE_DRIVER=s3 \
    RUN_MIGRATIONS=true \
    PATH=/opt/prisma-cli/node_modules/.bin:$PATH

WORKDIR /app

# Prisma CLI (sólo lectura, propiedad de root)
COPY --from=prisma-cli /opt/prisma-cli /opt/prisma-cli

# App: salida standalone de Next.js (incluye node_modules mínimos y el Prisma Client con su engine)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Schema + migraciones (prisma migrate deploy) y seed BASE empaquetado
COPY --from=builder --chown=nextjs:nodejs /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma/migrations ./prisma/migrations
COPY --from=builder --chown=nextjs:nodejs /app/dist/seed.cjs ./dist/seed.cjs

COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Normaliza finales de línea (por si el repo se clonó en Windows con CRLF)
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
 && chmod 0755 /usr/local/bin/docker-entrypoint.sh \
 && mkdir -p /app/.next/cache \
 && chown -R nextjs:nodejs /app/.next

USER nextjs

EXPOSE 3000

# Liveness con node (la imagen no trae curl). start-period cubre las migraciones al arrancar.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

ENTRYPOINT ["/usr/bin/tini", "--", "docker-entrypoint.sh"]
CMD ["start"]
