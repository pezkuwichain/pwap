# Backend (indexer) — Deploy Runbook

The backend is a runnable Node service (`src/index.js`) that indexes chain
transfers into a **stateful** local sqlite DB and serves a small read API. It is
built into a SHA-tagged, cosign-signed GHCR image and run as a Docker container
on the backend host by the `build-image-backend` + `deploy-backend` jobs in
`.github/workflows/quality-gate.yml`.

> The KYC/council service (`src/server.js`) is a separate surface (Supabase +
> sudo signer). It is not containerized by this pipeline; only the indexer is.

## Pipeline shape (mirrors the web deploy)

```
backend (npm ci + npm test + audit)
   └─ telegram-gate (CEO approves in Telegram — SAME gate as web)
        └─ build-image-backend (docker build ./backend → GHCR :<sha> + :latest, cosign sign)
             └─ deploy-backend (cosign verify → ssh host → docker run → /health → auto-rollback)
```

- **Trigger:** only `main` or tags, `push`/`workflow_dispatch`. Never fork PRs
  (the `if:` requires `refs/heads/main`|`refs/tags/*` + `packages:write`, which
  fork PRs never get).
- **Rollback:** `gh workflow run quality-gate.yml -f rollback_to=<sha>` — skips
  build, re-runs the old signed image. The deploy step also **auto-rolls-back**
  to the previously-live SHA on a failed health check.

## STATEFUL DB — do not wipe (critical)

The indexer's sqlite file **is** the service's memory. It lives in the Docker
**named volume `pwap-indexer-db`**, mounted at `/data`, with
`DB_PATH=/data/transactions.db`.

- The image never contains the DB (see `.dockerignore` + `Dockerfile` `VOLUME`).
- `deploy-backend` does `docker rm -f` + `docker run` on every deploy/rollback
  but **never touches the volume** — state survives every deploy and rollback.
- Never run `docker volume rm pwap-indexer-db` as part of a deploy. Back it up
  before host maintenance:
  `docker run --rm -v pwap-indexer-db:/data -v "$PWD:/backup" busybox tar czf /backup/indexer-db.tgz -C /data .`

## One-time host setup

On the backend host (as the `BACKEND_VPS_USER`):

```bash
mkdir -p /opt/pwap-indexer
# Runtime env for the container (owner-managed, NOT in git):
cat > /opt/pwap-indexer/.env <<'EOF'
WS_ENDPOINT=wss://rpc.pezkuwichain.io
PORT=3001
# DB_PATH is set by the deploy to /data/transactions.db — leave unset here.
EOF
```

Docker must be installed and the deploy user able to run it. Port `3001` is
published on the host; front it with the existing nginx/Cloudflare if it needs
to be public (remember `set_real_ip_from` behind the CF proxy).

## Required GitHub secrets

New (backend-specific):

| Secret | Purpose |
| --- | --- |
| `BACKEND_VPS_HOST` | Backend host address (no hardcoded IP in the workflow). **If the backend shares the web DEV VPS, set this equal to `VPS_HOST`.** |
| `BACKEND_VPS_USER` | SSH user on the backend host. |
| `BACKEND_VPS_SSH_KEY` | SSH private key for that user. |
| `BACKEND_VPS_SSH_PORT` | Optional; defaults to `22`. |

Reused from the existing web pipeline (no new value needed):
`GITHUB_TOKEN` (GHCR push/pull + cosign), `PEXSEC_BOT_TOKEN`,
`TELEGRAM_CEO_CHAT_ID`.

## Post-deploy smoke checks

```bash
curl -fsS http://<host>:3001/health        # {"status":"ok"}
curl -fsS http://<host>:3001/api/stats     # {"total": <n>} — grows as blocks index
docker inspect --format '{{.State.Health.Status}}' pwap-indexer   # healthy
docker volume inspect pwap-indexer-db      # confirm the DB volume exists/persists
```

## Notes / can't-run-in-this-environment

- **cosign keyless signing/verification** only works inside GitHub Actions
  (needs the Sigstore OIDC token). It cannot be exercised locally/offline.
- The offline test suite (`npm test`, `test/*.test.js`) needs no chain/DB. The
  `integration-tests/*.live.test.js` suites need a live chain + Supabase and are
  **excluded** from CI on purpose.
