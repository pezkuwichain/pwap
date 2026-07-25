# Security Fixes — Deploy Runbook (2026-07-25)

Deploys are gated and applied by the owner. This runbook lists exactly what must
ship for the P2P custodial-fund security fixes. **Apply migrations first, then
edge functions, then set secrets, then ship the frontend.** All escrow/withdraw
paths fail closed, so partial deploys can block legitimate withdrawals/trades.

## 1. Migrations (apply in this order)

Round 1 (BOLA / RLS / dispute escrow):
1. `20260725000000_withdraw_authz_hardening.sql` — `p2p_challenge_nonces` table; locks `request_withdraw` to service role.
2. `20260725010000_harden_financial_rls.sql` — removes world-open reads on balances/ledger/deposit-withdraw/payment-PII; scoped read RPCs; locks `p2p_fiat_disputes` UPDATE to service role.
3. `20260725020000_admin_dispute_resolution.sql` — `admin_resolve_dispute` (atomic release/refund/split, service role only).

Round 2 (escrow-RPC drain):
4. `20260725030000_lock_escrow_internal_rpcs.sql` — REVOKE PUBLIC/anon/authenticated EXECUTE on `lock_/release_/refund_escrow_internal`; GRANT to `service_role`.

> Migration 4 MUST be accompanied by the round-2 edge functions (below) and the
> updated frontend, or offer-creation and payment-release will break (the client
> can no longer call the escrow RPCs directly).

## 2. Edge functions to deploy

Round 1:
- `process-withdraw` (rewritten — signed-challenge authz, derives user_id server-side)
- `process-withdrawal` (batch — now requires the service-role key)
- `verify-deposit` (adds identity-ownership binding)
- `resolve-dispute` (new — admin-signature-gated dispute claim/resolve)

Round 2:
- `confirm-payment` (new — seller-signed escrow release)
- `lock-escrow` (new — owner-signed escrow lock)

Shared code: `functions/_shared/identity-auth.ts` (imported by the above; not a
deployable function itself — ensure it deploys alongside).

## 3. Secrets (supabase functions secrets)

- `PEOPLE_RPC_ENDPOINT` — People Chain WS (default `wss://people-rpc.pezkuwichain.io`).
  Required by `process-withdraw`, `verify-deposit`, `confirm-payment`, `lock-escrow`
  for citizen-NFT ownership verification.
- `ADMIN_WALLETS` — optional, comma-separated SS58 admin set for `resolve-dispute`
  (defaults to the 3 historical admin wallets baked into the function).
- Existing: `PLATFORM_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, RPC endpoints.

## 4. Frontend

Ship the updated client (new signing flows in withdraw/offer-create/payment-release
and the admin dispute panel). Users now sign an authorization challenge in their
wallet for: withdrawals, offer creation (lock), payment release, and admin dispute
actions.

## 5. Post-deploy smoke checks

- Withdraw a small amount (signs, succeeds; a replayed nonce is rejected).
- Create a sell offer (signs the lock; balance moves available→locked).
- Complete a trade release (seller signs; buyer credited).
- Resolve a test dispute as admin (escrow actually moves).
- Confirm anon `rpc('release_escrow_internal', …)` now returns permission denied.

## Known residual (NOT closed — tracked)

- Scoped read RPCs (`get_user_balance_transactions`, `get_user_deposit_withdraw_requests`)
  are keyed by a non-secret `user_id` (UUID from citizen/visa number). They stop
  full-table dumps but are not yet bound to a signed session. Deferred to avoid a
  sign-prompt on every passive read; reads leak history only (no fund movement).
- `p2p_fiat_offers` / `p2p_fiat_trades` / `p2p_messages` retain `USING(true)` for
  direct client read/write (no server session to bind to). Marking a trade status
  moves no funds; all fund movement now flows through service-role edge functions.
