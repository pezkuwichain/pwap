-- Migration: Drop auth.users FK constraints for wallet-based authentication
-- Since we moved from Supabase Auth to on-chain wallet verification,
-- user_id is now a deterministic UUID derived from wallet address (UUID v5)
-- and no longer corresponds to auth.users entries.

-- 1. Drop FK on p2p_deposit_withdraw_requests.user_id
ALTER TABLE public.p2p_deposit_withdraw_requests
  DROP CONSTRAINT IF EXISTS p2p_deposit_withdraw_requests_user_id_fkey;

-- 2. Drop FK on p2p_deposit_withdraw_requests.processed_by
ALTER TABLE public.p2p_deposit_withdraw_requests
  DROP CONSTRAINT IF EXISTS p2p_deposit_withdraw_requests_processed_by_fkey;

-- 3. Drop FK on user_internal_balances.user_id
ALTER TABLE public.user_internal_balances
  DROP CONSTRAINT IF EXISTS user_internal_balances_user_id_fkey;

-- 4. Drop FK on p2p_balance_transactions.user_id (if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'p2p_balance_transactions') THEN
    ALTER TABLE public.p2p_balance_transactions DROP CONSTRAINT IF EXISTS p2p_balance_transactions_user_id_fkey;
  END IF;
END $$;

-- 5. Drop FK on p2p_escrow_transactions (if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'p2p_escrow_transactions') THEN
    ALTER TABLE public.p2p_escrow_transactions DROP CONSTRAINT IF EXISTS p2p_escrow_transactions_buyer_id_fkey;
    ALTER TABLE public.p2p_escrow_transactions DROP CONSTRAINT IF EXISTS p2p_escrow_transactions_seller_id_fkey;
  END IF;
END $$;

-- 6. Drop FK on p2p_orders (if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'p2p_orders') THEN
    ALTER TABLE public.p2p_orders DROP CONSTRAINT IF EXISTS p2p_orders_user_id_fkey;
    ALTER TABLE public.p2p_orders DROP CONSTRAINT IF EXISTS p2p_orders_merchant_id_fkey;
  END IF;
END $$;

-- 7. Drop FK on p2p_ads (if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'p2p_ads') THEN
    ALTER TABLE public.p2p_ads DROP CONSTRAINT IF EXISTS p2p_ads_merchant_id_fkey;
  END IF;
END $$;
