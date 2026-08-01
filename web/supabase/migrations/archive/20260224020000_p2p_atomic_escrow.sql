-- =====================================================
-- P2P ATOMIC ESCROW & PLATFORM WALLET SYSTEM
-- Migration: 013_p2p_atomic_escrow.sql
-- =====================================================

-- 1. Platform escrow wallet tracking table
CREATE TABLE IF NOT EXISTS p2p_platform_escrow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES p2p_fiat_offers(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  seller_wallet TEXT NOT NULL,
  token TEXT NOT NULL,
  amount DECIMAL(20, 12) NOT NULL,
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  released_to TEXT, -- wallet address
  release_reason TEXT, -- 'trade_complete', 'trade_cancelled', 'trade_expired', 'refund'
  blockchain_tx_lock TEXT, -- tx hash for lock transfer
  blockchain_tx_release TEXT, -- tx hash for release transfer
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'released', 'pending_release')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_platform_escrow_offer ON p2p_platform_escrow(offer_id);
CREATE INDEX IF NOT EXISTS idx_platform_escrow_seller ON p2p_platform_escrow(seller_id);
CREATE INDEX IF NOT EXISTS idx_platform_escrow_status ON p2p_platform_escrow(status);

-- 2. Atomic function to accept offer (prevents race condition)
CREATE OR REPLACE FUNCTION accept_p2p_offer(
  p_offer_id UUID,
  p_buyer_id UUID,
  p_buyer_wallet TEXT,
  p_amount DECIMAL(20, 12)
) RETURNS JSON AS $$
DECLARE
  v_offer RECORD;
  v_trade_id UUID;
  v_payment_deadline TIMESTAMPTZ;
  v_fiat_amount DECIMAL(20, 2);
BEGIN
  -- Lock the offer row for update (prevents concurrent modifications)
  SELECT * INTO v_offer
  FROM p2p_fiat_offers
  WHERE id = p_offer_id
  FOR UPDATE;

  -- Validation checks
  IF v_offer IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Offer not found');
  END IF;

  IF v_offer.status != 'open' THEN
    RETURN json_build_object('success', false, 'error', 'Offer is not available');
  END IF;

  IF v_offer.seller_id = p_buyer_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot buy from your own offer');
  END IF;

  IF p_amount > v_offer.remaining_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient remaining amount. Available: ' || v_offer.remaining_amount);
  END IF;

  IF v_offer.min_order_amount IS NOT NULL AND p_amount < v_offer.min_order_amount THEN
    RETURN json_build_object('success', false, 'error', 'Minimum order: ' || v_offer.min_order_amount || ' ' || v_offer.token);
  END IF;

  IF v_offer.max_order_amount IS NOT NULL AND p_amount > v_offer.max_order_amount THEN
    RETURN json_build_object('success', false, 'error', 'Maximum order: ' || v_offer.max_order_amount || ' ' || v_offer.token);
  END IF;

  -- Calculate fiat amount
  v_fiat_amount := (p_amount / v_offer.amount_crypto) * v_offer.fiat_amount;
  v_payment_deadline := NOW() + (v_offer.time_limit_minutes || ' minutes')::INTERVAL;

  -- Create trade
  INSERT INTO p2p_fiat_trades (
    offer_id,
    seller_id,
    buyer_id,
    buyer_wallet,
    crypto_amount,
    fiat_amount,
    price_per_unit,
    escrow_locked_amount,
    escrow_locked_at,
    status,
    payment_deadline
  ) VALUES (
    p_offer_id,
    v_offer.seller_id,
    p_buyer_id,
    p_buyer_wallet,
    p_amount,
    v_fiat_amount,
    v_offer.price_per_unit,
    p_amount,
    NOW(),
    'pending',
    v_payment_deadline
  ) RETURNING id INTO v_trade_id;

  -- Atomically update remaining amount
  UPDATE p2p_fiat_offers
  SET
    remaining_amount = remaining_amount - p_amount,
    status = CASE
      WHEN remaining_amount - p_amount = 0 THEN 'locked'
      ELSE 'open'
    END,
    updated_at = NOW()
  WHERE id = p_offer_id;

  RETURN json_build_object(
    'success', true,
    'trade_id', v_trade_id,
    'crypto_amount', p_amount,
    'fiat_amount', v_fiat_amount,
    'payment_deadline', v_payment_deadline
  );
END;
$$ LANGUAGE plpgsql;

-- 3. Function to release escrow on trade completion
CREATE OR REPLACE FUNCTION complete_p2p_trade(
  p_trade_id UUID,
  p_seller_id UUID
) RETURNS JSON AS $$
DECLARE
  v_trade RECORD;
BEGIN
  -- Lock trade row
  SELECT * INTO v_trade
  FROM p2p_fiat_trades
  WHERE id = p_trade_id
  FOR UPDATE;

  IF v_trade IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Trade not found');
  END IF;

  IF v_trade.seller_id != p_seller_id THEN
    RETURN json_build_object('success', false, 'error', 'Only seller can confirm receipt');
  END IF;

  IF v_trade.status != 'payment_sent' THEN
    RETURN json_build_object('success', false, 'error', 'Payment not marked as sent yet');
  END IF;

  -- Update trade status
  UPDATE p2p_fiat_trades
  SET
    status = 'completed',
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_trade_id;

  -- Update escrow status (will be released by backend)
  UPDATE p2p_platform_escrow
  SET
    status = 'pending_release',
    released_to = v_trade.buyer_wallet,
    release_reason = 'trade_complete',
    updated_at = NOW()
  WHERE offer_id = v_trade.offer_id
    AND status = 'locked';

  RETURN json_build_object(
    'success', true,
    'buyer_wallet', v_trade.buyer_wallet,
    'amount', v_trade.crypto_amount,
    'token', (SELECT token FROM p2p_fiat_offers WHERE id = v_trade.offer_id)
  );
END;
$$ LANGUAGE plpgsql;

-- 4. Function to cancel/expire trade (return to seller)
CREATE OR REPLACE FUNCTION cancel_p2p_trade(
  p_trade_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT 'cancelled'
) RETURNS JSON AS $$
DECLARE
  v_trade RECORD;
  v_offer RECORD;
BEGIN
  -- Lock trade row
  SELECT * INTO v_trade
  FROM p2p_fiat_trades
  WHERE id = p_trade_id
  FOR UPDATE;

  IF v_trade IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Trade not found');
  END IF;

  -- Only buyer can cancel before payment, or system for expiry
  IF v_trade.status = 'pending' AND v_trade.buyer_id != p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Only buyer can cancel pending trade');
  END IF;

  IF v_trade.status NOT IN ('pending', 'payment_sent') THEN
    RETURN json_build_object('success', false, 'error', 'Trade cannot be cancelled in current status');
  END IF;

  -- Get offer details
  SELECT * INTO v_offer FROM p2p_fiat_offers WHERE id = v_trade.offer_id;

  -- Update trade status
  UPDATE p2p_fiat_trades
  SET
    status = 'cancelled',
    cancelled_at = NOW(),
    cancelled_by = p_user_id,
    updated_at = NOW()
  WHERE id = p_trade_id;

  -- Return amount to offer
  UPDATE p2p_fiat_offers
  SET
    remaining_amount = remaining_amount + v_trade.crypto_amount,
    status = 'open',
    updated_at = NOW()
  WHERE id = v_trade.offer_id;

  RETURN json_build_object(
    'success', true,
    'refunded_amount', v_trade.crypto_amount,
    'reason', p_reason
  );
END;
$$ LANGUAGE plpgsql;

-- 5. RLS policies for platform escrow
ALTER TABLE p2p_platform_escrow ENABLE ROW LEVEL SECURITY;

-- Sellers can view their own escrow
CREATE POLICY "Sellers can view their escrow"
  ON p2p_platform_escrow FOR SELECT
  USING (seller_id = auth.uid());

-- Admins can view all escrow
CREATE POLICY "Admins can view all escrow"
  ON p2p_platform_escrow FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Only system can insert/update (via service role)
-- No INSERT/UPDATE policies for regular users

-- 6. Add platform_wallet_address to config
CREATE TABLE IF NOT EXISTS p2p_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert platform wallet config (will be updated with real address)
INSERT INTO p2p_config (key, value, description)
VALUES (
  'platform_escrow_wallet',
  '5DFwqK698vL4gXHEcanaewnAqhxJ2rjhAogpSTHw3iwGDwd3',
  'Platform wallet address for P2P escrow'
)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE p2p_platform_escrow IS 'Tracks all escrow deposits for P2P trades';
COMMENT ON TABLE p2p_config IS 'P2P system configuration';
