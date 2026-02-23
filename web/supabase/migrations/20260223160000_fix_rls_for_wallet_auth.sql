-- Migration: Fix RLS policies for wallet-based authentication
--
-- Problem: All P2P RLS policies use auth.uid() which returns NULL because
-- users authenticate via wallet (not Supabase Auth). This blocks all access.
--
-- Solution: Replace auth.uid() policies with open access policies.
-- Security model:
--   - Financial mutations (escrow, deposits, withdrawals) go through SECURITY DEFINER RPCs
--   - Frontend queries filter by userId (UUID v5 derived from citizen/visa number)
--   - Edge functions use service_role key (bypass RLS)
--   - Admin operations check profiles.role in SECURITY DEFINER functions

-- ============================================================
-- 1. p2p_fiat_offers
-- ============================================================
DROP POLICY IF EXISTS "offers_seller_read_own" ON public.p2p_fiat_offers;
DROP POLICY IF EXISTS "offers_seller_insert" ON public.p2p_fiat_offers;
DROP POLICY IF EXISTS "offers_seller_update_own" ON public.p2p_fiat_offers;
DROP POLICY IF EXISTS "offers_seller_delete_own" ON public.p2p_fiat_offers;
-- Keep: offers_public_read_active (doesn't use auth.uid())

-- Sellers manage their own offers (anon key, no auth session)
CREATE POLICY "offers_anon_insert" ON public.p2p_fiat_offers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "offers_anon_update" ON public.p2p_fiat_offers
  FOR UPDATE USING (true);

CREATE POLICY "offers_anon_delete" ON public.p2p_fiat_offers
  FOR DELETE USING (true);

-- ============================================================
-- 2. p2p_fiat_trades
-- ============================================================
DROP POLICY IF EXISTS "trades_parties_read" ON public.p2p_fiat_trades;
DROP POLICY IF EXISTS "trades_buyer_insert" ON public.p2p_fiat_trades;
DROP POLICY IF EXISTS "trades_parties_update" ON public.p2p_fiat_trades;

CREATE POLICY "trades_anon_select" ON public.p2p_fiat_trades
  FOR SELECT USING (true);

CREATE POLICY "trades_anon_insert" ON public.p2p_fiat_trades
  FOR INSERT WITH CHECK (true);

CREATE POLICY "trades_anon_update" ON public.p2p_fiat_trades
  FOR UPDATE USING (true);

-- ============================================================
-- 3. p2p_fiat_disputes
-- ============================================================
DROP POLICY IF EXISTS "disputes_parties_read" ON public.p2p_fiat_disputes;
DROP POLICY IF EXISTS "disputes_moderators_read" ON public.p2p_fiat_disputes;
DROP POLICY IF EXISTS "disputes_parties_insert" ON public.p2p_fiat_disputes;

CREATE POLICY "disputes_anon_select" ON public.p2p_fiat_disputes
  FOR SELECT USING (true);

CREATE POLICY "disputes_anon_insert" ON public.p2p_fiat_disputes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "disputes_anon_update" ON public.p2p_fiat_disputes
  FOR UPDATE USING (true);

-- ============================================================
-- 4. p2p_dispute_evidence
-- ============================================================
-- May not have RLS enabled yet, ensure it does with open policies
ALTER TABLE IF EXISTS public.p2p_dispute_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evidence_anon_select" ON public.p2p_dispute_evidence;
DROP POLICY IF EXISTS "evidence_anon_insert" ON public.p2p_dispute_evidence;

CREATE POLICY "evidence_anon_select" ON public.p2p_dispute_evidence
  FOR SELECT USING (true);

CREATE POLICY "evidence_anon_insert" ON public.p2p_dispute_evidence
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- 5. p2p_messages (chat)
-- ============================================================
ALTER TABLE IF EXISTS public.p2p_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_anon_select" ON public.p2p_messages;
DROP POLICY IF EXISTS "messages_anon_insert" ON public.p2p_messages;
DROP POLICY IF EXISTS "messages_anon_update" ON public.p2p_messages;

CREATE POLICY "messages_anon_select" ON public.p2p_messages
  FOR SELECT USING (true);

CREATE POLICY "messages_anon_insert" ON public.p2p_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "messages_anon_update" ON public.p2p_messages
  FOR UPDATE USING (true);

-- ============================================================
-- 6. p2p_notifications
-- ============================================================
ALTER TABLE IF EXISTS public.p2p_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_anon_select" ON public.p2p_notifications;
DROP POLICY IF EXISTS "notifications_anon_insert" ON public.p2p_notifications;
DROP POLICY IF EXISTS "notifications_anon_update" ON public.p2p_notifications;

CREATE POLICY "notifications_anon_select" ON public.p2p_notifications
  FOR SELECT USING (true);

CREATE POLICY "notifications_anon_insert" ON public.p2p_notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "notifications_anon_update" ON public.p2p_notifications
  FOR UPDATE USING (true);

-- ============================================================
-- 7. p2p_ratings
-- ============================================================
ALTER TABLE IF EXISTS public.p2p_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ratings_anon_select" ON public.p2p_ratings;
DROP POLICY IF EXISTS "ratings_anon_insert" ON public.p2p_ratings;

CREATE POLICY "ratings_anon_select" ON public.p2p_ratings
  FOR SELECT USING (true);

CREATE POLICY "ratings_anon_insert" ON public.p2p_ratings
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- 8. p2p_block_trade_requests
-- ============================================================
ALTER TABLE IF EXISTS public.p2p_block_trade_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_trades_anon_select" ON public.p2p_block_trade_requests;
DROP POLICY IF EXISTS "block_trades_anon_insert" ON public.p2p_block_trade_requests;

CREATE POLICY "block_trades_anon_select" ON public.p2p_block_trade_requests
  FOR SELECT USING (true);

CREATE POLICY "block_trades_anon_insert" ON public.p2p_block_trade_requests
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- 9. p2p_merchant_tiers
-- ============================================================
ALTER TABLE IF EXISTS public.p2p_merchant_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchant_tiers_anon_select" ON public.p2p_merchant_tiers;

CREATE POLICY "merchant_tiers_anon_select" ON public.p2p_merchant_tiers
  FOR SELECT USING (true);

-- ============================================================
-- 10. p2p_merchant_stats
-- ============================================================
ALTER TABLE IF EXISTS public.p2p_merchant_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchant_stats_anon_select" ON public.p2p_merchant_stats;

CREATE POLICY "merchant_stats_anon_select" ON public.p2p_merchant_stats
  FOR SELECT USING (true);

-- ============================================================
-- 11. p2p_reputation (already has open SELECT, keep it)
-- ============================================================
-- reputation_public_read already uses USING (true) - no change needed

-- ============================================================
-- 12. user_internal_balances
-- Reads go through RPC get_user_internal_balance (SECURITY DEFINER)
-- But drop the auth.uid() policies to prevent errors
-- ============================================================
DROP POLICY IF EXISTS "Users can view own balances" ON public.user_internal_balances;
DROP POLICY IF EXISTS "Admins can view all balances" ON public.user_internal_balances;

CREATE POLICY "balances_anon_select" ON public.user_internal_balances
  FOR SELECT USING (true);

-- ============================================================
-- 13. p2p_deposit_withdraw_requests
-- Reads from frontend, writes via SECURITY DEFINER RPCs + edge functions
-- ============================================================
DROP POLICY IF EXISTS "Users can view own requests" ON public.p2p_deposit_withdraw_requests;
DROP POLICY IF EXISTS "Users can create own requests" ON public.p2p_deposit_withdraw_requests;
DROP POLICY IF EXISTS "Admins can manage all requests" ON public.p2p_deposit_withdraw_requests;

CREATE POLICY "deposit_requests_anon_select" ON public.p2p_deposit_withdraw_requests
  FOR SELECT USING (true);

-- Writes handled by service_role (edge functions) and SECURITY DEFINER RPCs
CREATE POLICY "deposit_requests_service_write" ON public.p2p_deposit_withdraw_requests
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 14. p2p_balance_transactions
-- Read-only from frontend
-- ============================================================
DROP POLICY IF EXISTS "Users can view own transactions" ON public.p2p_balance_transactions;

CREATE POLICY "balance_tx_anon_select" ON public.p2p_balance_transactions
  FOR SELECT USING (true);

-- ============================================================
-- 15. p2p_audit_log - keep restricted
-- ============================================================
DROP POLICY IF EXISTS "audit_user_read_own" ON public.p2p_audit_log;
DROP POLICY IF EXISTS "audit_admin_read_all" ON public.p2p_audit_log;
DROP POLICY IF EXISTS "p2p_audit_log_admin_only" ON public.p2p_audit_log;

-- Audit log: open INSERT (shared lib writes via anon key), SELECT for service_role
CREATE POLICY "audit_log_anon_insert" ON public.p2p_audit_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "audit_log_service_select" ON public.p2p_audit_log
  FOR SELECT USING (auth.role() = 'service_role');

-- ============================================================
-- 16. p2p_platform_escrow - keep restricted to service_role (if exists)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'p2p_platform_escrow') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Sellers can view their escrow" ON public.p2p_platform_escrow';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all escrow" ON public.p2p_platform_escrow';
    EXECUTE 'CREATE POLICY "escrow_service_only" ON public.p2p_platform_escrow FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
END $$;

-- ============================================================
-- 17. platform_escrow_balance - keep restricted (if exists)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_escrow_balance') THEN
    EXECUTE 'DROP POLICY IF EXISTS "escrow_admin_only" ON public.platform_escrow_balance';
    EXECUTE 'CREATE POLICY "escrow_balance_service_only" ON public.platform_escrow_balance FOR ALL USING (auth.role() = ''service_role'')';
  END IF;
END $$;

-- ============================================================
-- 18. p2p_user_payment_methods (if exists)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'p2p_user_payment_methods') THEN
    ALTER TABLE public.p2p_user_payment_methods ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS "user_pm_anon_select" ON public.p2p_user_payment_methods';
    EXECUTE 'DROP POLICY IF EXISTS "user_pm_anon_insert" ON public.p2p_user_payment_methods';
    EXECUTE 'DROP POLICY IF EXISTS "user_pm_anon_update" ON public.p2p_user_payment_methods';
    EXECUTE 'CREATE POLICY "user_pm_anon_select" ON public.p2p_user_payment_methods FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "user_pm_anon_insert" ON public.p2p_user_payment_methods FOR INSERT WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "user_pm_anon_update" ON public.p2p_user_payment_methods FOR UPDATE USING (true)';
  END IF;
END $$;

-- ============================================================
-- Done. All P2P tables now work with wallet-based auth.
-- Financial security maintained through SECURITY DEFINER RPCs.
-- ============================================================
