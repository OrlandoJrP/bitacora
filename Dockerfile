# ─────────────────────────────────────────────────────────────────────────────
# Bitácora — Dockerfile (Next.js standalone, Node 20)
# Imagen lista para DigitalOcean App Platform (Dockerfile) o cualquier runtime de
# contenedores. Las migraciones/seed se ejecutan como job aparte (ver DEPLOY.md).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH" NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# 1) Dependencias (cacheable)
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# 2) Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# URL ficticia solo para el build: las páginas son dinámicas, no se conectan a la BD.
ENV DATABASE_URL="postgres://invalid:invalid@127.0.0.1:5432/bitacora?sslmode=disable"
RUN pnpm build

# 3) Runner (imagen mínima con la salida standalone)
FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

# ─────────────────────────────────────────────────────────────────────────────
# Migraciones + seed (imagen completa con dependencias y scripts):
#   docker build --target deps -t bitacora-tools .
#   docker run --rm -e DATABASE_URL="...sslmode=require" \
#     -e ADMIN_EMAIL=... -e ADMIN_INITIAL_PASSWORD=... \
#     -v "$PWD":/app -w /app bitacora-tools \
#     sh -c "pnpm db:migrate && pnpm db:seed"
# En App Platform es más simple usar el job PRE_DEPLOY del app.yaml (buildpack).
# ─────────────────────────────────────────────────────────────────────────────
