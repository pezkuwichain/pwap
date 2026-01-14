-- ==================================================
-- Pezkuwi Mobile App - Supabase Database Schema
-- ==================================================
-- This schema creates all tables needed for web2 features:
-- - Forum (discussions, categories, replies)
-- - P2P Platform (ads, trades)
-- - Notifications
-- - Referrals
-- ==================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================================================
-- FORUM TABLES
-- ==================================================

-- Forum Categories
CREATE TABLE IF NOT EXISTS forum_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Forum Discussions (Threads)
CREATE TABLE IF NOT EXISTS forum_discussions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES forum_categories(id) ON DELETE CASCADE,
  author_address VARCHAR(100) NOT NULL,
  author_name VARCHAR(100),
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Forum Replies
CREATE TABLE IF NOT EXISTS forum_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  discussion_id UUID NOT NULL REFERENCES forum_discussions(id) ON DELETE CASCADE,
  author_address VARCHAR(100) NOT NULL,
  author_name VARCHAR(100),
  content TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================================================
-- P2P PLATFORM TABLES
-- ==================================================

-- P2P Ads
CREATE TABLE IF NOT EXISTS p2p_ads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_address VARCHAR(100) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('buy', 'sell')),
  merchant_name VARCHAR(100) NOT NULL,
  rating DECIMAL(3,2) DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5),
  trades_count INTEGER DEFAULT 0,
  price DECIMAL(18,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  amount VARCHAR(50) NOT NULL,
  min_limit VARCHAR(50) NOT NULL,
  max_limit VARCHAR(50) NOT NULL,
  payment_methods TEXT[] NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- P2P Trades
CREATE TABLE IF NOT EXISTS p2p_trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_id UUID NOT NULL REFERENCES p2p_ads(id) ON DELETE CASCADE,
  buyer_address VARCHAR(100) NOT NULL,
  seller_address VARCHAR(100) NOT NULL,
  amount VARCHAR(50) NOT NULL,
  price DECIMAL(18,2) NOT NULL,
  total DECIMAL(18,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'confirmed', 'disputed', 'completed', 'cancelled')),
  payment_method VARCHAR(100) NOT NULL,
  escrow_address VARCHAR(100),
  chat_messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================================================
-- NOTIFICATIONS TABLE
-- ==================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_address VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('transaction', 'governance', 'p2p', 'referral', 'system')),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================================================
-- REFERRALS TABLE
-- ==================================================

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_address VARCHAR(100) NOT NULL,
  referee_address VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  earnings DECIMAL(18,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referrer_address, referee_address)
);

-- ==================================================
-- INDEXES FOR PERFORMANCE
-- ==================================================

-- Forum indexes
CREATE INDEX IF NOT EXISTS idx_forum_discussions_category ON forum_discussions(category_id);
CREATE INDEX IF NOT EXISTS idx_forum_discussions_author ON forum_discussions(author_address);
CREATE INDEX IF NOT EXISTS idx_forum_discussions_created ON forum_discussions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_replies_discussion ON forum_replies(discussion_id);
CREATE INDEX IF NOT EXISTS idx_forum_replies_author ON forum_replies(author_address);

-- P2P indexes
CREATE INDEX IF NOT EXISTS idx_p2p_ads_user ON p2p_ads(user_address);
CREATE INDEX IF NOT EXISTS idx_p2p_ads_type ON p2p_ads(type);
CREATE INDEX IF NOT EXISTS idx_p2p_ads_status ON p2p_ads(status);
CREATE INDEX IF NOT EXISTS idx_p2p_ads_created ON p2p_ads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_p2p_trades_ad ON p2p_trades(ad_id);
CREATE INDEX IF NOT EXISTS idx_p2p_trades_buyer ON p2p_trades(buyer_address);
CREATE INDEX IF NOT EXISTS idx_p2p_trades_seller ON p2p_trades(seller_address);
CREATE INDEX IF NOT EXISTS idx_p2p_trades_status ON p2p_trades(status);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_address);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Referrals indexes
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_address);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_address);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- ==================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==================================================

-- Enable RLS on all tables
ALTER TABLE forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Forum policies (public read, authenticated write)
CREATE POLICY "Forum categories are viewable by everyone" ON forum_categories FOR SELECT USING (true);
CREATE POLICY "Forum discussions are viewable by everyone" ON forum_discussions FOR SELECT USING (true);
CREATE POLICY "Forum discussions can be created by anyone" ON forum_discussions FOR INSERT WITH CHECK (true);
CREATE POLICY "Forum discussions can be updated by author" ON forum_discussions FOR UPDATE USING (author_address = current_setting('request.jwt.claims', true)::json->>'address');
CREATE POLICY "Forum replies are viewable by everyone" ON forum_replies FOR SELECT USING (true);
CREATE POLICY "Forum replies can be created by anyone" ON forum_replies FOR INSERT WITH CHECK (true);

-- P2P policies (users can only see active ads and their own trades)
CREATE POLICY "P2P ads are viewable by everyone" ON p2p_ads FOR SELECT USING (status = 'active' OR user_address = current_setting('request.jwt.claims', true)::json->>'address');
CREATE POLICY "P2P ads can be created by anyone" ON p2p_ads FOR INSERT WITH CHECK (true);
CREATE POLICY "P2P ads can be updated by owner" ON p2p_ads FOR UPDATE USING (user_address = current_setting('request.jwt.claims', true)::json->>'address');
CREATE POLICY "P2P trades are viewable by participants" ON p2p_trades FOR SELECT USING (
  buyer_address = current_setting('request.jwt.claims', true)::json->>'address' OR
  seller_address = current_setting('request.jwt.claims', true)::json->>'address'
);
CREATE POLICY "P2P trades can be created by anyone" ON p2p_trades FOR INSERT WITH CHECK (true);
CREATE POLICY "P2P trades can be updated by participants" ON p2p_trades FOR UPDATE USING (
  buyer_address = current_setting('request.jwt.claims', true)::json->>'address' OR
  seller_address = current_setting('request.jwt.claims', true)::json->>'address'
);

-- Notifications policies (users can only see their own)
CREATE POLICY "Users can view their own notifications" ON notifications FOR SELECT USING (user_address = current_setting('request.jwt.claims', true)::json->>'address');
CREATE POLICY "Users can update their own notifications" ON notifications FOR UPDATE USING (user_address = current_setting('request.jwt.claims', true)::json->>'address');

-- Referrals policies (users can see their own referrals)
CREATE POLICY "Users can view their own referrals" ON referrals FOR SELECT USING (
  referrer_address = current_setting('request.jwt.claims', true)::json->>'address' OR
  referee_address = current_setting('request.jwt.claims', true)::json->>'address'
);
CREATE POLICY "Referrals can be created by anyone" ON referrals FOR INSERT WITH CHECK (true);

-- ==================================================
-- SAMPLE DATA FOR TESTING
-- ==================================================

-- Insert sample forum categories
INSERT INTO forum_categories (name, description, icon) VALUES
  ('General', 'General discussions about PezkuwiChain', '💬'),
  ('Governance', 'Proposals, voting, and governance topics', '🏛️'),
  ('Technical', 'Technical discussions and development', '💻'),
  ('Trading', 'P2P trading and market discussions', '📈'),
  ('Support', 'Get help and support', '❓')
ON CONFLICT (name) DO NOTHING;

-- ==================================================
-- FUNCTIONS AND TRIGGERS
-- ==================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_forum_discussions_updated_at BEFORE UPDATE ON forum_discussions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_p2p_ads_updated_at BEFORE UPDATE ON p2p_ads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_p2p_trades_updated_at BEFORE UPDATE ON p2p_trades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON referrals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment replies_count
CREATE OR REPLACE FUNCTION increment_replies_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE forum_discussions
  SET replies_count = replies_count + 1
  WHERE id = NEW.discussion_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for replies count
CREATE TRIGGER increment_forum_replies_count
AFTER INSERT ON forum_replies
FOR EACH ROW
EXECUTE FUNCTION increment_replies_count();

-- ==================================================
-- GRANT PERMISSIONS
-- ==================================================

-- Grant usage on all tables to anon and authenticated users
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ==================================================
-- SCHEMA COMPLETE
-- ==================================================

-- Verify table creation
SELECT
  'forum_categories' as table_name, COUNT(*) as row_count FROM forum_categories
UNION ALL
SELECT 'forum_discussions', COUNT(*) FROM forum_discussions
UNION ALL
SELECT 'forum_replies', COUNT(*) FROM forum_replies
UNION ALL
SELECT 'p2p_ads', COUNT(*) FROM p2p_ads
UNION ALL
SELECT 'p2p_trades', COUNT(*) FROM p2p_trades
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'referrals', COUNT(*) FROM referrals;
