-- =====================================================
-- Migration: Atomic admin dispute resolution (moves escrow)
-- Date: 2026-07-25
-- =====================================================
--
-- Fix for the CRITICAL fund-logic finding: the admin Dispute Resolution panel
-- only relabelled p2p_fiat_trades.status and NEVER moved escrow, so "buyer wins"
-- paid nothing, "refund seller" left funds locked, and "split" was unhandled.
--
-- This SECURITY DEFINER function performs the escrow movement AND all status
-- changes in a single transaction. It is service-role only; caller identity
-- (admin) is verified by the resolve-dispute edge function via a wallet
-- signature before this is invoked.
--
-- ESCROW ACCOUNTING (verified against createFiatOffer + accept_p2p_offer):
--   * createFiatOffer locks the FULL offer amount (available -> locked).
--   * accept_p2p_offer does NOT lock again; it only decrements
--     offer.remaining_amount. So: seller.locked == remaining_amount + SUM(active
--     trade amounts) for the offer.
--   Therefore, per trade of amount X:
--     - release_to_buyer : locked(seller) -= X, available(buyer) += X.  (offer untouched)
--     - refund_to_seller : locked(seller) -= X, available(seller) += X. (offer untouched)
--     - split            : release X/2 to buyer + refund X/2 to seller. (offer untouched)
--   remaining_amount is intentionally NOT restored (that would double-count the
--   funds — a latent bug in the older resolve_p2p_dispute()).

CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
  p_dispute_id UUID,
  p_trade_id UUID,
  p_decision TEXT,            -- 'release_to_buyer' | 'refund_to_seller' | 'split' | 'escalate'
  p_reasoning TEXT,
  p_admin_ref TEXT            -- admin wallet address (for audit only)
) RETURNS JSON AS $$
DECLARE
  v_trade RECORD;
  v_token TEXT;
  v_half DECIMAL(20, 12);
  v_res JSON;
  v_trade_status TEXT;
BEGIN
  -- SECURITY: backend service role only. Admin identity is verified upstream by
  -- the resolve-dispute edge function (wallet signature vs. admin wallet set).
  IF current_setting('role', true) <> 'service_role'
     AND current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
    RETURN json_build_object('success', false, 'error', 'UNAUTHORIZED: service role required');
  END IF;

  IF p_reasoning IS NULL OR length(trim(p_reasoning)) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Reasoning is required');
  END IF;

  IF p_decision NOT IN ('release_to_buyer', 'refund_to_seller', 'split', 'escalate') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid decision');
  END IF;

  -- Lock the trade row
  SELECT * INTO v_trade FROM public.p2p_fiat_trades WHERE id = p_trade_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Trade not found');
  END IF;

  -- ----- ESCALATE: no fund movement, just mark dispute escalated -----
  IF p_decision = 'escalate' THEN
    UPDATE public.p2p_fiat_disputes
    SET status = 'escalated', decision = 'escalate', decision_reasoning = p_reasoning, updated_at = NOW()
    WHERE id = p_dispute_id;

    INSERT INTO public.p2p_audit_log (user_id, action, entity_type, entity_id, details)
    VALUES (NULL, 'dispute_escalated', 'trade', p_trade_id,
      jsonb_build_object('dispute_id', p_dispute_id, 'admin_ref', p_admin_ref, 'reasoning', p_reasoning));

    RETURN json_build_object('success', true, 'decision', 'escalate');
  END IF;

  -- For fund-moving decisions the trade must be in dispute.
  IF v_trade.status <> 'disputed' THEN
    RETURN json_build_object('success', false, 'error', 'Trade is not in disputed status (current: ' || v_trade.status || ')');
  END IF;

  -- Resolve token from the offer
  SELECT token INTO v_token FROM public.p2p_fiat_offers WHERE id = v_trade.offer_id;
  IF v_token IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Offer/token not found for trade');
  END IF;

  IF p_decision = 'release_to_buyer' THEN
    v_res := public.release_escrow_internal(
      v_trade.seller_id, v_trade.buyer_id, v_token, v_trade.crypto_amount, 'dispute_resolution', p_trade_id);
    IF (v_res->>'success')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'release_escrow_internal failed: %', COALESCE(v_res->>'error', 'unknown');
    END IF;
    v_trade_status := 'completed';

  ELSIF p_decision = 'refund_to_seller' THEN
    v_res := public.refund_escrow_internal(
      v_trade.seller_id, v_token, v_trade.crypto_amount, 'dispute_resolution', p_trade_id);
    IF (v_res->>'success')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'refund_escrow_internal failed: %', COALESCE(v_res->>'error', 'unknown');
    END IF;
    v_trade_status := 'refunded';

  ELSIF p_decision = 'split' THEN
    v_half := ROUND(v_trade.crypto_amount / 2, 12);
    -- Half to buyer
    v_res := public.release_escrow_internal(
      v_trade.seller_id, v_trade.buyer_id, v_token, v_half, 'dispute_resolution_split', p_trade_id);
    IF (v_res->>'success')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'split release failed: %', COALESCE(v_res->>'error', 'unknown');
    END IF;
    -- Remainder back to seller (handles odd cents deterministically)
    v_res := public.refund_escrow_internal(
      v_trade.seller_id, v_token, v_trade.crypto_amount - v_half, 'dispute_resolution_split', p_trade_id);
    IF (v_res->>'success')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'split refund failed: %', COALESCE(v_res->>'error', 'unknown');
    END IF;
    v_trade_status := 'completed';
  END IF;

  -- Update trade
  UPDATE public.p2p_fiat_trades
  SET status = v_trade_status,
      completed_at = CASE WHEN v_trade_status = 'completed' THEN NOW() ELSE completed_at END,
      escrow_released_at = NOW(),
      dispute_resolved_at = NOW(),
      dispute_resolution = p_decision || ': ' || COALESCE(p_reasoning, ''),
      updated_at = NOW()
  WHERE id = p_trade_id;

  -- Update dispute
  UPDATE public.p2p_fiat_disputes
  SET status = 'resolved', decision = p_decision, decision_reasoning = p_reasoning,
      resolved_at = NOW(), updated_at = NOW()
  WHERE id = p_dispute_id;

  -- Notify both parties (best-effort, same txn)
  INSERT INTO public.p2p_notifications (user_id, type, title, message, reference_type, reference_id)
  VALUES
    (v_trade.seller_id, 'dispute_resolved', 'Dispute Resolved', 'Your dispute was resolved: ' || p_decision, 'dispute', p_dispute_id),
    (v_trade.buyer_id,  'dispute_resolved', 'Dispute Resolved', 'Your dispute was resolved: ' || p_decision, 'dispute', p_dispute_id);

  -- Audit
  INSERT INTO public.p2p_audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (NULL, 'dispute_resolved', 'trade', p_trade_id,
    jsonb_build_object(
      'dispute_id', p_dispute_id, 'decision', p_decision, 'admin_ref', p_admin_ref,
      'reasoning', p_reasoning, 'seller_id', v_trade.seller_id, 'buyer_id', v_trade.buyer_id,
      'amount', v_trade.crypto_amount, 'token', v_token));

  RETURN json_build_object('success', true, 'decision', p_decision, 'trade_id', p_trade_id, 'token', v_token, 'amount', v_trade.crypto_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.admin_resolve_dispute(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.admin_resolve_dispute IS
'Atomically resolves a P2P dispute: moves escrow (release/refund/split) AND
updates trade + dispute status + notifications in one transaction. SERVICE ROLE
ONLY — admin identity is verified by the resolve-dispute edge function.';
