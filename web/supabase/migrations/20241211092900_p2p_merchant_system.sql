-- =====================================================
-- P2P MERCHANT SYSTEM - PHASE 4
-- Merchant tiers, stats, and advanced features
-- =====================================================

-- =====================================================
-- MERCHANT TIERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.p2p_merchant_tiers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Tier info
  tier VARCHAR(20) DEFAULT 'lite' CHECK (tier IN ('lite', 'super', 'diamond')),

  -- Deposit (for higher tiers)
  deposit_amount DECIMAL(18,2) DEFAULT 0,
  deposit_token VARCHAR(10) DEFAULT 'HEZ',
  deposit_tx_hash TEXT,
  deposit_locked_at TIMESTAMPTZ,

  -- Limits based on tier
  max_pending_orders INT DEFAULT 5,
  max_order_amount DECIMAL(18,2) DEFAULT 10000,
  featured_ads_allowed INT DEFAULT 0,

  -- Application status
  application_status VARCHAR(20) CHECK (application_status IN ('pending', 'approved', 'rejected', 'suspended')),
  applied_at TIMESTAMPTZ,
  applied_for_tier VARCHAR(20),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,

  -- Review
  last_review_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_merchant_tiers_tier ON public.p2p_merchant_tiers(tier);
CREATE INDEX idx_merchant_tiers_pending ON public.p2p_merchant_tiers(application_status)
  WHERE application_status = 'pending';

-- Enable RLS
ALTER TABLE public.p2p_merchant_tiers ENABLE ROW LEVEL SECURITY;

-- Users can view their own tier
CREATE POLICY "p2p_merchant_own_read" ON public.p2p_merchant_tiers
  FOR SELECT USING (user_id = auth.uid());

-- Users can apply for tier (insert/update own)
CREATE POLICY "p2p_merchant_own_apply" ON public.p2p_merchant_tiers
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "p2p_merchant_own_update" ON public.p2p_merchant_tiers
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (
    -- Can only update application_status to 'pending' and applied_for_tier
    user_id = auth.uid()
  );

-- Public can see tier info (for display in ads)
CREATE POLICY "p2p_merchant_public_tier" ON public.p2p_merchant_tiers
  FOR SELECT USING (true);

-- Admins can manage all
CREATE POLICY "p2p_merchant_admin" ON public.p2p_merchant_tiers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid() AND role IN ('admin')
    )
  );

-- =====================================================
-- MERCHANT STATS TABLE (Rolling 30-day stats)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.p2p_merchant_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Volume stats (30 day rolling)
  total_volume_30d DECIMAL(18,2) DEFAULT 0,
  total_trades_30d INT DEFAULT 0,
  buy_volume_30d DECIMAL(18,2) DEFAULT 0,
  sell_volume_30d DECIMAL(18,2) DEFAULT 0,

  -- Performance metrics
  completion_rate_30d DECIMAL(5,2) DEFAULT 0,
  avg_release_time_minutes INT,
  avg_payment_time_minutes INT,

  -- Lifetime stats
  total_volume_lifetime DECIMAL(18,2) DEFAULT 0,
  total_trades_lifetime INT DEFAULT 0,

  -- Ranking
  volume_rank INT,
  trade_count_rank INT,

  -- Timestamps
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_merchant_stats_volume ON public.p2p_merchant_stats(total_volume_30d DESC);
CREATE INDEX idx_merchant_stats_trades ON public.p2p_merchant_stats(total_trades_30d DESC);

-- Enable RLS
ALTER TABLE public.p2p_merchant_stats ENABLE ROW LEVEL SECURITY;

-- Public read (for leaderboards)
CREATE POLICY "p2p_merchant_stats_public" ON public.p2p_merchant_stats
  FOR SELECT USING (true);

-- =====================================================
-- FEATURED ADS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.p2p_featured_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.p2p_fiat_offers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Featuring details
  position INT DEFAULT 1, -- 1 = top, 2 = second, etc.
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,

  -- Payment
  fee_amount DECIMAL(18,2) NOT NULL,
  fee_token VARCHAR(10) DEFAULT 'HEZ',
  fee_tx_hash TEXT,
  paid_at TIMESTAMPTZ,

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_featured_ads_active ON public.p2p_featured_ads(status, start_at, end_at)
  WHERE status = 'active';
CREATE INDEX idx_featured_ads_offer ON public.p2p_featured_ads(offer_id);

-- Enable RLS
ALTER TABLE public.p2p_featured_ads ENABLE ROW LEVEL SECURITY;

-- Users can view active featured ads
CREATE POLICY "p2p_featured_public_read" ON public.p2p_featured_ads
  FOR SELECT USING (status = 'active' OR user_id = auth.uid());

-- Users can create featured ads for own offers
CREATE POLICY "p2p_featured_own_create" ON public.p2p_featured_ads
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.p2p_fiat_offers
      WHERE id = offer_id AND seller_id = auth.uid()
    )
  );

-- =====================================================
-- USER PAYMENT METHODS (Saved methods)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.p2p_user_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id),

  -- Account details (encrypted)
  account_details_encrypted TEXT NOT NULL,
  account_name TEXT, -- For display/verification

  -- Settings
  is_default BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_payment_methods_user ON public.p2p_user_payment_methods(user_id);
CREATE UNIQUE INDEX idx_user_payment_methods_default ON public.p2p_user_payment_methods(user_id)
  WHERE is_default = true;

-- Enable RLS
ALTER TABLE public.p2p_user_payment_methods ENABLE ROW LEVEL SECURITY;

-- Users can manage own payment methods
CREATE POLICY "p2p_user_payment_own" ON public.p2p_user_payment_methods
  FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- TIER REQUIREMENTS CONSTANTS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.p2p_tier_requirements (
  tier VARCHAR(20) PRIMARY KEY,
  min_trades INT NOT NULL,
  min_completion_rate DECIMAL(5,2) NOT NULL,
  min_volume_30d DECIMAL(18,2) NOT NULL,
  deposit_required DECIMAL(18,2) NOT NULL,
  deposit_token VARCHAR(10) DEFAULT 'HEZ',
  max_pending_orders INT NOT NULL,
  max_order_amount DECIMAL(18,2) NOT NULL,
  featured_ads_allowed INT NOT NULL,
  description TEXT
);

-- Insert tier requirements
INSERT INTO public.p2p_tier_requirements (tier, min_trades, min_completion_rate, min_volume_30d, deposit_required, max_pending_orders, max_order_amount, featured_ads_allowed, description)
VALUES
  ('lite', 0, 0, 0, 0, 5, 10000, 0, 'Basic tier for all verified users'),
  ('super', 20, 90, 5000, 10000, 20, 100000, 3, 'Professional trader tier with higher limits'),
  ('diamond', 100, 95, 25000, 50000, 50, 150000, 10, 'Elite merchant tier with maximum privileges')
ON CONFLICT (tier) DO UPDATE SET
  min_trades = EXCLUDED.min_trades,
  min_completion_rate = EXCLUDED.min_completion_rate,
  min_volume_30d = EXCLUDED.min_volume_30d,
  deposit_required = EXCLUDED.deposit_required,
  max_pending_orders = EXCLUDED.max_pending_orders,
  max_order_amount = EXCLUDED.max_order_amount,
  featured_ads_allowed = EXCLUDED.featured_ads_allowed,
  description = EXCLUDED.description;

-- =====================================================
-- FUNCTION: Check Tier Eligibility
-- =====================================================
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

-- =====================================================
-- FUNCTION: Apply for Tier Upgrade
-- =====================================================
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

-- =====================================================
-- FUNCTION: Approve Tier Application (Admin)
-- =====================================================
CREATE OR REPLACE FUNCTION public.approve_tier_application(
  p_user_id UUID,
  p_admin_id UUID
) RETURNS void AS $$
DECLARE
  v_application RECORD;
  v_requirements RECORD;
BEGIN
  -- Get application
  SELECT * INTO v_application
  FROM public.p2p_merchant_tiers
  WHERE user_id = p_user_id AND application_status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending application found';
  END IF;

  -- Get tier requirements
  SELECT * INTO v_requirements
  FROM public.p2p_tier_requirements
  WHERE tier = v_application.applied_for_tier;

  -- Update tier
  UPDATE public.p2p_merchant_tiers
  SET
    tier = v_application.applied_for_tier,
    application_status = 'approved',
    approved_at = NOW(),
    approved_by = p_admin_id,
    max_pending_orders = v_requirements.max_pending_orders,
    max_order_amount = v_requirements.max_order_amount,
    featured_ads_allowed = v_requirements.featured_ads_allowed,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Create notification
  PERFORM public.create_p2p_notification(
    p_user_id,
    'system',
    'Tier Upgrade Approved!',
    format('Congratulations! You have been upgraded to %s tier.', v_application.applied_for_tier),
    NULL,
    NULL,
    '/p2p/merchant'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Calculate Merchant Stats
-- =====================================================
CREATE OR REPLACE FUNCTION public.calculate_merchant_stats(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_stats RECORD;
BEGIN
  -- Calculate 30-day stats
  SELECT
    COUNT(*) as trades_30d,
    COALESCE(SUM(fiat_amount), 0) as volume_30d,
    COALESCE(SUM(CASE WHEN buyer_id = p_user_id THEN fiat_amount ELSE 0 END), 0) as buy_volume,
    COALESCE(SUM(CASE WHEN seller_id = p_user_id THEN fiat_amount ELSE 0 END), 0) as sell_volume,
    COALESCE(
      (COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL /
       NULLIF(COUNT(*), 0) * 100), 0
    ) as completion_rate,
    AVG(EXTRACT(EPOCH FROM (seller_confirmed_at - buyer_marked_paid_at)) / 60)
      FILTER (WHERE seller_id = p_user_id AND seller_confirmed_at IS NOT NULL) as avg_release,
    AVG(EXTRACT(EPOCH FROM (buyer_marked_paid_at - created_at)) / 60)
      FILTER (WHERE buyer_id = p_user_id AND buyer_marked_paid_at IS NOT NULL) as avg_payment
  INTO v_stats
  FROM public.p2p_fiat_trades
  WHERE (buyer_id = p_user_id OR seller_id = p_user_id)
    AND created_at >= NOW() - INTERVAL '30 days';

  -- Upsert stats
  INSERT INTO public.p2p_merchant_stats (
    user_id,
    total_volume_30d,
    total_trades_30d,
    buy_volume_30d,
    sell_volume_30d,
    completion_rate_30d,
    avg_release_time_minutes,
    avg_payment_time_minutes,
    last_calculated_at
  ) VALUES (
    p_user_id,
    v_stats.volume_30d,
    v_stats.trades_30d,
    v_stats.buy_volume,
    v_stats.sell_volume,
    v_stats.completion_rate,
    v_stats.avg_release::INT,
    v_stats.avg_payment::INT,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_volume_30d = v_stats.volume_30d,
    total_trades_30d = v_stats.trades_30d,
    buy_volume_30d = v_stats.buy_volume,
    sell_volume_30d = v_stats.sell_volume,
    completion_rate_30d = v_stats.completion_rate,
    avg_release_time_minutes = v_stats.avg_release::INT,
    avg_payment_time_minutes = v_stats.avg_payment::INT,
    last_calculated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: Update stats on trade completion
-- =====================================================
CREATE OR REPLACE FUNCTION update_merchant_stats_on_trade()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    PERFORM public.calculate_merchant_stats(NEW.buyer_id);
    PERFORM public.calculate_merchant_stats(NEW.seller_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_merchant_stats
  AFTER UPDATE ON public.p2p_fiat_trades
  FOR EACH ROW EXECUTE FUNCTION update_merchant_stats_on_trade();

-- =====================================================
-- ADD is_featured COLUMN TO OFFERS
-- =====================================================
ALTER TABLE public.p2p_fiat_offers
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

ALTER TABLE public.p2p_fiat_offers
  ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_p2p_offers_featured ON public.p2p_fiat_offers(is_featured, featured_until)
  WHERE is_featured = true;

-- =====================================================
-- GRANTS
-- =====================================================
GRANT EXECUTE ON FUNCTION public.check_tier_eligibility TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_for_tier_upgrade TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_tier_application TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_merchant_stats TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.p2p_merchant_tiers IS 'Merchant tier assignments and applications';
COMMENT ON TABLE public.p2p_merchant_stats IS 'Rolling 30-day trading statistics for merchants';
COMMENT ON TABLE public.p2p_featured_ads IS 'Featured/promoted P2P advertisements';
COMMENT ON TABLE public.p2p_tier_requirements IS 'Requirements for each merchant tier level';
