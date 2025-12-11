-- =====================================================
-- P2P INTERNAL LEDGER ESCROW SYSTEM (OKX Model)
-- Migration: 014_p2p_internal_ledger_escrow.sql
-- Date: 2025-12-11
-- =====================================================
--
-- This migration implements OKX-style internal ledger escrow where:
-- - Blockchain transactions ONLY occur at deposit/withdraw
-- - P2P trades use internal database balance transfers
-- - No blockchain transactions during actual P2P trading
--

-- =====================================================
-- 1. USER INTERNAL BALANCES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS user_internal_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL CHECK (token IN ('HEZ', 'PEZ')),
  available_balance DECIMAL(20, 12) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  locked_balance DECIMAL(20, 12) NOT NULL DEFAULT 0 CHECK (locked_balance >= 0),
  total_deposited DECIMAL(20, 12) NOT NULL DEFAULT 0,
  total_withdrawn DECIMAL(20, 12) NOT NULL DEFAULT 0,
  last_deposit_at TIMESTAMPTZ,
  last_withdraw_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_internal_balances_user ON user_internal_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_internal_balances_token ON user_internal_balances(token);

-- RLS
ALTER TABLE user_internal_balances ENABLE ROW LEVEL SECURITY;

-- Users can view their own balances
CREATE POLICY "Users can view own balances"
  ON user_internal_balances FOR SELECT
  USING (user_id = auth.uid());

-- Only system can modify balances (via service role)
-- No INSERT/UPDATE/DELETE policies for regular users

-- Admins can view all balances
CREATE POLICY "Admins can view all balances"
  ON user_internal_balances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- =====================================================
-- 2. DEPOSIT/WITHDRAW REQUESTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS p2p_deposit_withdraw_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('deposit', 'withdraw')),
  token TEXT NOT NULL CHECK (token IN ('HEZ', 'PEZ')),
  amount DECIMAL(20, 12) NOT NULL CHECK (amount > 0),
  wallet_address TEXT NOT NULL,
  blockchain_tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),
  error_message TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deposit_withdraw_status ON p2p_deposit_withdraw_requests(status);
CREATE INDEX IF NOT EXISTS idx_deposit_withdraw_user ON p2p_deposit_withdraw_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_withdraw_type ON p2p_deposit_withdraw_requests(request_type);

-- RLS
ALTER TABLE p2p_deposit_withdraw_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own requests"
  ON p2p_deposit_withdraw_requests FOR SELECT
  USING (user_id = auth.uid());

-- Users can create their own requests
CREATE POLICY "Users can create own requests"
  ON p2p_deposit_withdraw_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can view and manage all requests
CREATE POLICY "Admins can manage all requests"
  ON p2p_deposit_withdraw_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- =====================================================
-- 3. BALANCE TRANSACTION LOG (Audit Trail)
-- =====================================================

CREATE TABLE IF NOT EXISTS p2p_balance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'deposit', 'withdraw', 'escrow_lock', 'escrow_release',
    'escrow_refund', 'trade_receive', 'admin_adjustment'
  )),
  amount DECIMAL(20, 12) NOT NULL,
  balance_before DECIMAL(20, 12) NOT NULL,
  balance_after DECIMAL(20, 12) NOT NULL,
  reference_type TEXT, -- 'offer', 'trade', 'deposit_request', 'withdraw_request'
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_balance_tx_user ON p2p_balance_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_tx_type ON p2p_balance_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_balance_tx_created ON p2p_balance_transactions(created_at DESC);

-- RLS
ALTER TABLE p2p_balance_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transaction history
CREATE POLICY "Users can view own transactions"
  ON p2p_balance_transactions FOR SELECT
  USING (user_id = auth.uid());

-- =====================================================
-- 4. LOCK ESCROW FUNCTION (Internal Balance)
-- =====================================================

CREATE OR REPLACE FUNCTION lock_escrow_internal(
  p_user_id UUID,
  p_token TEXT,
  p_amount DECIMAL(20, 12),
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_balance RECORD;
  v_balance_before DECIMAL(20, 12);
BEGIN
  -- Lock user's balance row for update
  SELECT * INTO v_balance
  FROM user_internal_balances
  WHERE user_id = p_user_id AND token = p_token
  FOR UPDATE;

  -- Check if balance exists
  IF v_balance IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No balance found for token ' || p_token || '. Please deposit first.'
    );
  END IF;

  v_balance_before := v_balance.available_balance;

  -- Check sufficient balance
  IF v_balance.available_balance < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient balance. Available: ' || v_balance.available_balance || ' ' || p_token
    );
  END IF;

  -- Move from available to locked
  UPDATE user_internal_balances
  SET
    available_balance = available_balance - p_amount,
    locked_balance = locked_balance + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id AND token = p_token;

  -- Log the transaction
  INSERT INTO p2p_balance_transactions (
    user_id, token, transaction_type, amount,
    balance_before, balance_after, reference_type, reference_id,
    description
  ) VALUES (
    p_user_id, p_token, 'escrow_lock', p_amount,
    v_balance_before, v_balance_before - p_amount, p_reference_type, p_reference_id,
    'Escrow locked for P2P offer'
  );

  RETURN json_build_object(
    'success', true,
    'locked_amount', p_amount,
    'available_balance', v_balance_before - p_amount,
    'locked_balance', v_balance.locked_balance + p_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. RELEASE ESCROW FUNCTION (Trade Completion)
-- =====================================================

CREATE OR REPLACE FUNCTION release_escrow_internal(
  p_from_user_id UUID,
  p_to_user_id UUID,
  p_token TEXT,
  p_amount DECIMAL(20, 12),
  p_reference_type TEXT DEFAULT 'trade',
  p_reference_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_from_balance RECORD;
  v_to_balance RECORD;
  v_from_balance_before DECIMAL(20, 12);
  v_to_balance_before DECIMAL(20, 12);
BEGIN
  -- Lock seller's balance row
  SELECT * INTO v_from_balance
  FROM user_internal_balances
  WHERE user_id = p_from_user_id AND token = p_token
  FOR UPDATE;

  -- Check seller has sufficient locked balance
  IF v_from_balance IS NULL OR v_from_balance.locked_balance < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient locked balance for release'
    );
  END IF;

  v_from_balance_before := v_from_balance.locked_balance;

  -- Reduce seller's locked balance
  UPDATE user_internal_balances
  SET
    locked_balance = locked_balance - p_amount,
    updated_at = NOW()
  WHERE user_id = p_from_user_id AND token = p_token;

  -- Log seller's transaction
  INSERT INTO p2p_balance_transactions (
    user_id, token, transaction_type, amount,
    balance_before, balance_after, reference_type, reference_id,
    description
  ) VALUES (
    p_from_user_id, p_token, 'escrow_release', -p_amount,
    v_from_balance_before, v_from_balance_before - p_amount, p_reference_type, p_reference_id,
    'Escrow released to buyer'
  );

  -- Get or initialize buyer's balance
  SELECT available_balance INTO v_to_balance_before
  FROM user_internal_balances
  WHERE user_id = p_to_user_id AND token = p_token;

  IF v_to_balance_before IS NULL THEN
    v_to_balance_before := 0;
  END IF;

  -- Increase buyer's available balance (upsert)
  INSERT INTO user_internal_balances (user_id, token, available_balance)
  VALUES (p_to_user_id, p_token, p_amount)
  ON CONFLICT (user_id, token)
  DO UPDATE SET
    available_balance = user_internal_balances.available_balance + p_amount,
    updated_at = NOW();

  -- Log buyer's transaction
  INSERT INTO p2p_balance_transactions (
    user_id, token, transaction_type, amount,
    balance_before, balance_after, reference_type, reference_id,
    description
  ) VALUES (
    p_to_user_id, p_token, 'trade_receive', p_amount,
    v_to_balance_before, v_to_balance_before + p_amount, p_reference_type, p_reference_id,
    'Received from P2P trade'
  );

  RETURN json_build_object(
    'success', true,
    'transferred_amount', p_amount,
    'from_user_id', p_from_user_id,
    'to_user_id', p_to_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. REFUND ESCROW FUNCTION (Trade Cancellation)
-- =====================================================

CREATE OR REPLACE FUNCTION refund_escrow_internal(
  p_user_id UUID,
  p_token TEXT,
  p_amount DECIMAL(20, 12),
  p_reference_type TEXT DEFAULT 'trade',
  p_reference_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_balance RECORD;
  v_locked_before DECIMAL(20, 12);
BEGIN
  -- Lock user's balance row
  SELECT * INTO v_balance
  FROM user_internal_balances
  WHERE user_id = p_user_id AND token = p_token
  FOR UPDATE;

  -- Check sufficient locked balance
  IF v_balance IS NULL OR v_balance.locked_balance < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient locked balance for refund'
    );
  END IF;

  v_locked_before := v_balance.locked_balance;

  -- Move from locked back to available
  UPDATE user_internal_balances
  SET
    locked_balance = locked_balance - p_amount,
    available_balance = available_balance + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id AND token = p_token;

  -- Log the transaction
  INSERT INTO p2p_balance_transactions (
    user_id, token, transaction_type, amount,
    balance_before, balance_after, reference_type, reference_id,
    description
  ) VALUES (
    p_user_id, p_token, 'escrow_refund', p_amount,
    v_locked_before, v_locked_before - p_amount, p_reference_type, p_reference_id,
    'Escrow refunded (trade cancelled)'
  );

  RETURN json_build_object(
    'success', true,
    'refunded_amount', p_amount,
    'available_balance', v_balance.available_balance + p_amount,
    'locked_balance', v_locked_before - p_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. PROCESS DEPOSIT FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION process_deposit(
  p_user_id UUID,
  p_token TEXT,
  p_amount DECIMAL(20, 12),
  p_tx_hash TEXT,
  p_request_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_balance_before DECIMAL(20, 12) := 0;
BEGIN
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
    'Deposit from blockchain TX: ' || p_tx_hash
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
    'new_balance', v_balance_before + p_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. REQUEST WITHDRAW FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION request_withdraw(
  p_user_id UUID,
  p_token TEXT,
  p_amount DECIMAL(20, 12),
  p_wallet_address TEXT
) RETURNS JSON AS $$
DECLARE
  v_balance RECORD;
  v_request_id UUID;
BEGIN
  -- Lock user's balance
  SELECT * INTO v_balance
  FROM user_internal_balances
  WHERE user_id = p_user_id AND token = p_token
  FOR UPDATE;

  -- Check sufficient available balance
  IF v_balance IS NULL OR v_balance.available_balance < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient available balance. Available: ' || COALESCE(v_balance.available_balance, 0)
    );
  END IF;

  -- Lock the amount (move to locked_balance)
  UPDATE user_internal_balances
  SET
    available_balance = available_balance - p_amount,
    locked_balance = locked_balance + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id AND token = p_token;

  -- Create withdrawal request
  INSERT INTO p2p_deposit_withdraw_requests (
    user_id, request_type, token, amount, wallet_address, status
  ) VALUES (
    p_user_id, 'withdraw', p_token, p_amount, p_wallet_address, 'pending'
  ) RETURNING id INTO v_request_id;

  -- Log the transaction
  INSERT INTO p2p_balance_transactions (
    user_id, token, transaction_type, amount,
    balance_before, balance_after, reference_type, reference_id,
    description
  ) VALUES (
    p_user_id, p_token, 'withdraw', -p_amount,
    v_balance.available_balance, v_balance.available_balance - p_amount, 'withdraw_request', v_request_id,
    'Withdrawal request to ' || p_wallet_address
  );

  RETURN json_build_object(
    'success', true,
    'request_id', v_request_id,
    'amount', p_amount,
    'wallet_address', p_wallet_address,
    'status', 'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. GET USER BALANCE FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_internal_balance(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_balances JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'token', token,
      'available_balance', available_balance,
      'locked_balance', locked_balance,
      'total_balance', available_balance + locked_balance,
      'total_deposited', total_deposited,
      'total_withdrawn', total_withdrawn
    )
  ) INTO v_balances
  FROM user_internal_balances
  WHERE user_id = p_user_id;

  RETURN COALESCE(v_balances, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 10. HELPER: UPDATE UPDATED_AT TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
DROP TRIGGER IF EXISTS update_user_internal_balances_updated_at ON user_internal_balances;
CREATE TRIGGER update_user_internal_balances_updated_at
  BEFORE UPDATE ON user_internal_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deposit_withdraw_requests_updated_at ON p2p_deposit_withdraw_requests;
CREATE TRIGGER update_deposit_withdraw_requests_updated_at
  BEFORE UPDATE ON p2p_deposit_withdraw_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE user_internal_balances IS 'User internal balances for P2P trading (OKX-style internal ledger)';
COMMENT ON TABLE p2p_deposit_withdraw_requests IS 'Requests for deposits/withdrawals that require blockchain transactions';
COMMENT ON TABLE p2p_balance_transactions IS 'Audit log of all balance changes';
COMMENT ON FUNCTION lock_escrow_internal IS 'Lock user balance for P2P escrow (internal ledger)';
COMMENT ON FUNCTION release_escrow_internal IS 'Release escrow to buyer on trade completion';
COMMENT ON FUNCTION refund_escrow_internal IS 'Refund escrow to seller on trade cancellation';
COMMENT ON FUNCTION process_deposit IS 'Credit user balance after deposit verification';
COMMENT ON FUNCTION request_withdraw IS 'Create withdrawal request and lock balance';
