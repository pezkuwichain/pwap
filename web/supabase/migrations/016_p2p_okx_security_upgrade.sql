-- =====================================================
-- P2P OKX-LEVEL SECURITY UPGRADE
-- Migration: 016_p2p_okx_security_upgrade.sql
-- Date: 2026-01-29
-- =====================================================
--
-- This migration brings the P2P system to OKX-level security:
-- 1. Deposit verification restricted to service role only
-- 2. TX hash duplicate prevention (UNIQUE constraint)
-- 3. Auto-release removed (disputes instead)
-- 4. Enhanced escrow controls
--

-- =====================================================
-- 1. ADD UNIQUE CONSTRAINT ON TX HASH (Prevent Double-Credit)
-- =====================================================

-- Add unique constraint to prevent same TX being processed twice
DO $$
BEGIN
  -- Check if table exists first
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'p2p_deposit_withdraw_requests') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'p2p_deposit_withdraw_requests_tx_hash_unique'
    ) THEN
      ALTER TABLE p2p_deposit_withdraw_requests
      ADD CONSTRAINT p2p_deposit_withdraw_requests_tx_hash_unique
      UNIQUE (blockchain_tx_hash)
      DEFERRABLE INITIALLY DEFERRED;
    END IF;
  ELSE
    RAISE NOTICE 'Table p2p_deposit_withdraw_requests does not exist. Please run migration 014 first.';
  END IF;
END $$;

-- Index for faster duplicate checking (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'p2p_deposit_withdraw_requests') THEN
    CREATE INDEX IF NOT EXISTS idx_deposit_withdraw_tx_hash
    ON p2p_deposit_withdraw_requests(blockchain_tx_hash)
    WHERE blockchain_tx_hash IS NOT NULL;
  END IF;
END $$;

-- =====================================================
-- 2. SECURE PROCESS_DEPOSIT FUNCTION (Service Role Only)
-- =====================================================

-- Drop old function and recreate with service role check
DROP FUNCTION IF EXISTS process_deposit(UUID, TEXT, DECIMAL, TEXT, UUID);

CREATE OR REPLACE FUNCTION process_deposit(
  p_user_id UUID,
  p_token TEXT,
  p_amount DECIMAL(20, 12),
  p_tx_hash TEXT,
  p_request_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_balance_before DECIMAL(20, 12) := 0;
  v_existing_tx RECORD;
BEGIN
  -- =====================================================
  -- SECURITY CHECK: Only service role can call this function
  -- This prevents users from crediting their own balance
  -- =====================================================
  IF current_setting('role', true) != 'service_role' AND
     current_setting('request.jwt.claim.role', true) != 'service_role' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'UNAUTHORIZED: Only backend service can process deposits'
    );
  END IF;

  -- =====================================================
  -- DUPLICATE CHECK: Prevent same TX hash being processed twice
  -- =====================================================
  SELECT * INTO v_existing_tx
  FROM p2p_deposit_withdraw_requests
  WHERE blockchain_tx_hash = p_tx_hash
    AND status = 'completed';

  IF FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'DUPLICATE: This transaction has already been processed',
      'existing_request_id', v_existing_tx.id
    );
  END IF;

  -- =====================================================
  -- PROCESS DEPOSIT
  -- =====================================================

  -- Get current balance
  SELECT available_balance INTO v_balance_before
  FROM user_internal_balances
  WHERE user_id = p_user_id AND token = p_token;

  IF v_balance_before IS NULL THEN
    v_balance_before := 0;
  END IF;

  -- Upsert balance
  INSERT INTO user_internal_balances (
    user_id, token, available_balance, total_deposited, last_deposit_at
  ) VALUES (
    p_user_id, p_token, p_amount, p_amount, NOW()
  )
  ON CONFLICT (user_id, token)
  DO UPDATE SET
    available_balance = user_internal_balances.available_balance + p_amount,
    total_deposited = user_internal_balances.total_deposited + p_amount,
    last_deposit_at = NOW(),
    updated_at = NOW();

  -- Log the transaction
  INSERT INTO p2p_balance_transactions (
    user_id, token, transaction_type, amount,
    balance_before, balance_after, reference_type, reference_id,
    description
  ) VALUES (
    p_user_id, p_token, 'deposit', p_amount,
    v_balance_before, v_balance_before + p_amount, 'deposit_request', p_request_id,
    'Verified deposit from blockchain TX: ' || p_tx_hash
  );

  -- Update request status if provided
  IF p_request_id IS NOT NULL THEN
    UPDATE p2p_deposit_withdraw_requests
    SET
      status = 'completed',
      blockchain_tx_hash = p_tx_hash,
      processed_at = NOW(),
      updated_at = NOW()
    WHERE id = p_request_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'deposited_amount', p_amount,
    'new_balance', v_balance_before + p_amount,
    'tx_hash', p_tx_hash
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke execute from authenticated users (only service role)
REVOKE EXECUTE ON FUNCTION process_deposit FROM authenticated;
REVOKE EXECUTE ON FUNCTION process_deposit FROM anon;

-- =====================================================
-- 3. CREATE DEPOSIT REQUEST FUNCTION (User-facing)
-- =====================================================

-- Users submit deposit requests, backend verifies and credits
CREATE OR REPLACE FUNCTION submit_deposit_request(
  p_token TEXT,
  p_amount DECIMAL(20, 12),
  p_tx_hash TEXT,
  p_wallet_address TEXT
) RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_existing_request RECORD;
  v_request_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Validate token
  IF p_token NOT IN ('HEZ', 'PEZ') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid token');
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than 0');
  END IF;

  -- Check for existing request with same TX hash
  SELECT * INTO v_existing_request
  FROM p2p_deposit_withdraw_requests
  WHERE blockchain_tx_hash = p_tx_hash;

  IF FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'A request with this transaction hash already exists',
      'existing_status', v_existing_request.status
    );
  END IF;

  -- Create deposit request (pending verification)
  INSERT INTO p2p_deposit_withdraw_requests (
    user_id,
    request_type,
    token,
    amount,
    wallet_address,
    blockchain_tx_hash,
    status
  ) VALUES (
    v_user_id,
    'deposit',
    p_token,
    p_amount,
    p_wallet_address,
    p_tx_hash,
    'pending'
  ) RETURNING id INTO v_request_id;

  RETURN json_build_object(
    'success', true,
    'request_id', v_request_id,
    'status', 'pending',
    'message', 'Deposit request submitted. Verification typically takes 1-5 minutes.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION submit_deposit_request TO authenticated;

-- =====================================================
-- 4. REMOVE AUTO-RELEASE, ADD DISPUTE TRIGGER
-- =====================================================

-- Replace cancel_expired_trades to NOT auto-release
CREATE OR REPLACE FUNCTION public.cancel_expired_trades()
RETURNS void AS $$
DECLARE
  v_trade RECORD;
BEGIN
  -- Cancel trades where buyer didn't pay in time
  FOR v_trade IN
    SELECT * FROM public.p2p_fiat_trades
    WHERE status = 'pending'
      AND payment_deadline < NOW()
  LOOP
    -- Update trade status
    UPDATE public.p2p_fiat_trades
    SET
      status = 'cancelled',
      cancelled_by = seller_id,
      cancellation_reason = 'Payment deadline expired',
      updated_at = NOW()
    WHERE id = v_trade.id;

    -- Refund escrow to seller (internal ledger)
    PERFORM refund_escrow_internal(
      v_trade.seller_id,
      (SELECT token FROM p2p_fiat_offers WHERE id = v_trade.offer_id),
      v_trade.crypto_amount,
      'trade',
      v_trade.id
    );

    -- Restore offer remaining amount
    UPDATE public.p2p_fiat_offers
    SET
      remaining_amount = remaining_amount + v_trade.crypto_amount,
      status = CASE
        WHEN status = 'locked' THEN 'open'
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = v_trade.offer_id;

    -- Update reputation (penalty for buyer)
    UPDATE public.p2p_reputation
    SET
      cancelled_trades = cancelled_trades + 1,
      reputation_score = GREATEST(reputation_score - 10, 0),
      updated_at = NOW()
    WHERE user_id = v_trade.buyer_id;
  END LOOP;

  -- =====================================================
  -- CRITICAL CHANGE: NO AUTO-RELEASE!
  -- Instead of auto-releasing, escalate to dispute
  -- =====================================================
  FOR v_trade IN
    SELECT * FROM public.p2p_fiat_trades
    WHERE status = 'payment_sent'
      AND confirmation_deadline < NOW()
      AND status != 'disputed'
  LOOP
    -- Escalate to dispute instead of auto-releasing
    UPDATE public.p2p_fiat_trades
    SET
      status = 'disputed',
      dispute_reason = 'AUTO_ESCALATED: Seller did not confirm payment within time limit',
      dispute_opened_at = NOW(),
      dispute_opened_by = v_trade.buyer_id,
      updated_at = NOW()
    WHERE id = v_trade.id;

    -- Log suspicious activity
    INSERT INTO public.p2p_suspicious_activity (
      user_id,
      trade_id,
      activity_type,
      severity,
      description,
      metadata
    ) VALUES (
      v_trade.seller_id,
      v_trade.id,
      'other',
      'medium',
      'Seller did not confirm payment within deadline - auto-escalated to dispute',
      jsonb_build_object(
        'buyer_id', v_trade.buyer_id,
        'crypto_amount', v_trade.crypto_amount,
        'payment_sent_at', v_trade.buyer_marked_paid_at,
        'confirmation_deadline', v_trade.confirmation_deadline
      )
    );

    -- Notify admins (in production, send push notification/email)
    -- For now, just log
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. ADD DISPUTE COLUMNS IF NOT EXISTS
-- =====================================================

DO $$
BEGIN
  -- Add dispute columns to trades table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'p2p_fiat_trades' AND column_name = 'dispute_reason') THEN
    ALTER TABLE p2p_fiat_trades ADD COLUMN dispute_reason TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'p2p_fiat_trades' AND column_name = 'dispute_opened_at') THEN
    ALTER TABLE p2p_fiat_trades ADD COLUMN dispute_opened_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'p2p_fiat_trades' AND column_name = 'dispute_opened_by') THEN
    ALTER TABLE p2p_fiat_trades ADD COLUMN dispute_opened_by UUID REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'p2p_fiat_trades' AND column_name = 'dispute_resolved_at') THEN
    ALTER TABLE p2p_fiat_trades ADD COLUMN dispute_resolved_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'p2p_fiat_trades' AND column_name = 'dispute_resolved_by') THEN
    ALTER TABLE p2p_fiat_trades ADD COLUMN dispute_resolved_by UUID REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'p2p_fiat_trades' AND column_name = 'dispute_resolution') THEN
    ALTER TABLE p2p_fiat_trades ADD COLUMN dispute_resolution TEXT;
  END IF;
END $$;

-- =====================================================
-- 6. ADMIN DISPUTE RESOLUTION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION resolve_p2p_dispute(
  p_trade_id UUID,
  p_resolution TEXT,  -- 'release_to_buyer' or 'refund_to_seller'
  p_resolution_notes TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_admin_id UUID;
  v_trade RECORD;
  v_offer RECORD;
BEGIN
  -- Get current user (must be admin)
  v_admin_id := auth.uid();

  -- Check admin role
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_admin_id
    AND role IN ('admin', 'super_admin', 'moderator')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Only admins can resolve disputes');
  END IF;

  -- Get trade
  SELECT * INTO v_trade
  FROM p2p_fiat_trades
  WHERE id = p_trade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Trade not found');
  END IF;

  IF v_trade.status != 'disputed' THEN
    RETURN json_build_object('success', false, 'error', 'Trade is not in disputed status');
  END IF;

  -- Get offer for token info
  SELECT * INTO v_offer
  FROM p2p_fiat_offers
  WHERE id = v_trade.offer_id;

  IF p_resolution = 'release_to_buyer' THEN
    -- Release crypto to buyer
    PERFORM release_escrow_internal(
      v_trade.seller_id,
      v_trade.buyer_id,
      v_offer.token,
      v_trade.crypto_amount,
      'dispute_resolution',
      p_trade_id
    );

    -- Update trade status
    UPDATE p2p_fiat_trades
    SET
      status = 'completed',
      completed_at = NOW(),
      dispute_resolved_at = NOW(),
      dispute_resolved_by = v_admin_id,
      dispute_resolution = 'Released to buyer: ' || COALESCE(p_resolution_notes, ''),
      updated_at = NOW()
    WHERE id = p_trade_id;

    -- Update reputations (seller gets penalty)
    UPDATE p2p_reputation
    SET
      disputed_trades = disputed_trades + 1,
      reputation_score = GREATEST(reputation_score - 20, 0),
      updated_at = NOW()
    WHERE user_id = v_trade.seller_id;

  ELSIF p_resolution = 'refund_to_seller' THEN
    -- Refund crypto to seller
    PERFORM refund_escrow_internal(
      v_trade.seller_id,
      v_offer.token,
      v_trade.crypto_amount,
      'dispute_resolution',
      p_trade_id
    );

    -- Restore offer if needed
    UPDATE p2p_fiat_offers
    SET
      remaining_amount = remaining_amount + v_trade.crypto_amount,
      status = CASE WHEN remaining_amount + v_trade.crypto_amount > 0 THEN 'open' ELSE status END,
      updated_at = NOW()
    WHERE id = v_trade.offer_id;

    -- Update trade status
    UPDATE p2p_fiat_trades
    SET
      status = 'refunded',
      dispute_resolved_at = NOW(),
      dispute_resolved_by = v_admin_id,
      dispute_resolution = 'Refunded to seller: ' || COALESCE(p_resolution_notes, ''),
      updated_at = NOW()
    WHERE id = p_trade_id;

    -- Update reputations (buyer gets penalty)
    UPDATE p2p_reputation
    SET
      disputed_trades = disputed_trades + 1,
      reputation_score = GREATEST(reputation_score - 20, 0),
      updated_at = NOW()
    WHERE user_id = v_trade.buyer_id;
  ELSE
    RETURN json_build_object('success', false, 'error', 'Invalid resolution type');
  END IF;

  -- Log the resolution
  INSERT INTO p2p_audit_log (
    user_id,
    action,
    entity_type,
    entity_id,
    details
  ) VALUES (
    v_admin_id,
    'dispute_resolved',
    'trade',
    p_trade_id,
    jsonb_build_object(
      'resolution', p_resolution,
      'notes', p_resolution_notes,
      'seller_id', v_trade.seller_id,
      'buyer_id', v_trade.buyer_id,
      'amount', v_trade.crypto_amount
    )
  );

  RETURN json_build_object(
    'success', true,
    'resolution', p_resolution,
    'trade_id', p_trade_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant to authenticated (function checks admin role internally)
GRANT EXECUTE ON FUNCTION resolve_p2p_dispute TO authenticated;

-- =====================================================
-- 7. ADD 'refunded' TO TRADE STATUS ENUM
-- =====================================================

DO $$
BEGIN
  -- Check if constraint exists and update it
  ALTER TABLE p2p_fiat_trades
  DROP CONSTRAINT IF EXISTS p2p_fiat_trades_status_check;

  ALTER TABLE p2p_fiat_trades
  ADD CONSTRAINT p2p_fiat_trades_status_check
  CHECK (status IN ('pending', 'payment_sent', 'completed', 'cancelled', 'disputed', 'refunded'));
EXCEPTION
  WHEN others THEN
    -- Constraint might not exist, ignore
    NULL;
END $$;

-- =====================================================
-- 8. CREATE P2P_AUDIT_LOG TABLE IF NOT EXISTS
-- =====================================================

CREATE TABLE IF NOT EXISTS p2p_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p2p_audit_log_user ON p2p_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_p2p_audit_log_action ON p2p_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_p2p_audit_log_entity ON p2p_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_p2p_audit_log_created ON p2p_audit_log(created_at DESC);

ALTER TABLE p2p_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit log
CREATE POLICY "p2p_audit_log_admin_only" ON p2p_audit_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION process_deposit IS
'OKX-LEVEL SECURITY: Process deposit - ONLY callable by service role (backend).
Users cannot credit their own balance. Backend must verify TX on-chain first.';

COMMENT ON FUNCTION submit_deposit_request IS
'User-facing function to submit deposit request. Creates pending request that
backend will verify and process using process_deposit().';

COMMENT ON FUNCTION cancel_expired_trades IS
'OKX-LEVEL SECURITY: NO AUTO-RELEASE. Expired confirmation trades are
escalated to dispute for admin review, not auto-released to buyer.';

COMMENT ON FUNCTION resolve_p2p_dispute IS
'Admin function to resolve P2P disputes. Can release to buyer or refund to seller.';
