-- =====================================================
-- Migration: Withdrawal authorization hardening
-- Date: 2026-07-25
-- =====================================================
--
-- Part of the fix for the CRITICAL broken-object-level-auth finding on the
-- withdrawal path. Two defenses:
--
--   1. Replay protection for the signed withdrawal challenge (nonce store).
--   2. Defense-in-depth: request_withdraw() may ONLY be executed by the backend
--      service role. Previously it was executable by anon/authenticated, so an
--      attacker with the public anon key could call it directly with a victim's
--      user_id to create a pending withdrawal to an attacker-controlled wallet,
--      which the batch processor would then pay out.
--

-- =====================================================
-- 1. CHALLENGE NONCE STORE (single-use signed challenges)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.p2p_challenge_nonces (
  nonce      TEXT PRIMARY KEY,
  purpose    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p2p_challenge_nonces_created
  ON public.p2p_challenge_nonces(created_at);

ALTER TABLE public.p2p_challenge_nonces ENABLE ROW LEVEL SECURITY;

-- Only the service role (edge functions) may read/write nonces.
DROP POLICY IF EXISTS "challenge_nonces_service_only" ON public.p2p_challenge_nonces;
CREATE POLICY "challenge_nonces_service_only" ON public.p2p_challenge_nonces
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON public.p2p_challenge_nonces FROM anon, authenticated, PUBLIC;

-- =====================================================
-- 2. LOCK request_withdraw() TO SERVICE ROLE
-- =====================================================
-- Recreate with an explicit service-role guard (mirrors process_deposit()).
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
  -- SECURITY: backend service role only. Object-level authorization (proving the
  -- caller owns p_user_id) is enforced by the process-withdraw edge function via
  -- a verified wallet signature before this is ever invoked.
  IF current_setting('role', true) <> 'service_role'
     AND current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'UNAUTHORIZED: withdrawals must go through the backend service'
    );
  END IF;

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

REVOKE EXECUTE ON FUNCTION request_withdraw(UUID, TEXT, DECIMAL, TEXT) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION request_withdraw IS
'Create withdrawal request and lock balance. SERVICE ROLE ONLY — called by the
process-withdraw edge function after it verifies the caller owns the identity via
a wallet signature. Never call directly from the client.';
