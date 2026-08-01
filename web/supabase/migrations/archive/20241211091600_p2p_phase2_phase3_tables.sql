-- =====================================================
-- P2P FIAT SYSTEM - PHASE 2 & 3 ADDITIONAL TABLES
-- Messages, Ratings, Notifications, Evidence, Fraud Reports
-- =====================================================

-- =====================================================
-- P2P MESSAGES TABLE (Phase 2 - Chat System)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.p2p_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES public.p2p_fiat_trades(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),

  -- Message content
  message TEXT NOT NULL CHECK (LENGTH(message) > 0 AND LENGTH(message) <= 2000),
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'system')),
  attachment_url TEXT, -- Supabase Storage URL

  -- Read status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for p2p_messages
CREATE INDEX idx_p2p_messages_trade ON public.p2p_messages(trade_id, created_at DESC);
CREATE INDEX idx_p2p_messages_sender ON public.p2p_messages(sender_id);
CREATE INDEX idx_p2p_messages_unread ON public.p2p_messages(trade_id, is_read) WHERE is_read = false;

-- Enable RLS
ALTER TABLE public.p2p_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Only trade participants can read/write messages
CREATE POLICY "p2p_messages_trade_participants" ON public.p2p_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.p2p_fiat_trades t
      WHERE t.id = trade_id
      AND (t.seller_id = auth.uid() OR t.buyer_id = auth.uid())
    )
  );

-- =====================================================
-- P2P RATINGS TABLE (Phase 2 - Trust System)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.p2p_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES public.p2p_fiat_trades(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES auth.users(id),
  rated_id UUID NOT NULL REFERENCES auth.users(id),

  -- Rating details
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT CHECK (LENGTH(review) <= 500),

  -- Rating aspects (optional breakdown)
  communication_rating INT CHECK (communication_rating BETWEEN 1 AND 5),
  speed_rating INT CHECK (speed_rating BETWEEN 1 AND 5),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_rating_per_trade UNIQUE(trade_id, rater_id),
  CONSTRAINT cannot_rate_self CHECK (rater_id != rated_id)
);

-- Indexes for p2p_ratings
CREATE INDEX idx_p2p_ratings_trade ON public.p2p_ratings(trade_id);
CREATE INDEX idx_p2p_ratings_rated ON public.p2p_ratings(rated_id, created_at DESC);
CREATE INDEX idx_p2p_ratings_rater ON public.p2p_ratings(rater_id);

-- Enable RLS
ALTER TABLE public.p2p_ratings ENABLE ROW LEVEL SECURITY;

-- Policy: Public read (for reputation display)
CREATE POLICY "p2p_ratings_public_read" ON public.p2p_ratings
  FOR SELECT USING (true);

-- Policy: Only trade participants can insert ratings
CREATE POLICY "p2p_ratings_trade_participants_insert" ON public.p2p_ratings
  FOR INSERT WITH CHECK (
    rater_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.p2p_fiat_trades t
      WHERE t.id = trade_id
      AND t.status = 'completed'
      AND (t.seller_id = auth.uid() OR t.buyer_id = auth.uid())
    )
  );

-- =====================================================
-- P2P NOTIFICATIONS TABLE (Phase 2 - Real-time Alerts)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.p2p_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Notification content
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'new_order', 'payment_sent', 'payment_confirmed', 'trade_cancelled',
    'dispute_opened', 'dispute_resolved', 'new_message', 'rating_received',
    'offer_matched', 'trade_reminder', 'system'
  )),
  title TEXT NOT NULL,
  message TEXT,

  -- Reference
  reference_type VARCHAR(20) CHECK (reference_type IN ('trade', 'offer', 'dispute', 'message')),
  reference_id UUID,

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- Action URL (frontend route)
  action_url TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for p2p_notifications
CREATE INDEX idx_p2p_notifications_user ON public.p2p_notifications(user_id, created_at DESC);
CREATE INDEX idx_p2p_notifications_unread ON public.p2p_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_p2p_notifications_type ON public.p2p_notifications(user_id, type);

-- Enable RLS
ALTER TABLE public.p2p_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own notifications
CREATE POLICY "p2p_notifications_own" ON public.p2p_notifications
  FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- P2P DISPUTE EVIDENCE TABLE (Phase 3 - Dispute System)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.p2p_dispute_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.p2p_fiat_disputes(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),

  -- Evidence details
  evidence_type VARCHAR(30) NOT NULL CHECK (evidence_type IN (
    'screenshot', 'receipt', 'bank_statement', 'chat_log',
    'transaction_proof', 'identity_doc', 'other'
  )),
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size INT, -- bytes
  mime_type TEXT,

  -- Description
  description TEXT CHECK (LENGTH(description) <= 1000),

  -- Admin review
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  is_valid BOOLEAN,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for p2p_dispute_evidence
CREATE INDEX idx_p2p_evidence_dispute ON public.p2p_dispute_evidence(dispute_id, created_at);
CREATE INDEX idx_p2p_evidence_uploader ON public.p2p_dispute_evidence(uploaded_by);

-- Enable RLS
ALTER TABLE public.p2p_dispute_evidence ENABLE ROW LEVEL SECURITY;

-- Policy: Dispute parties can view evidence
CREATE POLICY "p2p_evidence_parties_read" ON public.p2p_dispute_evidence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.p2p_fiat_disputes d
      JOIN public.p2p_fiat_trades t ON t.id = d.trade_id
      WHERE d.id = dispute_id
      AND (t.seller_id = auth.uid() OR t.buyer_id = auth.uid() OR d.opened_by = auth.uid())
    )
  );

-- Policy: Dispute parties can upload evidence
CREATE POLICY "p2p_evidence_parties_insert" ON public.p2p_dispute_evidence
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.p2p_fiat_disputes d
      JOIN public.p2p_fiat_trades t ON t.id = d.trade_id
      WHERE d.id = dispute_id
      AND d.status IN ('open', 'under_review')
      AND (t.seller_id = auth.uid() OR t.buyer_id = auth.uid())
    )
  );

-- Policy: Admins can view all evidence
CREATE POLICY "p2p_evidence_admin_read" ON public.p2p_dispute_evidence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid() AND role IN ('moderator', 'admin')
    )
  );

-- Policy: Admins can update evidence (for review)
CREATE POLICY "p2p_evidence_admin_update" ON public.p2p_dispute_evidence
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid() AND role IN ('moderator', 'admin')
    )
  );

-- =====================================================
-- P2P FRAUD REPORTS TABLE (Phase 3 - Security)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.p2p_fraud_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id),
  reported_user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Report details
  trade_id UUID REFERENCES public.p2p_fiat_trades(id),
  reason VARCHAR(50) NOT NULL CHECK (reason IN (
    'fake_payment', 'fake_proof', 'scam_attempt', 'harassment',
    'money_laundering', 'identity_fraud', 'multiple_accounts', 'other'
  )),
  description TEXT NOT NULL CHECK (LENGTH(description) >= 20 AND LENGTH(description) <= 2000),
  evidence_urls TEXT[] DEFAULT '{}',

  -- Investigation
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'investigating', 'confirmed', 'dismissed', 'escalated'
  )),
  assigned_to UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ,

  -- Resolution
  resolution TEXT,
  resolution_notes TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,

  -- Action taken
  action_taken VARCHAR(30) CHECK (action_taken IN (
    'warning_issued', 'temporary_ban', 'permanent_ban',
    'trade_restricted', 'no_action', 'referred_to_authorities'
  )),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT cannot_report_self CHECK (reporter_id != reported_user_id)
);

-- Indexes for p2p_fraud_reports
CREATE INDEX idx_p2p_fraud_reporter ON public.p2p_fraud_reports(reporter_id);
CREATE INDEX idx_p2p_fraud_reported ON public.p2p_fraud_reports(reported_user_id);
CREATE INDEX idx_p2p_fraud_status ON public.p2p_fraud_reports(status) WHERE status IN ('pending', 'investigating');
CREATE INDEX idx_p2p_fraud_trade ON public.p2p_fraud_reports(trade_id) WHERE trade_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.p2p_fraud_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own reports
CREATE POLICY "p2p_fraud_own_reports" ON public.p2p_fraud_reports
  FOR SELECT USING (reporter_id = auth.uid());

-- Policy: Users can create reports
CREATE POLICY "p2p_fraud_create" ON public.p2p_fraud_reports
  FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- Policy: Admins can view all reports
CREATE POLICY "p2p_fraud_admin_read" ON public.p2p_fraud_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid() AND role IN ('moderator', 'admin')
    )
  );

-- Policy: Admins can update reports
CREATE POLICY "p2p_fraud_admin_update" ON public.p2p_fraud_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid() AND role IN ('moderator', 'admin')
    )
  );

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE TRIGGER update_p2p_messages_updated_at BEFORE UPDATE ON public.p2p_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_p2p_fraud_reports_updated_at BEFORE UPDATE ON public.p2p_fraud_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ENABLE REALTIME FOR NEW TABLES
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.p2p_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.p2p_notifications;

-- =====================================================
-- NOTIFICATION TRIGGER FUNCTIONS
-- =====================================================

-- Function to create notification
CREATE OR REPLACE FUNCTION public.create_p2p_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Notify on new trade
CREATE OR REPLACE FUNCTION notify_on_new_trade()
RETURNS TRIGGER AS $$
DECLARE
  v_offer RECORD;
BEGIN
  -- Get offer details
  SELECT * INTO v_offer FROM public.p2p_fiat_offers WHERE id = NEW.offer_id;

  -- Notify seller about new order
  PERFORM public.create_p2p_notification(
    NEW.seller_id,
    'new_order',
    'New P2P Order',
    format('Someone wants to buy %s %s', NEW.crypto_amount, v_offer.token),
    'trade',
    NEW.id,
    format('/p2p/trade/%s', NEW.id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_new_trade
  AFTER INSERT ON public.p2p_fiat_trades
  FOR EACH ROW EXECUTE FUNCTION notify_on_new_trade();

-- Trigger: Notify on payment sent
CREATE OR REPLACE FUNCTION notify_on_payment_sent()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'payment_sent' THEN
    PERFORM public.create_p2p_notification(
      NEW.seller_id,
      'payment_sent',
      'Payment Marked as Sent',
      'The buyer has marked the payment as sent. Please verify and release.',
      'trade',
      NEW.id,
      format('/p2p/trade/%s', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_payment_sent
  AFTER UPDATE ON public.p2p_fiat_trades
  FOR EACH ROW EXECUTE FUNCTION notify_on_payment_sent();

-- Trigger: Notify on trade completed
CREATE OR REPLACE FUNCTION notify_on_trade_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
    -- Notify buyer
    PERFORM public.create_p2p_notification(
      NEW.buyer_id,
      'payment_confirmed',
      'Trade Completed!',
      'The seller has released the crypto. Check your wallet.',
      'trade',
      NEW.id,
      format('/p2p/trade/%s', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_trade_completed
  AFTER UPDATE ON public.p2p_fiat_trades
  FOR EACH ROW EXECUTE FUNCTION notify_on_trade_completed();

-- Trigger: Notify on dispute opened
CREATE OR REPLACE FUNCTION notify_on_dispute_opened()
RETURNS TRIGGER AS $$
DECLARE
  v_trade RECORD;
  v_other_party UUID;
BEGIN
  -- Get trade details
  SELECT * INTO v_trade FROM public.p2p_fiat_trades WHERE id = NEW.trade_id;

  -- Determine other party
  IF NEW.opened_by = v_trade.seller_id THEN
    v_other_party := v_trade.buyer_id;
  ELSE
    v_other_party := v_trade.seller_id;
  END IF;

  -- Notify the other party
  PERFORM public.create_p2p_notification(
    v_other_party,
    'dispute_opened',
    'Dispute Opened',
    'A dispute has been opened for your trade. Please provide evidence.',
    'dispute',
    NEW.id,
    format('/p2p/dispute/%s', NEW.id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_dispute_opened
  AFTER INSERT ON public.p2p_fiat_disputes
  FOR EACH ROW EXECUTE FUNCTION notify_on_dispute_opened();

-- Trigger: Notify on new message
CREATE OR REPLACE FUNCTION notify_on_new_message()
RETURNS TRIGGER AS $$
DECLARE
  v_trade RECORD;
  v_recipient_id UUID;
BEGIN
  -- Skip system messages
  IF NEW.message_type = 'system' THEN
    RETURN NEW;
  END IF;

  -- Get trade details
  SELECT * INTO v_trade FROM public.p2p_fiat_trades WHERE id = NEW.trade_id;

  -- Determine recipient
  IF NEW.sender_id = v_trade.seller_id THEN
    v_recipient_id := v_trade.buyer_id;
  ELSE
    v_recipient_id := v_trade.seller_id;
  END IF;

  -- Create notification
  PERFORM public.create_p2p_notification(
    v_recipient_id,
    'new_message',
    'New Message',
    LEFT(NEW.message, 100),
    'trade',
    NEW.trade_id,
    format('/p2p/trade/%s', NEW.trade_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_new_message
  AFTER INSERT ON public.p2p_messages
  FOR EACH ROW EXECUTE FUNCTION notify_on_new_message();

-- =====================================================
-- RATING HELPER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_user_rating_stats(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_avg_rating NUMERIC;
  v_total_ratings INT;
BEGIN
  -- Calculate average rating
  SELECT
    AVG(rating)::NUMERIC(3,2),
    COUNT(*)
  INTO v_avg_rating, v_total_ratings
  FROM public.p2p_ratings
  WHERE rated_id = p_user_id;

  -- Update reputation with rating info
  UPDATE public.p2p_reputation
  SET
    updated_at = NOW()
    -- Note: You could add avg_rating column to p2p_reputation if needed
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Update stats after rating
CREATE OR REPLACE FUNCTION update_rating_stats_trigger()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.update_user_rating_stats(NEW.rated_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_rating_stats
  AFTER INSERT ON public.p2p_ratings
  FOR EACH ROW EXECUTE FUNCTION update_rating_stats_trigger();

-- =====================================================
-- GRANT EXECUTE PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION public.create_p2p_notification TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_rating_stats TO authenticated;

-- =====================================================
-- ADD INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for finding user's average rating quickly
CREATE INDEX idx_p2p_ratings_avg ON public.p2p_ratings(rated_id, rating);

-- Index for unread notification count
CREATE INDEX idx_p2p_notifications_unread_count ON public.p2p_notifications(user_id)
  WHERE is_read = false;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE public.p2p_messages IS 'Real-time chat messages between trade participants';
COMMENT ON TABLE public.p2p_ratings IS 'Post-trade ratings and reviews';
COMMENT ON TABLE public.p2p_notifications IS 'User notifications for P2P trading events';
COMMENT ON TABLE public.p2p_dispute_evidence IS 'Evidence files uploaded during disputes';
COMMENT ON TABLE public.p2p_fraud_reports IS 'Fraud reports submitted by users';
