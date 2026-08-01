--
-- Baseline: the production schema as it actually is, 2026-08-01.
--
-- The migrations before this one do not describe this database. They were
-- applied by hand through the Supabase SQL editor over months, some only
-- partway, and recorded as applied regardless. The evidence:
--
--   * 25 functions declared across those migrations do not exist in the
--     database, from six migrations all marked applied
--   * admin_roles has three different definitions — 001 says
--     (id, user_id, role, granted_by, granted_at), COMBINED says
--     (user_id, role, created_at), production has
--     (id, user_id, role, permissions, created_at, updated_at)
--   * applying the set to an empty database fails on five migrations, partly
--     because the legacy 0NN filenames sort before the 14-digit timestamps they
--     depend on: "013" < "20241117054600"
--
-- So the set could not be replayed, could not be tested, and did not match what
-- was running. This file replaces it as the starting point: a pg_dump of the
-- live public schema, which by construction matches production exactly.
--
-- The old migrations are kept in migrations/archive/ rather than deleted — they
-- are the only record of why some of this looks the way it does, even where they
-- no longer describe it.
--
-- Generated with:
--   pg_dump --schema-only --schema=public --no-owner --no-comments
--
-- Privileges are included deliberately: the REVOKEs on lock_escrow_internal,
-- release_escrow_internal, refund_escrow_internal and request_withdraw are the
-- hardening from 20260725030000, and dropping them would quietly hand fund
-- movement back to anon.
--
-- auth.* references are satisfied by Supabase in production and by
-- deploy/test-bootstrap.sql in CI.
--

--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 15.8

--
-- ALTER DEFAULT PRIVILEGES statements (24 of them) were removed from this dump.
--
-- They set default grants for objects created *later* by roles postgres and
-- supabase_admin. That is Supabase's platform setup, not this schema: production
-- already has them from the platform install, and they cannot be applied in CI
-- because supabase_admin is a superuser and postgres is not, so no membership
-- can be granted.
--
-- Keeping them would mean a baseline that cannot be applied anywhere except the
-- database it came from, which defeats the purpose.
--
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: accept_p2p_offer(uuid, uuid, text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_p2p_offer(p_offer_id uuid, p_buyer_id uuid, p_buyer_wallet text, p_amount numeric) RETURNS json
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: admin_resolve_dispute(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_resolve_dispute(p_dispute_id uuid, p_trade_id uuid, p_decision text, p_reasoning text, p_admin_ref text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: apply_for_tier_upgrade(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_for_tier_upgrade(p_user_id uuid, p_target_tier character varying) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_eligibility RECORD;
  v_current_tier RECORD;
BEGIN
  -- Check current tier
  SELECT * INTO v_current_tier
  FROM public.p2p_merchant_tiers
  WHERE user_id = p_user_id;

  -- Check if already at or above target tier
  IF v_current_tier IS NOT NULL THEN
    IF v_current_tier.tier = p_target_tier THEN
      success := FALSE;
      message := 'You are already at this tier';
      RETURN NEXT;
      RETURN;
    END IF;

    IF v_current_tier.application_status = 'pending' THEN
      success := FALSE;
      message := 'You already have a pending application';
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- Check eligibility
  SELECT * INTO v_eligibility
  FROM public.check_tier_eligibility(p_user_id, p_target_tier);

  IF NOT v_eligibility.eligible THEN
    success := FALSE;
    message := 'Not eligible: ' || array_to_string(v_eligibility.missing_requirements, ', ');
    RETURN NEXT;
    RETURN;
  END IF;

  -- Create or update application
  INSERT INTO public.p2p_merchant_tiers (
    user_id, application_status, applied_at, applied_for_tier
  ) VALUES (
    p_user_id, 'pending', NOW(), p_target_tier
  )
  ON CONFLICT (user_id) DO UPDATE SET
    application_status = 'pending',
    applied_at = NOW(),
    applied_for_tier = p_target_tier,
    updated_at = NOW();

  success := TRUE;
  message := 'Application submitted successfully';

  RETURN NEXT;
END;
$$;


--
-- Name: calculate_withdraw_net_amount(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_withdraw_net_amount() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: cancel_expired_trades(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_expired_trades() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_trade RECORD;
BEGIN
  -- Cancel trades where buyer didn't pay in time
  FOR v_trade IN
    SELECT * FROM public.p2p_fiat_trades
    WHERE status = 'pending'
      AND payment_deadline < NOW()
  LOOP
    UPDATE public.p2p_fiat_trades
    SET
      status = 'cancelled',
      cancelled_by = seller_id,
      cancellation_reason = 'Payment deadline expired',
      updated_at = NOW()
    WHERE id = v_trade.id;

    PERFORM refund_escrow_internal(
      v_trade.seller_id,
      (SELECT token FROM public.p2p_fiat_offers WHERE id = v_trade.offer_id),
      v_trade.crypto_amount,
      'trade',
      v_trade.id
    );

    UPDATE public.p2p_fiat_offers
    SET
      remaining_amount = remaining_amount + v_trade.crypto_amount,
      status = CASE WHEN status = 'locked' THEN 'open' ELSE status END,
      updated_at = NOW()
    WHERE id = v_trade.offer_id;

    UPDATE public.p2p_reputation
    SET
      cancelled_trades = cancelled_trades + 1,
      reputation_score = GREATEST(reputation_score - 10, 0),
      updated_at = NOW()
    WHERE user_id = v_trade.buyer_id;
  END LOOP;

  -- OKX SECURITY: NO AUTO-RELEASE - Escalate to dispute instead
  FOR v_trade IN
    SELECT * FROM public.p2p_fiat_trades
    WHERE status = 'payment_sent'
      AND confirmation_deadline < NOW()
      AND status != 'disputed'
  LOOP
    UPDATE public.p2p_fiat_trades
    SET
      status = 'disputed',
      dispute_reason = 'AUTO_ESCALATED: Seller did not confirm payment within time limit',
      dispute_opened_at = NOW(),
      dispute_opened_by = v_trade.buyer_id,
      updated_at = NOW()
    WHERE id = v_trade.id;

    INSERT INTO public.p2p_suspicious_activity (
      user_id, trade_id, activity_type, severity, description, metadata
    ) VALUES (
      v_trade.seller_id, v_trade.id, 'other', 'medium',
      'Seller did not confirm payment within deadline - auto-escalated to dispute',
      jsonb_build_object(
        'buyer_id', v_trade.buyer_id,
        'crypto_amount', v_trade.crypto_amount,
        'payment_sent_at', v_trade.buyer_marked_paid_at,
        'confirmation_deadline', v_trade.confirmation_deadline
      )
    );
  END LOOP;
END;
$$;


--
-- Name: cancel_p2p_trade(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_p2p_trade(p_trade_id uuid, p_user_id uuid, p_reason text DEFAULT 'cancelled'::text) RETURNS json
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: check_tier_eligibility(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_tier_eligibility(p_user_id uuid, p_target_tier character varying) RETURNS TABLE(eligible boolean, missing_requirements text[])
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  v_reputation RECORD;
  v_stats RECORD;
  v_requirements RECORD;
  v_missing TEXT[] := '{}';
BEGIN
  -- Get requirements
  SELECT * INTO v_requirements
  FROM public.p2p_tier_requirements
  WHERE tier = p_target_tier;

  IF NOT FOUND THEN
    eligible := FALSE;
    missing_requirements := ARRAY['Invalid tier'];
    RETURN NEXT;
    RETURN;
  END IF;

  -- Get user reputation
  SELECT * INTO v_reputation
  FROM public.p2p_reputation
  WHERE user_id = p_user_id;

  -- Get user stats
  SELECT * INTO v_stats
  FROM public.p2p_merchant_stats
  WHERE user_id = p_user_id;

  -- Check completed trades
  IF COALESCE(v_reputation.completed_trades, 0) < v_requirements.min_trades THEN
    v_missing := array_append(v_missing,
      format('Need %s completed trades (have %s)',
        v_requirements.min_trades,
        COALESCE(v_reputation.completed_trades, 0)));
  END IF;

  -- Check completion rate
  IF COALESCE(v_stats.completion_rate_30d, 0) < v_requirements.min_completion_rate THEN
    v_missing := array_append(v_missing,
      format('Need %s%% completion rate (have %s%%)',
        v_requirements.min_completion_rate,
        COALESCE(v_stats.completion_rate_30d, 0)));
  END IF;

  -- Check 30-day volume
  IF COALESCE(v_stats.total_volume_30d, 0) < v_requirements.min_volume_30d THEN
    v_missing := array_append(v_missing,
      format('Need $%s 30-day volume (have $%s)',
        v_requirements.min_volume_30d,
        COALESCE(v_stats.total_volume_30d, 0)));
  END IF;

  -- Check deposit requirement
  IF v_requirements.deposit_required > 0 THEN
    v_missing := array_append(v_missing,
      format('Deposit of %s %s required',
        v_requirements.deposit_required,
        v_requirements.deposit_token));
  END IF;

  eligible := array_length(v_missing, 1) IS NULL OR array_length(v_missing, 1) = 0;
  missing_requirements := v_missing;

  RETURN NEXT;
END;
$_$;


--
-- Name: check_withdrawal_limit(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_withdrawal_limit(p_user_id uuid, p_amount numeric) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: cleanup_expired_payment_proofs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_payment_proofs() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: complete_p2p_trade(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_p2p_trade(p_trade_id uuid, p_seller_id uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
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
$$;


--
-- Name: complete_withdraw(uuid, text, numeric, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_withdraw(p_user_id uuid, p_token text, p_amount numeric, p_tx_hash text, p_request_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: create_p2p_notification(uuid, text, text, text, text, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_p2p_notification(p_user_id uuid, p_type text, p_title text, p_message text DEFAULT NULL::text, p_reference_type text DEFAULT NULL::text, p_reference_id uuid DEFAULT NULL::uuid, p_action_url text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.p2p_notifications (
    user_id, type, title, message,
    reference_type, reference_id, action_url, metadata
  ) VALUES (
    p_user_id, p_type, p_title, p_message,
    p_reference_type, p_reference_id, p_action_url, p_metadata
  )
  RETURNING id INTO v_notification_id;
  RETURN v_notification_id;
END;
$$;


--
-- Name: create_user_deposit_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_user_deposit_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    INSERT INTO tg_user_deposit_codes (user_id, code)
    VALUES (NEW.id, generate_deposit_code())
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
  END;
  $$;


--
-- Name: enforce_offer_financial_immutability(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_offer_financial_immutability() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.seller_id      IS DISTINCT FROM OLD.seller_id
     OR NEW.token       IS DISTINCT FROM OLD.token
     OR NEW.amount_crypto IS DISTINCT FROM OLD.amount_crypto THEN
    RAISE EXCEPTION 'Offer fund-routing columns are immutable (seller_id, token, amount_crypto)';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: enforce_trade_financial_immutability(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_trade_financial_immutability() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Allow the backend service role to change anything (reconciliation).
  IF current_setting('role', true) = 'service_role'
     OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.offer_id            IS DISTINCT FROM OLD.offer_id
     OR NEW.seller_id        IS DISTINCT FROM OLD.seller_id
     OR NEW.buyer_id         IS DISTINCT FROM OLD.buyer_id
     OR NEW.crypto_amount    IS DISTINCT FROM OLD.crypto_amount
     OR NEW.fiat_amount      IS DISTINCT FROM OLD.fiat_amount
     OR NEW.price_per_unit   IS DISTINCT FROM OLD.price_per_unit
     OR NEW.escrow_locked_amount IS DISTINCT FROM OLD.escrow_locked_amount THEN
    RAISE EXCEPTION 'Trade fund-routing columns are immutable (offer_id, seller_id, buyer_id, crypto_amount, fiat_amount, price_per_unit, escrow_locked_amount)';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: generate_deposit_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_deposit_code() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
  DECLARE
    chars VARCHAR(36) := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result VARCHAR(12) := 'PEZ-';
    i INTEGER;
  BEGIN
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
  END;
  $$;


--
-- Name: generate_visa_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_visa_number() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  num TEXT;
BEGIN
  LOOP
    num := 'V-' || lpad(floor(random() * 1000000)::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.p2p_visa WHERE visa_number = num);
  END LOOP;
  RETURN num;
END;
$$;


--
-- Name: get_admin_user_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_user_ids() RETURNS TABLE(user_id uuid)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
 BEGIN
   RETURN QUERY
   SELECT ar.user_id
   FROM public.admin_roles AS ar
   WHERE ar.role IN ('admin', 'super_admin');
 END;
 $$;


--
-- Name: get_my_telegram_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_telegram_id() RETURNS bigint
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT (raw_user_meta_data->>'telegram_id')::BIGINT
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$;


--
-- Name: get_my_tg_user_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_tg_user_id() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT id FROM tg_users
    WHERE telegram_id = get_my_telegram_id()
  );
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: p2p_balance_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_balance_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    transaction_type text NOT NULL,
    amount numeric(20,12) NOT NULL,
    balance_before numeric(20,12) NOT NULL,
    balance_after numeric(20,12) NOT NULL,
    reference_type text,
    reference_id uuid,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT p2p_balance_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['deposit'::text, 'withdraw'::text, 'withdraw_lock'::text, 'withdraw_complete'::text, 'escrow_lock'::text, 'escrow_release'::text, 'escrow_refund'::text, 'trade_receive'::text, 'dispute_refund'::text, 'admin_adjustment'::text])))
);


--
-- Name: get_user_balance_transactions(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_balance_transactions(p_user_id uuid, p_limit integer DEFAULT 50) RETURNS SETOF public.p2p_balance_transactions
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT *
  FROM public.p2p_balance_transactions
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
$$;


--
-- Name: p2p_deposit_withdraw_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_deposit_withdraw_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    request_type text NOT NULL,
    token text NOT NULL,
    amount numeric(20,12) NOT NULL,
    wallet_address text NOT NULL,
    blockchain_tx_hash text,
    status text DEFAULT 'pending'::text NOT NULL,
    processed_at timestamp with time zone,
    processed_by uuid,
    error_message text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    fee_amount numeric(20,12) DEFAULT 0,
    net_amount numeric(20,12),
    CONSTRAINT p2p_deposit_withdraw_requests_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT p2p_deposit_withdraw_requests_request_type_check CHECK ((request_type = ANY (ARRAY['deposit'::text, 'withdraw'::text]))),
    CONSTRAINT p2p_deposit_withdraw_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text]))),
    CONSTRAINT p2p_deposit_withdraw_requests_token_check CHECK ((token = ANY (ARRAY['HEZ'::text, 'PEZ'::text])))
);


--
-- Name: get_user_deposit_withdraw_requests(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_deposit_withdraw_requests(p_user_id uuid, p_limit integer DEFAULT 50) RETURNS SETOF public.p2p_deposit_withdraw_requests
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT *
  FROM public.p2p_deposit_withdraw_requests
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
$$;


--
-- Name: get_user_internal_balance(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_internal_balance(p_user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
  FROM public.user_internal_balances
  WHERE user_id = p_user_id;

  RETURN COALESCE(v_balances, '[]'::json);
END;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tg_users
    WHERE telegram_id = get_my_telegram_id()
    AND is_admin = true
  );
END;
$$;


--
-- Name: issue_p2p_visa(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.issue_p2p_visa(p_wallet_address text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_visa_number TEXT;
  v_result JSONB;
BEGIN
  -- Check if wallet already has a visa
  IF EXISTS (SELECT 1 FROM public.p2p_visa WHERE wallet_address = p_wallet_address AND status = 'active') THEN
    SELECT jsonb_build_object(
      'success', true,
      'visa_number', visa_number,
      'already_exists', true
    ) INTO v_result
    FROM public.p2p_visa
    WHERE wallet_address = p_wallet_address AND status = 'active';
    RETURN v_result;
  END IF;

  -- Generate unique visa number
  v_visa_number := generate_visa_number();

  -- Insert new visa
  INSERT INTO public.p2p_visa (visa_number, wallet_address)
  VALUES (v_visa_number, p_wallet_address);

  RETURN jsonb_build_object(
    'success', true,
    'visa_number', v_visa_number,
    'already_exists', false
  );
END;
$$;


--
-- Name: lock_escrow_internal(uuid, text, numeric, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_escrow_internal(p_user_id uuid, p_token text, p_amount numeric, p_reference_type text DEFAULT NULL::text, p_reference_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_balance RECORD;
  v_balance_before DECIMAL(20, 12);
BEGIN
  SELECT * INTO v_balance
  FROM public.user_internal_balances
  WHERE user_id = p_user_id AND token = p_token
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No balance found for token ' || p_token || '. Please deposit first.'
    );
  END IF;

  v_balance_before := v_balance.available_balance;

  IF v_balance.available_balance < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient balance. Available: ' || v_balance.available_balance || ' ' || p_token
    );
  END IF;

  UPDATE public.user_internal_balances
  SET
    available_balance = available_balance - p_amount,
    locked_balance = locked_balance + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id AND token = p_token;

  INSERT INTO public.p2p_balance_transactions (
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
$$;


--
-- Name: moderator_clear_payment_proof(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.moderator_clear_payment_proof(p_trade_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE p2p_fiat_trades
  SET buyer_payment_proof_url = NULL,
      proof_expires_at = NULL,
      updated_at = NOW()
  WHERE id = p_trade_id;

  RETURN json_build_object('success', true);
END;
$$;


--
-- Name: process_deposit(uuid, text, numeric, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_deposit(p_user_id uuid, p_token text, p_amount numeric, p_tx_hash text, p_request_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_balance_before DECIMAL(20, 12) := 0;
  v_existing_tx RECORD;
BEGIN
  -- SECURITY CHECK: Only service role can call this function
  IF current_setting('role', true) != 'service_role' AND
     current_setting('request.jwt.claim.role', true) != 'service_role' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'UNAUTHORIZED: Only backend service can process deposits'
    );
  END IF;

  -- DUPLICATE CHECK
  SELECT * INTO v_existing_tx
  FROM public.p2p_deposit_withdraw_requests
  WHERE blockchain_tx_hash = p_tx_hash
    AND status = 'completed';

  IF FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'DUPLICATE: This transaction has already been processed',
      'existing_request_id', v_existing_tx.id
    );
  END IF;

  SELECT available_balance INTO v_balance_before
  FROM public.user_internal_balances
  WHERE user_id = p_user_id AND token = p_token;

  IF v_balance_before IS NULL THEN
    v_balance_before := 0;
  END IF;

  INSERT INTO public.user_internal_balances (
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

  INSERT INTO public.p2p_balance_transactions (
    user_id, token, transaction_type, amount,
    balance_before, balance_after, reference_type, reference_id,
    description
  ) VALUES (
    p_user_id, p_token, 'deposit', p_amount,
    v_balance_before, v_balance_before + p_amount, 'deposit_request', p_request_id,
    'Verified deposit from blockchain TX: ' || p_tx_hash
  );

  IF p_request_id IS NOT NULL THEN
    UPDATE public.p2p_deposit_withdraw_requests
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
$$;


--
-- Name: record_withdrawal_limit(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_withdrawal_limit(p_user_id uuid, p_amount numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE p2p_withdrawal_limits
  SET
    daily_withdrawn = daily_withdrawn + p_amount,
    monthly_withdrawn = monthly_withdrawn + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;


--
-- Name: refund_escrow_internal(uuid, text, numeric, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refund_escrow_internal(p_user_id uuid, p_token text, p_amount numeric, p_reference_type text DEFAULT 'trade'::text, p_reference_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_balance RECORD;
  v_locked_before DECIMAL(20, 12);
BEGIN
  SELECT * INTO v_balance
  FROM public.user_internal_balances
  WHERE user_id = p_user_id AND token = p_token
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance.locked_balance < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient locked balance for refund'
    );
  END IF;

  v_locked_before := v_balance.locked_balance;

  UPDATE public.user_internal_balances
  SET
    locked_balance = locked_balance - p_amount,
    available_balance = available_balance + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id AND token = p_token;

  INSERT INTO public.p2p_balance_transactions (
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
$$;


--
-- Name: release_escrow_internal(uuid, uuid, text, numeric, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_escrow_internal(p_from_user_id uuid, p_to_user_id uuid, p_token text, p_amount numeric, p_reference_type text DEFAULT 'trade'::text, p_reference_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_from_balance RECORD;
  v_to_balance_before DECIMAL(20, 12);
  v_from_balance_before DECIMAL(20, 12);
BEGIN
  SELECT * INTO v_from_balance
  FROM public.user_internal_balances
  WHERE user_id = p_from_user_id AND token = p_token
  FOR UPDATE;

  IF v_from_balance IS NULL OR v_from_balance.locked_balance < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient locked balance for release'
    );
  END IF;

  v_from_balance_before := v_from_balance.locked_balance;

  UPDATE public.user_internal_balances
  SET
    locked_balance = locked_balance - p_amount,
    updated_at = NOW()
  WHERE user_id = p_from_user_id AND token = p_token;

  INSERT INTO public.p2p_balance_transactions (
    user_id, token, transaction_type, amount,
    balance_before, balance_after, reference_type, reference_id,
    description
  ) VALUES (
    p_from_user_id, p_token, 'escrow_release', -p_amount,
    v_from_balance_before, v_from_balance_before - p_amount, p_reference_type, p_reference_id,
    'Escrow released to buyer'
  );

  SELECT available_balance INTO v_to_balance_before
  FROM public.user_internal_balances
  WHERE user_id = p_to_user_id AND token = p_token;

  IF v_to_balance_before IS NULL THEN
    v_to_balance_before := 0;
  END IF;

  INSERT INTO public.user_internal_balances (user_id, token, available_balance)
  VALUES (p_to_user_id, p_token, p_amount)
  ON CONFLICT (user_id, token)
  DO UPDATE SET
    available_balance = user_internal_balances.available_balance + p_amount,
    updated_at = NOW();

  INSERT INTO public.p2p_balance_transactions (
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
$$;


--
-- Name: request_withdraw(uuid, text, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_withdraw(p_user_id uuid, p_token text, p_amount numeric, p_wallet_address text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: resolve_p2p_dispute(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_p2p_dispute(p_trade_id uuid, p_resolution text, p_resolution_notes text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_admin_id UUID;
  v_trade RECORD;
  v_offer RECORD;
BEGIN
  v_admin_id := auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_admin_id
    AND role IN ('admin', 'super_admin', 'moderator')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Only admins can resolve disputes');
  END IF;

  SELECT * INTO v_trade
  FROM public.p2p_fiat_trades
  WHERE id = p_trade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Trade not found');
  END IF;

  IF v_trade.status != 'disputed' THEN
    RETURN json_build_object('success', false, 'error', 'Trade is not in disputed status');
  END IF;

  SELECT * INTO v_offer
  FROM public.p2p_fiat_offers
  WHERE id = v_trade.offer_id;

  IF p_resolution = 'release_to_buyer' THEN
    PERFORM release_escrow_internal(
      v_trade.seller_id, v_trade.buyer_id, v_offer.token,
      v_trade.crypto_amount, 'dispute_resolution', p_trade_id
    );

    UPDATE public.p2p_fiat_trades
    SET
      status = 'completed',
      completed_at = NOW(),
      dispute_resolved_at = NOW(),
      dispute_resolved_by = v_admin_id,
      dispute_resolution = 'Released to buyer: ' || COALESCE(p_resolution_notes, ''),
      updated_at = NOW()
    WHERE id = p_trade_id;

    UPDATE public.p2p_reputation
    SET
      disputed_trades = disputed_trades + 1,
      reputation_score = GREATEST(reputation_score - 20, 0),
      updated_at = NOW()
    WHERE user_id = v_trade.seller_id;

  ELSIF p_resolution = 'refund_to_seller' THEN
    PERFORM refund_escrow_internal(
      v_trade.seller_id, v_offer.token, v_trade.crypto_amount,
      'dispute_resolution', p_trade_id
    );

    UPDATE public.p2p_fiat_offers
    SET
      remaining_amount = remaining_amount + v_trade.crypto_amount,
      status = CASE WHEN remaining_amount + v_trade.crypto_amount > 0 THEN 'open' ELSE status END,
      updated_at = NOW()
    WHERE id = v_trade.offer_id;

    UPDATE public.p2p_fiat_trades
    SET
      status = 'refunded',
      dispute_resolved_at = NOW(),
      dispute_resolved_by = v_admin_id,
      dispute_resolution = 'Refunded to seller: ' || COALESCE(p_resolution_notes, ''),
      updated_at = NOW()
    WHERE id = p_trade_id;

    UPDATE public.p2p_reputation
    SET
      disputed_trades = disputed_trades + 1,
      reputation_score = GREATEST(reputation_score - 20, 0),
      updated_at = NOW()
    WHERE user_id = v_trade.buyer_id;
  ELSE
    RETURN json_build_object('success', false, 'error', 'Invalid resolution type');
  END IF;

  INSERT INTO public.p2p_audit_log (
    user_id, action, entity_type, entity_id, details
  ) VALUES (
    v_admin_id, 'dispute_resolved', 'trade', p_trade_id,
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
$$;


--
-- Name: retain_payment_proof(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retain_payment_proof(p_trade_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE p2p_fiat_trades
  SET proof_expires_at = NULL,
      updated_at = NOW()
  WHERE id = p_trade_id
    AND buyer_payment_proof_url IS NOT NULL;

  RETURN json_build_object('success', true);
END;
$$;


--
-- Name: submit_deposit_request(text, numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_deposit_request(p_token text, p_amount numeric, p_tx_hash text, p_wallet_address text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID;
  v_existing_request RECORD;
  v_request_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_token NOT IN ('HEZ', 'PEZ') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid token');
  END IF;

  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than 0');
  END IF;

  SELECT * INTO v_existing_request
  FROM public.p2p_deposit_withdraw_requests
  WHERE blockchain_tx_hash = p_tx_hash;

  IF FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'A request with this transaction hash already exists',
      'existing_status', v_existing_request.status
    );
  END IF;

  INSERT INTO public.p2p_deposit_withdraw_requests (
    user_id, request_type, token, amount, wallet_address, blockchain_tx_hash, status
  ) VALUES (
    v_user_id, 'deposit', p_token, p_amount, p_wallet_address, p_tx_hash, 'pending'
  ) RETURNING id INTO v_request_id;

  RETURN json_build_object(
    'success', true,
    'request_id', v_request_id,
    'status', 'pending',
    'message', 'Deposit request submitted. Verification typically takes 1-5 minutes.'
  );
END;
$$;


--
-- Name: update_p2p_reputation(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_p2p_reputation(p_seller_id uuid, p_buyer_id uuid, p_trade_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_trade RECORD;
  v_payment_time_minutes INT;
  v_confirmation_time_minutes INT;
BEGIN
  -- Get trade details
  SELECT * INTO v_trade
  FROM public.p2p_fiat_trades
  WHERE id = p_trade_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade % not found', p_trade_id;
  END IF;
  
  -- Calculate timing metrics
  IF v_trade.buyer_marked_paid_at IS NOT NULL THEN
    v_payment_time_minutes := EXTRACT(EPOCH FROM (v_trade.buyer_marked_paid_at - v_trade.created_at)) / 60;
  END IF;
  
  IF v_trade.seller_confirmed_at IS NOT NULL AND v_trade.buyer_marked_paid_at IS NOT NULL THEN
    v_confirmation_time_minutes := EXTRACT(EPOCH FROM (v_trade.seller_confirmed_at - v_trade.buyer_marked_paid_at)) / 60;
  END IF;
  
  -- Update seller reputation
  INSERT INTO public.p2p_reputation (
    user_id,
    total_trades,
    completed_trades,
    total_as_seller,
    reputation_score,
    avg_confirmation_time_minutes,
    last_trade_at,
    first_trade_at
  ) VALUES (
    p_seller_id,
    1,
    1,
    1,
    105, -- +5 bonus for first trade
    v_confirmation_time_minutes,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_trades = p2p_reputation.total_trades + 1,
    completed_trades = p2p_reputation.completed_trades + 1,
    total_as_seller = p2p_reputation.total_as_seller + 1,
    reputation_score = LEAST(p2p_reputation.reputation_score + 5, 1000),
    avg_confirmation_time_minutes = CASE
      WHEN p2p_reputation.avg_confirmation_time_minutes IS NULL THEN v_confirmation_time_minutes
      ELSE (p2p_reputation.avg_confirmation_time_minutes + COALESCE(v_confirmation_time_minutes, 0)) / 2
    END,
    last_trade_at = NOW(),
    updated_at = NOW();
  
  -- Update buyer reputation
  INSERT INTO public.p2p_reputation (
    user_id,
    total_trades,
    completed_trades,
    total_as_buyer,
    reputation_score,
    avg_payment_time_minutes,
    last_trade_at,
    first_trade_at
  ) VALUES (
    p_buyer_id,
    1,
    1,
    1,
    105,
    v_payment_time_minutes,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_trades = p2p_reputation.total_trades + 1,
    completed_trades = p2p_reputation.completed_trades + 1,
    total_as_buyer = p2p_reputation.total_as_buyer + 1,
    reputation_score = LEAST(p2p_reputation.reputation_score + 5, 1000),
    avg_payment_time_minutes = CASE
      WHEN p2p_reputation.avg_payment_time_minutes IS NULL THEN v_payment_time_minutes
      ELSE (p2p_reputation.avg_payment_time_minutes + COALESCE(v_payment_time_minutes, 0)) / 2
    END,
    last_trade_at = NOW(),
    updated_at = NOW();
  
  -- Update trust levels based on reputation score
  UPDATE public.p2p_reputation
  SET trust_level = CASE
    WHEN reputation_score >= 900 THEN 'verified'
    WHEN reputation_score >= 700 THEN 'advanced'
    WHEN reputation_score >= 400 THEN 'intermediate'
    WHEN reputation_score >= 100 THEN 'basic'
    ELSE 'new'
  END,
  fast_trader = CASE
    WHEN avg_payment_time_minutes < 15 AND avg_confirmation_time_minutes < 30 THEN true
    ELSE false
  END
  WHERE user_id IN (p_seller_id, p_buyer_id);
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text DEFAULT ''::text,
    full_name text,
    avatar_url text,
    bio text,
    wallet_address text,
    role text DEFAULT 'member'::text,
    reputation_score integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    email_verified boolean DEFAULT false,
    email_verified_at timestamp with time zone,
    recovery_email text,
    recovery_email_verified boolean DEFAULT false,
    phone_number text,
    phone_verified boolean DEFAULT false,
    website text,
    location text,
    joined_at timestamp with time zone DEFAULT now(),
    email text,
    twitter text,
    github text,
    linkedin text,
    notifications_enabled boolean DEFAULT true,
    email_notifications boolean DEFAULT true,
    two_factor_enabled boolean DEFAULT false,
    theme text DEFAULT 'system'::text,
    language text DEFAULT 'en'::text,
    phone character varying(20),
    company character varying(100),
    "position" character varying(100),
    skills text[],
    interests text[],
    languages text[],
    timezone character varying(50),
    is_public boolean DEFAULT true,
    push_notifications boolean DEFAULT false,
    currency character varying(10) DEFAULT 'USD'::character varying,
    date_format character varying(20) DEFAULT 'MM/DD/YYYY'::character varying,
    time_format character varying(10) DEFAULT '12h'::character varying,
    week_starts character varying(10) DEFAULT 'sunday'::character varying,
    profile_completion integer DEFAULT 0,
    notifications_email boolean DEFAULT true,
    notifications_push boolean DEFAULT false,
    notifications_sms boolean DEFAULT false,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['member'::text, 'delegate'::text, 'moderator'::text, 'admin'::text, 'founder'::text])))
);


--
-- Name: upsert_user_profile(text, text, text, text, text, text, text, text, boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_user_profile(p_username text DEFAULT ''::text, p_full_name text DEFAULT NULL::text, p_bio text DEFAULT NULL::text, p_phone_number text DEFAULT NULL::text, p_location text DEFAULT NULL::text, p_website text DEFAULT NULL::text, p_language text DEFAULT 'en'::text, p_theme text DEFAULT 'dark'::text, p_notifications_email boolean DEFAULT true, p_notifications_push boolean DEFAULT false, p_notifications_sms boolean DEFAULT false) RETURNS public.profiles
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  result public.profiles;
BEGIN
  -- Use auth.uid() to ensure user can only upsert their own profile
  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    bio,
    phone_number,
    location,
    website,
    language,
    theme,
    notifications_email,
    notifications_push,
    notifications_sms,
    updated_at
  )
  VALUES (
    auth.uid(),
    p_username,
    p_full_name,
    p_bio,
    p_phone_number,
    p_location,
    p_website,
    p_language,
    p_theme,
    p_notifications_email,
    p_notifications_push,
    p_notifications_sms,
    NOW()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    username = COALESCE(NULLIF(EXCLUDED.username, ''), profiles.username, ''),
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    bio = COALESCE(EXCLUDED.bio, profiles.bio),
    phone_number = COALESCE(EXCLUDED.phone_number, profiles.phone_number),
    location = COALESCE(EXCLUDED.location, profiles.location),
    website = COALESCE(EXCLUDED.website, profiles.website),
    language = COALESCE(EXCLUDED.language, profiles.language),
    theme = COALESCE(EXCLUDED.theme, profiles.theme),
    notifications_email = COALESCE(EXCLUDED.notifications_email, profiles.notifications_email),
    notifications_push = COALESCE(EXCLUDED.notifications_push, profiles.notifications_push),
    notifications_sms = COALESCE(EXCLUDED.notifications_sms, profiles.notifications_sms),
    updated_at = NOW()
  RETURNING *
  INTO result;

  RETURN result;
END;
$$;


--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action character varying(255) NOT NULL,
    details jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin_announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    type text DEFAULT 'info'::text,
    priority integer DEFAULT 0,
    is_active boolean DEFAULT true,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_announcements_type_check CHECK ((type = ANY (ARRAY['info'::text, 'warning'::text, 'success'::text, 'critical'::text])))
);


--
-- Name: admin_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    role text NOT NULL,
    permissions jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_roles_role_check CHECK ((role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'moderator'::text])))
);


--
-- Name: ai_chat_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_chat_log (
    id bigint NOT NULL,
    ip text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_chat_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_chat_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_chat_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_chat_log_id_seq OWNED BY public.ai_chat_log.id;


--
-- Name: backup_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_metadata (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    backup_type character varying(50) NOT NULL,
    backup_name character varying(255) NOT NULL,
    backup_size bigint,
    backup_location character varying(500),
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    created_by uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    error_message text
);


--
-- Name: backup_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    schedule_name character varying(255) NOT NULL,
    backup_type character varying(50) NOT NULL,
    frequency character varying(50) NOT NULL,
    cron_expression character varying(100),
    is_active boolean DEFAULT true,
    last_run timestamp with time zone,
    next_run timestamp with time zone,
    retention_days integer DEFAULT 30,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    config jsonb DEFAULT '{}'::jsonb
);


--
-- Name: batch_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batch_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    chain_id text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    transactions jsonb NOT NULL,
    total_gas_saved numeric(20,8),
    original_cost numeric(20,8),
    optimized_cost numeric(20,8),
    batch_hash text,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    processed_at timestamp with time zone,
    completed_at timestamp with time zone
);


--
-- Name: bridge_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bridge_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    from_chain text NOT NULL,
    to_chain text NOT NULL,
    from_address text NOT NULL,
    to_address text NOT NULL,
    amount numeric(20,8) NOT NULL,
    token text NOT NULL,
    status text DEFAULT 'pending'::text,
    tx_hash text,
    bridge_fee numeric(20,8),
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);


--
-- Name: chain_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chain_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chain_id text NOT NULL,
    name text NOT NULL,
    rpc_url text NOT NULL,
    explorer_url text,
    native_token text NOT NULL,
    icon_url text,
    is_active boolean DEFAULT true,
    block_time integer DEFAULT 6,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: cross_chain_proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cross_chain_proposals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id text NOT NULL,
    origin_chain text NOT NULL,
    target_chains text[] DEFAULT '{}'::text[],
    title text NOT NULL,
    description text,
    status text DEFAULT 'pending'::text,
    sync_status jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: email_verification_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_verification_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    token text NOT NULL,
    email text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: forum_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    icon text DEFAULT '💬'::text,
    color text DEFAULT '#3B82F6'::text,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: forum_discussions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_discussions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid,
    proposal_id text,
    title text NOT NULL,
    content text NOT NULL,
    image_url text,
    author_id text NOT NULL,
    author_name text NOT NULL,
    author_address text,
    is_pinned boolean DEFAULT false,
    is_locked boolean DEFAULT false,
    views_count integer DEFAULT 0,
    replies_count integer DEFAULT 0,
    tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_activity_at timestamp with time zone DEFAULT now()
);


--
-- Name: forum_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    discussion_id uuid,
    reply_id uuid,
    user_id text NOT NULL,
    reaction_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT forum_reactions_reaction_type_check CHECK ((reaction_type = ANY (ARRAY['upvote'::text, 'downvote'::text])))
);


--
-- Name: forum_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    discussion_id uuid,
    parent_reply_id uuid,
    content text NOT NULL,
    author_id text NOT NULL,
    author_name text NOT NULL,
    author_address text,
    is_edited boolean DEFAULT false,
    edited_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: gas_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gas_prices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chain_id text NOT NULL,
    chain_name text NOT NULL,
    base_fee numeric(20,8) NOT NULL,
    priority_fee numeric(20,8) NOT NULL,
    safe_gas_price numeric(20,8) NOT NULL,
    fast_gas_price numeric(20,8) NOT NULL,
    instant_gas_price numeric(20,8) NOT NULL,
    block_number bigint NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: governance_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.governance_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    permission_type text NOT NULL,
    granted_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    granted_by uuid,
    CONSTRAINT governance_permissions_permission_type_check CHECK ((permission_type = ANY (ARRAY['create_proposal'::text, 'vote'::text, 'delegate'::text, 'moderate'::text, 'treasury_access'::text])))
);


--
-- Name: mev_attacks_detected; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mev_attacks_detected (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    chain_id text NOT NULL,
    transaction_hash text,
    attack_type text NOT NULL,
    attacker_address text,
    victim_address text,
    potential_loss numeric(20,6),
    actual_loss numeric(20,6),
    gas_used bigint,
    block_number bigint,
    detection_confidence numeric(5,2),
    prevented boolean DEFAULT false,
    details jsonb,
    detected_at timestamp with time zone DEFAULT now()
);


--
-- Name: mev_protection_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mev_protection_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chain_id text NOT NULL,
    chain_name text NOT NULL,
    flashbot_rpc text,
    private_pool_enabled boolean DEFAULT false,
    min_protection_value numeric(20,6) DEFAULT 100,
    max_slippage numeric(5,2) DEFAULT 0.5,
    protection_level text DEFAULT 'medium'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: mev_rewards_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mev_rewards_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    opt_in_status boolean DEFAULT false,
    profit_share_percentage numeric(5,2) DEFAULT 50.00,
    min_rebate_threshold numeric(10,4) DEFAULT 0.001,
    auto_compound boolean DEFAULT false,
    preferred_validators text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT mev_rewards_config_profit_share_percentage_check CHECK (((profit_share_percentage >= (0)::numeric) AND (profit_share_percentage <= (100)::numeric)))
);


--
-- Name: mev_rewards_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mev_rewards_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    transaction_hash text NOT NULL,
    chain_id text NOT NULL,
    mev_profit numeric(20,8) NOT NULL,
    user_rebate numeric(20,8) NOT NULL,
    validator_reward numeric(20,8) NOT NULL,
    validator_address text NOT NULL,
    gas_saved numeric(20,8),
    protection_type text,
    distribution_status text DEFAULT 'pending'::text,
    distributed_at timestamp with time zone,
    claimed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT mev_rewards_history_distribution_status_check CHECK ((distribution_status = ANY (ARRAY['pending'::text, 'distributed'::text, 'claimed'::text, 'failed'::text]))),
    CONSTRAINT mev_rewards_history_protection_type_check CHECK ((protection_type = ANY (ARRAY['flashbot'::text, 'private_pool'::text, 'bundle'::text, 'priority_fee'::text])))
);


--
-- Name: mev_statistics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mev_statistics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chain_id text NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    total_mev_extracted numeric(20,8) DEFAULT 0,
    total_mev_redistributed numeric(20,8) DEFAULT 0,
    total_users_protected integer DEFAULT 0,
    average_rebate_percentage numeric(5,2) DEFAULT 0,
    total_gas_saved numeric(20,8) DEFAULT 0,
    top_validators jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: multi_sig_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.multi_sig_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wallet_id uuid,
    initiator_id uuid,
    token_type character varying(10),
    amount numeric(20,8) NOT NULL,
    recipient_address character varying(255) NOT NULL,
    description text,
    status character varying(20) DEFAULT 'pending'::character varying,
    signatures_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    executed_at timestamp with time zone,
    CONSTRAINT multi_sig_transactions_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT multi_sig_transactions_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('executed'::character varying)::text]))),
    CONSTRAINT multi_sig_transactions_token_type_check CHECK (((token_type)::text = ANY (ARRAY[('HEZ'::character varying)::text, ('PEZ'::character varying)::text])))
);


--
-- Name: multi_sig_wallets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.multi_sig_wallets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wallet_name character varying(100) NOT NULL,
    required_signatures integer NOT NULL,
    total_signers integer NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT multi_sig_wallets_check CHECK ((total_signers >= required_signatures)),
    CONSTRAINT multi_sig_wallets_required_signatures_check CHECK ((required_signatures > 0))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL,
    read boolean DEFAULT false,
    action_url text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone,
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'error'::text, 'system'::text])))
);


--
-- Name: optimization_routes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.optimization_routes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_chain text NOT NULL,
    to_chain text NOT NULL,
    token_address text NOT NULL,
    amount numeric(30,18) NOT NULL,
    direct_cost numeric(20,8),
    optimized_cost numeric(20,8),
    savings_amount numeric(20,8),
    savings_percentage numeric(5,2),
    route_path jsonb NOT NULL,
    estimated_time integer,
    confidence_score numeric(3,2),
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: p2p_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    details jsonb DEFAULT '{}'::jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: p2p_block_trade_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_block_trade_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type character varying(10) NOT NULL,
    token character varying(10) NOT NULL,
    fiat_currency character varying(10) NOT NULL,
    amount numeric(20,8) NOT NULL,
    target_price numeric(20,8),
    message text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    admin_notes text,
    assigned_to uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT p2p_block_trade_requests_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('negotiating'::character varying)::text, ('approved'::character varying)::text, ('in_progress'::character varying)::text, ('completed'::character varying)::text, ('cancelled'::character varying)::text]))),
    CONSTRAINT p2p_block_trade_requests_type_check CHECK (((type)::text = ANY (ARRAY[('buy'::character varying)::text, ('sell'::character varying)::text])))
);


--
-- Name: p2p_challenge_nonces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_challenge_nonces (
    nonce text NOT NULL,
    purpose text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: p2p_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_config (
    key text NOT NULL,
    value text NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: p2p_dispute_evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_dispute_evidence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dispute_id uuid NOT NULL,
    uploaded_by uuid NOT NULL,
    evidence_type character varying(30) NOT NULL,
    file_url text NOT NULL,
    file_name text,
    file_size integer,
    mime_type text,
    description text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    is_valid boolean,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT p2p_dispute_evidence_description_check CHECK ((length(description) <= 1000)),
    CONSTRAINT p2p_dispute_evidence_evidence_type_check CHECK (((evidence_type)::text = ANY (ARRAY[('screenshot'::character varying)::text, ('receipt'::character varying)::text, ('bank_statement'::character varying)::text, ('chat_log'::character varying)::text, ('transaction_proof'::character varying)::text, ('identity_doc'::character varying)::text, ('other'::character varying)::text])))
);


--
-- Name: p2p_featured_ads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_featured_ads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offer_id uuid NOT NULL,
    user_id uuid NOT NULL,
    "position" integer DEFAULT 1,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    fee_amount numeric(18,2) NOT NULL,
    fee_token character varying(10) DEFAULT 'HEZ'::character varying,
    fee_tx_hash text,
    paid_at timestamp with time zone,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT p2p_featured_ads_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('active'::character varying)::text, ('expired'::character varying)::text, ('cancelled'::character varying)::text])))
);


--
-- Name: p2p_fiat_disputes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_fiat_disputes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trade_id uuid NOT NULL,
    opened_by uuid NOT NULL,
    reason text NOT NULL,
    category text NOT NULL,
    evidence_urls text[] DEFAULT '{}'::text[],
    additional_info jsonb DEFAULT '{}'::jsonb,
    assigned_moderator_id uuid,
    assigned_at timestamp with time zone,
    decision text,
    decision_reasoning text,
    resolved_at timestamp with time zone,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT p2p_fiat_disputes_category_check CHECK ((category = ANY (ARRAY['payment_not_received'::text, 'wrong_amount'::text, 'fake_payment_proof'::text, 'other'::text]))),
    CONSTRAINT p2p_fiat_disputes_decision_check CHECK ((decision = ANY (ARRAY['release_to_buyer'::text, 'refund_to_seller'::text, 'split'::text, 'escalate'::text]))),
    CONSTRAINT p2p_fiat_disputes_status_check CHECK ((status = ANY (ARRAY['open'::text, 'under_review'::text, 'resolved'::text, 'escalated'::text, 'closed'::text])))
);


--
-- Name: p2p_fiat_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_fiat_offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    seller_wallet text NOT NULL,
    token text NOT NULL,
    amount_crypto numeric NOT NULL,
    fiat_currency text NOT NULL,
    fiat_amount numeric NOT NULL,
    price_per_unit numeric GENERATED ALWAYS AS ((fiat_amount / amount_crypto)) STORED,
    payment_method_id uuid,
    payment_details_encrypted text,
    min_order_amount numeric,
    max_order_amount numeric,
    time_limit_minutes integer DEFAULT 30,
    auto_reply_message text,
    min_buyer_completed_trades integer DEFAULT 0,
    min_buyer_reputation integer DEFAULT 0,
    blocked_users uuid[] DEFAULT '{}'::uuid[],
    status text DEFAULT 'open'::text NOT NULL,
    remaining_amount numeric NOT NULL,
    escrow_tx_hash text,
    escrow_locked_at timestamp with time zone,
    is_featured boolean DEFAULT false,
    featured_until timestamp with time zone,
    ad_type text DEFAULT 'sell'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
    CONSTRAINT p2p_fiat_offers_ad_type_check CHECK ((ad_type = ANY (ARRAY['buy'::text, 'sell'::text]))),
    CONSTRAINT p2p_fiat_offers_amount_crypto_check CHECK ((amount_crypto > (0)::numeric)),
    CONSTRAINT p2p_fiat_offers_fiat_amount_check CHECK ((fiat_amount > (0)::numeric)),
    CONSTRAINT p2p_fiat_offers_min_order_amount_check CHECK (((min_order_amount IS NULL) OR (min_order_amount > (0)::numeric))),
    CONSTRAINT p2p_fiat_offers_remaining_amount_check CHECK ((remaining_amount >= (0)::numeric)),
    CONSTRAINT p2p_fiat_offers_status_check CHECK ((status = ANY (ARRAY['open'::text, 'paused'::text, 'locked'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT p2p_fiat_offers_time_limit_minutes_check CHECK (((time_limit_minutes >= 15) AND (time_limit_minutes <= 120))),
    CONSTRAINT p2p_fiat_offers_token_check CHECK ((token = ANY (ARRAY['HEZ'::text, 'PEZ'::text])))
);


--
-- Name: p2p_fiat_trades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_fiat_trades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offer_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    buyer_id uuid NOT NULL,
    buyer_wallet text NOT NULL,
    crypto_amount numeric NOT NULL,
    fiat_amount numeric NOT NULL,
    price_per_unit numeric NOT NULL,
    escrow_locked_amount numeric NOT NULL,
    escrow_locked_at timestamp with time zone,
    escrow_release_tx_hash text,
    escrow_released_at timestamp with time zone,
    buyer_marked_paid_at timestamp with time zone,
    buyer_payment_proof_url text,
    seller_confirmed_at timestamp with time zone,
    chat_messages jsonb DEFAULT '[]'::jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    payment_deadline timestamp with time zone NOT NULL,
    confirmation_deadline timestamp with time zone,
    cancelled_by uuid,
    cancellation_reason text,
    dispute_id uuid,
    dispute_reason text,
    dispute_opened_at timestamp with time zone,
    dispute_opened_by uuid,
    dispute_resolved_at timestamp with time zone,
    dispute_resolved_by uuid,
    dispute_resolution text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    proof_expires_at timestamp with time zone,
    CONSTRAINT different_users CHECK ((seller_id <> buyer_id)),
    CONSTRAINT p2p_fiat_trades_crypto_amount_check CHECK ((crypto_amount > (0)::numeric)),
    CONSTRAINT p2p_fiat_trades_fiat_amount_check CHECK ((fiat_amount > (0)::numeric)),
    CONSTRAINT p2p_fiat_trades_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'payment_sent'::text, 'completed'::text, 'cancelled'::text, 'disputed'::text, 'refunded'::text])))
);


--
-- Name: p2p_fraud_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_fraud_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid NOT NULL,
    reported_user_id uuid NOT NULL,
    trade_id uuid,
    reason character varying(50) NOT NULL,
    description text NOT NULL,
    evidence_urls text[] DEFAULT '{}'::text[],
    status character varying(20) DEFAULT 'pending'::character varying,
    assigned_to uuid,
    assigned_at timestamp with time zone,
    resolution text,
    resolution_notes text,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    action_taken character varying(30),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cannot_report_self CHECK ((reporter_id <> reported_user_id)),
    CONSTRAINT p2p_fraud_reports_action_taken_check CHECK (((action_taken)::text = ANY (ARRAY[('warning_issued'::character varying)::text, ('temporary_ban'::character varying)::text, ('permanent_ban'::character varying)::text, ('trade_restricted'::character varying)::text, ('no_action'::character varying)::text, ('referred_to_authorities'::character varying)::text]))),
    CONSTRAINT p2p_fraud_reports_description_check CHECK (((length(description) >= 20) AND (length(description) <= 2000))),
    CONSTRAINT p2p_fraud_reports_reason_check CHECK (((reason)::text = ANY (ARRAY[('fake_payment'::character varying)::text, ('fake_proof'::character varying)::text, ('scam_attempt'::character varying)::text, ('harassment'::character varying)::text, ('money_laundering'::character varying)::text, ('identity_fraud'::character varying)::text, ('multiple_accounts'::character varying)::text, ('other'::character varying)::text]))),
    CONSTRAINT p2p_fraud_reports_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('investigating'::character varying)::text, ('confirmed'::character varying)::text, ('dismissed'::character varying)::text, ('escalated'::character varying)::text])))
);


--
-- Name: p2p_merchant_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_merchant_stats (
    user_id uuid NOT NULL,
    total_volume_30d numeric(18,2) DEFAULT 0,
    total_trades_30d integer DEFAULT 0,
    buy_volume_30d numeric(18,2) DEFAULT 0,
    sell_volume_30d numeric(18,2) DEFAULT 0,
    completion_rate_30d numeric(5,2) DEFAULT 0,
    avg_release_time_minutes integer,
    avg_payment_time_minutes integer,
    total_volume_lifetime numeric(18,2) DEFAULT 0,
    total_trades_lifetime integer DEFAULT 0,
    volume_rank integer,
    trade_count_rank integer,
    last_calculated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: p2p_merchant_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_merchant_tiers (
    user_id uuid NOT NULL,
    tier character varying(20) DEFAULT 'lite'::character varying,
    deposit_amount numeric(18,2) DEFAULT 0,
    deposit_token character varying(10) DEFAULT 'HEZ'::character varying,
    deposit_tx_hash text,
    deposit_locked_at timestamp with time zone,
    max_pending_orders integer DEFAULT 5,
    max_order_amount numeric(18,2) DEFAULT 10000,
    featured_ads_allowed integer DEFAULT 0,
    application_status character varying(20),
    applied_at timestamp with time zone,
    applied_for_tier character varying(20),
    approved_at timestamp with time zone,
    approved_by uuid,
    rejection_reason text,
    last_review_at timestamp with time zone,
    next_review_at timestamp with time zone,
    review_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT p2p_merchant_tiers_application_status_check CHECK (((application_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('suspended'::character varying)::text]))),
    CONSTRAINT p2p_merchant_tiers_tier_check CHECK (((tier)::text = ANY (ARRAY[('lite'::character varying)::text, ('super'::character varying)::text, ('diamond'::character varying)::text])))
);


--
-- Name: p2p_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trade_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    message text NOT NULL,
    message_type character varying(20) DEFAULT 'text'::character varying,
    attachment_url text,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT p2p_messages_message_check CHECK (((length(message) > 0) AND (length(message) <= 2000))),
    CONSTRAINT p2p_messages_message_type_check CHECK (((message_type)::text = ANY (ARRAY[('text'::character varying)::text, ('image'::character varying)::text, ('system'::character varying)::text])))
);


--
-- Name: p2p_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    title text NOT NULL,
    message text,
    reference_type character varying(20),
    reference_id uuid,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    action_url text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT p2p_notifications_reference_type_check CHECK (((reference_type)::text = ANY (ARRAY[('trade'::character varying)::text, ('offer'::character varying)::text, ('dispute'::character varying)::text, ('message'::character varying)::text]))),
    CONSTRAINT p2p_notifications_type_check CHECK (((type)::text = ANY (ARRAY[('new_order'::character varying)::text, ('payment_sent'::character varying)::text, ('payment_confirmed'::character varying)::text, ('trade_cancelled'::character varying)::text, ('dispute_opened'::character varying)::text, ('dispute_resolved'::character varying)::text, ('new_message'::character varying)::text, ('rating_received'::character varying)::text, ('offer_matched'::character varying)::text, ('trade_reminder'::character varying)::text, ('system'::character varying)::text])))
);


--
-- Name: p2p_platform_escrow; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_platform_escrow (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offer_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    seller_wallet text NOT NULL,
    token text NOT NULL,
    amount numeric(20,12) NOT NULL,
    locked_at timestamp with time zone DEFAULT now(),
    released_at timestamp with time zone,
    released_to text,
    release_reason text,
    blockchain_tx_lock text,
    blockchain_tx_release text,
    status text DEFAULT 'locked'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT p2p_platform_escrow_status_check CHECK ((status = ANY (ARRAY['locked'::text, 'released'::text, 'pending_release'::text])))
);


--
-- Name: p2p_ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trade_id uuid NOT NULL,
    rater_id uuid NOT NULL,
    rated_id uuid NOT NULL,
    rating integer NOT NULL,
    review text,
    communication_rating integer,
    speed_rating integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cannot_rate_self CHECK ((rater_id <> rated_id)),
    CONSTRAINT p2p_ratings_communication_rating_check CHECK (((communication_rating >= 1) AND (communication_rating <= 5))),
    CONSTRAINT p2p_ratings_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT p2p_ratings_review_check CHECK ((length(review) <= 500)),
    CONSTRAINT p2p_ratings_speed_rating_check CHECK (((speed_rating >= 1) AND (speed_rating <= 5)))
);


--
-- Name: p2p_reputation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_reputation (
    user_id uuid NOT NULL,
    total_trades integer DEFAULT 0,
    completed_trades integer DEFAULT 0,
    cancelled_trades integer DEFAULT 0,
    disputed_trades integer DEFAULT 0,
    total_as_seller integer DEFAULT 0,
    total_as_buyer integer DEFAULT 0,
    total_volume_usd numeric DEFAULT 0,
    avg_payment_time_minutes integer,
    avg_confirmation_time_minutes integer,
    reputation_score integer DEFAULT 100,
    trust_level text DEFAULT 'new'::text,
    verified_merchant boolean DEFAULT false,
    fast_trader boolean DEFAULT false,
    is_restricted boolean DEFAULT false,
    restriction_reason text,
    restricted_until timestamp with time zone,
    first_trade_at timestamp with time zone,
    last_trade_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT p2p_reputation_cancelled_trades_check CHECK ((cancelled_trades >= 0)),
    CONSTRAINT p2p_reputation_completed_trades_check CHECK ((completed_trades >= 0)),
    CONSTRAINT p2p_reputation_disputed_trades_check CHECK ((disputed_trades >= 0)),
    CONSTRAINT p2p_reputation_reputation_score_check CHECK (((reputation_score >= 0) AND (reputation_score <= 1000))),
    CONSTRAINT p2p_reputation_total_as_buyer_check CHECK ((total_as_buyer >= 0)),
    CONSTRAINT p2p_reputation_total_as_seller_check CHECK ((total_as_seller >= 0)),
    CONSTRAINT p2p_reputation_total_trades_check CHECK ((total_trades >= 0)),
    CONSTRAINT p2p_reputation_total_volume_usd_check CHECK ((total_volume_usd >= (0)::numeric)),
    CONSTRAINT p2p_reputation_trust_level_check CHECK ((trust_level = ANY (ARRAY['new'::text, 'basic'::text, 'intermediate'::text, 'advanced'::text, 'verified'::text])))
);


--
-- Name: p2p_suspicious_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_suspicious_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    trade_id uuid,
    activity_type character varying(50) NOT NULL,
    severity character varying(10) NOT NULL,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb,
    status character varying(20) DEFAULT 'pending'::character varying,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    action_taken text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT p2p_suspicious_activity_activity_type_check CHECK (((activity_type)::text = ANY (ARRAY[('high_cancel_rate'::character varying)::text, ('frequent_disputes'::character varying)::text, ('rapid_trading'::character varying)::text, ('unusual_amount'::character varying)::text, ('new_account_large_trade'::character varying)::text, ('payment_name_mismatch'::character varying)::text, ('suspected_multi_account'::character varying)::text, ('ip_anomaly'::character varying)::text, ('device_anomaly'::character varying)::text, ('other'::character varying)::text]))),
    CONSTRAINT p2p_suspicious_activity_severity_check CHECK (((severity)::text = ANY (ARRAY[('low'::character varying)::text, ('medium'::character varying)::text, ('high'::character varying)::text, ('critical'::character varying)::text]))),
    CONSTRAINT p2p_suspicious_activity_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('reviewed'::character varying)::text, ('dismissed'::character varying)::text, ('actioned'::character varying)::text])))
);


--
-- Name: p2p_tier_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_tier_requirements (
    tier character varying(20) NOT NULL,
    min_trades integer NOT NULL,
    min_completion_rate numeric(5,2) NOT NULL,
    min_volume_30d numeric(18,2) NOT NULL,
    deposit_required numeric(18,2) NOT NULL,
    deposit_token character varying(10) DEFAULT 'HEZ'::character varying,
    max_pending_orders integer NOT NULL,
    max_order_amount numeric(18,2) NOT NULL,
    featured_ads_allowed integer NOT NULL,
    description text
);


--
-- Name: p2p_trades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_trades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid,
    buyer_id uuid,
    token_type character varying(10),
    amount numeric(20,8) NOT NULL,
    price_per_token numeric(20,8) NOT NULL,
    total_price numeric(20,8) NOT NULL,
    payment_method character varying(50),
    status character varying(20) DEFAULT 'active'::character varying,
    escrow_released boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    CONSTRAINT p2p_trades_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT p2p_trades_price_per_token_check CHECK ((price_per_token > (0)::numeric)),
    CONSTRAINT p2p_trades_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('pending'::character varying)::text, ('completed'::character varying)::text, ('cancelled'::character varying)::text, ('disputed'::character varying)::text]))),
    CONSTRAINT p2p_trades_token_type_check CHECK (((token_type)::text = ANY (ARRAY[('HEZ'::character varying)::text, ('PEZ'::character varying)::text])))
);


--
-- Name: p2p_user_fraud_indicators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_user_fraud_indicators (
    user_id uuid NOT NULL,
    cancel_rate numeric(5,2) DEFAULT 0,
    dispute_rate numeric(5,2) DEFAULT 0,
    avg_trade_amount numeric(18,2) DEFAULT 0,
    recent_cancellations_24h integer DEFAULT 0,
    recent_disputes_7d integer DEFAULT 0,
    trades_today integer DEFAULT 0,
    volume_today numeric(18,2) DEFAULT 0,
    risk_score integer DEFAULT 0,
    risk_level character varying(10) DEFAULT 'low'::character varying,
    active_flags text[] DEFAULT '{}'::text[],
    is_blocked boolean DEFAULT false,
    blocked_reason text,
    blocked_at timestamp with time zone,
    blocked_until timestamp with time zone,
    requires_review boolean DEFAULT false,
    last_cancellation_at timestamp with time zone,
    last_dispute_at timestamp with time zone,
    last_trade_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT p2p_user_fraud_indicators_risk_level_check CHECK (((risk_level)::text = ANY (ARRAY[('low'::character varying)::text, ('medium'::character varying)::text, ('high'::character varying)::text, ('critical'::character varying)::text]))),
    CONSTRAINT p2p_user_fraud_indicators_risk_score_check CHECK (((risk_score >= 0) AND (risk_score <= 100)))
);


--
-- Name: p2p_user_payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_user_payment_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    payment_method_id uuid NOT NULL,
    account_details_encrypted text NOT NULL,
    account_name text,
    is_default boolean DEFAULT false,
    is_verified boolean DEFAULT false,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: p2p_visa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_visa (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    visa_number text NOT NULL,
    wallet_address text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    trust_level integer DEFAULT 1 NOT NULL,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '1 year'::interval),
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: p2p_withdrawal_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.p2p_withdrawal_limits (
    user_id uuid NOT NULL,
    daily_withdrawn numeric(20,12) DEFAULT 0,
    monthly_withdrawn numeric(20,12) DEFAULT 0,
    daily_limit numeric(20,12) DEFAULT 1000,
    monthly_limit numeric(20,12) DEFAULT 10000,
    last_daily_reset timestamp with time zone DEFAULT now(),
    last_monthly_reset timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    currency text NOT NULL,
    country text NOT NULL,
    method_name text NOT NULL,
    method_type text NOT NULL,
    logo_url text,
    fields jsonb DEFAULT '{}'::jsonb NOT NULL,
    validation_rules jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    min_trade_amount numeric DEFAULT 0,
    max_trade_amount numeric,
    processing_time_minutes integer DEFAULT 60,
    requires_verification boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payment_methods_method_type_check CHECK ((method_type = ANY (ARRAY['bank'::text, 'mobile_payment'::text, 'cash'::text, 'crypto_exchange'::text, 'e_wallet'::text, 'card'::text, 'remittance'::text])))
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resource text NOT NULL,
    action text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);


--
-- Name: platform_escrow_balance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_escrow_balance (
    token text NOT NULL,
    total_locked numeric DEFAULT 0,
    hot_wallet_address text NOT NULL,
    last_audit_at timestamp with time zone,
    last_audit_blockchain_balance numeric,
    discrepancy numeric GENERATED ALWAYS AS ((last_audit_blockchain_balance - total_locked)) STORED,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT platform_escrow_balance_token_check CHECK ((token = ANY (ARRAY['HEZ'::text, 'PEZ'::text]))),
    CONSTRAINT platform_escrow_balance_total_locked_check CHECK ((total_locked >= (0)::numeric))
);


--
-- Name: platform_wallet_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_wallet_config (
    id integer NOT NULL,
    wallet_type text NOT NULL,
    wallet_address text NOT NULL,
    public_key text,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT platform_wallet_config_wallet_type_check CHECK ((wallet_type = ANY (ARRAY['hot'::text, 'cold'::text, 'fee_collector'::text])))
);


--
-- Name: platform_wallet_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.platform_wallet_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: platform_wallet_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.platform_wallet_config_id_seq OWNED BY public.platform_wallet_config.id;


--
-- Name: private_pools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.private_pools (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pool_name text NOT NULL,
    chain_id text NOT NULL,
    pool_endpoint text NOT NULL,
    pool_type text NOT NULL,
    min_tip numeric(20,6) DEFAULT 0,
    success_rate numeric(5,2) DEFAULT 0,
    avg_inclusion_time integer DEFAULT 0,
    total_transactions integer DEFAULT 0,
    is_active boolean DEFAULT true,
    features jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: protected_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.protected_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    chain_id text NOT NULL,
    transaction_hash text,
    pool_id uuid,
    protection_type text NOT NULL,
    original_gas_price numeric(20,9),
    tip_paid numeric(20,9),
    status text DEFAULT 'pending'::text,
    inclusion_block bigint,
    submission_time timestamp with time zone DEFAULT now(),
    inclusion_time timestamp with time zone,
    protection_metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: recovery_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recovery_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    backup_id uuid,
    recovery_type character varying(50) NOT NULL,
    recovery_point timestamp with time zone,
    status character varying(50) DEFAULT 'pending'::character varying,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    initiated_by uuid,
    affected_records integer,
    recovery_metadata jsonb DEFAULT '{}'::jsonb,
    error_message text
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    priority integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);


--
-- Name: staking_positions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staking_positions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    token_type character varying(10),
    amount numeric(20,8) NOT NULL,
    staked_at timestamp with time zone DEFAULT now(),
    lock_period integer DEFAULT 30 NOT NULL,
    unlock_at timestamp with time zone,
    apy numeric(5,2) DEFAULT 12.00 NOT NULL,
    rewards_claimed numeric(20,8) DEFAULT 0,
    last_claim_at timestamp with time zone,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT staking_positions_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT staking_positions_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('unstaking'::character varying)::text, ('completed'::character varying)::text]))),
    CONSTRAINT staking_positions_token_type_check CHECK (((token_type)::text = ANY (ARRAY[('HEZ'::character varying)::text, ('PEZ'::character varying)::text])))
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    description text,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tg_announcement_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tg_announcement_reactions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    announcement_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reaction text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tg_announcement_reactions_reaction_check CHECK ((reaction = ANY (ARRAY['like'::text, 'dislike'::text])))
);


--
-- Name: tg_announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tg_announcements (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    image_url text,
    link_url text,
    author_id uuid NOT NULL,
    likes integer DEFAULT 0,
    dislikes integer DEFAULT 0,
    views integer DEFAULT 0,
    is_published boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tg_deposits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tg_deposits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    network character varying(20) NOT NULL,
    amount numeric(20,6) NOT NULL,
    tx_hash character varying(100),
    memo character varying(50),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    wusdt_tx_hash character varying(100),
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    confirmed_at timestamp with time zone,
    processed_at timestamp with time zone,
    retry_count integer DEFAULT 0,
    transfer_tx_hash text,
    last_error text,
    completed_at timestamp with time zone,
    failed_at timestamp with time zone,
    CONSTRAINT tg_deposits_network_check CHECK (((network)::text = ANY (ARRAY[('ton'::character varying)::text, ('trc20'::character varying)::text, ('polkadot'::character varying)::text]))),
    CONSTRAINT tg_deposits_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('confirming'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text, ('expired'::character varying)::text])))
);


--
-- Name: tg_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tg_replies (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    thread_id uuid NOT NULL,
    content text NOT NULL,
    author_id uuid NOT NULL,
    likes integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tg_reply_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tg_reply_likes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    reply_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tg_thread_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tg_thread_likes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    thread_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tg_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tg_threads (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    author_id uuid NOT NULL,
    reply_count integer DEFAULT 0,
    likes integer DEFAULT 0,
    views integer DEFAULT 0,
    last_activity timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tg_user_deposit_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tg_user_deposit_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    code character varying(12) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tg_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tg_users (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    telegram_id bigint NOT NULL,
    username text,
    first_name text NOT NULL,
    last_name text,
    photo_url text,
    language_code text DEFAULT 'ku'::text,
    is_admin boolean DEFAULT false,
    wallet_address text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deposit_index integer,
    p2p_user_id uuid
);


--
-- Name: transaction_signatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transaction_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_id uuid,
    signer_id uuid,
    signed_at timestamp with time zone DEFAULT now(),
    signature_type character varying(20),
    CONSTRAINT transaction_signatures_signature_type_check CHECK (((signature_type)::text = ANY (ARRAY[('approve'::character varying)::text, ('reject'::character varying)::text])))
);


--
-- Name: two_factor_auth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.two_factor_auth (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    secret text NOT NULL,
    enabled boolean DEFAULT false,
    backup_codes text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);


--
-- Name: user_internal_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_internal_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    available_balance numeric(20,12) DEFAULT 0 NOT NULL,
    locked_balance numeric(20,12) DEFAULT 0 NOT NULL,
    total_deposited numeric(20,12) DEFAULT 0 NOT NULL,
    total_withdrawn numeric(20,12) DEFAULT 0 NOT NULL,
    last_deposit_at timestamp with time zone,
    last_withdraw_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_internal_balances_available_balance_check CHECK ((available_balance >= (0)::numeric)),
    CONSTRAINT user_internal_balances_locked_balance_check CHECK ((locked_balance >= (0)::numeric)),
    CONSTRAINT user_internal_balances_token_check CHECK ((token = ANY (ARRAY['HEZ'::text, 'PEZ'::text])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    assigned_by uuid
);


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    token text NOT NULL,
    ip_address inet,
    user_agent text,
    device_info jsonb DEFAULT '{}'::jsonb,
    last_activity timestamp with time zone DEFAULT timezone('utc'::text, now()),
    expires_at timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    telegram_id bigint NOT NULL,
    username text,
    first_name text NOT NULL,
    last_name text,
    photo_url text,
    language_code text DEFAULT 'ku'::text,
    wallet_address text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: validator_incentives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.validator_incentives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    validator_address text NOT NULL,
    chain_id text NOT NULL,
    total_mev_protected numeric(20,8) DEFAULT 0,
    total_rewards_earned numeric(20,8) DEFAULT 0,
    protection_count integer DEFAULT 0,
    average_rebate_rate numeric(5,2) DEFAULT 0,
    reputation_score numeric(5,2) DEFAULT 50.00,
    last_protection_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT validator_incentives_reputation_score_check CHECK (((reputation_score >= (0)::numeric) AND (reputation_score <= (100)::numeric)))
);


--
-- Name: wallet_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    chain_id text NOT NULL,
    wallet_address text NOT NULL,
    wallet_type text NOT NULL,
    is_primary boolean DEFAULT false,
    last_connected timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: wallet_signers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_signers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wallet_id uuid,
    user_id uuid,
    added_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true
);


--
-- Name: ai_chat_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_log ALTER COLUMN id SET DEFAULT nextval('public.ai_chat_log_id_seq'::regclass);


--
-- Name: platform_wallet_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_wallet_config ALTER COLUMN id SET DEFAULT nextval('public.platform_wallet_config_id_seq'::regclass);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: admin_announcements admin_announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_announcements
    ADD CONSTRAINT admin_announcements_pkey PRIMARY KEY (id);


--
-- Name: admin_roles admin_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_roles
    ADD CONSTRAINT admin_roles_pkey PRIMARY KEY (id);


--
-- Name: admin_roles admin_roles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_roles
    ADD CONSTRAINT admin_roles_user_id_key UNIQUE (user_id);


--
-- Name: ai_chat_log ai_chat_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_log
    ADD CONSTRAINT ai_chat_log_pkey PRIMARY KEY (id);


--
-- Name: backup_metadata backup_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_metadata
    ADD CONSTRAINT backup_metadata_pkey PRIMARY KEY (id);


--
-- Name: backup_schedules backup_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_schedules
    ADD CONSTRAINT backup_schedules_pkey PRIMARY KEY (id);


--
-- Name: batch_transactions batch_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_transactions
    ADD CONSTRAINT batch_transactions_pkey PRIMARY KEY (id);


--
-- Name: bridge_transactions bridge_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bridge_transactions
    ADD CONSTRAINT bridge_transactions_pkey PRIMARY KEY (id);


--
-- Name: chain_configs chain_configs_chain_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chain_configs
    ADD CONSTRAINT chain_configs_chain_id_key UNIQUE (chain_id);


--
-- Name: chain_configs chain_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chain_configs
    ADD CONSTRAINT chain_configs_pkey PRIMARY KEY (id);


--
-- Name: cross_chain_proposals cross_chain_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cross_chain_proposals
    ADD CONSTRAINT cross_chain_proposals_pkey PRIMARY KEY (id);


--
-- Name: cross_chain_proposals cross_chain_proposals_proposal_id_origin_chain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cross_chain_proposals
    ADD CONSTRAINT cross_chain_proposals_proposal_id_origin_chain_key UNIQUE (proposal_id, origin_chain);


--
-- Name: email_verification_tokens email_verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (id);


--
-- Name: email_verification_tokens email_verification_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_token_key UNIQUE (token);


--
-- Name: forum_categories forum_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_categories
    ADD CONSTRAINT forum_categories_name_key UNIQUE (name);


--
-- Name: forum_categories forum_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_categories
    ADD CONSTRAINT forum_categories_pkey PRIMARY KEY (id);


--
-- Name: forum_discussions forum_discussions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_discussions
    ADD CONSTRAINT forum_discussions_pkey PRIMARY KEY (id);


--
-- Name: forum_reactions forum_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_reactions
    ADD CONSTRAINT forum_reactions_pkey PRIMARY KEY (id);


--
-- Name: forum_replies forum_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_replies
    ADD CONSTRAINT forum_replies_pkey PRIMARY KEY (id);


--
-- Name: gas_prices gas_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gas_prices
    ADD CONSTRAINT gas_prices_pkey PRIMARY KEY (id);


--
-- Name: governance_permissions governance_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_permissions
    ADD CONSTRAINT governance_permissions_pkey PRIMARY KEY (id);


--
-- Name: governance_permissions governance_permissions_user_id_permission_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_permissions
    ADD CONSTRAINT governance_permissions_user_id_permission_type_key UNIQUE (user_id, permission_type);


--
-- Name: mev_attacks_detected mev_attacks_detected_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mev_attacks_detected
    ADD CONSTRAINT mev_attacks_detected_pkey PRIMARY KEY (id);


--
-- Name: mev_protection_configs mev_protection_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mev_protection_configs
    ADD CONSTRAINT mev_protection_configs_pkey PRIMARY KEY (id);


--
-- Name: mev_rewards_config mev_rewards_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mev_rewards_config
    ADD CONSTRAINT mev_rewards_config_pkey PRIMARY KEY (id);


--
-- Name: mev_rewards_config mev_rewards_config_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mev_rewards_config
    ADD CONSTRAINT mev_rewards_config_user_id_key UNIQUE (user_id);


--
-- Name: mev_rewards_history mev_rewards_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mev_rewards_history
    ADD CONSTRAINT mev_rewards_history_pkey PRIMARY KEY (id);


--
-- Name: mev_statistics mev_statistics_chain_id_period_start_period_end_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mev_statistics
    ADD CONSTRAINT mev_statistics_chain_id_period_start_period_end_key UNIQUE (chain_id, period_start, period_end);


--
-- Name: mev_statistics mev_statistics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mev_statistics
    ADD CONSTRAINT mev_statistics_pkey PRIMARY KEY (id);


--
-- Name: multi_sig_transactions multi_sig_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.multi_sig_transactions
    ADD CONSTRAINT multi_sig_transactions_pkey PRIMARY KEY (id);


--
-- Name: multi_sig_wallets multi_sig_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.multi_sig_wallets
    ADD CONSTRAINT multi_sig_wallets_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: p2p_fiat_disputes one_dispute_per_trade; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_fiat_disputes
    ADD CONSTRAINT one_dispute_per_trade UNIQUE (trade_id);


--
-- Name: optimization_routes optimization_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.optimization_routes
    ADD CONSTRAINT optimization_routes_pkey PRIMARY KEY (id);


--
-- Name: p2p_audit_log p2p_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_audit_log
    ADD CONSTRAINT p2p_audit_log_pkey PRIMARY KEY (id);


--
-- Name: p2p_balance_transactions p2p_balance_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_balance_transactions
    ADD CONSTRAINT p2p_balance_transactions_pkey PRIMARY KEY (id);


--
-- Name: p2p_block_trade_requests p2p_block_trade_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_block_trade_requests
    ADD CONSTRAINT p2p_block_trade_requests_pkey PRIMARY KEY (id);


--
-- Name: p2p_challenge_nonces p2p_challenge_nonces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_challenge_nonces
    ADD CONSTRAINT p2p_challenge_nonces_pkey PRIMARY KEY (nonce);


--
-- Name: p2p_config p2p_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_config
    ADD CONSTRAINT p2p_config_pkey PRIMARY KEY (key);


--
-- Name: p2p_deposit_withdraw_requests p2p_deposit_withdraw_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_deposit_withdraw_requests
    ADD CONSTRAINT p2p_deposit_withdraw_requests_pkey PRIMARY KEY (id);


--
-- Name: p2p_deposit_withdraw_requests p2p_deposit_withdraw_requests_tx_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_deposit_withdraw_requests
    ADD CONSTRAINT p2p_deposit_withdraw_requests_tx_hash_unique UNIQUE (blockchain_tx_hash);


--
-- Name: p2p_dispute_evidence p2p_dispute_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_dispute_evidence
    ADD CONSTRAINT p2p_dispute_evidence_pkey PRIMARY KEY (id);


--
-- Name: p2p_featured_ads p2p_featured_ads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_featured_ads
    ADD CONSTRAINT p2p_featured_ads_pkey PRIMARY KEY (id);


--
-- Name: p2p_fiat_disputes p2p_fiat_disputes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_fiat_disputes
    ADD CONSTRAINT p2p_fiat_disputes_pkey PRIMARY KEY (id);


--
-- Name: p2p_fiat_offers p2p_fiat_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_fiat_offers
    ADD CONSTRAINT p2p_fiat_offers_pkey PRIMARY KEY (id);


--
-- Name: p2p_fiat_trades p2p_fiat_trades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_fiat_trades
    ADD CONSTRAINT p2p_fiat_trades_pkey PRIMARY KEY (id);


--
-- Name: p2p_fraud_reports p2p_fraud_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_fraud_reports
    ADD CONSTRAINT p2p_fraud_reports_pkey PRIMARY KEY (id);


--
-- Name: p2p_merchant_stats p2p_merchant_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_merchant_stats
    ADD CONSTRAINT p2p_merchant_stats_pkey PRIMARY KEY (user_id);


--
-- Name: p2p_merchant_tiers p2p_merchant_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_merchant_tiers
    ADD CONSTRAINT p2p_merchant_tiers_pkey PRIMARY KEY (user_id);


--
-- Name: p2p_messages p2p_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_messages
    ADD CONSTRAINT p2p_messages_pkey PRIMARY KEY (id);


--
-- Name: p2p_notifications p2p_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_notifications
    ADD CONSTRAINT p2p_notifications_pkey PRIMARY KEY (id);


--
-- Name: p2p_platform_escrow p2p_platform_escrow_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_platform_escrow
    ADD CONSTRAINT p2p_platform_escrow_pkey PRIMARY KEY (id);


--
-- Name: p2p_ratings p2p_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_ratings
    ADD CONSTRAINT p2p_ratings_pkey PRIMARY KEY (id);


--
-- Name: p2p_reputation p2p_reputation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_reputation
    ADD CONSTRAINT p2p_reputation_pkey PRIMARY KEY (user_id);


--
-- Name: p2p_suspicious_activity p2p_suspicious_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_suspicious_activity
    ADD CONSTRAINT p2p_suspicious_activity_pkey PRIMARY KEY (id);


--
-- Name: p2p_tier_requirements p2p_tier_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_tier_requirements
    ADD CONSTRAINT p2p_tier_requirements_pkey PRIMARY KEY (tier);


--
-- Name: p2p_trades p2p_trades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_trades
    ADD CONSTRAINT p2p_trades_pkey PRIMARY KEY (id);


--
-- Name: p2p_user_fraud_indicators p2p_user_fraud_indicators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_user_fraud_indicators
    ADD CONSTRAINT p2p_user_fraud_indicators_pkey PRIMARY KEY (user_id);


--
-- Name: p2p_user_payment_methods p2p_user_payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_user_payment_methods
    ADD CONSTRAINT p2p_user_payment_methods_pkey PRIMARY KEY (id);


--
-- Name: p2p_visa p2p_visa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_visa
    ADD CONSTRAINT p2p_visa_pkey PRIMARY KEY (id);


--
-- Name: p2p_visa p2p_visa_visa_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_visa
    ADD CONSTRAINT p2p_visa_visa_number_key UNIQUE (visa_number);


--
-- Name: p2p_visa p2p_visa_wallet_address_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_visa
    ADD CONSTRAINT p2p_visa_wallet_address_key UNIQUE (wallet_address);


--
-- Name: p2p_withdrawal_limits p2p_withdrawal_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_withdrawal_limits
    ADD CONSTRAINT p2p_withdrawal_limits_pkey PRIMARY KEY (user_id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_resource_action_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_resource_action_key UNIQUE (resource, action);


--
-- Name: platform_escrow_balance platform_escrow_balance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_escrow_balance
    ADD CONSTRAINT platform_escrow_balance_pkey PRIMARY KEY (token);


--
-- Name: platform_wallet_config platform_wallet_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_wallet_config
    ADD CONSTRAINT platform_wallet_config_pkey PRIMARY KEY (id);


--
-- Name: platform_wallet_config platform_wallet_config_wallet_type_wallet_address_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_wallet_config
    ADD CONSTRAINT platform_wallet_config_wallet_type_wallet_address_key UNIQUE (wallet_type, wallet_address);


--
-- Name: private_pools private_pools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_pools
    ADD CONSTRAINT private_pools_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_key UNIQUE (email);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: protected_transactions protected_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protected_transactions
    ADD CONSTRAINT protected_transactions_pkey PRIMARY KEY (id);


--
-- Name: recovery_logs recovery_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recovery_logs
    ADD CONSTRAINT recovery_logs_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: staking_positions staking_positions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staking_positions
    ADD CONSTRAINT staking_positions_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_key_key UNIQUE (key);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: tg_announcement_reactions tg_announcement_reactions_announcement_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_announcement_reactions
    ADD CONSTRAINT tg_announcement_reactions_announcement_id_user_id_key UNIQUE (announcement_id, user_id);


--
-- Name: tg_announcement_reactions tg_announcement_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_announcement_reactions
    ADD CONSTRAINT tg_announcement_reactions_pkey PRIMARY KEY (id);


--
-- Name: tg_announcements tg_announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_announcements
    ADD CONSTRAINT tg_announcements_pkey PRIMARY KEY (id);


--
-- Name: tg_deposits tg_deposits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_deposits
    ADD CONSTRAINT tg_deposits_pkey PRIMARY KEY (id);


--
-- Name: tg_deposits tg_deposits_tx_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_deposits
    ADD CONSTRAINT tg_deposits_tx_hash_unique UNIQUE (tx_hash);


--
-- Name: tg_replies tg_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_replies
    ADD CONSTRAINT tg_replies_pkey PRIMARY KEY (id);


--
-- Name: tg_reply_likes tg_reply_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_reply_likes
    ADD CONSTRAINT tg_reply_likes_pkey PRIMARY KEY (id);


--
-- Name: tg_reply_likes tg_reply_likes_reply_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_reply_likes
    ADD CONSTRAINT tg_reply_likes_reply_id_user_id_key UNIQUE (reply_id, user_id);


--
-- Name: tg_thread_likes tg_thread_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_thread_likes
    ADD CONSTRAINT tg_thread_likes_pkey PRIMARY KEY (id);


--
-- Name: tg_thread_likes tg_thread_likes_thread_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_thread_likes
    ADD CONSTRAINT tg_thread_likes_thread_id_user_id_key UNIQUE (thread_id, user_id);


--
-- Name: tg_threads tg_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_threads
    ADD CONSTRAINT tg_threads_pkey PRIMARY KEY (id);


--
-- Name: tg_user_deposit_codes tg_user_deposit_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_user_deposit_codes
    ADD CONSTRAINT tg_user_deposit_codes_code_key UNIQUE (code);


--
-- Name: tg_user_deposit_codes tg_user_deposit_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_user_deposit_codes
    ADD CONSTRAINT tg_user_deposit_codes_pkey PRIMARY KEY (id);


--
-- Name: tg_users tg_users_deposit_index_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_users
    ADD CONSTRAINT tg_users_deposit_index_key UNIQUE (deposit_index);


--
-- Name: tg_users tg_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_users
    ADD CONSTRAINT tg_users_pkey PRIMARY KEY (id);


--
-- Name: tg_users tg_users_telegram_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_users
    ADD CONSTRAINT tg_users_telegram_id_key UNIQUE (telegram_id);


--
-- Name: transaction_signatures transaction_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_signatures
    ADD CONSTRAINT transaction_signatures_pkey PRIMARY KEY (id);


--
-- Name: transaction_signatures transaction_signatures_transaction_id_signer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_signatures
    ADD CONSTRAINT transaction_signatures_transaction_id_signer_id_key UNIQUE (transaction_id, signer_id);


--
-- Name: two_factor_auth two_factor_auth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.two_factor_auth
    ADD CONSTRAINT two_factor_auth_pkey PRIMARY KEY (id);


--
-- Name: two_factor_auth two_factor_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.two_factor_auth
    ADD CONSTRAINT two_factor_auth_user_id_key UNIQUE (user_id);


--
-- Name: p2p_ratings unique_rating_per_trade; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_ratings
    ADD CONSTRAINT unique_rating_per_trade UNIQUE (trade_id, rater_id);


--
-- Name: tg_user_deposit_codes unique_user_deposit_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_user_deposit_codes
    ADD CONSTRAINT unique_user_deposit_code UNIQUE (user_id);


--
-- Name: user_internal_balances user_internal_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_internal_balances
    ADD CONSTRAINT user_internal_balances_pkey PRIMARY KEY (id);


--
-- Name: user_internal_balances user_internal_balances_user_id_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_internal_balances
    ADD CONSTRAINT user_internal_balances_user_id_token_key UNIQUE (user_id, token);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_token_key UNIQUE (token);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_telegram_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_telegram_id_key UNIQUE (telegram_id);


--
-- Name: validator_incentives validator_incentives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validator_incentives
    ADD CONSTRAINT validator_incentives_pkey PRIMARY KEY (id);


--
-- Name: validator_incentives validator_incentives_validator_address_chain_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validator_incentives
    ADD CONSTRAINT validator_incentives_validator_address_chain_id_key UNIQUE (validator_address, chain_id);


--
-- Name: wallet_connections wallet_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_connections
    ADD CONSTRAINT wallet_connections_pkey PRIMARY KEY (id);


--
-- Name: wallet_connections wallet_connections_user_id_chain_id_wallet_address_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_connections
    ADD CONSTRAINT wallet_connections_user_id_chain_id_wallet_address_key UNIQUE (user_id, chain_id, wallet_address);


--
-- Name: wallet_signers wallet_signers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_signers
    ADD CONSTRAINT wallet_signers_pkey PRIMARY KEY (id);


--
-- Name: wallet_signers wallet_signers_wallet_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_signers
    ADD CONSTRAINT wallet_signers_wallet_id_user_id_key UNIQUE (wallet_id, user_id);


--
-- Name: ai_chat_log_ip_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_chat_log_ip_created_at_idx ON public.ai_chat_log USING btree (ip, created_at DESC);


--
-- Name: idx_activity_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_action ON public.activity_logs USING btree (action);


--
-- Name: idx_activity_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs USING btree (created_at DESC);


--
-- Name: idx_activity_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_user_id ON public.activity_logs USING btree (user_id);


--
-- Name: idx_audit_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_created ON public.p2p_audit_log USING btree (created_at DESC);


--
-- Name: idx_audit_log_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_entity ON public.p2p_audit_log USING btree (entity_type, entity_id);


--
-- Name: idx_audit_log_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_user ON public.p2p_audit_log USING btree (user_id, created_at DESC);


--
-- Name: idx_balance_tx_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_balance_tx_created ON public.p2p_balance_transactions USING btree (created_at DESC);


--
-- Name: idx_balance_tx_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_balance_tx_type ON public.p2p_balance_transactions USING btree (transaction_type);


--
-- Name: idx_balance_tx_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_balance_tx_user ON public.p2p_balance_transactions USING btree (user_id);


--
-- Name: idx_batch_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_created ON public.batch_transactions USING btree (created_at DESC);


--
-- Name: idx_batch_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_status ON public.batch_transactions USING btree (status);


--
-- Name: idx_batch_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_user ON public.batch_transactions USING btree (user_id);


--
-- Name: idx_deposit_codes_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deposit_codes_code ON public.tg_user_deposit_codes USING btree (code);


--
-- Name: idx_deposit_withdraw_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deposit_withdraw_status ON public.p2p_deposit_withdraw_requests USING btree (status);


--
-- Name: idx_deposit_withdraw_tx_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deposit_withdraw_tx_hash ON public.p2p_deposit_withdraw_requests USING btree (blockchain_tx_hash) WHERE (blockchain_tx_hash IS NOT NULL);


--
-- Name: idx_deposit_withdraw_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deposit_withdraw_type ON public.p2p_deposit_withdraw_requests USING btree (request_type);


--
-- Name: idx_deposit_withdraw_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deposit_withdraw_user ON public.p2p_deposit_withdraw_requests USING btree (user_id);


--
-- Name: idx_deposits_network; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deposits_network ON public.tg_deposits USING btree (network);


--
-- Name: idx_deposits_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deposits_status ON public.tg_deposits USING btree (status);


--
-- Name: idx_deposits_status_retry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deposits_status_retry ON public.tg_deposits USING btree (status, retry_count) WHERE ((status)::text = 'confirming'::text);


--
-- Name: idx_deposits_tx_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deposits_tx_hash ON public.tg_deposits USING btree (tx_hash);


--
-- Name: idx_deposits_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deposits_user_id ON public.tg_deposits USING btree (user_id);


--
-- Name: idx_disputes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disputes_status ON public.p2p_fiat_disputes USING btree (status) WHERE (status = ANY (ARRAY['open'::text, 'under_review'::text]));


--
-- Name: idx_disputes_trade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disputes_trade ON public.p2p_fiat_disputes USING btree (trade_id);


--
-- Name: idx_fraud_indicators_blocked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fraud_indicators_blocked ON public.p2p_user_fraud_indicators USING btree (is_blocked) WHERE (is_blocked = true);


--
-- Name: idx_fraud_indicators_risk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fraud_indicators_risk ON public.p2p_user_fraud_indicators USING btree (risk_score DESC);


--
-- Name: idx_gas_prices_chain_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gas_prices_chain_timestamp ON public.gas_prices USING btree (chain_id, "timestamp" DESC);


--
-- Name: idx_gas_prices_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gas_prices_timestamp ON public.gas_prices USING btree ("timestamp" DESC);


--
-- Name: idx_internal_balances_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_internal_balances_token ON public.user_internal_balances USING btree (token);


--
-- Name: idx_internal_balances_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_internal_balances_user ON public.user_internal_balances USING btree (user_id);


--
-- Name: idx_mev_rewards_chain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mev_rewards_chain ON public.mev_rewards_history USING btree (chain_id);


--
-- Name: idx_mev_rewards_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mev_rewards_status ON public.mev_rewards_history USING btree (distribution_status);


--
-- Name: idx_mev_rewards_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mev_rewards_user ON public.mev_rewards_history USING btree (user_id);


--
-- Name: idx_mev_stats_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mev_stats_period ON public.mev_statistics USING btree (period_start, period_end);


--
-- Name: idx_multisig_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_multisig_status ON public.multi_sig_transactions USING btree (status);


--
-- Name: idx_multisig_wallet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_multisig_wallet ON public.multi_sig_transactions USING btree (wallet_id);


--
-- Name: idx_p2p_audit_log_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_audit_log_action ON public.p2p_audit_log USING btree (action);


--
-- Name: idx_p2p_buyer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_buyer ON public.p2p_trades USING btree (buyer_id);


--
-- Name: idx_p2p_challenge_nonces_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_challenge_nonces_created ON public.p2p_challenge_nonces USING btree (created_at);


--
-- Name: idx_p2p_evidence_dispute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_evidence_dispute ON public.p2p_dispute_evidence USING btree (dispute_id, created_at);


--
-- Name: idx_p2p_fraud_reported; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_fraud_reported ON public.p2p_fraud_reports USING btree (reported_user_id);


--
-- Name: idx_p2p_fraud_reporter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_fraud_reporter ON public.p2p_fraud_reports USING btree (reporter_id);


--
-- Name: idx_p2p_fraud_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_fraud_status ON public.p2p_fraud_reports USING btree (status) WHERE ((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('investigating'::character varying)::text]));


--
-- Name: idx_p2p_messages_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_messages_sender ON public.p2p_messages USING btree (sender_id);


--
-- Name: idx_p2p_messages_trade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_messages_trade ON public.p2p_messages USING btree (trade_id, created_at DESC);


--
-- Name: idx_p2p_messages_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_messages_unread ON public.p2p_messages USING btree (trade_id, is_read) WHERE (is_read = false);


--
-- Name: idx_p2p_notifications_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_notifications_unread ON public.p2p_notifications USING btree (user_id, is_read) WHERE (is_read = false);


--
-- Name: idx_p2p_notifications_unread_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_notifications_unread_count ON public.p2p_notifications USING btree (user_id) WHERE (is_read = false);


--
-- Name: idx_p2p_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_notifications_user ON public.p2p_notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_p2p_offers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_offers_active ON public.p2p_fiat_offers USING btree (status, fiat_currency, token) WHERE ((status = 'open'::text) AND (remaining_amount > (0)::numeric));


--
-- Name: idx_p2p_offers_currency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_offers_currency ON public.p2p_fiat_offers USING btree (fiat_currency, token);


--
-- Name: idx_p2p_offers_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_offers_featured ON public.p2p_fiat_offers USING btree (is_featured, featured_until) WHERE (is_featured = true);


--
-- Name: idx_p2p_offers_seller; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_offers_seller ON public.p2p_fiat_offers USING btree (seller_id);


--
-- Name: idx_p2p_offers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_offers_status ON public.p2p_fiat_offers USING btree (status) WHERE (status = ANY (ARRAY['open'::text, 'paused'::text]));


--
-- Name: idx_p2p_ratings_avg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_ratings_avg ON public.p2p_ratings USING btree (rated_id, rating);


--
-- Name: idx_p2p_ratings_rated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_ratings_rated ON public.p2p_ratings USING btree (rated_id, created_at DESC);


--
-- Name: idx_p2p_ratings_trade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_ratings_trade ON public.p2p_ratings USING btree (trade_id);


--
-- Name: idx_p2p_seller; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_seller ON public.p2p_trades USING btree (seller_id);


--
-- Name: idx_p2p_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_status ON public.p2p_trades USING btree (status);


--
-- Name: idx_p2p_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_token ON public.p2p_trades USING btree (token_type);


--
-- Name: idx_p2p_trades_buyer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_trades_buyer ON public.p2p_fiat_trades USING btree (buyer_id);


--
-- Name: idx_p2p_trades_deadlines; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_trades_deadlines ON public.p2p_fiat_trades USING btree (payment_deadline, confirmation_deadline) WHERE (status = ANY (ARRAY['pending'::text, 'payment_sent'::text]));


--
-- Name: idx_p2p_trades_offer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_trades_offer ON public.p2p_fiat_trades USING btree (offer_id);


--
-- Name: idx_p2p_trades_seller; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_trades_seller ON public.p2p_fiat_trades USING btree (seller_id);


--
-- Name: idx_p2p_trades_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_p2p_trades_status ON public.p2p_fiat_trades USING btree (status);


--
-- Name: idx_payment_methods_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_active ON public.payment_methods USING btree (is_active);


--
-- Name: idx_payment_methods_currency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_currency ON public.payment_methods USING btree (currency);


--
-- Name: idx_payment_methods_currency_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_currency_active ON public.payment_methods USING btree (currency, is_active);


--
-- Name: idx_payment_methods_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_type ON public.payment_methods USING btree (method_type);


--
-- Name: idx_platform_escrow_offer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_escrow_offer ON public.p2p_platform_escrow USING btree (offer_id);


--
-- Name: idx_platform_escrow_seller; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_escrow_seller ON public.p2p_platform_escrow USING btree (seller_id);


--
-- Name: idx_platform_escrow_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_escrow_status ON public.p2p_platform_escrow USING btree (status);


--
-- Name: idx_profiles_language; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_language ON public.profiles USING btree (language);


--
-- Name: idx_profiles_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_location ON public.profiles USING btree (location);


--
-- Name: idx_profiles_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_phone ON public.profiles USING btree (phone);


--
-- Name: idx_reputation_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reputation_score ON public.p2p_reputation USING btree (reputation_score DESC);


--
-- Name: idx_reputation_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reputation_verified ON public.p2p_reputation USING btree (verified_merchant) WHERE (verified_merchant = true);


--
-- Name: idx_routes_chains; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_routes_chains ON public.optimization_routes USING btree (from_chain, to_chain);


--
-- Name: idx_routes_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_routes_expires ON public.optimization_routes USING btree (expires_at);


--
-- Name: idx_staking_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staking_status ON public.staking_positions USING btree (status);


--
-- Name: idx_staking_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staking_token ON public.staking_positions USING btree (token_type);


--
-- Name: idx_staking_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staking_user ON public.staking_positions USING btree (user_id);


--
-- Name: idx_suspicious_activity_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suspicious_activity_status ON public.p2p_suspicious_activity USING btree (status) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_suspicious_activity_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suspicious_activity_user ON public.p2p_suspicious_activity USING btree (user_id, created_at DESC);


--
-- Name: idx_tg_announcements_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tg_announcements_created ON public.tg_announcements USING btree (created_at DESC);


--
-- Name: idx_tg_replies_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tg_replies_thread ON public.tg_replies USING btree (thread_id);


--
-- Name: idx_tg_threads_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tg_threads_activity ON public.tg_threads USING btree (last_activity DESC);


--
-- Name: idx_tg_threads_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tg_threads_created ON public.tg_threads USING btree (created_at DESC);


--
-- Name: idx_tg_users_p2p_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tg_users_p2p_user_id ON public.tg_users USING btree (p2p_user_id);


--
-- Name: idx_tg_users_telegram_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tg_users_telegram_id ON public.tg_users USING btree (telegram_id);


--
-- Name: idx_user_sessions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions USING btree (expires_at);


--
-- Name: idx_user_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_token ON public.user_sessions USING btree (token);


--
-- Name: idx_user_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);


--
-- Name: idx_users_deposit_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_deposit_index ON public.tg_users USING btree (deposit_index);


--
-- Name: idx_users_telegram_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_telegram_id ON public.users USING btree (telegram_id);


--
-- Name: idx_users_wallet_address; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_wallet_address ON public.users USING btree (wallet_address);


--
-- Name: idx_validator_chain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_validator_chain ON public.validator_incentives USING btree (chain_id);


--
-- Name: idx_validator_reputation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_validator_reputation ON public.validator_incentives USING btree (reputation_score DESC);


--
-- Name: idx_visa_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visa_status ON public.p2p_visa USING btree (status);


--
-- Name: idx_visa_wallet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visa_wallet ON public.p2p_visa USING btree (wallet_address);


--
-- Name: idx_wallet_signers; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wallet_signers ON public.wallet_signers USING btree (wallet_id);


--
-- Name: idx_withdraw_requests_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdraw_requests_pending ON public.p2p_deposit_withdraw_requests USING btree (user_id, status) WHERE ((request_type = 'withdraw'::text) AND (status = 'pending'::text));


--
-- Name: p2p_fiat_offers trg_freeze_offer_financials; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_freeze_offer_financials BEFORE UPDATE ON public.p2p_fiat_offers FOR EACH ROW EXECUTE FUNCTION public.enforce_offer_financial_immutability();


--
-- Name: p2p_fiat_trades trg_freeze_trade_financials; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_freeze_trade_financials BEFORE UPDATE ON public.p2p_fiat_trades FOR EACH ROW EXECUTE FUNCTION public.enforce_trade_financial_immutability();


--
-- Name: p2p_deposit_withdraw_requests trigger_calculate_withdraw_net; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_calculate_withdraw_net BEFORE INSERT ON public.p2p_deposit_withdraw_requests FOR EACH ROW EXECUTE FUNCTION public.calculate_withdraw_net_amount();


--
-- Name: tg_users trigger_create_deposit_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_create_deposit_code AFTER INSERT ON public.tg_users FOR EACH ROW EXECUTE FUNCTION public.create_user_deposit_code();


--
-- Name: p2p_deposit_withdraw_requests update_deposit_withdraw_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_deposit_withdraw_requests_updated_at BEFORE UPDATE ON public.p2p_deposit_withdraw_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: p2p_fiat_disputes update_p2p_disputes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_p2p_disputes_updated_at BEFORE UPDATE ON public.p2p_fiat_disputes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: p2p_fiat_offers update_p2p_offers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_p2p_offers_updated_at BEFORE UPDATE ON public.p2p_fiat_offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: p2p_fiat_trades update_p2p_trades_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_p2p_trades_updated_at BEFORE UPDATE ON public.p2p_fiat_trades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payment_methods update_payment_methods_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_internal_balances update_user_internal_balances_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_internal_balances_updated_at BEFORE UPDATE ON public.user_internal_balances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: admin_roles admin_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_roles
    ADD CONSTRAINT admin_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: backup_metadata backup_metadata_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_metadata
    ADD CONSTRAINT backup_metadata_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: backup_schedules backup_schedules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_schedules
    ADD CONSTRAINT backup_schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: batch_transactions batch_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_transactions
    ADD CONSTRAINT batch_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: bridge_transactions bridge_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bridge_transactions
    ADD CONSTRAINT bridge_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: cross_chain_proposals cross_chain_proposals_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cross_chain_proposals
    ADD CONSTRAINT cross_chain_proposals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: email_verification_tokens email_verification_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: forum_discussions forum_discussions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_discussions
    ADD CONSTRAINT forum_discussions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.forum_categories(id);


--
-- Name: forum_reactions forum_reactions_discussion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_reactions
    ADD CONSTRAINT forum_reactions_discussion_id_fkey FOREIGN KEY (discussion_id) REFERENCES public.forum_discussions(id) ON DELETE CASCADE;


--
-- Name: forum_reactions forum_reactions_reply_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_reactions
    ADD CONSTRAINT forum_reactions_reply_id_fkey FOREIGN KEY (reply_id) REFERENCES public.forum_replies(id) ON DELETE CASCADE;


--
-- Name: forum_replies forum_replies_discussion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_replies
    ADD CONSTRAINT forum_replies_discussion_id_fkey FOREIGN KEY (discussion_id) REFERENCES public.forum_discussions(id) ON DELETE CASCADE;


--
-- Name: forum_replies forum_replies_parent_reply_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_replies
    ADD CONSTRAINT forum_replies_parent_reply_id_fkey FOREIGN KEY (parent_reply_id) REFERENCES public.forum_replies(id);


--
-- Name: governance_permissions governance_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_permissions
    ADD CONSTRAINT governance_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.profiles(id);


--
-- Name: governance_permissions governance_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.governance_permissions
    ADD CONSTRAINT governance_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: mev_attacks_detected mev_attacks_detected_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mev_attacks_detected
    ADD CONSTRAINT mev_attacks_detected_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: mev_rewards_config mev_rewards_config_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mev_rewards_config
    ADD CONSTRAINT mev_rewards_config_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: mev_rewards_history mev_rewards_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mev_rewards_history
    ADD CONSTRAINT mev_rewards_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: multi_sig_transactions multi_sig_transactions_initiator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.multi_sig_transactions
    ADD CONSTRAINT multi_sig_transactions_initiator_id_fkey FOREIGN KEY (initiator_id) REFERENCES auth.users(id);


--
-- Name: multi_sig_transactions multi_sig_transactions_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.multi_sig_transactions
    ADD CONSTRAINT multi_sig_transactions_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.multi_sig_wallets(id) ON DELETE CASCADE;


--
-- Name: multi_sig_wallets multi_sig_wallets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.multi_sig_wallets
    ADD CONSTRAINT multi_sig_wallets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: p2p_dispute_evidence p2p_dispute_evidence_dispute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_dispute_evidence
    ADD CONSTRAINT p2p_dispute_evidence_dispute_id_fkey FOREIGN KEY (dispute_id) REFERENCES public.p2p_fiat_disputes(id) ON DELETE CASCADE;


--
-- Name: p2p_featured_ads p2p_featured_ads_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_featured_ads
    ADD CONSTRAINT p2p_featured_ads_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.p2p_fiat_offers(id) ON DELETE CASCADE;


--
-- Name: p2p_fiat_disputes p2p_fiat_disputes_trade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_fiat_disputes
    ADD CONSTRAINT p2p_fiat_disputes_trade_id_fkey FOREIGN KEY (trade_id) REFERENCES public.p2p_fiat_trades(id) ON DELETE CASCADE;


--
-- Name: p2p_fiat_offers p2p_fiat_offers_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_fiat_offers
    ADD CONSTRAINT p2p_fiat_offers_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id);


--
-- Name: p2p_fiat_trades p2p_fiat_trades_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_fiat_trades
    ADD CONSTRAINT p2p_fiat_trades_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.p2p_fiat_offers(id) ON DELETE CASCADE;


--
-- Name: p2p_fraud_reports p2p_fraud_reports_trade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_fraud_reports
    ADD CONSTRAINT p2p_fraud_reports_trade_id_fkey FOREIGN KEY (trade_id) REFERENCES public.p2p_fiat_trades(id);


--
-- Name: p2p_messages p2p_messages_trade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_messages
    ADD CONSTRAINT p2p_messages_trade_id_fkey FOREIGN KEY (trade_id) REFERENCES public.p2p_fiat_trades(id) ON DELETE CASCADE;


--
-- Name: p2p_platform_escrow p2p_platform_escrow_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_platform_escrow
    ADD CONSTRAINT p2p_platform_escrow_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.p2p_fiat_offers(id) ON DELETE CASCADE;


--
-- Name: p2p_platform_escrow p2p_platform_escrow_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_platform_escrow
    ADD CONSTRAINT p2p_platform_escrow_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id);


--
-- Name: p2p_ratings p2p_ratings_trade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_ratings
    ADD CONSTRAINT p2p_ratings_trade_id_fkey FOREIGN KEY (trade_id) REFERENCES public.p2p_fiat_trades(id) ON DELETE CASCADE;


--
-- Name: p2p_suspicious_activity p2p_suspicious_activity_trade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_suspicious_activity
    ADD CONSTRAINT p2p_suspicious_activity_trade_id_fkey FOREIGN KEY (trade_id) REFERENCES public.p2p_fiat_trades(id);


--
-- Name: p2p_user_payment_methods p2p_user_payment_methods_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.p2p_user_payment_methods
    ADD CONSTRAINT p2p_user_payment_methods_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id);


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: protected_transactions protected_transactions_pool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protected_transactions
    ADD CONSTRAINT protected_transactions_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES public.private_pools(id);


--
-- Name: protected_transactions protected_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.protected_transactions
    ADD CONSTRAINT protected_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: recovery_logs recovery_logs_backup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recovery_logs
    ADD CONSTRAINT recovery_logs_backup_id_fkey FOREIGN KEY (backup_id) REFERENCES public.backup_metadata(id);


--
-- Name: recovery_logs recovery_logs_initiated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recovery_logs
    ADD CONSTRAINT recovery_logs_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES auth.users(id);


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: staking_positions staking_positions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staking_positions
    ADD CONSTRAINT staking_positions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: system_settings system_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: tg_announcement_reactions tg_announcement_reactions_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_announcement_reactions
    ADD CONSTRAINT tg_announcement_reactions_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.tg_announcements(id) ON DELETE CASCADE;


--
-- Name: tg_announcement_reactions tg_announcement_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_announcement_reactions
    ADD CONSTRAINT tg_announcement_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.tg_users(id) ON DELETE CASCADE;


--
-- Name: tg_announcements tg_announcements_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_announcements
    ADD CONSTRAINT tg_announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.tg_users(id) ON DELETE CASCADE;


--
-- Name: tg_deposits tg_deposits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_deposits
    ADD CONSTRAINT tg_deposits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.tg_users(id) ON DELETE CASCADE;


--
-- Name: tg_replies tg_replies_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_replies
    ADD CONSTRAINT tg_replies_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.tg_users(id) ON DELETE CASCADE;


--
-- Name: tg_replies tg_replies_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_replies
    ADD CONSTRAINT tg_replies_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.tg_threads(id) ON DELETE CASCADE;


--
-- Name: tg_reply_likes tg_reply_likes_reply_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_reply_likes
    ADD CONSTRAINT tg_reply_likes_reply_id_fkey FOREIGN KEY (reply_id) REFERENCES public.tg_replies(id) ON DELETE CASCADE;


--
-- Name: tg_reply_likes tg_reply_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_reply_likes
    ADD CONSTRAINT tg_reply_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.tg_users(id) ON DELETE CASCADE;


--
-- Name: tg_thread_likes tg_thread_likes_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_thread_likes
    ADD CONSTRAINT tg_thread_likes_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.tg_threads(id) ON DELETE CASCADE;


--
-- Name: tg_thread_likes tg_thread_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_thread_likes
    ADD CONSTRAINT tg_thread_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.tg_users(id) ON DELETE CASCADE;


--
-- Name: tg_threads tg_threads_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_threads
    ADD CONSTRAINT tg_threads_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.tg_users(id) ON DELETE CASCADE;


--
-- Name: tg_user_deposit_codes tg_user_deposit_codes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tg_user_deposit_codes
    ADD CONSTRAINT tg_user_deposit_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.tg_users(id) ON DELETE CASCADE;


--
-- Name: transaction_signatures transaction_signatures_signer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_signatures
    ADD CONSTRAINT transaction_signatures_signer_id_fkey FOREIGN KEY (signer_id) REFERENCES auth.users(id);


--
-- Name: transaction_signatures transaction_signatures_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_signatures
    ADD CONSTRAINT transaction_signatures_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.multi_sig_transactions(id) ON DELETE CASCADE;


--
-- Name: two_factor_auth two_factor_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.two_factor_auth
    ADD CONSTRAINT two_factor_auth_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id);


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: wallet_connections wallet_connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_connections
    ADD CONSTRAINT wallet_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: wallet_signers wallet_signers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_signers
    ADD CONSTRAINT wallet_signers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: wallet_signers wallet_signers_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_signers
    ADD CONSTRAINT wallet_signers_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.multi_sig_wallets(id) ON DELETE CASCADE;


--
-- Name: p2p_platform_escrow Admins can view all escrow; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all escrow" ON public.p2p_platform_escrow FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));


--
-- Name: p2p_config Anyone can read p2p_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read p2p_config" ON public.p2p_config FOR SELECT USING (true);


--
-- Name: p2p_platform_escrow Sellers can view their escrow; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Sellers can view their escrow" ON public.p2p_platform_escrow FOR SELECT USING ((seller_id = auth.uid()));


--
-- Name: p2p_visa Service role full access on p2p_visa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access on p2p_visa" ON public.p2p_visa USING ((auth.role() = 'service_role'::text));


--
-- Name: tg_user_deposit_codes Service role full access to deposit codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to deposit codes" ON public.tg_user_deposit_codes USING ((auth.role() = 'service_role'::text));


--
-- Name: tg_deposits Service role full access to deposits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to deposits" ON public.tg_deposits USING ((auth.role() = 'service_role'::text));


--
-- Name: p2p_visa Users can read own visa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own visa" ON public.p2p_visa FOR SELECT USING (true);


--
-- Name: tg_user_deposit_codes Users can view own deposit code; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own deposit code" ON public.tg_user_deposit_codes FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: tg_deposits Users can view own deposits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own deposits" ON public.tg_deposits FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: activity_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_logs activity_logs_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activity_logs_del_svc ON public.activity_logs FOR DELETE TO service_role USING (true);


--
-- Name: activity_logs activity_logs_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activity_logs_ins_svc ON public.activity_logs FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: activity_logs activity_logs_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activity_logs_sel_svc ON public.activity_logs FOR SELECT TO service_role USING (true);


--
-- Name: activity_logs activity_logs_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY activity_logs_upd_svc ON public.activity_logs FOR UPDATE TO service_role USING (true);


--
-- Name: admin_announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_announcements admin_announcements_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_announcements_del_svc ON public.admin_announcements FOR DELETE TO service_role USING (true);


--
-- Name: admin_announcements admin_announcements_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_announcements_ins_svc ON public.admin_announcements FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: admin_announcements admin_announcements_sel_pub; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_announcements_sel_pub ON public.admin_announcements FOR SELECT TO authenticated, anon USING (true);


--
-- Name: admin_announcements admin_announcements_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_announcements_upd_svc ON public.admin_announcements FOR UPDATE TO service_role USING (true);


--
-- Name: admin_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_roles admin_roles_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_roles_del_svc ON public.admin_roles FOR DELETE TO service_role USING (true);


--
-- Name: admin_roles admin_roles_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_roles_ins_svc ON public.admin_roles FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: admin_roles admin_roles_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_roles_sel_svc ON public.admin_roles FOR SELECT TO service_role USING (true);


--
-- Name: admin_roles admin_roles_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_roles_upd_svc ON public.admin_roles FOR UPDATE TO service_role USING (true);


--
-- Name: ai_chat_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_chat_log ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_audit_log audit_log_anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_anon_insert ON public.p2p_audit_log FOR INSERT WITH CHECK (true);


--
-- Name: p2p_audit_log audit_log_service_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_service_select ON public.p2p_audit_log FOR SELECT USING ((auth.role() = 'service_role'::text));


--
-- Name: admin_roles authenticated_read_admin_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_read_admin_roles ON public.admin_roles FOR SELECT TO authenticated USING (true);


--
-- Name: backup_metadata; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_metadata ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_metadata backup_metadata_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY backup_metadata_del_svc ON public.backup_metadata FOR DELETE TO service_role USING (true);


--
-- Name: backup_metadata backup_metadata_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY backup_metadata_ins_svc ON public.backup_metadata FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: backup_metadata backup_metadata_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY backup_metadata_sel_svc ON public.backup_metadata FOR SELECT TO service_role USING (true);


--
-- Name: backup_metadata backup_metadata_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY backup_metadata_upd_svc ON public.backup_metadata FOR UPDATE TO service_role USING (true);


--
-- Name: backup_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_schedules backup_schedules_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY backup_schedules_del_svc ON public.backup_schedules FOR DELETE TO service_role USING (true);


--
-- Name: backup_schedules backup_schedules_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY backup_schedules_ins_svc ON public.backup_schedules FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: backup_schedules backup_schedules_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY backup_schedules_sel_svc ON public.backup_schedules FOR SELECT TO service_role USING (true);


--
-- Name: backup_schedules backup_schedules_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY backup_schedules_upd_svc ON public.backup_schedules FOR UPDATE TO service_role USING (true);


--
-- Name: batch_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.batch_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: batch_transactions batch_transactions_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY batch_transactions_del_svc ON public.batch_transactions FOR DELETE TO service_role USING (true);


--
-- Name: batch_transactions batch_transactions_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY batch_transactions_ins_svc ON public.batch_transactions FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: batch_transactions batch_transactions_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY batch_transactions_sel_svc ON public.batch_transactions FOR SELECT TO service_role USING (true);


--
-- Name: batch_transactions batch_transactions_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY batch_transactions_upd_svc ON public.batch_transactions FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_block_trade_requests block_trades_anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY block_trades_anon_insert ON public.p2p_block_trade_requests FOR INSERT WITH CHECK (true);


--
-- Name: p2p_block_trade_requests block_trades_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY block_trades_anon_select ON public.p2p_block_trade_requests FOR SELECT USING (true);


--
-- Name: bridge_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bridge_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: bridge_transactions bridge_transactions_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bridge_transactions_del_svc ON public.bridge_transactions FOR DELETE TO service_role USING (true);


--
-- Name: bridge_transactions bridge_transactions_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bridge_transactions_ins_svc ON public.bridge_transactions FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: bridge_transactions bridge_transactions_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bridge_transactions_sel_svc ON public.bridge_transactions FOR SELECT TO service_role USING (true);


--
-- Name: bridge_transactions bridge_transactions_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bridge_transactions_upd_svc ON public.bridge_transactions FOR UPDATE TO service_role USING (true);


--
-- Name: chain_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chain_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: chain_configs chain_configs_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chain_configs_del_svc ON public.chain_configs FOR DELETE TO service_role USING (true);


--
-- Name: chain_configs chain_configs_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chain_configs_ins_svc ON public.chain_configs FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: chain_configs chain_configs_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chain_configs_sel_svc ON public.chain_configs FOR SELECT TO service_role USING (true);


--
-- Name: chain_configs chain_configs_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chain_configs_upd_svc ON public.chain_configs FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_challenge_nonces challenge_nonces_service_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY challenge_nonces_service_only ON public.p2p_challenge_nonces USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: cross_chain_proposals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cross_chain_proposals ENABLE ROW LEVEL SECURITY;

--
-- Name: cross_chain_proposals cross_chain_proposals_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cross_chain_proposals_del_svc ON public.cross_chain_proposals FOR DELETE TO service_role USING (true);


--
-- Name: cross_chain_proposals cross_chain_proposals_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cross_chain_proposals_ins_svc ON public.cross_chain_proposals FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: cross_chain_proposals cross_chain_proposals_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cross_chain_proposals_sel_svc ON public.cross_chain_proposals FOR SELECT TO service_role USING (true);


--
-- Name: cross_chain_proposals cross_chain_proposals_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cross_chain_proposals_upd_svc ON public.cross_chain_proposals FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_deposit_withdraw_requests deposit_requests_service_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deposit_requests_service_write ON public.p2p_deposit_withdraw_requests USING ((auth.role() = 'service_role'::text));


--
-- Name: p2p_fiat_disputes disputes_anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY disputes_anon_insert ON public.p2p_fiat_disputes FOR INSERT WITH CHECK (true);


--
-- Name: p2p_fiat_disputes disputes_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY disputes_anon_select ON public.p2p_fiat_disputes FOR SELECT USING (true);


--
-- Name: p2p_fiat_disputes disputes_service_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY disputes_service_update ON public.p2p_fiat_disputes FOR UPDATE USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: email_verification_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: email_verification_tokens email_verification_tokens_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_verification_tokens_del_svc ON public.email_verification_tokens FOR DELETE TO service_role USING (true);


--
-- Name: email_verification_tokens email_verification_tokens_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_verification_tokens_ins_svc ON public.email_verification_tokens FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: email_verification_tokens email_verification_tokens_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_verification_tokens_sel_svc ON public.email_verification_tokens FOR SELECT TO service_role USING (true);


--
-- Name: email_verification_tokens email_verification_tokens_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_verification_tokens_upd_svc ON public.email_verification_tokens FOR UPDATE TO service_role USING (true);


--
-- Name: platform_escrow_balance escrow_balance_service_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY escrow_balance_service_only ON public.platform_escrow_balance USING ((auth.role() = 'service_role'::text));


--
-- Name: p2p_dispute_evidence evidence_anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evidence_anon_insert ON public.p2p_dispute_evidence FOR INSERT WITH CHECK (true);


--
-- Name: p2p_dispute_evidence evidence_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evidence_anon_select ON public.p2p_dispute_evidence FOR SELECT USING (true);


--
-- Name: forum_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: forum_categories forum_categories_all_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_categories_all_svc ON public.forum_categories TO service_role USING (true) WITH CHECK (true);


--
-- Name: forum_categories forum_categories_del_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_categories_del_auth ON public.forum_categories FOR DELETE TO authenticated USING (true);


--
-- Name: forum_categories forum_categories_ins_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_categories_ins_auth ON public.forum_categories FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: forum_categories forum_categories_sel_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_categories_sel_all ON public.forum_categories FOR SELECT TO authenticated, anon USING (true);


--
-- Name: forum_categories forum_categories_upd_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_categories_upd_auth ON public.forum_categories FOR UPDATE TO authenticated USING (true);


--
-- Name: forum_discussions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forum_discussions ENABLE ROW LEVEL SECURITY;

--
-- Name: forum_discussions forum_discussions_all_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_discussions_all_svc ON public.forum_discussions TO service_role USING (true) WITH CHECK (true);


--
-- Name: forum_discussions forum_discussions_del_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_discussions_del_auth ON public.forum_discussions FOR DELETE TO authenticated USING (true);


--
-- Name: forum_discussions forum_discussions_ins_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_discussions_ins_auth ON public.forum_discussions FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: forum_discussions forum_discussions_sel_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_discussions_sel_all ON public.forum_discussions FOR SELECT TO authenticated, anon USING (true);


--
-- Name: forum_discussions forum_discussions_upd_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_discussions_upd_auth ON public.forum_discussions FOR UPDATE TO authenticated USING (true);


--
-- Name: forum_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forum_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: forum_reactions forum_reactions_all_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_reactions_all_svc ON public.forum_reactions TO service_role USING (true) WITH CHECK (true);


--
-- Name: forum_reactions forum_reactions_del_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_reactions_del_auth ON public.forum_reactions FOR DELETE TO authenticated USING (true);


--
-- Name: forum_reactions forum_reactions_ins_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_reactions_ins_auth ON public.forum_reactions FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: forum_reactions forum_reactions_sel_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_reactions_sel_all ON public.forum_reactions FOR SELECT TO authenticated, anon USING (true);


--
-- Name: forum_reactions forum_reactions_upd_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_reactions_upd_auth ON public.forum_reactions FOR UPDATE TO authenticated USING (true);


--
-- Name: forum_replies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;

--
-- Name: forum_replies forum_replies_all_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_replies_all_svc ON public.forum_replies TO service_role USING (true) WITH CHECK (true);


--
-- Name: forum_replies forum_replies_del_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_replies_del_auth ON public.forum_replies FOR DELETE TO authenticated USING (true);


--
-- Name: forum_replies forum_replies_ins_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_replies_ins_auth ON public.forum_replies FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: forum_replies forum_replies_sel_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_replies_sel_all ON public.forum_replies FOR SELECT TO authenticated, anon USING (true);


--
-- Name: forum_replies forum_replies_upd_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_replies_upd_auth ON public.forum_replies FOR UPDATE TO authenticated USING (true);


--
-- Name: gas_prices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gas_prices ENABLE ROW LEVEL SECURITY;

--
-- Name: gas_prices gas_prices_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY gas_prices_del_svc ON public.gas_prices FOR DELETE TO service_role USING (true);


--
-- Name: gas_prices gas_prices_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY gas_prices_ins_svc ON public.gas_prices FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: gas_prices gas_prices_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY gas_prices_sel_svc ON public.gas_prices FOR SELECT TO service_role USING (true);


--
-- Name: gas_prices gas_prices_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY gas_prices_upd_svc ON public.gas_prices FOR UPDATE TO service_role USING (true);


--
-- Name: governance_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.governance_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: governance_permissions governance_permissions_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY governance_permissions_del_svc ON public.governance_permissions FOR DELETE TO service_role USING (true);


--
-- Name: governance_permissions governance_permissions_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY governance_permissions_ins_svc ON public.governance_permissions FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: governance_permissions governance_permissions_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY governance_permissions_sel_svc ON public.governance_permissions FOR SELECT TO service_role USING (true);


--
-- Name: governance_permissions governance_permissions_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY governance_permissions_upd_svc ON public.governance_permissions FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_merchant_stats merchant_stats_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY merchant_stats_anon_select ON public.p2p_merchant_stats FOR SELECT USING (true);


--
-- Name: p2p_merchant_tiers merchant_tiers_anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY merchant_tiers_anon_insert ON public.p2p_merchant_tiers FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: p2p_merchant_tiers merchant_tiers_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY merchant_tiers_anon_select ON public.p2p_merchant_tiers FOR SELECT USING (true);


--
-- Name: p2p_merchant_tiers merchant_tiers_anon_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY merchant_tiers_anon_update ON public.p2p_merchant_tiers FOR UPDATE TO authenticated, anon USING (true);


--
-- Name: p2p_merchant_tiers merchant_tiers_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY merchant_tiers_public_read ON public.p2p_merchant_tiers FOR SELECT TO authenticated, anon USING (true);


--
-- Name: p2p_messages messages_anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_anon_insert ON public.p2p_messages FOR INSERT WITH CHECK (true);


--
-- Name: p2p_messages messages_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_anon_select ON public.p2p_messages FOR SELECT USING (true);


--
-- Name: p2p_messages messages_anon_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_anon_update ON public.p2p_messages FOR UPDATE USING (true);


--
-- Name: mev_attacks_detected; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mev_attacks_detected ENABLE ROW LEVEL SECURITY;

--
-- Name: mev_attacks_detected mev_attacks_detected_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mev_attacks_detected_del_svc ON public.mev_attacks_detected FOR DELETE TO service_role USING (true);


--
-- Name: mev_attacks_detected mev_attacks_detected_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mev_attacks_detected_ins_svc ON public.mev_attacks_detected FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: mev_attacks_detected mev_attacks_detected_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mev_attacks_detected_sel_svc ON public.mev_attacks_detected FOR SELECT TO service_role USING (true);


--
-- Name: mev_attacks_detected mev_attacks_detected_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mev_attacks_detected_upd_svc ON public.mev_attacks_detected FOR UPDATE TO service_role USING (true);


--
-- Name: mev_protection_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mev_protection_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: mev_protection_configs mev_protection_configs_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mev_protection_configs_del_svc ON public.mev_protection_configs FOR DELETE TO service_role USING (true);


--
-- Name: mev_protection_configs mev_protection_configs_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mev_protection_configs_ins_svc ON public.mev_protection_configs FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: mev_protection_configs mev_protection_configs_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mev_protection_configs_sel_svc ON public.mev_protection_configs FOR SELECT TO service_role USING (true);


--
-- Name: mev_protection_configs mev_protection_configs_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mev_protection_configs_upd_svc ON public.mev_protection_configs FOR UPDATE TO service_role USING (true);


--
-- Name: mev_rewards_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mev_rewards_config ENABLE ROW LEVEL SECURITY;

--
-- Name: mev_rewards_config mev_rewards_config_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mev_rewards_config_del_svc ON public.mev_rewards_config FOR DELETE TO service_role USING (true);


--
-- Name: mev_rewards_config mev_rewards_config_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mev_rewards_config_ins_svc ON public.mev_rewards_config FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: mev_rewards_config mev_rewards_config_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mev_rewards_config_sel_svc ON public.mev_rewards_config FOR SELECT TO service_role USING (true);


--
-- Name: mev_rewards_config mev_rewards_config_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mev_rewards_config_upd_svc ON public.mev_rewards_config FOR UPDATE TO service_role USING (true);


--
-- Name: mev_rewards_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mev_rewards_history ENABLE ROW LEVEL SECURITY;

--
-- Name: mev_rewards_history mev_rewards_history_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mev_rewards_history_del_svc ON public.mev_rewards_history FOR DELETE TO service_role USING (true);


--
-- Name: mev_rewards_history mev_rewards_history_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mev_rewards_history_ins_svc ON public.mev_rewards_history FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: mev_rewards_history mev_rewards_history_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mev_rewards_history_sel_svc ON public.mev_rewards_history FOR SELECT TO service_role USING (true);


--
-- Name: mev_rewards_history mev_rewards_history_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mev_rewards_history_upd_svc ON public.mev_rewards_history FOR UPDATE TO service_role USING (true);


--
-- Name: mev_statistics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mev_statistics ENABLE ROW LEVEL SECURITY;

--
-- Name: mev_statistics mev_statistics_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mev_statistics_del_svc ON public.mev_statistics FOR DELETE TO service_role USING (true);


--
-- Name: mev_statistics mev_statistics_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mev_statistics_ins_svc ON public.mev_statistics FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: mev_statistics mev_statistics_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mev_statistics_sel_svc ON public.mev_statistics FOR SELECT TO service_role USING (true);


--
-- Name: mev_statistics mev_statistics_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mev_statistics_upd_svc ON public.mev_statistics FOR UPDATE TO service_role USING (true);


--
-- Name: multi_sig_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.multi_sig_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: multi_sig_transactions multi_sig_transactions_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY multi_sig_transactions_del_svc ON public.multi_sig_transactions FOR DELETE TO service_role USING (true);


--
-- Name: multi_sig_transactions multi_sig_transactions_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY multi_sig_transactions_ins_svc ON public.multi_sig_transactions FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: multi_sig_transactions multi_sig_transactions_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY multi_sig_transactions_sel_svc ON public.multi_sig_transactions FOR SELECT TO service_role USING (true);


--
-- Name: multi_sig_transactions multi_sig_transactions_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY multi_sig_transactions_upd_svc ON public.multi_sig_transactions FOR UPDATE TO service_role USING (true);


--
-- Name: multi_sig_wallets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.multi_sig_wallets ENABLE ROW LEVEL SECURITY;

--
-- Name: multi_sig_wallets multi_sig_wallets_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY multi_sig_wallets_del_svc ON public.multi_sig_wallets FOR DELETE TO service_role USING (true);


--
-- Name: multi_sig_wallets multi_sig_wallets_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY multi_sig_wallets_ins_svc ON public.multi_sig_wallets FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: multi_sig_wallets multi_sig_wallets_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY multi_sig_wallets_sel_svc ON public.multi_sig_wallets FOR SELECT TO service_role USING (true);


--
-- Name: multi_sig_wallets multi_sig_wallets_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY multi_sig_wallets_upd_svc ON public.multi_sig_wallets FOR UPDATE TO service_role USING (true);


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_notifications notifications_anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_anon_insert ON public.p2p_notifications FOR INSERT WITH CHECK (true);


--
-- Name: p2p_notifications notifications_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_anon_select ON public.p2p_notifications FOR SELECT USING (true);


--
-- Name: p2p_notifications notifications_anon_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_anon_update ON public.p2p_notifications FOR UPDATE USING (true);


--
-- Name: notifications notifications_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_del_svc ON public.notifications FOR DELETE TO service_role USING (true);


--
-- Name: notifications notifications_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_ins_svc ON public.notifications FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: notifications notifications_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_sel_svc ON public.notifications FOR SELECT TO service_role USING (true);


--
-- Name: notifications notifications_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_upd_svc ON public.notifications FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_fiat_offers offers_anon_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offers_anon_delete ON public.p2p_fiat_offers FOR DELETE USING (true);


--
-- Name: p2p_fiat_offers offers_anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offers_anon_insert ON public.p2p_fiat_offers FOR INSERT WITH CHECK (true);


--
-- Name: p2p_fiat_offers offers_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offers_anon_select ON public.p2p_fiat_offers FOR SELECT TO authenticated, anon USING (true);


--
-- Name: p2p_fiat_offers offers_anon_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY offers_anon_update ON public.p2p_fiat_offers FOR UPDATE USING (true);


--
-- Name: optimization_routes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.optimization_routes ENABLE ROW LEVEL SECURITY;

--
-- Name: optimization_routes optimization_routes_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY optimization_routes_del_svc ON public.optimization_routes FOR DELETE TO service_role USING (true);


--
-- Name: optimization_routes optimization_routes_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY optimization_routes_ins_svc ON public.optimization_routes FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: optimization_routes optimization_routes_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY optimization_routes_sel_svc ON public.optimization_routes FOR SELECT TO service_role USING (true);


--
-- Name: optimization_routes optimization_routes_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY optimization_routes_upd_svc ON public.optimization_routes FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_audit_log p2p_audit_log_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_audit_log_del_svc ON public.p2p_audit_log FOR DELETE TO service_role USING (true);


--
-- Name: p2p_audit_log p2p_audit_log_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_audit_log_ins_svc ON public.p2p_audit_log FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_audit_log p2p_audit_log_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_audit_log_sel_svc ON public.p2p_audit_log FOR SELECT TO service_role USING (true);


--
-- Name: p2p_audit_log p2p_audit_log_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_audit_log_upd_svc ON public.p2p_audit_log FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_balance_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_balance_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_balance_transactions p2p_balance_transactions_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_balance_transactions_del_svc ON public.p2p_balance_transactions FOR DELETE TO service_role USING (true);


--
-- Name: p2p_balance_transactions p2p_balance_transactions_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_balance_transactions_ins_svc ON public.p2p_balance_transactions FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_balance_transactions p2p_balance_transactions_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_balance_transactions_sel_svc ON public.p2p_balance_transactions FOR SELECT TO service_role USING (true);


--
-- Name: p2p_balance_transactions p2p_balance_transactions_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_balance_transactions_upd_svc ON public.p2p_balance_transactions FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_block_trade_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_block_trade_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_block_trade_requests p2p_block_trade_requests_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_block_trade_requests_del_svc ON public.p2p_block_trade_requests FOR DELETE TO service_role USING (true);


--
-- Name: p2p_block_trade_requests p2p_block_trade_requests_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_block_trade_requests_ins_svc ON public.p2p_block_trade_requests FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_block_trade_requests p2p_block_trade_requests_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_block_trade_requests_sel_svc ON public.p2p_block_trade_requests FOR SELECT TO service_role USING (true);


--
-- Name: p2p_block_trade_requests p2p_block_trade_requests_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_block_trade_requests_upd_svc ON public.p2p_block_trade_requests FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_challenge_nonces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_challenge_nonces ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_config ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_deposit_withdraw_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_deposit_withdraw_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_deposit_withdraw_requests p2p_deposit_withdraw_requests_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_deposit_withdraw_requests_del_svc ON public.p2p_deposit_withdraw_requests FOR DELETE TO service_role USING (true);


--
-- Name: p2p_deposit_withdraw_requests p2p_deposit_withdraw_requests_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_deposit_withdraw_requests_ins_svc ON public.p2p_deposit_withdraw_requests FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_deposit_withdraw_requests p2p_deposit_withdraw_requests_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_deposit_withdraw_requests_sel_svc ON public.p2p_deposit_withdraw_requests FOR SELECT TO service_role USING (true);


--
-- Name: p2p_deposit_withdraw_requests p2p_deposit_withdraw_requests_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_deposit_withdraw_requests_upd_svc ON public.p2p_deposit_withdraw_requests FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_dispute_evidence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_dispute_evidence ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_dispute_evidence p2p_dispute_evidence_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_dispute_evidence_del_svc ON public.p2p_dispute_evidence FOR DELETE TO service_role USING (true);


--
-- Name: p2p_dispute_evidence p2p_dispute_evidence_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_dispute_evidence_ins_svc ON public.p2p_dispute_evidence FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_dispute_evidence p2p_dispute_evidence_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_dispute_evidence_sel_svc ON public.p2p_dispute_evidence FOR SELECT TO service_role USING (true);


--
-- Name: p2p_dispute_evidence p2p_dispute_evidence_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_dispute_evidence_upd_svc ON public.p2p_dispute_evidence FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_featured_ads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_featured_ads ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_featured_ads p2p_featured_ads_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_featured_ads_del_svc ON public.p2p_featured_ads FOR DELETE TO service_role USING (true);


--
-- Name: p2p_featured_ads p2p_featured_ads_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_featured_ads_ins_svc ON public.p2p_featured_ads FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_featured_ads p2p_featured_ads_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_featured_ads_sel_svc ON public.p2p_featured_ads FOR SELECT TO service_role USING (true);


--
-- Name: p2p_featured_ads p2p_featured_ads_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_featured_ads_upd_svc ON public.p2p_featured_ads FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_fiat_disputes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_fiat_disputes ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_fiat_disputes p2p_fiat_disputes_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_fiat_disputes_del_svc ON public.p2p_fiat_disputes FOR DELETE TO service_role USING (true);


--
-- Name: p2p_fiat_disputes p2p_fiat_disputes_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_fiat_disputes_ins_svc ON public.p2p_fiat_disputes FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_fiat_disputes p2p_fiat_disputes_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_fiat_disputes_sel_svc ON public.p2p_fiat_disputes FOR SELECT TO service_role USING (true);


--
-- Name: p2p_fiat_disputes p2p_fiat_disputes_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_fiat_disputes_upd_svc ON public.p2p_fiat_disputes FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_fiat_offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_fiat_offers ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_fiat_offers p2p_fiat_offers_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_fiat_offers_del_svc ON public.p2p_fiat_offers FOR DELETE TO service_role USING (true);


--
-- Name: p2p_fiat_offers p2p_fiat_offers_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_fiat_offers_ins_svc ON public.p2p_fiat_offers FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_fiat_offers p2p_fiat_offers_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_fiat_offers_sel_svc ON public.p2p_fiat_offers FOR SELECT TO service_role USING (true);


--
-- Name: p2p_fiat_offers p2p_fiat_offers_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_fiat_offers_upd_svc ON public.p2p_fiat_offers FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_fiat_trades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_fiat_trades ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_fiat_trades p2p_fiat_trades_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_fiat_trades_del_svc ON public.p2p_fiat_trades FOR DELETE TO service_role USING (true);


--
-- Name: p2p_fiat_trades p2p_fiat_trades_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_fiat_trades_ins_svc ON public.p2p_fiat_trades FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_fiat_trades p2p_fiat_trades_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_fiat_trades_sel_svc ON public.p2p_fiat_trades FOR SELECT TO service_role USING (true);


--
-- Name: p2p_fiat_trades p2p_fiat_trades_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_fiat_trades_upd_svc ON public.p2p_fiat_trades FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_fraud_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_fraud_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_fraud_reports p2p_fraud_reports_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_fraud_reports_del_svc ON public.p2p_fraud_reports FOR DELETE TO service_role USING (true);


--
-- Name: p2p_fraud_reports p2p_fraud_reports_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_fraud_reports_ins_svc ON public.p2p_fraud_reports FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_fraud_reports p2p_fraud_reports_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_fraud_reports_sel_svc ON public.p2p_fraud_reports FOR SELECT TO service_role USING (true);


--
-- Name: p2p_fraud_reports p2p_fraud_reports_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_fraud_reports_upd_svc ON public.p2p_fraud_reports FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_merchant_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_merchant_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_merchant_stats p2p_merchant_stats_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_merchant_stats_del_svc ON public.p2p_merchant_stats FOR DELETE TO service_role USING (true);


--
-- Name: p2p_merchant_stats p2p_merchant_stats_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_merchant_stats_ins_svc ON public.p2p_merchant_stats FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_merchant_stats p2p_merchant_stats_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_merchant_stats_sel_svc ON public.p2p_merchant_stats FOR SELECT TO service_role USING (true);


--
-- Name: p2p_merchant_stats p2p_merchant_stats_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_merchant_stats_upd_svc ON public.p2p_merchant_stats FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_merchant_tiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_merchant_tiers ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_merchant_tiers p2p_merchant_tiers_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_merchant_tiers_del_svc ON public.p2p_merchant_tiers FOR DELETE TO service_role USING (true);


--
-- Name: p2p_merchant_tiers p2p_merchant_tiers_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_merchant_tiers_ins_svc ON public.p2p_merchant_tiers FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_merchant_tiers p2p_merchant_tiers_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_merchant_tiers_sel_svc ON public.p2p_merchant_tiers FOR SELECT TO service_role USING (true);


--
-- Name: p2p_merchant_tiers p2p_merchant_tiers_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_merchant_tiers_upd_svc ON public.p2p_merchant_tiers FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_messages p2p_messages_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_messages_del_svc ON public.p2p_messages FOR DELETE TO service_role USING (true);


--
-- Name: p2p_messages p2p_messages_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_messages_ins_svc ON public.p2p_messages FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_messages p2p_messages_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_messages_sel_svc ON public.p2p_messages FOR SELECT TO service_role USING (true);


--
-- Name: p2p_messages p2p_messages_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_messages_upd_svc ON public.p2p_messages FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_notifications p2p_notifications_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_notifications_del_svc ON public.p2p_notifications FOR DELETE TO service_role USING (true);


--
-- Name: p2p_notifications p2p_notifications_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_notifications_ins_svc ON public.p2p_notifications FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_notifications p2p_notifications_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_notifications_sel_svc ON public.p2p_notifications FOR SELECT TO service_role USING (true);


--
-- Name: p2p_notifications p2p_notifications_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_notifications_upd_svc ON public.p2p_notifications FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_platform_escrow; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_platform_escrow ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_ratings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_ratings ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_ratings p2p_ratings_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_ratings_del_svc ON public.p2p_ratings FOR DELETE TO service_role USING (true);


--
-- Name: p2p_ratings p2p_ratings_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_ratings_ins_svc ON public.p2p_ratings FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_ratings p2p_ratings_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_ratings_sel_svc ON public.p2p_ratings FOR SELECT TO service_role USING (true);


--
-- Name: p2p_ratings p2p_ratings_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_ratings_upd_svc ON public.p2p_ratings FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_reputation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_reputation ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_reputation p2p_reputation_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_reputation_del_svc ON public.p2p_reputation FOR DELETE TO service_role USING (true);


--
-- Name: p2p_reputation p2p_reputation_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_reputation_ins_svc ON public.p2p_reputation FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_reputation p2p_reputation_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_reputation_sel_svc ON public.p2p_reputation FOR SELECT TO service_role USING (true);


--
-- Name: p2p_reputation p2p_reputation_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_reputation_upd_svc ON public.p2p_reputation FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_suspicious_activity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_suspicious_activity ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_suspicious_activity p2p_suspicious_activity_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_suspicious_activity_del_svc ON public.p2p_suspicious_activity FOR DELETE TO service_role USING (true);


--
-- Name: p2p_suspicious_activity p2p_suspicious_activity_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_suspicious_activity_ins_svc ON public.p2p_suspicious_activity FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_suspicious_activity p2p_suspicious_activity_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_suspicious_activity_sel_svc ON public.p2p_suspicious_activity FOR SELECT TO service_role USING (true);


--
-- Name: p2p_suspicious_activity p2p_suspicious_activity_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_suspicious_activity_upd_svc ON public.p2p_suspicious_activity FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_tier_requirements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_tier_requirements ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_tier_requirements p2p_tier_requirements_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_tier_requirements_del_svc ON public.p2p_tier_requirements FOR DELETE TO service_role USING (true);


--
-- Name: p2p_tier_requirements p2p_tier_requirements_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_tier_requirements_ins_svc ON public.p2p_tier_requirements FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_tier_requirements p2p_tier_requirements_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_tier_requirements_sel_svc ON public.p2p_tier_requirements FOR SELECT TO service_role USING (true);


--
-- Name: p2p_tier_requirements p2p_tier_requirements_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_tier_requirements_upd_svc ON public.p2p_tier_requirements FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_trades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_trades ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_trades p2p_trades_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_trades_del_svc ON public.p2p_trades FOR DELETE TO service_role USING (true);


--
-- Name: p2p_trades p2p_trades_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_trades_ins_svc ON public.p2p_trades FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_trades p2p_trades_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_trades_sel_svc ON public.p2p_trades FOR SELECT TO service_role USING (true);


--
-- Name: p2p_trades p2p_trades_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_trades_upd_svc ON public.p2p_trades FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_user_fraud_indicators; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_user_fraud_indicators ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_user_fraud_indicators p2p_user_fraud_indicators_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_user_fraud_indicators_del_svc ON public.p2p_user_fraud_indicators FOR DELETE TO service_role USING (true);


--
-- Name: p2p_user_fraud_indicators p2p_user_fraud_indicators_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_user_fraud_indicators_ins_svc ON public.p2p_user_fraud_indicators FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_user_fraud_indicators p2p_user_fraud_indicators_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_user_fraud_indicators_sel_svc ON public.p2p_user_fraud_indicators FOR SELECT TO service_role USING (true);


--
-- Name: p2p_user_fraud_indicators p2p_user_fraud_indicators_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_user_fraud_indicators_upd_svc ON public.p2p_user_fraud_indicators FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_user_payment_methods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_user_payment_methods ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_user_payment_methods p2p_user_payment_methods_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_user_payment_methods_del_svc ON public.p2p_user_payment_methods FOR DELETE TO service_role USING (true);


--
-- Name: p2p_user_payment_methods p2p_user_payment_methods_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_user_payment_methods_ins_svc ON public.p2p_user_payment_methods FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_user_payment_methods p2p_user_payment_methods_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_user_payment_methods_sel_svc ON public.p2p_user_payment_methods FOR SELECT TO service_role USING (true);


--
-- Name: p2p_user_payment_methods p2p_user_payment_methods_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_user_payment_methods_upd_svc ON public.p2p_user_payment_methods FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_visa; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_visa ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_withdrawal_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.p2p_withdrawal_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: p2p_withdrawal_limits p2p_withdrawal_limits_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_withdrawal_limits_del_svc ON public.p2p_withdrawal_limits FOR DELETE TO service_role USING (true);


--
-- Name: p2p_withdrawal_limits p2p_withdrawal_limits_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_withdrawal_limits_ins_svc ON public.p2p_withdrawal_limits FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: p2p_withdrawal_limits p2p_withdrawal_limits_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_withdrawal_limits_sel_svc ON public.p2p_withdrawal_limits FOR SELECT TO service_role USING (true);


--
-- Name: p2p_withdrawal_limits p2p_withdrawal_limits_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p2p_withdrawal_limits_upd_svc ON public.p2p_withdrawal_limits FOR UPDATE TO service_role USING (true);


--
-- Name: password_reset_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: password_reset_tokens password_reset_tokens_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY password_reset_tokens_del_svc ON public.password_reset_tokens FOR DELETE TO service_role USING (true);


--
-- Name: password_reset_tokens password_reset_tokens_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY password_reset_tokens_ins_svc ON public.password_reset_tokens FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: password_reset_tokens password_reset_tokens_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY password_reset_tokens_sel_svc ON public.password_reset_tokens FOR SELECT TO service_role USING (true);


--
-- Name: password_reset_tokens password_reset_tokens_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY password_reset_tokens_upd_svc ON public.password_reset_tokens FOR UPDATE TO service_role USING (true);


--
-- Name: payment_methods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_methods payment_methods_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_methods_del_svc ON public.payment_methods FOR DELETE TO service_role USING (true);


--
-- Name: payment_methods payment_methods_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_methods_ins_svc ON public.payment_methods FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: payment_methods payment_methods_sel_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_methods_sel_public ON public.payment_methods FOR SELECT TO authenticated, anon USING ((is_active = true));


--
-- Name: payment_methods payment_methods_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_methods_sel_svc ON public.payment_methods FOR SELECT TO service_role USING (true);


--
-- Name: payment_methods payment_methods_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_methods_upd_svc ON public.payment_methods FOR UPDATE TO service_role USING (true);


--
-- Name: permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: permissions permissions_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY permissions_del_svc ON public.permissions FOR DELETE TO service_role USING (true);


--
-- Name: permissions permissions_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY permissions_ins_svc ON public.permissions FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: permissions permissions_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY permissions_sel_svc ON public.permissions FOR SELECT TO service_role USING (true);


--
-- Name: permissions permissions_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY permissions_upd_svc ON public.permissions FOR UPDATE TO service_role USING (true);


--
-- Name: platform_escrow_balance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_escrow_balance ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_escrow_balance platform_escrow_balance_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_escrow_balance_del_svc ON public.platform_escrow_balance FOR DELETE TO service_role USING (true);


--
-- Name: platform_escrow_balance platform_escrow_balance_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_escrow_balance_ins_svc ON public.platform_escrow_balance FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: platform_escrow_balance platform_escrow_balance_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_escrow_balance_sel_svc ON public.platform_escrow_balance FOR SELECT TO service_role USING (true);


--
-- Name: platform_escrow_balance platform_escrow_balance_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_escrow_balance_upd_svc ON public.platform_escrow_balance FOR UPDATE TO service_role USING (true);


--
-- Name: platform_wallet_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_wallet_config ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_wallet_config platform_wallet_config_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_wallet_config_del_svc ON public.platform_wallet_config FOR DELETE TO service_role USING (true);


--
-- Name: platform_wallet_config platform_wallet_config_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_wallet_config_ins_svc ON public.platform_wallet_config FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: platform_wallet_config platform_wallet_config_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_wallet_config_sel_svc ON public.platform_wallet_config FOR SELECT TO service_role USING (true);


--
-- Name: platform_wallet_config platform_wallet_config_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_wallet_config_upd_svc ON public.platform_wallet_config FOR UPDATE TO service_role USING (true);


--
-- Name: private_pools; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.private_pools ENABLE ROW LEVEL SECURITY;

--
-- Name: private_pools private_pools_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY private_pools_del_svc ON public.private_pools FOR DELETE TO service_role USING (true);


--
-- Name: private_pools private_pools_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY private_pools_ins_svc ON public.private_pools FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: private_pools private_pools_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY private_pools_sel_svc ON public.private_pools FOR SELECT TO service_role USING (true);


--
-- Name: private_pools private_pools_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY private_pools_upd_svc ON public.private_pools FOR UPDATE TO service_role USING (true);


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_del_svc ON public.profiles FOR DELETE TO service_role USING (true);


--
-- Name: profiles profiles_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_ins_svc ON public.profiles FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: profiles profiles_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_sel_svc ON public.profiles FOR SELECT TO service_role USING (true);


--
-- Name: profiles profiles_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_upd_svc ON public.profiles FOR UPDATE TO service_role USING (true);


--
-- Name: protected_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.protected_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: protected_transactions protected_transactions_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY protected_transactions_del_svc ON public.protected_transactions FOR DELETE TO service_role USING (true);


--
-- Name: protected_transactions protected_transactions_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY protected_transactions_ins_svc ON public.protected_transactions FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: protected_transactions protected_transactions_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY protected_transactions_sel_svc ON public.protected_transactions FOR SELECT TO service_role USING (true);


--
-- Name: protected_transactions protected_transactions_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY protected_transactions_upd_svc ON public.protected_transactions FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_ratings ratings_anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ratings_anon_insert ON public.p2p_ratings FOR INSERT WITH CHECK (true);


--
-- Name: p2p_ratings ratings_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ratings_anon_select ON public.p2p_ratings FOR SELECT USING (true);


--
-- Name: recovery_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recovery_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: recovery_logs recovery_logs_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recovery_logs_del_svc ON public.recovery_logs FOR DELETE TO service_role USING (true);


--
-- Name: recovery_logs recovery_logs_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recovery_logs_ins_svc ON public.recovery_logs FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: recovery_logs recovery_logs_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recovery_logs_sel_svc ON public.recovery_logs FOR SELECT TO service_role USING (true);


--
-- Name: recovery_logs recovery_logs_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recovery_logs_upd_svc ON public.recovery_logs FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_reputation reputation_anon_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reputation_anon_update ON public.p2p_reputation FOR UPDATE TO authenticated, anon USING (true);


--
-- Name: p2p_reputation reputation_anon_upsert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reputation_anon_upsert ON public.p2p_reputation FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: p2p_reputation reputation_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reputation_public_read ON public.p2p_reputation FOR SELECT TO authenticated, anon USING (true);


--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions role_permissions_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_permissions_del_svc ON public.role_permissions FOR DELETE TO service_role USING (true);


--
-- Name: role_permissions role_permissions_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_permissions_ins_svc ON public.role_permissions FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: role_permissions role_permissions_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_permissions_sel_svc ON public.role_permissions FOR SELECT TO service_role USING (true);


--
-- Name: role_permissions role_permissions_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_permissions_upd_svc ON public.role_permissions FOR UPDATE TO service_role USING (true);


--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: roles roles_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY roles_del_svc ON public.roles FOR DELETE TO service_role USING (true);


--
-- Name: roles roles_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY roles_ins_svc ON public.roles FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: roles roles_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY roles_sel_svc ON public.roles FOR SELECT TO service_role USING (true);


--
-- Name: roles roles_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY roles_upd_svc ON public.roles FOR UPDATE TO service_role USING (true);


--
-- Name: staking_positions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staking_positions ENABLE ROW LEVEL SECURITY;

--
-- Name: staking_positions staking_positions_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staking_positions_del_svc ON public.staking_positions FOR DELETE TO service_role USING (true);


--
-- Name: staking_positions staking_positions_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staking_positions_ins_svc ON public.staking_positions FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: staking_positions staking_positions_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staking_positions_sel_svc ON public.staking_positions FOR SELECT TO service_role USING (true);


--
-- Name: staking_positions staking_positions_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staking_positions_upd_svc ON public.staking_positions FOR UPDATE TO service_role USING (true);


--
-- Name: system_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: system_settings system_settings_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_settings_del_svc ON public.system_settings FOR DELETE TO service_role USING (true);


--
-- Name: system_settings system_settings_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_settings_ins_svc ON public.system_settings FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: system_settings system_settings_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_settings_sel_svc ON public.system_settings FOR SELECT TO service_role USING (true);


--
-- Name: system_settings system_settings_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_settings_upd_svc ON public.system_settings FOR UPDATE TO service_role USING (true);


--
-- Name: tg_announcement_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tg_announcement_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: tg_announcement_reactions tg_announcement_reactions_all_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_announcement_reactions_all_svc ON public.tg_announcement_reactions TO service_role USING (true) WITH CHECK (true);


--
-- Name: tg_announcement_reactions tg_announcement_reactions_del_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_announcement_reactions_del_auth ON public.tg_announcement_reactions FOR DELETE TO authenticated USING (true);


--
-- Name: tg_announcement_reactions tg_announcement_reactions_ins_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_announcement_reactions_ins_auth ON public.tg_announcement_reactions FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: tg_announcement_reactions tg_announcement_reactions_sel_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_announcement_reactions_sel_all ON public.tg_announcement_reactions FOR SELECT TO authenticated, anon USING (true);


--
-- Name: tg_announcement_reactions tg_announcement_reactions_upd_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_announcement_reactions_upd_auth ON public.tg_announcement_reactions FOR UPDATE TO authenticated USING (true);


--
-- Name: tg_announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tg_announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: tg_announcements tg_announcements_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_announcements_del_svc ON public.tg_announcements FOR DELETE TO service_role USING (true);


--
-- Name: tg_announcements tg_announcements_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_announcements_ins_svc ON public.tg_announcements FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: tg_announcements tg_announcements_sel_pub; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_announcements_sel_pub ON public.tg_announcements FOR SELECT TO authenticated, anon USING (true);


--
-- Name: tg_announcements tg_announcements_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_announcements_upd_svc ON public.tg_announcements FOR UPDATE TO service_role USING (true);


--
-- Name: tg_deposits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tg_deposits ENABLE ROW LEVEL SECURITY;

--
-- Name: tg_replies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tg_replies ENABLE ROW LEVEL SECURITY;

--
-- Name: tg_replies tg_replies_all_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_replies_all_svc ON public.tg_replies TO service_role USING (true) WITH CHECK (true);


--
-- Name: tg_replies tg_replies_del_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_replies_del_auth ON public.tg_replies FOR DELETE TO authenticated USING (true);


--
-- Name: tg_replies tg_replies_ins_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_replies_ins_auth ON public.tg_replies FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: tg_replies tg_replies_sel_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_replies_sel_all ON public.tg_replies FOR SELECT TO authenticated, anon USING (true);


--
-- Name: tg_replies tg_replies_upd_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_replies_upd_auth ON public.tg_replies FOR UPDATE TO authenticated USING (true);


--
-- Name: tg_reply_likes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tg_reply_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: tg_reply_likes tg_reply_likes_all_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_reply_likes_all_svc ON public.tg_reply_likes TO service_role USING (true) WITH CHECK (true);


--
-- Name: tg_reply_likes tg_reply_likes_del_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_reply_likes_del_auth ON public.tg_reply_likes FOR DELETE TO authenticated USING (true);


--
-- Name: tg_reply_likes tg_reply_likes_ins_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_reply_likes_ins_auth ON public.tg_reply_likes FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: tg_reply_likes tg_reply_likes_sel_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_reply_likes_sel_all ON public.tg_reply_likes FOR SELECT TO authenticated, anon USING (true);


--
-- Name: tg_reply_likes tg_reply_likes_upd_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_reply_likes_upd_auth ON public.tg_reply_likes FOR UPDATE TO authenticated USING (true);


--
-- Name: tg_thread_likes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tg_thread_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: tg_thread_likes tg_thread_likes_all_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_thread_likes_all_svc ON public.tg_thread_likes TO service_role USING (true) WITH CHECK (true);


--
-- Name: tg_thread_likes tg_thread_likes_del_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_thread_likes_del_auth ON public.tg_thread_likes FOR DELETE TO authenticated USING (true);


--
-- Name: tg_thread_likes tg_thread_likes_ins_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_thread_likes_ins_auth ON public.tg_thread_likes FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: tg_thread_likes tg_thread_likes_sel_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_thread_likes_sel_all ON public.tg_thread_likes FOR SELECT TO authenticated, anon USING (true);


--
-- Name: tg_thread_likes tg_thread_likes_upd_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_thread_likes_upd_auth ON public.tg_thread_likes FOR UPDATE TO authenticated USING (true);


--
-- Name: tg_threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tg_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: tg_threads tg_threads_all_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_threads_all_svc ON public.tg_threads TO service_role USING (true) WITH CHECK (true);


--
-- Name: tg_threads tg_threads_del_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_threads_del_auth ON public.tg_threads FOR DELETE TO authenticated USING (true);


--
-- Name: tg_threads tg_threads_ins_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_threads_ins_auth ON public.tg_threads FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: tg_threads tg_threads_sel_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_threads_sel_all ON public.tg_threads FOR SELECT TO authenticated, anon USING (true);


--
-- Name: tg_threads tg_threads_upd_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_threads_upd_auth ON public.tg_threads FOR UPDATE TO authenticated USING (true);


--
-- Name: tg_user_deposit_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tg_user_deposit_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: tg_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tg_users ENABLE ROW LEVEL SECURITY;

--
-- Name: tg_users tg_users_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_users_del_svc ON public.tg_users FOR DELETE TO service_role USING (true);


--
-- Name: tg_users tg_users_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_users_ins_svc ON public.tg_users FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: tg_users tg_users_sel_pub; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_users_sel_pub ON public.tg_users FOR SELECT TO authenticated, anon USING (true);


--
-- Name: tg_users tg_users_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tg_users_upd_svc ON public.tg_users FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_fiat_trades trades_anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trades_anon_insert ON public.p2p_fiat_trades FOR INSERT WITH CHECK (true);


--
-- Name: p2p_fiat_trades trades_anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trades_anon_select ON public.p2p_fiat_trades FOR SELECT USING (true);


--
-- Name: p2p_fiat_trades trades_anon_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trades_anon_update ON public.p2p_fiat_trades FOR UPDATE USING (true);


--
-- Name: transaction_signatures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transaction_signatures ENABLE ROW LEVEL SECURITY;

--
-- Name: transaction_signatures transaction_signatures_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transaction_signatures_del_svc ON public.transaction_signatures FOR DELETE TO service_role USING (true);


--
-- Name: transaction_signatures transaction_signatures_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transaction_signatures_ins_svc ON public.transaction_signatures FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: transaction_signatures transaction_signatures_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transaction_signatures_sel_svc ON public.transaction_signatures FOR SELECT TO service_role USING (true);


--
-- Name: transaction_signatures transaction_signatures_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transaction_signatures_upd_svc ON public.transaction_signatures FOR UPDATE TO service_role USING (true);


--
-- Name: two_factor_auth; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.two_factor_auth ENABLE ROW LEVEL SECURITY;

--
-- Name: two_factor_auth two_factor_auth_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY two_factor_auth_del_svc ON public.two_factor_auth FOR DELETE TO service_role USING (true);


--
-- Name: two_factor_auth two_factor_auth_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY two_factor_auth_ins_svc ON public.two_factor_auth FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: two_factor_auth two_factor_auth_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY two_factor_auth_sel_svc ON public.two_factor_auth FOR SELECT TO service_role USING (true);


--
-- Name: two_factor_auth two_factor_auth_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY two_factor_auth_upd_svc ON public.two_factor_auth FOR UPDATE TO service_role USING (true);


--
-- Name: user_internal_balances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_internal_balances ENABLE ROW LEVEL SECURITY;

--
-- Name: user_internal_balances user_internal_balances_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_internal_balances_del_svc ON public.user_internal_balances FOR DELETE TO service_role USING (true);


--
-- Name: user_internal_balances user_internal_balances_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_internal_balances_ins_svc ON public.user_internal_balances FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: user_internal_balances user_internal_balances_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_internal_balances_sel_svc ON public.user_internal_balances FOR SELECT TO service_role USING (true);


--
-- Name: user_internal_balances user_internal_balances_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_internal_balances_upd_svc ON public.user_internal_balances FOR UPDATE TO service_role USING (true);


--
-- Name: p2p_user_payment_methods user_pm_service_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_pm_service_only ON public.p2p_user_payment_methods USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_del_svc ON public.user_roles FOR DELETE TO service_role USING (true);


--
-- Name: user_roles user_roles_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_ins_svc ON public.user_roles FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: user_roles user_roles_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_sel_svc ON public.user_roles FOR SELECT TO service_role USING (true);


--
-- Name: user_roles user_roles_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_upd_svc ON public.user_roles FOR UPDATE TO service_role USING (true);


--
-- Name: user_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_sessions user_sessions_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_sessions_del_svc ON public.user_sessions FOR DELETE TO service_role USING (true);


--
-- Name: user_sessions user_sessions_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_sessions_ins_svc ON public.user_sessions FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: user_sessions user_sessions_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_sessions_sel_svc ON public.user_sessions FOR SELECT TO service_role USING (true);


--
-- Name: user_sessions user_sessions_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_sessions_upd_svc ON public.user_sessions FOR UPDATE TO service_role USING (true);


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users users_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_del_svc ON public.users FOR DELETE TO service_role USING (true);


--
-- Name: users users_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_ins_svc ON public.users FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: users users_sel_pub; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_sel_pub ON public.users FOR SELECT TO authenticated, anon USING (true);


--
-- Name: users users_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_upd_svc ON public.users FOR UPDATE TO service_role USING (true);


--
-- Name: validator_incentives; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.validator_incentives ENABLE ROW LEVEL SECURITY;

--
-- Name: validator_incentives validator_incentives_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY validator_incentives_del_svc ON public.validator_incentives FOR DELETE TO service_role USING (true);


--
-- Name: validator_incentives validator_incentives_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY validator_incentives_ins_svc ON public.validator_incentives FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: validator_incentives validator_incentives_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY validator_incentives_sel_svc ON public.validator_incentives FOR SELECT TO service_role USING (true);


--
-- Name: validator_incentives validator_incentives_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY validator_incentives_upd_svc ON public.validator_incentives FOR UPDATE TO service_role USING (true);


--
-- Name: wallet_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wallet_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: wallet_connections wallet_connections_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wallet_connections_del_svc ON public.wallet_connections FOR DELETE TO service_role USING (true);


--
-- Name: wallet_connections wallet_connections_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wallet_connections_ins_svc ON public.wallet_connections FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: wallet_connections wallet_connections_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wallet_connections_sel_svc ON public.wallet_connections FOR SELECT TO service_role USING (true);


--
-- Name: wallet_connections wallet_connections_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wallet_connections_upd_svc ON public.wallet_connections FOR UPDATE TO service_role USING (true);


--
-- Name: wallet_signers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wallet_signers ENABLE ROW LEVEL SECURITY;

--
-- Name: wallet_signers wallet_signers_del_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wallet_signers_del_svc ON public.wallet_signers FOR DELETE TO service_role USING (true);


--
-- Name: wallet_signers wallet_signers_ins_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wallet_signers_ins_svc ON public.wallet_signers FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: wallet_signers wallet_signers_sel_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wallet_signers_sel_svc ON public.wallet_signers FOR SELECT TO service_role USING (true);


--
-- Name: wallet_signers wallet_signers_upd_svc; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wallet_signers_upd_svc ON public.wallet_signers FOR UPDATE TO service_role USING (true);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION accept_p2p_offer(p_offer_id uuid, p_buyer_id uuid, p_buyer_wallet text, p_amount numeric); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.accept_p2p_offer(p_offer_id uuid, p_buyer_id uuid, p_buyer_wallet text, p_amount numeric) TO anon;
GRANT ALL ON FUNCTION public.accept_p2p_offer(p_offer_id uuid, p_buyer_id uuid, p_buyer_wallet text, p_amount numeric) TO authenticated;
GRANT ALL ON FUNCTION public.accept_p2p_offer(p_offer_id uuid, p_buyer_id uuid, p_buyer_wallet text, p_amount numeric) TO service_role;


--
-- Name: FUNCTION admin_resolve_dispute(p_dispute_id uuid, p_trade_id uuid, p_decision text, p_reasoning text, p_admin_ref text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_resolve_dispute(p_dispute_id uuid, p_trade_id uuid, p_decision text, p_reasoning text, p_admin_ref text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_resolve_dispute(p_dispute_id uuid, p_trade_id uuid, p_decision text, p_reasoning text, p_admin_ref text) TO service_role;


--
-- Name: FUNCTION apply_for_tier_upgrade(p_user_id uuid, p_target_tier character varying); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.apply_for_tier_upgrade(p_user_id uuid, p_target_tier character varying) TO anon;
GRANT ALL ON FUNCTION public.apply_for_tier_upgrade(p_user_id uuid, p_target_tier character varying) TO authenticated;
GRANT ALL ON FUNCTION public.apply_for_tier_upgrade(p_user_id uuid, p_target_tier character varying) TO service_role;


--
-- Name: FUNCTION calculate_withdraw_net_amount(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.calculate_withdraw_net_amount() TO anon;
GRANT ALL ON FUNCTION public.calculate_withdraw_net_amount() TO authenticated;
GRANT ALL ON FUNCTION public.calculate_withdraw_net_amount() TO service_role;


--
-- Name: FUNCTION cancel_expired_trades(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cancel_expired_trades() TO anon;
GRANT ALL ON FUNCTION public.cancel_expired_trades() TO authenticated;
GRANT ALL ON FUNCTION public.cancel_expired_trades() TO service_role;


--
-- Name: FUNCTION cancel_p2p_trade(p_trade_id uuid, p_user_id uuid, p_reason text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cancel_p2p_trade(p_trade_id uuid, p_user_id uuid, p_reason text) TO anon;
GRANT ALL ON FUNCTION public.cancel_p2p_trade(p_trade_id uuid, p_user_id uuid, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_p2p_trade(p_trade_id uuid, p_user_id uuid, p_reason text) TO service_role;


--
-- Name: FUNCTION check_tier_eligibility(p_user_id uuid, p_target_tier character varying); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.check_tier_eligibility(p_user_id uuid, p_target_tier character varying) TO anon;
GRANT ALL ON FUNCTION public.check_tier_eligibility(p_user_id uuid, p_target_tier character varying) TO authenticated;
GRANT ALL ON FUNCTION public.check_tier_eligibility(p_user_id uuid, p_target_tier character varying) TO service_role;


--
-- Name: FUNCTION check_withdrawal_limit(p_user_id uuid, p_amount numeric); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.check_withdrawal_limit(p_user_id uuid, p_amount numeric) TO anon;
GRANT ALL ON FUNCTION public.check_withdrawal_limit(p_user_id uuid, p_amount numeric) TO authenticated;
GRANT ALL ON FUNCTION public.check_withdrawal_limit(p_user_id uuid, p_amount numeric) TO service_role;


--
-- Name: FUNCTION cleanup_expired_payment_proofs(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cleanup_expired_payment_proofs() TO anon;
GRANT ALL ON FUNCTION public.cleanup_expired_payment_proofs() TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_expired_payment_proofs() TO service_role;


--
-- Name: FUNCTION complete_p2p_trade(p_trade_id uuid, p_seller_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.complete_p2p_trade(p_trade_id uuid, p_seller_id uuid) TO anon;
GRANT ALL ON FUNCTION public.complete_p2p_trade(p_trade_id uuid, p_seller_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.complete_p2p_trade(p_trade_id uuid, p_seller_id uuid) TO service_role;


--
-- Name: FUNCTION complete_withdraw(p_user_id uuid, p_token text, p_amount numeric, p_tx_hash text, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.complete_withdraw(p_user_id uuid, p_token text, p_amount numeric, p_tx_hash text, p_request_id uuid) TO anon;
GRANT ALL ON FUNCTION public.complete_withdraw(p_user_id uuid, p_token text, p_amount numeric, p_tx_hash text, p_request_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.complete_withdraw(p_user_id uuid, p_token text, p_amount numeric, p_tx_hash text, p_request_id uuid) TO service_role;


--
-- Name: FUNCTION create_p2p_notification(p_user_id uuid, p_type text, p_title text, p_message text, p_reference_type text, p_reference_id uuid, p_action_url text, p_metadata jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_p2p_notification(p_user_id uuid, p_type text, p_title text, p_message text, p_reference_type text, p_reference_id uuid, p_action_url text, p_metadata jsonb) TO anon;
GRANT ALL ON FUNCTION public.create_p2p_notification(p_user_id uuid, p_type text, p_title text, p_message text, p_reference_type text, p_reference_id uuid, p_action_url text, p_metadata jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.create_p2p_notification(p_user_id uuid, p_type text, p_title text, p_message text, p_reference_type text, p_reference_id uuid, p_action_url text, p_metadata jsonb) TO service_role;


--
-- Name: FUNCTION create_user_deposit_code(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_user_deposit_code() TO anon;
GRANT ALL ON FUNCTION public.create_user_deposit_code() TO authenticated;
GRANT ALL ON FUNCTION public.create_user_deposit_code() TO service_role;


--
-- Name: FUNCTION enforce_offer_financial_immutability(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.enforce_offer_financial_immutability() TO anon;
GRANT ALL ON FUNCTION public.enforce_offer_financial_immutability() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_offer_financial_immutability() TO service_role;


--
-- Name: FUNCTION enforce_trade_financial_immutability(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.enforce_trade_financial_immutability() TO anon;
GRANT ALL ON FUNCTION public.enforce_trade_financial_immutability() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_trade_financial_immutability() TO service_role;


--
-- Name: FUNCTION generate_deposit_code(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_deposit_code() TO anon;
GRANT ALL ON FUNCTION public.generate_deposit_code() TO authenticated;
GRANT ALL ON FUNCTION public.generate_deposit_code() TO service_role;


--
-- Name: FUNCTION generate_visa_number(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_visa_number() TO anon;
GRANT ALL ON FUNCTION public.generate_visa_number() TO authenticated;
GRANT ALL ON FUNCTION public.generate_visa_number() TO service_role;


--
-- Name: FUNCTION get_admin_user_ids(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_admin_user_ids() TO anon;
GRANT ALL ON FUNCTION public.get_admin_user_ids() TO authenticated;
GRANT ALL ON FUNCTION public.get_admin_user_ids() TO service_role;


--
-- Name: FUNCTION get_my_telegram_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_my_telegram_id() TO anon;
GRANT ALL ON FUNCTION public.get_my_telegram_id() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_telegram_id() TO service_role;


--
-- Name: FUNCTION get_my_tg_user_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_my_tg_user_id() TO anon;
GRANT ALL ON FUNCTION public.get_my_tg_user_id() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_tg_user_id() TO service_role;


--
-- Name: TABLE p2p_balance_transactions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_balance_transactions TO anon;
GRANT ALL ON TABLE public.p2p_balance_transactions TO authenticated;
GRANT ALL ON TABLE public.p2p_balance_transactions TO service_role;


--
-- Name: FUNCTION get_user_balance_transactions(p_user_id uuid, p_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_balance_transactions(p_user_id uuid, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.get_user_balance_transactions(p_user_id uuid, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_balance_transactions(p_user_id uuid, p_limit integer) TO service_role;


--
-- Name: TABLE p2p_deposit_withdraw_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_deposit_withdraw_requests TO anon;
GRANT ALL ON TABLE public.p2p_deposit_withdraw_requests TO authenticated;
GRANT ALL ON TABLE public.p2p_deposit_withdraw_requests TO service_role;


--
-- Name: FUNCTION get_user_deposit_withdraw_requests(p_user_id uuid, p_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_deposit_withdraw_requests(p_user_id uuid, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.get_user_deposit_withdraw_requests(p_user_id uuid, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_deposit_withdraw_requests(p_user_id uuid, p_limit integer) TO service_role;


--
-- Name: FUNCTION get_user_internal_balance(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_internal_balance(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_internal_balance(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_internal_balance(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION issue_p2p_visa(p_wallet_address text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.issue_p2p_visa(p_wallet_address text) TO anon;
GRANT ALL ON FUNCTION public.issue_p2p_visa(p_wallet_address text) TO authenticated;
GRANT ALL ON FUNCTION public.issue_p2p_visa(p_wallet_address text) TO service_role;


--
-- Name: FUNCTION lock_escrow_internal(p_user_id uuid, p_token text, p_amount numeric, p_reference_type text, p_reference_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.lock_escrow_internal(p_user_id uuid, p_token text, p_amount numeric, p_reference_type text, p_reference_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.lock_escrow_internal(p_user_id uuid, p_token text, p_amount numeric, p_reference_type text, p_reference_id uuid) TO service_role;


--
-- Name: FUNCTION moderator_clear_payment_proof(p_trade_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.moderator_clear_payment_proof(p_trade_id uuid) TO anon;
GRANT ALL ON FUNCTION public.moderator_clear_payment_proof(p_trade_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.moderator_clear_payment_proof(p_trade_id uuid) TO service_role;


--
-- Name: FUNCTION process_deposit(p_user_id uuid, p_token text, p_amount numeric, p_tx_hash text, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.process_deposit(p_user_id uuid, p_token text, p_amount numeric, p_tx_hash text, p_request_id uuid) TO anon;
GRANT ALL ON FUNCTION public.process_deposit(p_user_id uuid, p_token text, p_amount numeric, p_tx_hash text, p_request_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.process_deposit(p_user_id uuid, p_token text, p_amount numeric, p_tx_hash text, p_request_id uuid) TO service_role;


--
-- Name: FUNCTION record_withdrawal_limit(p_user_id uuid, p_amount numeric); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.record_withdrawal_limit(p_user_id uuid, p_amount numeric) TO anon;
GRANT ALL ON FUNCTION public.record_withdrawal_limit(p_user_id uuid, p_amount numeric) TO authenticated;
GRANT ALL ON FUNCTION public.record_withdrawal_limit(p_user_id uuid, p_amount numeric) TO service_role;


--
-- Name: FUNCTION refund_escrow_internal(p_user_id uuid, p_token text, p_amount numeric, p_reference_type text, p_reference_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.refund_escrow_internal(p_user_id uuid, p_token text, p_amount numeric, p_reference_type text, p_reference_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.refund_escrow_internal(p_user_id uuid, p_token text, p_amount numeric, p_reference_type text, p_reference_id uuid) TO service_role;


--
-- Name: FUNCTION release_escrow_internal(p_from_user_id uuid, p_to_user_id uuid, p_token text, p_amount numeric, p_reference_type text, p_reference_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.release_escrow_internal(p_from_user_id uuid, p_to_user_id uuid, p_token text, p_amount numeric, p_reference_type text, p_reference_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.release_escrow_internal(p_from_user_id uuid, p_to_user_id uuid, p_token text, p_amount numeric, p_reference_type text, p_reference_id uuid) TO service_role;


--
-- Name: FUNCTION request_withdraw(p_user_id uuid, p_token text, p_amount numeric, p_wallet_address text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.request_withdraw(p_user_id uuid, p_token text, p_amount numeric, p_wallet_address text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.request_withdraw(p_user_id uuid, p_token text, p_amount numeric, p_wallet_address text) TO service_role;


--
-- Name: FUNCTION resolve_p2p_dispute(p_trade_id uuid, p_resolution text, p_resolution_notes text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.resolve_p2p_dispute(p_trade_id uuid, p_resolution text, p_resolution_notes text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.resolve_p2p_dispute(p_trade_id uuid, p_resolution text, p_resolution_notes text) TO service_role;


--
-- Name: FUNCTION retain_payment_proof(p_trade_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.retain_payment_proof(p_trade_id uuid) TO anon;
GRANT ALL ON FUNCTION public.retain_payment_proof(p_trade_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.retain_payment_proof(p_trade_id uuid) TO service_role;


--
-- Name: FUNCTION submit_deposit_request(p_token text, p_amount numeric, p_tx_hash text, p_wallet_address text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.submit_deposit_request(p_token text, p_amount numeric, p_tx_hash text, p_wallet_address text) TO anon;
GRANT ALL ON FUNCTION public.submit_deposit_request(p_token text, p_amount numeric, p_tx_hash text, p_wallet_address text) TO authenticated;
GRANT ALL ON FUNCTION public.submit_deposit_request(p_token text, p_amount numeric, p_tx_hash text, p_wallet_address text) TO service_role;


--
-- Name: FUNCTION update_p2p_reputation(p_seller_id uuid, p_buyer_id uuid, p_trade_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_p2p_reputation(p_seller_id uuid, p_buyer_id uuid, p_trade_id uuid) TO anon;
GRANT ALL ON FUNCTION public.update_p2p_reputation(p_seller_id uuid, p_buyer_id uuid, p_trade_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.update_p2p_reputation(p_seller_id uuid, p_buyer_id uuid, p_trade_id uuid) TO service_role;


--
-- Name: FUNCTION update_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at() TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: FUNCTION upsert_user_profile(p_username text, p_full_name text, p_bio text, p_phone_number text, p_location text, p_website text, p_language text, p_theme text, p_notifications_email boolean, p_notifications_push boolean, p_notifications_sms boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.upsert_user_profile(p_username text, p_full_name text, p_bio text, p_phone_number text, p_location text, p_website text, p_language text, p_theme text, p_notifications_email boolean, p_notifications_push boolean, p_notifications_sms boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.upsert_user_profile(p_username text, p_full_name text, p_bio text, p_phone_number text, p_location text, p_website text, p_language text, p_theme text, p_notifications_email boolean, p_notifications_push boolean, p_notifications_sms boolean) TO anon;
GRANT ALL ON FUNCTION public.upsert_user_profile(p_username text, p_full_name text, p_bio text, p_phone_number text, p_location text, p_website text, p_language text, p_theme text, p_notifications_email boolean, p_notifications_push boolean, p_notifications_sms boolean) TO authenticated;
GRANT ALL ON FUNCTION public.upsert_user_profile(p_username text, p_full_name text, p_bio text, p_phone_number text, p_location text, p_website text, p_language text, p_theme text, p_notifications_email boolean, p_notifications_push boolean, p_notifications_sms boolean) TO service_role;


--
-- Name: TABLE activity_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.activity_logs TO anon;
GRANT ALL ON TABLE public.activity_logs TO authenticated;
GRANT ALL ON TABLE public.activity_logs TO service_role;


--
-- Name: TABLE admin_announcements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_announcements TO anon;
GRANT ALL ON TABLE public.admin_announcements TO authenticated;
GRANT ALL ON TABLE public.admin_announcements TO service_role;


--
-- Name: TABLE admin_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_roles TO anon;
GRANT ALL ON TABLE public.admin_roles TO authenticated;
GRANT ALL ON TABLE public.admin_roles TO service_role;


--
-- Name: TABLE ai_chat_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_chat_log TO service_role;


--
-- Name: SEQUENCE ai_chat_log_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.ai_chat_log_id_seq TO anon;
GRANT ALL ON SEQUENCE public.ai_chat_log_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.ai_chat_log_id_seq TO service_role;


--
-- Name: TABLE backup_metadata; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.backup_metadata TO anon;
GRANT ALL ON TABLE public.backup_metadata TO authenticated;
GRANT ALL ON TABLE public.backup_metadata TO service_role;


--
-- Name: TABLE backup_schedules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.backup_schedules TO anon;
GRANT ALL ON TABLE public.backup_schedules TO authenticated;
GRANT ALL ON TABLE public.backup_schedules TO service_role;


--
-- Name: TABLE batch_transactions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.batch_transactions TO anon;
GRANT ALL ON TABLE public.batch_transactions TO authenticated;
GRANT ALL ON TABLE public.batch_transactions TO service_role;


--
-- Name: TABLE bridge_transactions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.bridge_transactions TO anon;
GRANT ALL ON TABLE public.bridge_transactions TO authenticated;
GRANT ALL ON TABLE public.bridge_transactions TO service_role;


--
-- Name: TABLE chain_configs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chain_configs TO anon;
GRANT ALL ON TABLE public.chain_configs TO authenticated;
GRANT ALL ON TABLE public.chain_configs TO service_role;


--
-- Name: TABLE cross_chain_proposals; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cross_chain_proposals TO anon;
GRANT ALL ON TABLE public.cross_chain_proposals TO authenticated;
GRANT ALL ON TABLE public.cross_chain_proposals TO service_role;


--
-- Name: TABLE email_verification_tokens; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_verification_tokens TO anon;
GRANT ALL ON TABLE public.email_verification_tokens TO authenticated;
GRANT ALL ON TABLE public.email_verification_tokens TO service_role;


--
-- Name: TABLE forum_categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.forum_categories TO anon;
GRANT ALL ON TABLE public.forum_categories TO authenticated;
GRANT ALL ON TABLE public.forum_categories TO service_role;


--
-- Name: TABLE forum_discussions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.forum_discussions TO anon;
GRANT ALL ON TABLE public.forum_discussions TO authenticated;
GRANT ALL ON TABLE public.forum_discussions TO service_role;


--
-- Name: TABLE forum_reactions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.forum_reactions TO anon;
GRANT ALL ON TABLE public.forum_reactions TO authenticated;
GRANT ALL ON TABLE public.forum_reactions TO service_role;


--
-- Name: TABLE forum_replies; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.forum_replies TO anon;
GRANT ALL ON TABLE public.forum_replies TO authenticated;
GRANT ALL ON TABLE public.forum_replies TO service_role;


--
-- Name: TABLE gas_prices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.gas_prices TO anon;
GRANT ALL ON TABLE public.gas_prices TO authenticated;
GRANT ALL ON TABLE public.gas_prices TO service_role;


--
-- Name: TABLE governance_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.governance_permissions TO anon;
GRANT ALL ON TABLE public.governance_permissions TO authenticated;
GRANT ALL ON TABLE public.governance_permissions TO service_role;


--
-- Name: TABLE mev_attacks_detected; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mev_attacks_detected TO anon;
GRANT ALL ON TABLE public.mev_attacks_detected TO authenticated;
GRANT ALL ON TABLE public.mev_attacks_detected TO service_role;


--
-- Name: TABLE mev_protection_configs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mev_protection_configs TO anon;
GRANT ALL ON TABLE public.mev_protection_configs TO authenticated;
GRANT ALL ON TABLE public.mev_protection_configs TO service_role;


--
-- Name: TABLE mev_rewards_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mev_rewards_config TO anon;
GRANT ALL ON TABLE public.mev_rewards_config TO authenticated;
GRANT ALL ON TABLE public.mev_rewards_config TO service_role;


--
-- Name: TABLE mev_rewards_history; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mev_rewards_history TO anon;
GRANT ALL ON TABLE public.mev_rewards_history TO authenticated;
GRANT ALL ON TABLE public.mev_rewards_history TO service_role;


--
-- Name: TABLE mev_statistics; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mev_statistics TO anon;
GRANT ALL ON TABLE public.mev_statistics TO authenticated;
GRANT ALL ON TABLE public.mev_statistics TO service_role;


--
-- Name: TABLE multi_sig_transactions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.multi_sig_transactions TO anon;
GRANT ALL ON TABLE public.multi_sig_transactions TO authenticated;
GRANT ALL ON TABLE public.multi_sig_transactions TO service_role;


--
-- Name: TABLE multi_sig_wallets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.multi_sig_wallets TO anon;
GRANT ALL ON TABLE public.multi_sig_wallets TO authenticated;
GRANT ALL ON TABLE public.multi_sig_wallets TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE optimization_routes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.optimization_routes TO anon;
GRANT ALL ON TABLE public.optimization_routes TO authenticated;
GRANT ALL ON TABLE public.optimization_routes TO service_role;


--
-- Name: TABLE p2p_audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_audit_log TO anon;
GRANT ALL ON TABLE public.p2p_audit_log TO authenticated;
GRANT ALL ON TABLE public.p2p_audit_log TO service_role;


--
-- Name: TABLE p2p_block_trade_requests; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_block_trade_requests TO anon;
GRANT ALL ON TABLE public.p2p_block_trade_requests TO authenticated;
GRANT ALL ON TABLE public.p2p_block_trade_requests TO service_role;


--
-- Name: TABLE p2p_challenge_nonces; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_challenge_nonces TO service_role;


--
-- Name: TABLE p2p_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_config TO anon;
GRANT ALL ON TABLE public.p2p_config TO authenticated;
GRANT ALL ON TABLE public.p2p_config TO service_role;


--
-- Name: TABLE p2p_dispute_evidence; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_dispute_evidence TO anon;
GRANT ALL ON TABLE public.p2p_dispute_evidence TO authenticated;
GRANT ALL ON TABLE public.p2p_dispute_evidence TO service_role;


--
-- Name: TABLE p2p_featured_ads; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_featured_ads TO anon;
GRANT ALL ON TABLE public.p2p_featured_ads TO authenticated;
GRANT ALL ON TABLE public.p2p_featured_ads TO service_role;


--
-- Name: TABLE p2p_fiat_disputes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_fiat_disputes TO anon;
GRANT ALL ON TABLE public.p2p_fiat_disputes TO authenticated;
GRANT ALL ON TABLE public.p2p_fiat_disputes TO service_role;


--
-- Name: TABLE p2p_fiat_offers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_fiat_offers TO anon;
GRANT ALL ON TABLE public.p2p_fiat_offers TO authenticated;
GRANT ALL ON TABLE public.p2p_fiat_offers TO service_role;


--
-- Name: TABLE p2p_fiat_trades; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_fiat_trades TO anon;
GRANT ALL ON TABLE public.p2p_fiat_trades TO authenticated;
GRANT ALL ON TABLE public.p2p_fiat_trades TO service_role;


--
-- Name: TABLE p2p_fraud_reports; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_fraud_reports TO anon;
GRANT ALL ON TABLE public.p2p_fraud_reports TO authenticated;
GRANT ALL ON TABLE public.p2p_fraud_reports TO service_role;


--
-- Name: TABLE p2p_merchant_stats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_merchant_stats TO anon;
GRANT ALL ON TABLE public.p2p_merchant_stats TO authenticated;
GRANT ALL ON TABLE public.p2p_merchant_stats TO service_role;


--
-- Name: TABLE p2p_merchant_tiers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_merchant_tiers TO anon;
GRANT ALL ON TABLE public.p2p_merchant_tiers TO authenticated;
GRANT ALL ON TABLE public.p2p_merchant_tiers TO service_role;


--
-- Name: TABLE p2p_messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_messages TO anon;
GRANT ALL ON TABLE public.p2p_messages TO authenticated;
GRANT ALL ON TABLE public.p2p_messages TO service_role;


--
-- Name: TABLE p2p_notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_notifications TO anon;
GRANT ALL ON TABLE public.p2p_notifications TO authenticated;
GRANT ALL ON TABLE public.p2p_notifications TO service_role;


--
-- Name: TABLE p2p_platform_escrow; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_platform_escrow TO anon;
GRANT ALL ON TABLE public.p2p_platform_escrow TO authenticated;
GRANT ALL ON TABLE public.p2p_platform_escrow TO service_role;


--
-- Name: TABLE p2p_ratings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_ratings TO anon;
GRANT ALL ON TABLE public.p2p_ratings TO authenticated;
GRANT ALL ON TABLE public.p2p_ratings TO service_role;


--
-- Name: TABLE p2p_reputation; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_reputation TO anon;
GRANT ALL ON TABLE public.p2p_reputation TO authenticated;
GRANT ALL ON TABLE public.p2p_reputation TO service_role;


--
-- Name: TABLE p2p_suspicious_activity; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_suspicious_activity TO anon;
GRANT ALL ON TABLE public.p2p_suspicious_activity TO authenticated;
GRANT ALL ON TABLE public.p2p_suspicious_activity TO service_role;


--
-- Name: TABLE p2p_tier_requirements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_tier_requirements TO anon;
GRANT ALL ON TABLE public.p2p_tier_requirements TO authenticated;
GRANT ALL ON TABLE public.p2p_tier_requirements TO service_role;


--
-- Name: TABLE p2p_trades; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_trades TO anon;
GRANT ALL ON TABLE public.p2p_trades TO authenticated;
GRANT ALL ON TABLE public.p2p_trades TO service_role;


--
-- Name: TABLE p2p_user_fraud_indicators; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_user_fraud_indicators TO anon;
GRANT ALL ON TABLE public.p2p_user_fraud_indicators TO authenticated;
GRANT ALL ON TABLE public.p2p_user_fraud_indicators TO service_role;


--
-- Name: TABLE p2p_user_payment_methods; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_user_payment_methods TO service_role;


--
-- Name: TABLE p2p_visa; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_visa TO anon;
GRANT ALL ON TABLE public.p2p_visa TO authenticated;
GRANT ALL ON TABLE public.p2p_visa TO service_role;


--
-- Name: TABLE p2p_withdrawal_limits; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.p2p_withdrawal_limits TO anon;
GRANT ALL ON TABLE public.p2p_withdrawal_limits TO authenticated;
GRANT ALL ON TABLE public.p2p_withdrawal_limits TO service_role;


--
-- Name: TABLE password_reset_tokens; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.password_reset_tokens TO anon;
GRANT ALL ON TABLE public.password_reset_tokens TO authenticated;
GRANT ALL ON TABLE public.password_reset_tokens TO service_role;


--
-- Name: TABLE payment_methods; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payment_methods TO anon;
GRANT ALL ON TABLE public.payment_methods TO authenticated;
GRANT ALL ON TABLE public.payment_methods TO service_role;


--
-- Name: TABLE permissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.permissions TO anon;
GRANT ALL ON TABLE public.permissions TO authenticated;
GRANT ALL ON TABLE public.permissions TO service_role;


--
-- Name: TABLE platform_escrow_balance; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_escrow_balance TO anon;
GRANT ALL ON TABLE public.platform_escrow_balance TO authenticated;
GRANT ALL ON TABLE public.platform_escrow_balance TO service_role;


--
-- Name: TABLE platform_wallet_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.platform_wallet_config TO anon;
GRANT ALL ON TABLE public.platform_wallet_config TO authenticated;
GRANT ALL ON TABLE public.platform_wallet_config TO service_role;


--
-- Name: SEQUENCE platform_wallet_config_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.platform_wallet_config_id_seq TO anon;
GRANT ALL ON SEQUENCE public.platform_wallet_config_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.platform_wallet_config_id_seq TO service_role;


--
-- Name: TABLE private_pools; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.private_pools TO anon;
GRANT ALL ON TABLE public.private_pools TO authenticated;
GRANT ALL ON TABLE public.private_pools TO service_role;


--
-- Name: TABLE protected_transactions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.protected_transactions TO anon;
GRANT ALL ON TABLE public.protected_transactions TO authenticated;
GRANT ALL ON TABLE public.protected_transactions TO service_role;


--
-- Name: TABLE recovery_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.recovery_logs TO anon;
GRANT ALL ON TABLE public.recovery_logs TO authenticated;
GRANT ALL ON TABLE public.recovery_logs TO service_role;


--
-- Name: TABLE role_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.role_permissions TO anon;
GRANT ALL ON TABLE public.role_permissions TO authenticated;
GRANT ALL ON TABLE public.role_permissions TO service_role;


--
-- Name: TABLE roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.roles TO anon;
GRANT ALL ON TABLE public.roles TO authenticated;
GRANT ALL ON TABLE public.roles TO service_role;


--
-- Name: TABLE staking_positions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.staking_positions TO anon;
GRANT ALL ON TABLE public.staking_positions TO authenticated;
GRANT ALL ON TABLE public.staking_positions TO service_role;


--
-- Name: TABLE system_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.system_settings TO anon;
GRANT ALL ON TABLE public.system_settings TO authenticated;
GRANT ALL ON TABLE public.system_settings TO service_role;


--
-- Name: TABLE tg_announcement_reactions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tg_announcement_reactions TO anon;
GRANT ALL ON TABLE public.tg_announcement_reactions TO authenticated;
GRANT ALL ON TABLE public.tg_announcement_reactions TO service_role;


--
-- Name: TABLE tg_announcements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tg_announcements TO anon;
GRANT ALL ON TABLE public.tg_announcements TO authenticated;
GRANT ALL ON TABLE public.tg_announcements TO service_role;


--
-- Name: TABLE tg_deposits; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tg_deposits TO anon;
GRANT ALL ON TABLE public.tg_deposits TO authenticated;
GRANT ALL ON TABLE public.tg_deposits TO service_role;


--
-- Name: TABLE tg_replies; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tg_replies TO anon;
GRANT ALL ON TABLE public.tg_replies TO authenticated;
GRANT ALL ON TABLE public.tg_replies TO service_role;


--
-- Name: TABLE tg_reply_likes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tg_reply_likes TO anon;
GRANT ALL ON TABLE public.tg_reply_likes TO authenticated;
GRANT ALL ON TABLE public.tg_reply_likes TO service_role;


--
-- Name: TABLE tg_thread_likes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tg_thread_likes TO anon;
GRANT ALL ON TABLE public.tg_thread_likes TO authenticated;
GRANT ALL ON TABLE public.tg_thread_likes TO service_role;


--
-- Name: TABLE tg_threads; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tg_threads TO anon;
GRANT ALL ON TABLE public.tg_threads TO authenticated;
GRANT ALL ON TABLE public.tg_threads TO service_role;


--
-- Name: TABLE tg_user_deposit_codes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tg_user_deposit_codes TO anon;
GRANT ALL ON TABLE public.tg_user_deposit_codes TO authenticated;
GRANT ALL ON TABLE public.tg_user_deposit_codes TO service_role;


--
-- Name: TABLE tg_users; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tg_users TO anon;
GRANT ALL ON TABLE public.tg_users TO authenticated;
GRANT ALL ON TABLE public.tg_users TO service_role;


--
-- Name: TABLE transaction_signatures; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.transaction_signatures TO anon;
GRANT ALL ON TABLE public.transaction_signatures TO authenticated;
GRANT ALL ON TABLE public.transaction_signatures TO service_role;


--
-- Name: TABLE two_factor_auth; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.two_factor_auth TO anon;
GRANT ALL ON TABLE public.two_factor_auth TO authenticated;
GRANT ALL ON TABLE public.two_factor_auth TO service_role;


--
-- Name: TABLE user_internal_balances; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_internal_balances TO anon;
GRANT ALL ON TABLE public.user_internal_balances TO authenticated;
GRANT ALL ON TABLE public.user_internal_balances TO service_role;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;


--
-- Name: TABLE user_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_sessions TO anon;
GRANT ALL ON TABLE public.user_sessions TO authenticated;
GRANT ALL ON TABLE public.user_sessions TO service_role;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;


--
-- Name: TABLE validator_incentives; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.validator_incentives TO anon;
GRANT ALL ON TABLE public.validator_incentives TO authenticated;
GRANT ALL ON TABLE public.validator_incentives TO service_role;


--
-- Name: TABLE wallet_connections; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.wallet_connections TO anon;
GRANT ALL ON TABLE public.wallet_connections TO authenticated;
GRANT ALL ON TABLE public.wallet_connections TO service_role;


--
-- Name: TABLE wallet_signers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.wallet_signers TO anon;
GRANT ALL ON TABLE public.wallet_signers TO authenticated;
GRANT ALL ON TABLE public.wallet_signers TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--

