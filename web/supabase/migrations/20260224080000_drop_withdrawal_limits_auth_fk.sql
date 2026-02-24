-- Migration: Drop auth.users FK constraint on p2p_withdrawal_limits
-- This table was missed in 20260223120000 and 20260224050000 migrations.
-- user_id is now a deterministic UUID v5 derived from citizen/visa number,
-- not an auth.users entry. The FK causes check_withdrawal_limit() to fail
-- with a constraint violation on INSERT.

ALTER TABLE public.p2p_withdrawal_limits
  DROP CONSTRAINT IF EXISTS p2p_withdrawal_limits_user_id_fkey;

-- Also drop the ON DELETE CASCADE since auth.users is no longer the source
-- The constraint name may vary; try the default naming convention too
ALTER TABLE public.p2p_withdrawal_limits
  DROP CONSTRAINT IF EXISTS p2p_withdrawal_limits_pkey_fkey;
