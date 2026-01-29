-- =====================================================
-- COMBINED P2P FULL SYSTEM MIGRATION
-- Created: 2026-01-29
-- Run this file in Supabase SQL Editor to set up complete P2P system
-- =====================================================
-- ORDER:
-- 1. Extensions and base utilities
-- 2. Base P2P tables (offers, trades, disputes, reputation)
-- 3. Payment methods table and data
-- 4. Phase 2/3: Messages, ratings, notifications, evidence
-- 5. Fraud prevention system
-- 6. Merchant system
-- 7. Internal ledger (OKX model)
-- 8. Security upgrades
-- =====================================================

BEGIN;

-- =====================================================
-- 0. PREREQUISITES - Admin roles table (if not exists)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.admin_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('moderator', 'admin', 'super_admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 1. EXTENSIONS AND UTILITIES
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. PAYMENT METHODS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency TEXT NOT NULL,
  country TEXT NOT NULL,
  method_name TEXT NOT NULL,
  method_type TEXT NOT NULL CHECK (method_type IN ('bank', 'mobile_payment', 'cash', 'crypto_exchange', 'e_wallet', 'card', 'remittance')),
  logo_url TEXT,
  fields JSONB NOT NULL DEFAULT '{}',
  validation_rules JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  min_trade_amount NUMERIC DEFAULT 0,
  max_trade_amount NUMERIC,
  processing_time_minutes INT DEFAULT 60,
  requires_verification BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_currency_active ON public.payment_methods(currency, is_active);
CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON public.payment_methods(method_type);
CREATE INDEX IF NOT EXISTS idx_payment_methods_currency ON public.payment_methods(currency);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON public.payment_methods(is_active);

-- =====================================================
-- 3. P2P FIAT OFFERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.p2p_fiat_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_wallet TEXT NOT NULL,

  -- Crypto side
  token TEXT NOT NULL CHECK (token IN ('HEZ', 'PEZ')),
  amount_crypto NUMERIC NOT NULL CHECK (amount_crypto > 0),

  -- Fiat side
  fiat_currency TEXT NOT NULL,
  fiat_amount NUMERIC NOT NULL CHECK (fiat_amount > 0),
  price_per_unit NUMERIC GENERATED ALWAYS AS (fiat_amount / amount_crypto) STORED,

  -- Payment details
  payment_method_id UUID REFERENCES public.payment_methods(id),
  payment_details_encrypted TEXT,

  -- Terms
  min_order_amount NUMERIC CHECK (min_order_amount IS NULL OR min_order_amount > 0),
  max_order_amount NUMERIC,
  time_limit_minutes INT DEFAULT 30 CHECK (time_limit_minutes BETWEEN 15 AND 120),
  auto_reply_message TEXT,

  -- Restrictions
  min_buyer_completed_trades INT DEFAULT 0,
  min_buyer_reputation INT DEFAULT 0,
  blocked_users UUID[] DEFAULT '{}',

  -- Status
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paused', 'locked', 'completed', 'cancelled')),
  remaining_amount NUMERIC NOT NULL CHECK (remaining_amount >= 0),

  -- Escrow tracking
  escrow_tx_hash TEXT,
  escrow_locked_at TIMESTAMPTZ,

  -- Featured ads (merchant system)
  is_featured BOOLEAN DEFAULT FALSE,
  featured_until TIMESTAMPTZ,

  -- Ad type (buy/sell)
  ad_type TEXT DEFAULT 'sell' CHECK (ad_type IN ('buy', 'sell')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_p2p_offers_seller ON public.p2p_fiat_offers(seller_id);
CREATE INDEX IF NOT EXISTS idx_p2p_offers_currency ON public.p2p_fiat_offers(fiat_currency, token);
CREATE INDEX IF NOT EXISTS idx_p2p_offers_status ON public.p2p_fiat_offers(status) WHERE status IN ('open', 'paused');
CREATE INDEX IF NOT EXISTS idx_p2p_offers_active ON public.p2p_fiat_offers(status, fiat_currency, token) WHERE status = 'open' AND remaining_amount > 0;
CREATE INDEX IF NOT EXISTS idx_p2p_offers_featured ON public.p2p_fiat_offers(is_featured, featured_until) WHERE is_featured = true;

-- =====================================================
-- 4. P2P FIAT TRADES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.p2p_fiat_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.p2p_fiat_offers(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  buyer_id UUID NOT NULL REFERENCES auth.users(id),
  buyer_wallet TEXT NOT NULL,

  -- Trade amounts
  crypto_amount NUMERIC NOT NULL CHECK (crypto_amount > 0),
  fiat_amount NUMERIC NOT NULL CHECK (fiat_amount > 0),
  price_per_unit NUMERIC NOT NULL,

  -- Escrow
  escrow_locked_amount NUMERIC NOT NULL,
  escrow_locked_at TIMESTAMPTZ,
  escrow_release_tx_hash TEXT,
  escrow_released_at TIMESTAMPTZ,

  -- Payment tracking
  buyer_marked_paid_at TIMESTAMPTZ,
  buyer_payment_proof_url TEXT,
  seller_confirmed_at TIMESTAMPTZ,

  -- Chat messages (encrypted)
  chat_messages JSONB DEFAULT '[]',

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'payment_sent', 'completed', 'cancelled', 'disputed', 'refunded')
  ),

  -- Deadlines
  payment_deadline TIMESTAMPTZ NOT NULL,
  confirmation_deadline TIMESTAMPTZ,

  -- Cancellation/Dispute
  cancelled_by UUID REFERENCES auth.users(id),
  cancellation_reason TEXT,
  dispute_id UUID,

  -- Dispute columns (OKX security upgrade)
  dispute_reason TEXT,
  dispute_opened_at TIMESTAMPTZ,
  dispute_opened_by UUID REFERENCES auth.users(id),
  dispute_resolved_at TIMESTAMPTZ,
  dispute_resolved_by UUID REFERENCES auth.users(id),
  dispute_resolution TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  CONSTRAINT different_users CHECK (seller_id != buyer_id)
);

CREATE INDEX IF NOT EXISTS idx_p2p_trades_offer ON public.p2p_fiat_trades(offer_id);
CREATE INDEX IF NOT EXISTS idx_p2p_trades_seller ON public.p2p_fiat_trades(seller_id);
CREATE INDEX IF NOT EXISTS idx_p2p_trades_buyer ON public.p2p_fiat_trades(buyer_id);
CREATE INDEX IF NOT EXISTS idx_p2p_trades_status ON public.p2p_fiat_trades(status);
CREATE INDEX IF NOT EXISTS idx_p2p_trades_deadlines ON public.p2p_fiat_trades(payment_deadline, confirmation_deadline) WHERE status IN ('pending', 'payment_sent');

-- =====================================================
-- 5. P2P DISPUTES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.p2p_fiat_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES public.p2p_fiat_trades(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES auth.users(id),

  reason TEXT NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN ('payment_not_received', 'wrong_amount', 'fake_payment_proof', 'other')
  ),
  evidence_urls TEXT[] DEFAULT '{}',
  additional_info JSONB DEFAULT '{}',

  assigned_moderator_id UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ,

  decision TEXT CHECK (decision IN ('release_to_buyer', 'refund_to_seller', 'split', 'escalate')),
  decision_reasoning TEXT,
  resolved_at TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'under_review', 'resolved', 'escalated', 'closed')
  ),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT one_dispute_per_trade UNIQUE (trade_id)
);

CREATE INDEX IF NOT EXISTS idx_disputes_trade ON public.p2p_fiat_disputes(trade_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.p2p_fiat_disputes(status) WHERE status IN ('open', 'under_review');

-- =====================================================
-- 6. P2P REPUTATION TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.p2p_reputation (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  total_trades INT DEFAULT 0 CHECK (total_trades >= 0),
  completed_trades INT DEFAULT 0 CHECK (completed_trades >= 0),
  cancelled_trades INT DEFAULT 0 CHECK (cancelled_trades >= 0),
  disputed_trades INT DEFAULT 0 CHECK (disputed_trades >= 0),

  total_as_seller INT DEFAULT 0 CHECK (total_as_seller >= 0),
  total_as_buyer INT DEFAULT 0 CHECK (total_as_buyer >= 0),

  total_volume_usd NUMERIC DEFAULT 0 CHECK (total_volume_usd >= 0),

  avg_payment_time_minutes INT,
  avg_confirmation_time_minutes INT,

  reputation_score INT DEFAULT 100 CHECK (reputation_score BETWEEN 0 AND 1000),
  trust_level TEXT DEFAULT 'new' CHECK (
    trust_level IN ('new', 'basic', 'intermediate', 'advanced', 'verified')
  ),

  verified_merchant BOOLEAN DEFAULT false,
  fast_trader BOOLEAN DEFAULT false,

  is_restricted BOOLEAN DEFAULT false,
  restriction_reason TEXT,
  restricted_until TIMESTAMPTZ,

  first_trade_at TIMESTAMPTZ,
  last_trade_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reputation_score ON public.p2p_reputation(reputation_score DESC);
CREATE INDEX IF NOT EXISTS idx_reputation_verified ON public.p2p_reputation(verified_merchant) WHERE verified_merchant = true;

-- =====================================================
-- 7. PLATFORM ESCROW TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS public.platform_escrow_balance (
  token TEXT PRIMARY KEY CHECK (token IN ('HEZ', 'PEZ')),
  total_locked NUMERIC DEFAULT 0 CHECK (total_locked >= 0),
  hot_wallet_address TEXT NOT NULL,
  last_audit_at TIMESTAMPTZ,
  last_audit_blockchain_balance NUMERIC,
  discrepancy NUMERIC GENERATED ALWAYS AS (last_audit_blockchain_balance - total_locked) STORED,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 8. P2P AUDIT LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS public.p2p_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.p2p_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.p2p_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.p2p_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_p2p_audit_log_action ON public.p2p_audit_log(action);

-- =====================================================
-- 9. P2P MESSAGES TABLE (Chat System)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.p2p_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES public.p2p_fiat_trades(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),

  message TEXT NOT NULL CHECK (LENGTH(message) > 0 AND LENGTH(message) <= 2000),
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'system')),
  attachment_url TEXT,

  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p2p_messages_trade ON public.p2p_messages(trade_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_p2p_messages_sender ON public.p2p_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_p2p_messages_unread ON public.p2p_messages(trade_id, is_read) WHERE is_read = false;

-- =====================================================
-- 10. P2P RATINGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.p2p_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES public.p2p_fiat_trades(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES auth.users(id),
  rated_id UUID NOT NULL REFERENCES auth.users(id),

  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT CHECK (LENGTH(review) <= 500),

  communication_rating INT CHECK (communication_rating BETWEEN 1 AND 5),
  speed_rating INT CHECK (speed_rating BETWEEN 1 AND 5),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_rating_per_trade UNIQUE(trade_id, rater_id),
  CONSTRAINT cannot_rate_self CHECK (rater_id != rated_id)
);

CREATE INDEX IF NOT EXISTS idx_p2p_ratings_trade ON public.p2p_ratings(trade_id);
CREATE INDEX IF NOT EXISTS idx_p2p_ratings_rated ON public.p2p_ratings(rated_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_p2p_ratings_avg ON public.p2p_ratings(rated_id, rating);

-- =====================================================
-- 11. P2P NOTIFICATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.p2p_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  type VARCHAR(50) NOT NULL CHECK (type IN (
    'new_order', 'payment_sent', 'payment_confirmed', 'trade_cancelled',
    'dispute_opened', 'dispute_resolved', 'new_message', 'rating_received',
    'offer_matched', 'trade_reminder', 'system'
  )),
  title TEXT NOT NULL,
  message TEXT,

  reference_type VARCHAR(20) CHECK (reference_type IN ('trade', 'offer', 'dispute', 'message')),
  reference_id UUID,

  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  action_url TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p2p_notifications_user ON public.p2p_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_p2p_notifications_unread ON public.p2p_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_p2p_notifications_unread_count ON public.p2p_notifications(user_id) WHERE is_read = false;

-- =====================================================
-- 12. P2P DISPUTE EVIDENCE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.p2p_dispute_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.p2p_fiat_disputes(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),

  evidence_type VARCHAR(30) NOT NULL CHECK (evidence_type IN (
    'screenshot', 'receipt', 'bank_statement', 'chat_log',
    'transaction_proof', 'identity_doc', 'other'
  )),
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size INT,
  mime_type TEXT,

  description TEXT CHECK (LENGTH(description) <= 1000),

  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  is_valid BOOLEAN,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p2p_evidence_dispute ON public.p2p_dispute_evidence(dispute_id, created_at);

-- =====================================================
-- 13. P2P FRAUD REPORTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.p2p_fraud_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id),
  reported_user_id UUID NOT NULL REFERENCES auth.users(id),

  trade_id UUID REFERENCES public.p2p_fiat_trades(id),
  reason VARCHAR(50) NOT NULL CHECK (reason IN (
    'fake_payment', 'fake_proof', 'scam_attempt', 'harassment',
    'money_laundering', 'identity_fraud', 'multiple_accounts', 'other'
  )),
  description TEXT NOT NULL CHECK (LENGTH(description) >= 20 AND LENGTH(description) <= 2000),
  evidence_urls TEXT[] DEFAULT '{}',

  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'investigating', 'confirmed', 'dismissed', 'escalated'
  )),
  assigned_to UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ,

  resolution TEXT,
  resolution_notes TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,

  action_taken VARCHAR(30) CHECK (action_taken IN (
    'warning_issued', 'temporary_ban', 'permanent_ban',
    'trade_restricted', 'no_action', 'referred_to_authorities'
  )),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT cannot_report_self CHECK (reporter_id != reported_user_id)
);

CREATE INDEX IF NOT EXISTS idx_p2p_fraud_reporter ON public.p2p_fraud_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_p2p_fraud_reported ON public.p2p_fraud_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_p2p_fraud_status ON public.p2p_fraud_reports(status) WHERE status IN ('pending', 'investigating');

-- =====================================================
-- 14. USER FRAUD INDICATORS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.p2p_user_fraud_indicators (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  cancel_rate DECIMAL(5,2) DEFAULT 0,
  dispute_rate DECIMAL(5,2) DEFAULT 0,
  avg_trade_amount DECIMAL(18,2) DEFAULT 0,

  recent_cancellations_24h INT DEFAULT 0,
  recent_disputes_7d INT DEFAULT 0,
  trades_today INT DEFAULT 0,
  volume_today DECIMAL(18,2) DEFAULT 0,

  risk_score INT DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  risk_level VARCHAR(10) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  active_flags TEXT[] DEFAULT '{}',

  is_blocked BOOLEAN DEFAULT FALSE,
  blocked_reason TEXT,
  blocked_at TIMESTAMPTZ,
  blocked_until TIMESTAMPTZ,
  requires_review BOOLEAN DEFAULT FALSE,

  last_cancellation_at TIMESTAMPTZ,
  last_dispute_at TIMESTAMPTZ,
  last_trade_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_indicators_risk ON public.p2p_user_fraud_indicators(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_indicators_blocked ON public.p2p_user_fraud_indicators(is_blocked) WHERE is_blocked = true;

-- =====================================================
-- 15. SUSPICIOUS ACTIVITY LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS public.p2p_suspicious_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  trade_id UUID REFERENCES public.p2p_fiat_trades(id),

  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
    'high_cancel_rate', 'frequent_disputes', 'rapid_trading',
    'unusual_amount', 'new_account_large_trade', 'payment_name_mismatch',
    'suspected_multi_account', 'ip_anomaly', 'device_anomaly', 'other'
  )),
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,
  metadata JSONB DEFAULT '{}',

  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  action_taken TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suspicious_activity_user ON public.p2p_suspicious_activity(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suspicious_activity_status ON public.p2p_suspicious_activity(status) WHERE status = 'pending';

-- =====================================================
-- 16. MERCHANT TIERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.p2p_merchant_tiers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  tier VARCHAR(20) DEFAULT 'lite' CHECK (tier IN ('lite', 'super', 'diamond')),

  deposit_amount DECIMAL(18,2) DEFAULT 0,
  deposit_token VARCHAR(10) DEFAULT 'HEZ',
  deposit_tx_hash TEXT,
  deposit_locked_at TIMESTAMPTZ,

  max_pending_orders INT DEFAULT 5,
  max_order_amount DECIMAL(18,2) DEFAULT 10000,
  featured_ads_allowed INT DEFAULT 0,

  application_status VARCHAR(20) CHECK (application_status IN ('pending', 'approved', 'rejected', 'suspended')),
  applied_at TIMESTAMPTZ,
  applied_for_tier VARCHAR(20),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,

  last_review_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  review_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 17. MERCHANT STATS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.p2p_merchant_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  total_volume_30d DECIMAL(18,2) DEFAULT 0,
  total_trades_30d INT DEFAULT 0,
  buy_volume_30d DECIMAL(18,2) DEFAULT 0,
  sell_volume_30d DECIMAL(18,2) DEFAULT 0,

  completion_rate_30d DECIMAL(5,2) DEFAULT 0,
  avg_release_time_minutes INT,
  avg_payment_time_minutes INT,

  total_volume_lifetime DECIMAL(18,2) DEFAULT 0,
  total_trades_lifetime INT DEFAULT 0,

  volume_rank INT,
  trade_count_rank INT,

  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 18. TIER REQUIREMENTS TABLE
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

INSERT INTO public.p2p_tier_requirements (tier, min_trades, min_completion_rate, min_volume_30d, deposit_required, max_pending_orders, max_order_amount, featured_ads_allowed, description)
VALUES
  ('lite', 0, 0, 0, 0, 5, 10000, 0, 'Basic tier for all verified users'),
  ('super', 20, 90, 5000, 10000, 20, 100000, 3, 'Professional trader tier with higher limits'),
  ('diamond', 100, 95, 25000, 50000, 50, 150000, 10, 'Elite merchant tier with maximum privileges')
ON CONFLICT (tier) DO NOTHING;

-- =====================================================
-- 19. FEATURED ADS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.p2p_featured_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.p2p_fiat_offers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),

  position INT DEFAULT 1,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,

  fee_amount DECIMAL(18,2) NOT NULL,
  fee_token VARCHAR(10) DEFAULT 'HEZ',
  fee_tx_hash TEXT,
  paid_at TIMESTAMPTZ,

  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 20. USER PAYMENT METHODS (Saved)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.p2p_user_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id),

  account_details_encrypted TEXT NOT NULL,
  account_name TEXT,

  is_default BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 21. BLOCK TRADE REQUESTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.p2p_block_trade_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type VARCHAR(10) NOT NULL CHECK (type IN ('buy', 'sell')),
  token VARCHAR(10) NOT NULL,
  fiat_currency VARCHAR(10) NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,
  target_price DECIMAL(20, 8),
  message TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'negotiating', 'approved', 'in_progress', 'completed', 'cancelled')),
  admin_notes TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 22. INTERNAL LEDGER TABLES (OKX Model)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_internal_balances (
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

CREATE INDEX IF NOT EXISTS idx_internal_balances_user ON public.user_internal_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_internal_balances_token ON public.user_internal_balances(token);

-- =====================================================
-- 23. DEPOSIT/WITHDRAW REQUESTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.p2p_deposit_withdraw_requests (
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

CREATE INDEX IF NOT EXISTS idx_deposit_withdraw_status ON public.p2p_deposit_withdraw_requests(status);
CREATE INDEX IF NOT EXISTS idx_deposit_withdraw_user ON public.p2p_deposit_withdraw_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_withdraw_type ON public.p2p_deposit_withdraw_requests(request_type);

-- TX Hash unique constraint (OKX security)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'p2p_deposit_withdraw_requests_tx_hash_unique'
  ) THEN
    ALTER TABLE public.p2p_deposit_withdraw_requests
    ADD CONSTRAINT p2p_deposit_withdraw_requests_tx_hash_unique
    UNIQUE (blockchain_tx_hash)
    DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_deposit_withdraw_tx_hash
ON public.p2p_deposit_withdraw_requests(blockchain_tx_hash)
WHERE blockchain_tx_hash IS NOT NULL;

-- =====================================================
-- 24. BALANCE TRANSACTION LOG (Audit Trail)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.p2p_balance_transactions (
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
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_balance_tx_user ON public.p2p_balance_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_tx_type ON public.p2p_balance_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_balance_tx_created ON public.p2p_balance_transactions(created_at DESC);

-- =====================================================
-- 25. RLS POLICIES
-- =====================================================

-- Payment Methods: Public read
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_methods_public_read" ON public.payment_methods;
CREATE POLICY "payment_methods_public_read" ON public.payment_methods
  FOR SELECT USING (is_active = true);

-- P2P Offers
ALTER TABLE public.p2p_fiat_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "offers_public_read_active" ON public.p2p_fiat_offers;
CREATE POLICY "offers_public_read_active" ON public.p2p_fiat_offers
  FOR SELECT USING (
    status IN ('open', 'paused') AND
    remaining_amount > 0 AND
    expires_at > NOW()
  );

DROP POLICY IF EXISTS "offers_seller_read_own" ON public.p2p_fiat_offers;
CREATE POLICY "offers_seller_read_own" ON public.p2p_fiat_offers
  FOR SELECT USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "offers_seller_insert" ON public.p2p_fiat_offers;
CREATE POLICY "offers_seller_insert" ON public.p2p_fiat_offers
  FOR INSERT WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "offers_seller_update_own" ON public.p2p_fiat_offers;
CREATE POLICY "offers_seller_update_own" ON public.p2p_fiat_offers
  FOR UPDATE USING (seller_id = auth.uid());

-- P2P Trades
ALTER TABLE public.p2p_fiat_trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trades_parties_read" ON public.p2p_fiat_trades;
CREATE POLICY "trades_parties_read" ON public.p2p_fiat_trades
  FOR SELECT USING (seller_id = auth.uid() OR buyer_id = auth.uid());

DROP POLICY IF EXISTS "trades_buyer_insert" ON public.p2p_fiat_trades;
CREATE POLICY "trades_buyer_insert" ON public.p2p_fiat_trades
  FOR INSERT WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "trades_parties_update" ON public.p2p_fiat_trades;
CREATE POLICY "trades_parties_update" ON public.p2p_fiat_trades
  FOR UPDATE USING (seller_id = auth.uid() OR buyer_id = auth.uid());

-- Reputation: Public read
ALTER TABLE public.p2p_reputation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reputation_public_read" ON public.p2p_reputation;
CREATE POLICY "reputation_public_read" ON public.p2p_reputation
  FOR SELECT USING (true);

-- Internal Balances
ALTER TABLE public.user_internal_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own balances" ON public.user_internal_balances;
CREATE POLICY "Users can view own balances"
  ON public.user_internal_balances FOR SELECT
  USING (user_id = auth.uid());

-- Deposit/Withdraw Requests
ALTER TABLE public.p2p_deposit_withdraw_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own requests" ON public.p2p_deposit_withdraw_requests;
CREATE POLICY "Users can view own requests"
  ON public.p2p_deposit_withdraw_requests FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own requests" ON public.p2p_deposit_withdraw_requests;
CREATE POLICY "Users can create own requests"
  ON public.p2p_deposit_withdraw_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Balance Transactions
ALTER TABLE public.p2p_balance_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.p2p_balance_transactions;
CREATE POLICY "Users can view own transactions"
  ON public.p2p_balance_transactions FOR SELECT
  USING (user_id = auth.uid());

-- P2P Messages
ALTER TABLE public.p2p_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p2p_messages_trade_participants" ON public.p2p_messages;
CREATE POLICY "p2p_messages_trade_participants" ON public.p2p_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.p2p_fiat_trades t
      WHERE t.id = trade_id
      AND (t.seller_id = auth.uid() OR t.buyer_id = auth.uid())
    )
  );

-- P2P Ratings
ALTER TABLE public.p2p_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p2p_ratings_public_read" ON public.p2p_ratings;
CREATE POLICY "p2p_ratings_public_read" ON public.p2p_ratings
  FOR SELECT USING (true);

-- P2P Notifications
ALTER TABLE public.p2p_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p2p_notifications_own" ON public.p2p_notifications;
CREATE POLICY "p2p_notifications_own" ON public.p2p_notifications
  FOR ALL USING (user_id = auth.uid());

-- Audit Log
ALTER TABLE public.p2p_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p2p_audit_log_admin_only" ON public.p2p_audit_log;
CREATE POLICY "p2p_audit_log_admin_only" ON public.p2p_audit_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Fraud Indicators
ALTER TABLE public.p2p_user_fraud_indicators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p2p_fraud_indicators_own_read" ON public.p2p_user_fraud_indicators;
CREATE POLICY "p2p_fraud_indicators_own_read" ON public.p2p_user_fraud_indicators
  FOR SELECT USING (user_id = auth.uid());

-- Suspicious Activity
ALTER TABLE public.p2p_suspicious_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p2p_suspicious_activity_admin" ON public.p2p_suspicious_activity;
CREATE POLICY "p2p_suspicious_activity_admin" ON public.p2p_suspicious_activity
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid() AND role IN ('moderator', 'admin')
    )
  );

-- Merchant Tiers
ALTER TABLE public.p2p_merchant_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p2p_merchant_public_tier" ON public.p2p_merchant_tiers;
CREATE POLICY "p2p_merchant_public_tier" ON public.p2p_merchant_tiers
  FOR SELECT USING (true);

-- Merchant Stats
ALTER TABLE public.p2p_merchant_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p2p_merchant_stats_public" ON public.p2p_merchant_stats;
CREATE POLICY "p2p_merchant_stats_public" ON public.p2p_merchant_stats
  FOR SELECT USING (true);

-- =====================================================
-- 26. TRIGGERS
-- =====================================================

-- Updated_at triggers
DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON public.payment_methods;
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_p2p_offers_updated_at ON public.p2p_fiat_offers;
CREATE TRIGGER update_p2p_offers_updated_at BEFORE UPDATE ON public.p2p_fiat_offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_p2p_trades_updated_at ON public.p2p_fiat_trades;
CREATE TRIGGER update_p2p_trades_updated_at BEFORE UPDATE ON public.p2p_fiat_trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_p2p_disputes_updated_at ON public.p2p_fiat_disputes;
CREATE TRIGGER update_p2p_disputes_updated_at BEFORE UPDATE ON public.p2p_fiat_disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_internal_balances_updated_at ON public.user_internal_balances;
CREATE TRIGGER update_user_internal_balances_updated_at
  BEFORE UPDATE ON public.user_internal_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deposit_withdraw_requests_updated_at ON public.p2p_deposit_withdraw_requests;
CREATE TRIGGER update_deposit_withdraw_requests_updated_at
  BEFORE UPDATE ON public.p2p_deposit_withdraw_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 27. CORE FUNCTIONS
-- =====================================================

-- Notification function
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

-- Lock escrow function (internal ledger)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Release escrow function
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refund escrow function
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process deposit function (SERVICE ROLE ONLY - OKX Security)
CREATE OR REPLACE FUNCTION process_deposit(
  p_user_id UUID,
  p_token TEXT,
  p_amount DECIMAL(20, 12),
  p_tx_hash TEXT,
  p_request_id UUID DEFAULT NULL
) RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke execute from authenticated users (only service role)
REVOKE EXECUTE ON FUNCTION process_deposit FROM authenticated;
REVOKE EXECUTE ON FUNCTION process_deposit FROM anon;

-- Submit deposit request (User-facing)
CREATE OR REPLACE FUNCTION submit_deposit_request(
  p_token TEXT,
  p_amount DECIMAL(20, 12),
  p_tx_hash TEXT,
  p_wallet_address TEXT
) RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION submit_deposit_request TO authenticated;

-- Request withdraw function
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
  SELECT * INTO v_balance
  FROM public.user_internal_balances
  WHERE user_id = p_user_id AND token = p_token
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance.available_balance < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient available balance. Available: ' || COALESCE(v_balance.available_balance, 0)
    );
  END IF;

  UPDATE public.user_internal_balances
  SET
    available_balance = available_balance - p_amount,
    locked_balance = locked_balance + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id AND token = p_token;

  INSERT INTO public.p2p_deposit_withdraw_requests (
    user_id, request_type, token, amount, wallet_address, status
  ) VALUES (
    p_user_id, 'withdraw', p_token, p_amount, p_wallet_address, 'pending'
  ) RETURNING id INTO v_request_id;

  INSERT INTO public.p2p_balance_transactions (
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

-- Get user internal balance
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
  FROM public.user_internal_balances
  WHERE user_id = p_user_id;

  RETURN COALESCE(v_balances, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cancel expired trades (OKX Security - NO AUTO-RELEASE)
CREATE OR REPLACE FUNCTION public.cancel_expired_trades()
RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Resolve P2P dispute (Admin function)
CREATE OR REPLACE FUNCTION resolve_p2p_dispute(
  p_trade_id UUID,
  p_resolution TEXT,
  p_resolution_notes TEXT DEFAULT NULL
) RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION resolve_p2p_dispute TO authenticated;

-- =====================================================
-- 28. INITIALIZE ESCROW BALANCE
-- =====================================================

INSERT INTO public.platform_escrow_balance (token, total_locked, hot_wallet_address, last_audit_at)
VALUES
  ('HEZ', 0, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', NOW()),
  ('PEZ', 0, '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', NOW())
ON CONFLICT (token) DO NOTHING;

-- =====================================================
-- 29. PAYMENT METHODS DATA (Turkey, Iraq, Iran, Europe, USA, Diaspora)
-- =====================================================

-- TURKEY (TRY)
INSERT INTO public.payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order)
VALUES
('TRY', 'Turkey', 'Ziraat Bankası', 'bank', '{"account_holder": "Account Holder Name", "iban": "IBAN Number"}', '{"iban": {"pattern": "^TR[0-9]{24}$", "required": true}}', 100, 15, 1),
('TRY', 'Turkey', 'İş Bankası', 'bank', '{"account_holder": "Account Holder Name", "iban": "IBAN Number"}', '{"iban": {"pattern": "^TR[0-9]{24}$", "required": true}}', 100, 15, 2),
('TRY', 'Turkey', 'Garanti BBVA', 'bank', '{"account_holder": "Account Holder Name", "iban": "IBAN Number"}', '{"iban": {"pattern": "^TR[0-9]{24}$", "required": true}}', 100, 15, 3),
('TRY', 'Turkey', 'Akbank', 'bank', '{"account_holder": "Account Holder Name", "iban": "IBAN Number"}', '{"iban": {"pattern": "^TR[0-9]{24}$", "required": true}}', 100, 15, 4),
('TRY', 'Turkey', 'Yapı Kredi', 'bank', '{"account_holder": "Account Holder Name", "iban": "IBAN Number"}', '{"iban": {"pattern": "^TR[0-9]{24}$", "required": true}}', 100, 15, 5),
('TRY', 'Turkey', 'Halkbank', 'bank', '{"account_holder": "Account Holder Name", "iban": "IBAN Number"}', '{"iban": {"pattern": "^TR[0-9]{24}$", "required": true}}', 100, 15, 6),
('TRY', 'Turkey', 'Vakıfbank', 'bank', '{"account_holder": "Account Holder Name", "iban": "IBAN Number"}', '{"iban": {"pattern": "^TR[0-9]{24}$", "required": true}}', 100, 15, 7),
('TRY', 'Turkey', 'Papara', 'e_wallet', '{"papara_number": "Papara Number", "account_holder": "Account Holder Name"}', '{"papara_number": {"pattern": "^[0-9]{10}$", "required": true}}', 50, 5, 11)
ON CONFLICT DO NOTHING;

-- IRAQ (IQD)
INSERT INTO public.payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order)
VALUES
('IQD', 'Iraq', 'Rasheed Bank', 'bank', '{"account_holder": "Account Holder Name", "account_number": "Account Number"}', '{"account_number": {"required": true}}', 100000, 30, 1),
('IQD', 'Iraq', 'Rafidain Bank', 'bank', '{"account_holder": "Account Holder Name", "account_number": "Account Number"}', '{"account_number": {"required": true}}', 100000, 30, 2),
('IQD', 'Iraq', 'Kurdistan International Bank', 'bank', '{"account_holder": "Account Holder Name", "iban": "IBAN Number"}', '{"iban": {"required": true}}', 50000, 20, 4),
('IQD', 'Iraq', 'ZainCash', 'mobile_payment', '{"phone_number": "ZainCash Phone Number"}', '{"phone_number": {"pattern": "^\\+964[0-9]{10}$", "required": true}}', 10000, 5, 6),
('IQD', 'Iraq', 'FastPay', 'mobile_payment', '{"phone_number": "FastPay Phone Number", "fastpay_id": "FastPay ID"}', '{"fastpay_id": {"required": true}}', 10000, 5, 8)
ON CONFLICT DO NOTHING;

-- IRAN (IRR)
INSERT INTO public.payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order)
VALUES
('IRR', 'Iran', 'Bank Melli Iran', 'bank', '{"account_holder": "Account Holder Name", "sheba": "Sheba Number", "card_number": "Card Number"}', '{"sheba": {"pattern": "^IR[0-9]{24}$", "required": true}}', 5000000, 30, 1),
('IRR', 'Iran', 'Bank Mellat', 'bank', '{"account_holder": "Account Holder Name", "sheba": "Sheba Number"}', '{"sheba": {"pattern": "^IR[0-9]{24}$", "required": true}}', 5000000, 30, 2),
('IRR', 'Iran', 'Card to Card', 'card', '{"card_number": "16-digit Card Number", "account_holder": "Card Holder Name"}', '{"card_number": {"pattern": "^[0-9]{16}$", "required": true}}', 1000000, 5, 8)
ON CONFLICT DO NOTHING;

-- EUROPE (EUR)
INSERT INTO public.payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order)
VALUES
('EUR', 'Europe', 'SEPA Bank Transfer', 'bank', '{"account_holder": "Account Holder Name", "iban": "IBAN", "bic": "BIC/SWIFT"}', '{"iban": {"pattern": "^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$", "required": true}}', 10, 60, 1),
('EUR', 'Europe', 'SEPA Instant', 'bank', '{"account_holder": "Account Holder Name", "iban": "IBAN"}', '{"iban": {"pattern": "^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$", "required": true}}', 10, 5, 2),
('EUR', 'Europe', 'Revolut', 'e_wallet', '{"revolut_tag": "Revolut Tag (@username)", "phone": "Phone Number"}', '{"revolut_tag": {"pattern": "^@[a-z0-9]+$", "required": true}}', 5, 5, 4),
('EUR', 'Europe', 'Wise (TransferWise)', 'e_wallet', '{"email": "Wise Email", "account_holder": "Account Holder Name"}', '{"email": {"pattern": "^[^@]+@[^@]+\\.[^@]+$", "required": true}}', 5, 10, 5),
('EUR', 'Europe', 'PayPal', 'e_wallet', '{"paypal_email": "PayPal Email"}', '{"paypal_email": {"pattern": "^[^@]+@[^@]+\\.[^@]+$", "required": true}}', 10, 5, 6)
ON CONFLICT DO NOTHING;

-- USA (USD)
INSERT INTO public.payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order)
VALUES
('USD', 'United States', 'Zelle', 'mobile_payment', '{"email_or_phone": "Email or Phone linked to Zelle"}', '{"email_or_phone": {"required": true}}', 10, 5, 1),
('USD', 'United States', 'Venmo', 'mobile_payment', '{"venmo_username": "Venmo Username (@)"}', '{"venmo_username": {"pattern": "^@[a-zA-Z0-9_-]+$", "required": true}}', 10, 5, 2),
('USD', 'United States', 'CashApp', 'mobile_payment', '{"cashtag": "Cash Tag ($)"}', '{"cashtag": {"pattern": "^\\$[a-zA-Z0-9_]+$", "required": true}}', 10, 5, 3),
('USD', 'United States', 'PayPal', 'e_wallet', '{"paypal_email": "PayPal Email"}', '{"paypal_email": {"pattern": "^[^@]+@[^@]+\\.[^@]+$", "required": true}}', 10, 5, 4)
ON CONFLICT DO NOTHING;

-- SWEDEN (SEK) - Kurdish Diaspora
INSERT INTO public.payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order)
VALUES
('SEK', 'Sweden', 'Swish', 'mobile_payment', '{"phone_number": "Mobilnummer (07x)"}', '{"phone_number": {"pattern": "^07[0-9]{8}$", "required": true}}', 100, 5, 1)
ON CONFLICT DO NOTHING;

-- UK (GBP) - Kurdish Diaspora
INSERT INTO public.payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order)
VALUES
('GBP', 'United Kingdom', 'Faster Payments', 'bank', '{"account_holder": "Account Name", "sort_code": "Sort Code", "account_number": "Account Number"}', '{"sort_code": {"pattern": "^[0-9]{6}$", "required": true}, "account_number": {"pattern": "^[0-9]{8}$", "required": true}}', 10, 5, 1)
ON CONFLICT DO NOTHING;

-- SWITZERLAND (CHF) - Kurdish Diaspora
INSERT INTO public.payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order)
VALUES
('CHF', 'Switzerland', 'TWINT', 'mobile_payment', '{"twint_phone": "Mobile Number"}', '{"twint_phone": {"pattern": "^\\+41[0-9]{9}$", "required": true}}', 10, 5, 1)
ON CONFLICT DO NOTHING;

-- CANADA (CAD) - Kurdish Diaspora
INSERT INTO public.payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order)
VALUES
('CAD', 'Canada', 'Interac e-Transfer', 'mobile_payment', '{"email": "Email Address", "account_holder": "Account Name"}', '{"email": {"pattern": "^[^@]+@[^@]+\\.[^@]+$", "required": true}}', 10, 5, 1)
ON CONFLICT DO NOTHING;

-- AUSTRALIA (AUD) - Kurdish Diaspora
INSERT INTO public.payment_methods (currency, country, method_name, method_type, fields, validation_rules, min_trade_amount, processing_time_minutes, display_order)
VALUES
('AUD', 'Australia', 'PayID', 'mobile_payment', '{"payid": "PayID (Email or Phone)", "account_holder": "Account Name"}', '{"payid": {"required": true}}', 10, 5, 1)
ON CONFLICT DO NOTHING;

COMMIT;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Tables created: 24
-- Functions created: 15
-- RLS Policies: 25+
-- Payment Methods: 30+ (base set)
-- =====================================================
