# pwap indexer service — runnable Node container (not a static-dist image).
#
# Two stages on the SAME debian base so the natively-compiled sqlite3 binding
# built in stage 1 is ABI-compatible with the runtime in stage 2 (do NOT mix
# alpine/musl here — sqlite3 would fail to load).
#
# STATEFUL DATA: the indexer's sqlite file is the service's memory. It is kept
# OUT of the image, under /data, which MUST be a mounted volume. A deploy
# replaces the container/image but never the volume — see backend/DEPLOY.md.

# ─── Stage 1: install production deps (compiles sqlite3) ────────
FROM node:20-bookworm AS builder
WORKDIR /app
COPY package.json package-lock.json ./
# --omit=dev: the test-only devDeps (supertest, @pezkuwi/keyring) never ship.
RUN npm ci --omit=dev

# ─── Stage 2: runtime ──────────────────────────────────────────
FROM node:20-bookworm-slim
ENV NODE_ENV=production
ENV PORT=3001
# DB on the volume, never in the image layer.
ENV DB_PATH=/data/transactions.db
WORKDIR /app

# curl only, for the HEALTHCHECK probe.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# /data holds the stateful sqlite DB — declared as a volume and owned by the
# non-root runtime user so the container can write to the mount.
RUN mkdir -p /data && chown -R node:node /app /data
VOLUME ["/data"]

USER node
EXPOSE 3001

# Probe the in-container /health endpoint added to the indexer API.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD sh -c 'curl -fsS "http://localhost:${PORT:-3001}/health" || exit 1'

CMD ["node", "src/index.js"]
