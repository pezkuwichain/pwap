-- =====================================================
-- Migration: Harden RLS on financial + PII tables
-- Date: 2026-07-25
-- =====================================================
--
-- Forward migration (does NOT rewrite history) that removes the blanket
-- `USING (true)` read policies added in 20260223160000_fix_rls_for_wallet_auth
-- on the crown-jewel financial/PII tables, so the public anon key can no longer
-- enumerate every user's balances, ledger history, deposit/withdraw requests, or
-- payment-method PII.
--
-- Reads the app legitimately needs are moved behind SECURITY DEFINER RPCs that
-- return only the requested user's rows (instead of the whole table). Writes to
-- these tables already go through service_role edge functions / SECURITY DEFINER
-- RPCs, so no client write path is affected.
--
-- NOTE (residual, tracked): user_id is a UUID v5 derived from a citizen/visa
-- number, which is not a secret. These RPCs remove full-table exfiltration but do
-- not yet cryptographically bind the reader to the row owner. Fully closing that
-- requires a signed-session read path (same mechanism as withdrawals) applied to
-- these reads — see the security report. The high-severity leak (dump ALL rows)
-- is closed here.

-- =====================================================
-- 1. user_internal_balances — no direct client reads (uses
--    get_user_internal_balance RPC which is SECURITY DEFINER and bypasses RLS)
-- =====================================================
DROP POLICY IF EXISTS "balances_anon_select" ON public.user_internal_balances;
-- No anon policy remains -> anon/authenticated cannot read the table directly.
-- SECURITY DEFINER RPCs (get_user_internal_balance) continue to work.

-- =====================================================
-- 2. p2p_balance_transactions — replace open SELECT with a scoped RPC
-- =====================================================
DROP POLICY IF EXISTS "balance_tx_anon_select" ON public.p2p_balance_transactions;

CREATE OR REPLACE FUNCTION public.get_user_balance_transactions(
  p_user_id UUID,
  p_limit INT DEFAULT 50
) RETURNS SETOF public.p2p_balance_transactions AS $$
  SELECT *
  FROM public.p2p_balance_transactions
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_balance_transactions(UUID, INT) TO anon, authenticated;

COMMENT ON FUNCTION public.get_user_balance_transactions IS
'Returns balance-transaction history for a single user_id only (no full-table
dump). Replaces the removed USING(true) SELECT policy.';

-- =====================================================
-- 3. p2p_deposit_withdraw_requests — replace open SELECT with a scoped RPC
--    (service_role write policy from 20260223160000 is retained)
-- =====================================================
DROP POLICY IF EXISTS "deposit_requests_anon_select" ON public.p2p_deposit_withdraw_requests;

CREATE OR REPLACE FUNCTION public.get_user_deposit_withdraw_requests(
  p_user_id UUID,
  p_limit INT DEFAULT 50
) RETURNS SETOF public.p2p_deposit_withdraw_requests AS $$
  SELECT *
  FROM public.p2p_deposit_withdraw_requests
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_deposit_withdraw_requests(UUID, INT) TO anon, authenticated;

COMMENT ON FUNCTION public.get_user_deposit_withdraw_requests IS
'Returns deposit/withdraw requests for a single user_id only. Replaces the
removed USING(true) SELECT policy.';

-- =====================================================
-- 4. p2p_user_payment_methods (IBAN / payment PII) — lock to service role
--    (no direct client access exists; offers embed encrypted payment details).
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'p2p_user_payment_methods') THEN
    EXECUTE 'ALTER TABLE public.p2p_user_payment_methods ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "user_pm_anon_select" ON public.p2p_user_payment_methods';
    EXECUTE 'DROP POLICY IF EXISTS "user_pm_anon_insert" ON public.p2p_user_payment_methods';
    EXECUTE 'DROP POLICY IF EXISTS "user_pm_anon_update" ON public.p2p_user_payment_methods';
    EXECUTE 'DROP POLICY IF EXISTS "user_pm_service_only" ON public.p2p_user_payment_methods';
    EXECUTE 'CREATE POLICY "user_pm_service_only" ON public.p2p_user_payment_methods
               FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')';
    EXECUTE 'REVOKE ALL ON public.p2p_user_payment_methods FROM anon, authenticated, PUBLIC';
  END IF;
END $$;

-- =====================================================
-- 5. p2p_fiat_disputes — remove world-open UPDATE.
--    Dispute state transitions (claim/resolve) now go through the service-role
--    `resolve-dispute` edge function (which verifies the admin wallet signature).
--    Regular users still INSERT disputes (disputes_anon_insert retained).
-- =====================================================
DROP POLICY IF EXISTS "disputes_anon_update" ON public.p2p_fiat_disputes;
DROP POLICY IF EXISTS "disputes_service_update" ON public.p2p_fiat_disputes;
CREATE POLICY "disputes_service_update" ON public.p2p_fiat_disputes
  FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- Done. Balances, ledger, deposit/withdraw requests and payment PII are no longer
-- world-readable via the anon key; dispute resolution is no longer world-writable.
--
-- RESIDUAL (documented in the security report, NOT closed here to avoid breaking
-- the live app without the signed-session refactor):
--   * p2p_fiat_offers / p2p_fiat_trades / p2p_messages still carry USING(true)
--     policies because the client reads/writes them directly with the anon key
--     and there is no server session to bind to. Marking a trade status does not
--     itself move funds.
--   * The internal-ledger escrow RPCs (lock_/release_/refund_escrow_internal)
--     are still EXECUTE-able by anon (confirmPaymentReceived / createFiatOffer
--     call them directly). This is a SEPARATE critical hole that needs the same
--     signed-challenge mechanism applied to trade actions (an authenticated
--     confirm-payment / create-offer edge function). See report.
-- =====================================================
