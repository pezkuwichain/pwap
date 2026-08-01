-- Payment proof lifecycle: auto-delete after 1 day, retain if disputed

-- 1. Add proof_expires_at column
ALTER TABLE public.p2p_fiat_trades
  ADD COLUMN IF NOT EXISTS proof_expires_at TIMESTAMPTZ;

-- 2. Function to clean up expired payment proofs
-- Called by pg_cron or Edge Function daily
CREATE OR REPLACE FUNCTION cleanup_expired_payment_proofs()
RETURNS JSON AS $$
DECLARE
  v_count INT := 0;
  v_trade RECORD;
BEGIN
  FOR v_trade IN
    SELECT id, buyer_payment_proof_url
    FROM p2p_fiat_trades
    WHERE buyer_payment_proof_url IS NOT NULL
      AND proof_expires_at IS NOT NULL
      AND proof_expires_at < NOW()
      AND status NOT IN ('disputed')
  LOOP
    UPDATE p2p_fiat_trades
    SET buyer_payment_proof_url = NULL,
        proof_expires_at = NULL,
        updated_at = NOW()
    WHERE id = v_trade.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'cleaned', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function to retain proof when dispute is opened (set expires_at = NULL)
CREATE OR REPLACE FUNCTION retain_payment_proof(p_trade_id UUID)
RETURNS JSON AS $$
BEGIN
  UPDATE p2p_fiat_trades
  SET proof_expires_at = NULL,
      updated_at = NOW()
  WHERE id = p_trade_id
    AND buyer_payment_proof_url IS NOT NULL;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Moderator function to delete proof after dispute resolution
CREATE OR REPLACE FUNCTION moderator_clear_payment_proof(p_trade_id UUID)
RETURNS JSON AS $$
BEGIN
  UPDATE p2p_fiat_trades
  SET buyer_payment_proof_url = NULL,
      proof_expires_at = NULL,
      updated_at = NOW()
  WHERE id = p_trade_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
