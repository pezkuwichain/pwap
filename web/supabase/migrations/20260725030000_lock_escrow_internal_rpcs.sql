-- =====================================================
-- Migration: Lock down internal-ledger escrow RPCs
-- Date: 2026-07-25
-- =====================================================
--
-- Fix for the CRITICAL drain: lock_/release_/refund_escrow_internal (migration
-- 014) had default PUBLIC EXECUTE, and the client called release_escrow_internal
-- directly with the public anon key. An anon caller could therefore run
--   release_escrow_internal(victim, attacker, token, amount)
-- and drain any victim's LOCKED balance.
--
-- These functions now execute ONLY as the service role. Every legitimate caller
-- goes through a service-role edge function that first verifies a wallet
-- signature + identity ownership:
--   * release  -> confirm-payment edge function (seller-authorized)
--   * lock     -> lock-escrow edge function (owner-authorized)
--   * refund   -> process-withdraw (on failed payout) + admin_resolve_dispute
--                 (dispute refunds/splits). No direct client caller.
--
-- SECURITY DEFINER functions that call these internally (admin_resolve_dispute,
-- cancel_expired_trades, process_deposit) are unaffected: EXECUTE for an inner
-- call is checked against the function OWNER, not the session role.

-- release_escrow_internal(p_from_user_id, p_to_user_id, p_token, p_amount, p_reference_type, p_reference_id)
REVOKE EXECUTE ON FUNCTION release_escrow_internal(UUID, UUID, TEXT, DECIMAL, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION release_escrow_internal(UUID, UUID, TEXT, DECIMAL, TEXT, UUID)
  TO service_role;

-- refund_escrow_internal(p_user_id, p_token, p_amount, p_reference_type, p_reference_id)
REVOKE EXECUTE ON FUNCTION refund_escrow_internal(UUID, TEXT, DECIMAL, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION refund_escrow_internal(UUID, TEXT, DECIMAL, TEXT, UUID)
  TO service_role;

-- lock_escrow_internal(p_user_id, p_token, p_amount, p_reference_type, p_reference_id)
REVOKE EXECUTE ON FUNCTION lock_escrow_internal(UUID, TEXT, DECIMAL, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION lock_escrow_internal(UUID, TEXT, DECIMAL, TEXT, UUID)
  TO service_role;

COMMENT ON FUNCTION release_escrow_internal IS
'Release escrow seller->buyer. SERVICE ROLE ONLY — invoked by the confirm-payment
edge function after verifying the seller''s wallet signature + identity ownership.';

COMMENT ON FUNCTION refund_escrow_internal IS
'Refund locked escrow to its owner. SERVICE ROLE ONLY — invoked by process-withdraw
(failed payout) and admin_resolve_dispute (dispute refund/split).';

COMMENT ON FUNCTION lock_escrow_internal IS
'Lock a user''s own available balance into escrow. SERVICE ROLE ONLY — invoked by
the lock-escrow edge function after verifying the caller owns that identity.';
