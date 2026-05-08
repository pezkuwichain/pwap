# pwap/web — Static SPA build for distribution.
# Stage 1: build with Node. Stage 2: pure dist/ in busybox (smallest possible
# attacker surface — no shell, no package manager, no node runtime).
# Tag the resulting image with the git SHA in CI so rollback is just
# "pull pwap-web:<old-sha>".

# ─── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /build

# Copy package files first to leverage Docker layer cache when only src changes
COPY package.json package-lock.json ./
RUN npm ci

# Copy source after dependencies — invalidates only on code change
COPY . .

# Build args for environment-specific values (passed from CI)
ARG VITE_NETWORK=MAINNET
ARG VITE_WS_ENDPOINT=wss://rpc.pezkuwichain.io
ARG VITE_WS_ENDPOINT_FALLBACK_1=wss://mainnet.pezkuwichain.io
ARG VITE_ASSET_HUB_ENDPOINT=wss://asset-hub-rpc.pezkuwichain.io
ARG VITE_PEOPLE_CHAIN_ENDPOINT=wss://people-rpc.pezkuwichain.io
ARG VITE_WALLETCONNECT_PROJECT_ID=8292a793b7640e8364c378e331e76d04
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

ENV VITE_NETWORK=$VITE_NETWORK
ENV VITE_WS_ENDPOINT=$VITE_WS_ENDPOINT
ENV VITE_WS_ENDPOINT_FALLBACK_1=$VITE_WS_ENDPOINT_FALLBACK_1
ENV VITE_ASSET_HUB_ENDPOINT=$VITE_ASSET_HUB_ENDPOINT
ENV VITE_PEOPLE_CHAIN_ENDPOINT=$VITE_PEOPLE_CHAIN_ENDPOINT
ENV VITE_WALLETCONNECT_PROJECT_ID=$VITE_WALLETCONNECT_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# ─── Stage 2: Distribution image ───────────────────────────────
# busybox:musl gives us a tiny base (~1.5MB) with a shell for `cp` operations
# during deploy extraction, but no npm/curl/wget/ssh — minimal attack surface
# if the image were ever exposed.
FROM busybox:musl
WORKDIR /dist
COPY --from=builder /build/dist /dist
LABEL org.opencontainers.image.source="https://github.com/pezkuwichain/pwap"
LABEL org.opencontainers.image.description="pwap/web static SPA — Pezkuwi wallet/exchange frontend"
LABEL org.opencontainers.image.licenses="proprietary"
CMD ["sh", "-c", "echo 'pwap-web image — extract /dist via: docker create + docker cp'; sleep infinity"]
