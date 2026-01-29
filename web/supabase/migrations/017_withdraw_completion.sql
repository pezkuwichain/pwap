-- =====================================================
-- Migration 017: Withdraw Completion Function
-- Properly handles successful withdrawal balance updates
-- =====================================================

-- Function to complete a withdrawal (called after blockchain TX success)
CREATE OR REPLACE FUNCTION complete_withdraw(
  p_user_id UUID,
  p_token TEXT,
  p_amount DECIMAL(20, 12),
  p_tx_hash TEXT,
  p_request_id UUID
) RETURNS JSON AS $$
DECLARE
  v_balance RECORD;
  v_locked_before DECIMAL(20, 12);
BEGIN
  -- Get current balance
  SELECT * INTO v_balance
  FROM user_internal_balances
  WHERE user_id = p_user_id AND token = p_token
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Balance record not found');
  END IF;

  IF v_balance.locked_balance < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient locked balance for withdrawal completion'
    );
  END IF;

  v_locked_before := v_balance.locked_balance;

  -- Deduct from locked balance (already deducted from available when request was made)
  UPDATE user_internal_balances
  SET
    locked_balance = locked_balance - p_amount,
    total_withdrawn = total_withdrawn + p_amount,
    last_withdraw_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id AND token = p_token;

  -- Log the transaction
  INSERT INTO p2p_balance_transactions (
    user_id, token, transaction_type, amount,
    balance_before, balance_after, reference_type, reference_id,
    description
  ) VALUES (
    p_user_id, p_token, 'withdraw', -p_amount,
    v_locked_before, v_locked_before - p_amount, 'withdraw_request', p_request_id,
    'Withdrawal completed. TX: ' || p_tx_hash
  );

  RETURN json_build_object(
    'success', true,
    'withdrawn_amount', p_amount,
    'remaining_locked', v_locked_before - p_amount,
    'tx_hash', p_tx_hash
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role only (called from Edge Function)
REVOKE EXECUTE ON FUNCTION complete_withdraw FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION complete_withdraw FROM authenticated;
REVOKE EXECUTE ON FUNCTION complete_withdraw FROM anon;

-- Create index for faster withdrawal request lookups
CREATE INDEX IF NOT EXISTS idx_withdraw_requests_pending
ON p2p_deposit_withdraw_requests(user_id, status)
WHERE request_type = 'withdraw' AND status = 'pending';

-- Add fee tracking columns if not exists
ALTER TABLE p2p_deposit_withdraw_requests
ADD COLUMN IF NOT EXISTS fee_amount DECIMAL(20, 12) DEFAULT 0;

ALTER TABLE p2p_deposit_withdraw_requests
ADD COLUMN IF NOT EXISTS net_amount DECIMAL(20, 12);

-- Trigger to calculate net amount
CREATE OR REPLACE FUNCTION calculate_withdraw_net_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.request_type = 'withdraw' THEN
    -- Default fees: HEZ = 0.1, PEZ = 1
    IF NEW.fee_amount IS NULL OR NEW.fee_amount = 0 THEN
      NEW.fee_amount := CASE NEW.token
        WHEN 'HEZ' THEN 0.1
        WHEN 'PEZ' THEN 1
        ELSE 0
      END;
    END IF;
    NEW.net_amount := NEW.amount - NEW.fee_amount;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_withdraw_net ON p2p_deposit_withdraw_requests;
CREATE TRIGGER trigger_calculate_withdraw_net
  BEFORE INSERT ON p2p_deposit_withdraw_requests
  FOR EACH ROW EXECUTE FUNCTION calculate_withdraw_net_amount();

-- Add daily/monthly withdrawal limits table
CREATE TABLE IF NOT EXISTS p2p_withdrawal_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_withdrawn DECIMAL(20, 12) DEFAULT 0,
  monthly_withdrawn DECIMAL(20, 12) DEFAULT 0,
  daily_limit DECIMAL(20, 12) DEFAULT 1000, -- Default 1000 HEZ/day
  monthly_limit DECIMAL(20, 12) DEFAULT 10000, -- Default 10000 HEZ/month
  last_daily_reset TIMESTAMPTZ DEFAULT NOW(),
  last_monthly_reset TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to check withdrawal limits
CREATE OR REPLACE FUNCTION check_withdrawal_limit(
  p_user_id UUID,
  p_amount DECIMAL(20, 12)
) RETURNS JSON AS $$
DECLARE
  v_limits RECORD;
  v_daily_remaining DECIMAL;
  v_monthly_remaining DECIMAL;
BEGIN
  -- Get or create limits record
  INSERT INTO p2p_withdrawal_limits (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_limits
  FROM p2p_withdrawal_limits
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Reset daily counter if needed
  IF v_limits.last_daily_reset < CURRENT_DATE THEN
    UPDATE p2p_withdrawal_limits
    SET daily_withdrawn = 0, last_daily_reset = NOW()
    WHERE user_id = p_user_id;
    v_limits.daily_withdrawn := 0;
  END IF;

  -- Reset monthly counter if needed
  IF v_limits.last_monthly_reset < DATE_TRUNC('month', CURRENT_DATE) THEN
    UPDATE p2p_withdrawal_limits
    SET monthly_withdrawn = 0, last_monthly_reset = NOW()
    WHERE user_id = p_user_id;
    v_limits.monthly_withdrawn := 0;
  END IF;

  v_daily_remaining := v_limits.daily_limit - v_limits.daily_withdrawn;
  v_monthly_remaining := v_limits.monthly_limit - v_limits.monthly_withdrawn;

  IF p_amount > v_daily_remaining THEN
    RETURN json_build_object(
      'allowed', false,
      'error', format('Daily limit exceeded. Remaining: %s', v_daily_remaining),
      'daily_remaining', v_daily_remaining,
      'monthly_remaining', v_monthly_remaining
    );
  END IF;

  IF p_amount > v_monthly_remaining THEN
    RETURN json_build_object(
      'allowed', false,
      'error', format('Monthly limit exceeded. Remaining: %s', v_monthly_remaining),
      'daily_remaining', v_daily_remaining,
      'monthly_remaining', v_monthly_remaining
    );
  END IF;

  RETURN json_build_object(
    'allowed', true,
    'daily_remaining', v_daily_remaining,
    'monthly_remaining', v_monthly_remaining
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record withdrawal in limits
CREATE OR REPLACE FUNCTION record_withdrawal_limit(
  p_user_id UUID,
  p_amount DECIMAL(20, 12)
) RETURNS void AS $$
BEGIN
  UPDATE p2p_withdrawal_limits
  SET
    daily_withdrawn = daily_withdrawn + p_amount,
    monthly_withdrawn = monthly_withdrawn + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_withdrawal_limit TO authenticated;
GRANT EXECUTE ON FUNCTION record_withdrawal_limit TO authenticated;

-- RLS for withdrawal limits
ALTER TABLE p2p_withdrawal_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own withdrawal limits"
ON p2p_withdrawal_limits FOR SELECT
USING (user_id = auth.uid());

COMMENT ON FUNCTION complete_withdraw IS 'Completes a withdrawal after blockchain TX success. Service role only.';
COMMENT ON FUNCTION check_withdrawal_limit IS 'Check if user can withdraw the specified amount based on daily/monthly limits.';
