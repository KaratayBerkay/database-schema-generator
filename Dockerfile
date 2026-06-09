# syntax=docker/dockerfile:1

# Schema Studio runs as a normal `next start` server (not standalone output):
# several API routes shell out to the Prisma CLI (`pnpm prisma ...`) from the
# project root at runtime, and the app uses the native `better-sqlite3` binding.
# So the final image keeps a full node_modules tree + pnpm + the Prisma engines,
# and runs from /app where process.cwd() resolves the SQLite data dir.

# ---- Base -------------------------------------------------------------------
# Node 24 (current LTS) on Debian trixie-slim (Debian 13 — fresh base with fewer
# open CVEs than bookworm), matching the local toolchain pinned in .nvmrc. Native
# modules (better-sqlite3) are compiled in-image so the ABI matches this Node
# version, and Prisma's glibc engine runs here. Alpine/musl is deliberately
# avoided: Prisma's engines and better-sqlite3 are a known source of pain on musl.
FROM node:24-trixie-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
WORKDIR /app

# ---- Dependencies -----------------------------------------------------------
# python3/make/g++ compile better-sqlite3; pnpm also downloads the Prisma engines
# here (allowed via pnpm-workspace.yaml's allowBuilds).
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---- Builder ----------------------------------------------------------------
FROM deps AS builder
COPY . .
# Pre-initialize app.db in a single process so the one-time ADD COLUMN migrations
# in src/lib/db/client.ts run exactly once. `next build`'s multi-worker page-data
# collection would otherwise race on a fresh DB ("duplicate column name").
# --conditions=react-server resolves the `server-only` import to its empty stub.
# This build-time DB is discarded — only field-templates.json/.next/public are
# copied into the runner, and the server creates a fresh app.db on its volume.
RUN node --conditions=react-server --experimental-strip-types \
      -e "import('./src/lib/db/client.ts').then(()=>console.log('app.db initialized')).catch((e)=>{console.error(e);process.exit(1)})"
RUN pnpm build

# ---- Runner -----------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# pnpm's "verify deps before run" check would run `pnpm install` on every pnpm
# invocation — at container start (CMD) and on every `pnpm prisma ...` the API
# routes spawn. node_modules is baked into the image with nothing to install at
# runtime, and the check fails in this minimal context. Turn it off so pnpm just
# execs the requested binary.
ENV PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false
# OpenSSL + CA certs are required by the Prisma query/migration engines at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Full dependency tree (Prisma CLI + engines and the compiled better-sqlite3
# binding) and the built app. The migration / SQL-Query routes spawn
# `pnpm prisma ...` with cwd = /app, so node_modules must live here.
COPY --chown=node:node --from=deps    /app/node_modules        ./node_modules
COPY --chown=node:node --from=builder /app/.next               ./.next
COPY --chown=node:node --from=builder /app/public              ./public
COPY --chown=node:node --from=builder /app/package.json        ./package.json
COPY --chown=node:node --from=builder /app/pnpm-lock.yaml      ./pnpm-lock.yaml
COPY --chown=node:node --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --chown=node:node --from=builder /app/.npmrc              ./.npmrc
COPY --chown=node:node --from=builder /app/next.config.ts      ./next.config.ts
COPY --chown=node:node --from=builder /app/field-templates.json ./field-templates.json

# Writable data dir: SQLite app.db + the SQL-Query .db files. Mount a volume here
# (see docker-compose.yaml) to persist projects across rebuilds.
RUN mkdir -p /app/src/database && chown -R node:node /app/src

USER node
EXPOSE 3000

# `/` redirects to /tables (followed automatically); a 2xx means the app is up.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["pnpm", "exec", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
