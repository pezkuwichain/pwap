-- =====================================================
-- Migration 018: Hot Wallet Configuration
-- Production hot wallet address setup
-- =====================================================

-- Update platform escrow balance with production hot wallet
UPDATE platform_escrow_balance
SET hot_wallet_address = '5HN6sFM7TbPQazmfhJP1kU8itw7Tb2A9UML8TwSYRwiN9q5Z'
WHERE token IN ('HEZ', 'PEZ');

-- Create hot wallet config table for additional metadata
CREATE TABLE IF NOT EXISTS platform_wallet_config (
  id SERIAL PRIMARY KEY,
  wallet_type TEXT NOT NULL CHECK (wallet_type IN ('hot', 'cold', 'fee_collector')),
  wallet_address TEXT NOT NULL,
  public_key TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet_type, wallet_address)
);

-- Insert hot wallet config
INSERT INTO platform_wallet_config (wallet_type, wallet_address, public_key, description)
VALUES (
  'hot',
  '5HN6sFM7TbPQazmfhJP1kU8itw7Tb2A9UML8TwSYRwiN9q5Z',
  '0xea71cc341e6790988692d8adcd08a26c75d8c813e45e0a25b24b707dc7846677',
  'P2P Platform Hot Wallet - Deposit/Withdraw operations'
)
ON CONFLICT (wallet_type, wallet_address) DO UPDATE SET
  public_key = EXCLUDED.public_key,
  description = EXCLUDED.description,
  updated_at = NOW();

-- RLS: Only admins can view wallet config
ALTER TABLE platform_wallet_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only wallet config"
ON platform_wallet_config FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);

COMMENT ON TABLE platform_wallet_config IS 'Platform wallet addresses configuration. Private keys stored in Supabase Secrets.';
