-- Fix: Make blockchain_tx_hash unique constraint non-deferrable
-- PostgreSQL ON CONFLICT does not support deferrable constraints as arbiters

-- Drop the deferrable constraint (actual name from migration 016)
ALTER TABLE public.p2p_deposit_withdraw_requests
  DROP CONSTRAINT IF EXISTS p2p_deposit_withdraw_requests_tx_hash_unique;

-- Also try the auto-generated name pattern
ALTER TABLE public.p2p_deposit_withdraw_requests
  DROP CONSTRAINT IF EXISTS unique_blockchain_tx_hash;

-- Also try the default PostgreSQL naming convention
ALTER TABLE public.p2p_deposit_withdraw_requests
  DROP CONSTRAINT IF EXISTS p2p_deposit_withdraw_requests_blockchain_tx_hash_key;

-- Recreate as non-deferrable (standard UNIQUE)
ALTER TABLE public.p2p_deposit_withdraw_requests
  ADD CONSTRAINT p2p_deposit_withdraw_requests_tx_hash_unique UNIQUE (blockchain_tx_hash);
