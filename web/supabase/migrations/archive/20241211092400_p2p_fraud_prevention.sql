-- =====================================================
-- P2P FRAUD PREVENTION SYSTEM
-- Auto-detection rules and triggers
-- =====================================================

-- =====================================================
-- USER FRAUD INDICATORS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.p2p_user_fraud_indicators (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Trade statistics
  cancel_rate DECIMAL(5,2) DEFAULT 0,          -- Percentage
  dispute_rate DECIMAL(5,2) DEFAULT 0,         -- Percentage
  avg_trade_amount DECIMAL(18,2) DEFAULT 0,

  -- Recent activity
  recent_cancellations_24h INT DEFAULT 0,
  recent_disputes_7d INT DEFAULT 0,
  trades_today INT DEFAULT 0,
  volume_today DECIMAL(18,2) DEFAULT 0,

  -- Risk assessment
  risk_score INT DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  risk_level VARCHAR(10) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  active_flags TEXT[] DEFAULT '{}',

  -- Restrictions
  is_blocked BOOLEAN DEFAULT FALSE,
  blocked_reason TEXT,
  blocked_at TIMESTAMPTZ,
  blocked_until TIMESTAMPTZ,
  requires_review BOOLEAN DEFAULT FALSE,

  -- Cooldowns
  last_cancellation_at TIMESTAMPTZ,
  last_dispute_at TIMESTAMPTZ,
  last_trade_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_fraud_indicators_risk ON public.p2p_user_fraud_indicators(risk_score DESC);
CREATE INDEX idx_fraud_indicators_blocked ON public.p2p_user_fraud_indicators(is_blocked) WHERE is_blocked = true;
CREATE INDEX idx_fraud_indicators_review ON public.p2p_user_fraud_indicators(requires_review) WHERE requires_review = true;

-- Enable RLS
ALTER TABLE public.p2p_user_fraud_indicators ENABLE ROW LEVEL SECURITY;

-- Users can view their own indicators (limited)
CREATE POLICY "p2p_fraud_indicators_own_read" ON public.p2p_user_fraud_indicators
  FOR SELECT USING (user_id = auth.uid());

-- Admins can view and update all
CREATE POLICY "p2p_fraud_indicators_admin" ON public.p2p_user_fraud_indicators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid() AND role IN ('moderator', 'admin')
    )
  );

-- =====================================================
-- SUSPICIOUS ACTIVITY LOG
-- =====================================================
CREATE TABLE IF NOT EXISTS public.p2p_suspicious_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  trade_id UUID REFERENCES public.p2p_fiat_trades(id),

  -- Activity details
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
    'high_cancel_rate', 'frequent_disputes', 'rapid_trading',
    'unusual_amount', 'new_account_large_trade', 'payment_name_mismatch',
    'suspected_multi_account', 'ip_anomaly', 'device_anomaly', 'other'
  )),
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,
  metadata JSONB DEFAULT '{}',

  -- Resolution
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  action_taken TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_suspicious_activity_user ON public.p2p_suspicious_activity(user_id, created_at DESC);
CREATE INDEX idx_suspicious_activity_status ON public.p2p_suspicious_activity(status) WHERE status = 'pending';
CREATE INDEX idx_suspicious_activity_severity ON public.p2p_suspicious_activity(severity, created_at DESC);

-- Enable RLS
ALTER TABLE public.p2p_suspicious_activity ENABLE ROW LEVEL SECURITY;

-- Only admins can view
CREATE POLICY "p2p_suspicious_activity_admin" ON public.p2p_suspicious_activity
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid() AND role IN ('moderator', 'admin')
    )
  );

-- =====================================================
-- FUNCTION: Calculate User Risk Score
-- =====================================================
CREATE OR REPLACE FUNCTION public.calculate_user_risk_score(p_user_id UUID)
RETURNS TABLE(
  risk_score INT,
  risk_level TEXT,
  flags TEXT[]
) AS $$
DECLARE
  v_indicators RECORD;
  v_score INT := 0;
  v_flags TEXT[] := '{}';
BEGIN
  -- Get current indicators
  SELECT * INTO v_indicators
  FROM public.p2p_user_fraud_indicators
  WHERE user_id = p_user_id;

  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.p2p_user_fraud_indicators (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_indicators;
  END IF;

  -- Calculate from reputation data
  SELECT
    COALESCE(
      CASE WHEN total_trades > 0
        THEN (cancelled_trades::DECIMAL / total_trades * 100)
        ELSE 0
      END, 0),
    COALESCE(
      CASE WHEN total_trades > 0
        THEN (disputed_trades::DECIMAL / total_trades * 100)
        ELSE 0
      END, 0)
  INTO v_indicators.cancel_rate, v_indicators.dispute_rate
  FROM public.p2p_reputation
  WHERE user_id = p_user_id;

  -- Apply rules and calculate score
  -- Rule 1: High cancel rate (>30%)
  IF v_indicators.cancel_rate > 30 THEN
    v_score := v_score + 25;
    v_flags := array_append(v_flags, 'High Cancellation Rate');
  END IF;

  -- Rule 2: High dispute rate (>20%)
  IF v_indicators.dispute_rate > 20 THEN
    v_score := v_score + 30;
    v_flags := array_append(v_flags, 'Frequent Disputes');
  END IF;

  -- Rule 3: Multiple recent cancellations (>3 in 24h)
  IF v_indicators.recent_cancellations_24h > 3 THEN
    v_score := v_score + 35;
    v_flags := array_append(v_flags, 'Multiple Recent Cancellations');
  END IF;

  -- Rule 4: Recent disputes (>2 in 7d)
  IF v_indicators.recent_disputes_7d > 2 THEN
    v_score := v_score + 25;
    v_flags := array_append(v_flags, 'Recent Disputes');
  END IF;

  -- Cap score at 100
  v_score := LEAST(v_score, 100);

  -- Determine risk level
  risk_level := CASE
    WHEN v_score >= 95 THEN 'critical'
    WHEN v_score >= 80 THEN 'high'
    WHEN v_score >= 50 THEN 'medium'
    ELSE 'low'
  END;

  -- Update indicators table
  UPDATE public.p2p_user_fraud_indicators
  SET
    risk_score = v_score,
    risk_level = risk_level,
    active_flags = v_flags,
    is_blocked = (v_score >= 95),
    requires_review = (v_score >= 80),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  risk_score := v_score;
  flags := v_flags;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Check Trade Allowed
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_trade_allowed(
  p_user_id UUID,
  p_trade_amount DECIMAL
) RETURNS TABLE(
  allowed BOOLEAN,
  reason TEXT
) AS $$
DECLARE
  v_indicators RECORD;
  v_reputation RECORD;
  v_limits RECORD;
  v_cooldown_ms BIGINT;
BEGIN
  -- Get fraud indicators
  SELECT * INTO v_indicators
  FROM public.p2p_user_fraud_indicators
  WHERE user_id = p_user_id;

  -- Check if blocked
  IF v_indicators IS NOT NULL AND v_indicators.is_blocked THEN
    allowed := FALSE;
    reason := COALESCE(v_indicators.blocked_reason, 'Your account is temporarily restricted from trading.');
    RETURN NEXT;
    RETURN;
  END IF;

  -- Check cooldown after cancellation (5 minutes)
  IF v_indicators IS NOT NULL AND v_indicators.last_cancellation_at IS NOT NULL THEN
    v_cooldown_ms := EXTRACT(EPOCH FROM (NOW() - v_indicators.last_cancellation_at)) * 1000;
    IF v_cooldown_ms < 300000 THEN  -- 5 minutes
      allowed := FALSE;
      reason := format('Please wait %s seconds before creating a new trade.', ((300000 - v_cooldown_ms) / 1000)::INT);
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- Check cooldown after dispute (24 hours)
  IF v_indicators IS NOT NULL AND v_indicators.last_dispute_at IS NOT NULL THEN
    v_cooldown_ms := EXTRACT(EPOCH FROM (NOW() - v_indicators.last_dispute_at)) * 1000;
    IF v_cooldown_ms < 86400000 THEN  -- 24 hours
      allowed := FALSE;
      reason := 'Trading is restricted for 24 hours after a dispute.';
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- Get reputation for trust level
  SELECT * INTO v_reputation
  FROM public.p2p_reputation
  WHERE user_id = p_user_id;

  -- Define limits based on trust level
  SELECT * INTO v_limits FROM (
    SELECT
      CASE COALESCE(v_reputation.trust_level, 'new')
        WHEN 'verified' THEN 50000
        WHEN 'advanced' THEN 10000
        WHEN 'intermediate' THEN 2000
        WHEN 'basic' THEN 500
        ELSE 100
      END as max_trade,
      CASE COALESCE(v_reputation.trust_level, 'new')
        WHEN 'verified' THEN 50
        WHEN 'advanced' THEN 20
        WHEN 'intermediate' THEN 10
        WHEN 'basic' THEN 5
        ELSE 3
      END as max_daily_trades,
      CASE COALESCE(v_reputation.trust_level, 'new')
        WHEN 'verified' THEN 100000
        WHEN 'advanced' THEN 25000
        WHEN 'intermediate' THEN 5000
        WHEN 'basic' THEN 1000
        ELSE 200
      END as max_daily_volume
  ) limits;

  -- Check trade amount limit
  IF p_trade_amount > v_limits.max_trade THEN
    allowed := FALSE;
    reason := format('Trade amount exceeds your limit of $%s. Complete more trades to increase your limit.', v_limits.max_trade);
    RETURN NEXT;
    RETURN;
  END IF;

  -- Check daily trade count
  IF v_indicators IS NOT NULL AND v_indicators.trades_today >= v_limits.max_daily_trades THEN
    allowed := FALSE;
    reason := format('You have reached your daily limit of %s trades.', v_limits.max_daily_trades);
    RETURN NEXT;
    RETURN;
  END IF;

  -- Check daily volume
  IF v_indicators IS NOT NULL AND (v_indicators.volume_today + p_trade_amount) > v_limits.max_daily_volume THEN
    allowed := FALSE;
    reason := format('This trade would exceed your daily volume limit of $%s.', v_limits.max_daily_volume);
    RETURN NEXT;
    RETURN;
  END IF;

  -- All checks passed
  allowed := TRUE;
  reason := NULL;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Log Suspicious Activity
-- =====================================================
CREATE OR REPLACE FUNCTION public.log_suspicious_activity(
  p_user_id UUID,
  p_trade_id UUID,
  p_activity_type TEXT,
  p_severity TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO public.p2p_suspicious_activity (
    user_id, trade_id, activity_type, severity, description, metadata
  ) VALUES (
    p_user_id, p_trade_id, p_activity_type, p_severity, p_description, p_metadata
  )
  RETURNING id INTO v_activity_id;

  -- Auto-recalculate risk score
  PERFORM public.calculate_user_risk_score(p_user_id);

  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: Update Fraud Indicators on Trade Completion
-- =====================================================
CREATE OR REPLACE FUNCTION update_fraud_indicators_on_trade()
RETURNS TRIGGER AS $$
BEGIN
  -- On trade completion
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Update buyer indicators
    INSERT INTO public.p2p_user_fraud_indicators (user_id, trades_today, volume_today, last_trade_at)
    VALUES (NEW.buyer_id, 1, NEW.fiat_amount, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      trades_today = p2p_user_fraud_indicators.trades_today + 1,
      volume_today = p2p_user_fraud_indicators.volume_today + NEW.fiat_amount,
      last_trade_at = NOW(),
      updated_at = NOW();

    -- Update seller indicators
    INSERT INTO public.p2p_user_fraud_indicators (user_id, trades_today, volume_today, last_trade_at)
    VALUES (NEW.seller_id, 1, NEW.fiat_amount, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      trades_today = p2p_user_fraud_indicators.trades_today + 1,
      volume_today = p2p_user_fraud_indicators.volume_today + NEW.fiat_amount,
      last_trade_at = NOW(),
      updated_at = NOW();
  END IF;

  -- On trade cancellation
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    IF NEW.cancelled_by IS NOT NULL THEN
      UPDATE public.p2p_user_fraud_indicators
      SET
        recent_cancellations_24h = recent_cancellations_24h + 1,
        last_cancellation_at = NOW(),
        updated_at = NOW()
      WHERE user_id = NEW.cancelled_by;

      -- Recalculate risk score
      PERFORM public.calculate_user_risk_score(NEW.cancelled_by);
    END IF;
  END IF;

  -- On dispute
  IF NEW.status = 'disputed' AND (OLD.status IS NULL OR OLD.status != 'disputed') THEN
    -- Update both parties
    UPDATE public.p2p_user_fraud_indicators
    SET
      recent_disputes_7d = recent_disputes_7d + 1,
      last_dispute_at = NOW(),
      updated_at = NOW()
    WHERE user_id IN (NEW.buyer_id, NEW.seller_id);

    -- Recalculate risk scores
    PERFORM public.calculate_user_risk_score(NEW.buyer_id);
    PERFORM public.calculate_user_risk_score(NEW.seller_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_fraud_indicators
  AFTER UPDATE ON public.p2p_fiat_trades
  FOR EACH ROW EXECUTE FUNCTION update_fraud_indicators_on_trade();

-- =====================================================
-- SCHEDULED JOB: Reset Daily Counters
-- (Run at midnight UTC via pg_cron or external scheduler)
-- =====================================================
CREATE OR REPLACE FUNCTION public.reset_daily_fraud_counters()
RETURNS void AS $$
BEGIN
  UPDATE public.p2p_user_fraud_indicators
  SET
    trades_today = 0,
    volume_today = 0,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SCHEDULED JOB: Reset Weekly Counters
-- =====================================================
CREATE OR REPLACE FUNCTION public.reset_weekly_fraud_counters()
RETURNS void AS $$
BEGIN
  UPDATE public.p2p_user_fraud_indicators
  SET
    recent_disputes_7d = 0,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION public.calculate_user_risk_score TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_trade_allowed TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_suspicious_activity TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_daily_fraud_counters TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_weekly_fraud_counters TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.p2p_user_fraud_indicators IS 'Tracks fraud indicators and risk scores for P2P users';
COMMENT ON TABLE public.p2p_suspicious_activity IS 'Log of suspicious activities detected by the fraud system';
COMMENT ON FUNCTION public.calculate_user_risk_score IS 'Calculate and update user risk score based on trading behavior';
COMMENT ON FUNCTION public.check_trade_allowed IS 'Check if a user is allowed to make a trade based on limits and restrictions';
