-- Repair: recreate functions that their migrations recorded but never created.
--
-- supabase_migrations.schema_migrations lists 20241211092900 as applied, and its
-- tables (p2p_merchant_tiers, p2p_merchant_stats, p2p_tier_requirements) do
-- exist — but none of its functions do. The same is true of five other
-- migrations: the tables landed, the function bodies did not. Those files carry
-- "Run this in Supabase SQL Editor" headers, so they were pasted in by hand
-- before apply-migrations.sh existed, and a run that stopped partway still got
-- recorded as applied. The CI runner then skipped them forever after.
--
-- This is forward-only repair rather than a re-run of those files. Re-running
-- them would abort on their bare CREATE POLICY/INDEX/TRIGGER statements, since
-- the tables are already there.
--
-- 25 declared functions are missing. Only the ones the app actually reaches are
-- restored here:
--   apply_for_tier_upgrade  - MerchantApplication.tsx:213
--   check_tier_eligibility  - called by the above
--   update_p2p_reputation   - shared/lib/p2p-fiat.ts:803
-- All are CREATE OR REPLACE, so this file is safe to run repeatedly, and every
-- table they touch was verified present first.
--
-- Deliberately NOT re-running the source migrations. 20241117054602 is
-- self-consistent, but 016 later redefined its cancel_expired_trades; replaying
-- the whole file would overwrite the newer definition with the older one. Taking
-- only the missing body avoids that.
--
-- The remaining 22 are left alone: nothing calls them, and several are trigger
-- bodies whose triggers were never created either, so creating them would switch
-- on behaviour that has never run rather than restore something broken. They are
-- listed in deploy/known-schema-gaps.txt.

CREATE OR REPLACE FUNCTION public.check_tier_eligibility(
  p_user_id UUID,
  p_target_tier VARCHAR(20)
) RETURNS TABLE(
  eligible BOOLEAN,
  missing_requirements TEXT[]
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.apply_for_tier_upgrade(
  p_user_id UUID,
  p_target_tier VARCHAR(20)
) RETURNS TABLE(
  success BOOLEAN,
  message TEXT
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.check_tier_eligibility TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_for_tier_upgrade TO authenticated;

CREATE OR REPLACE FUNCTION public.update_p2p_reputation(
  p_seller_id UUID,
  p_buyer_id UUID,
  p_trade_id UUID
) RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.update_p2p_reputation TO authenticated;
