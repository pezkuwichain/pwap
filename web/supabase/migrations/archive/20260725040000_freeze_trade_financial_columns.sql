-- =====================================================
-- Migration: Freeze fund-routing columns on trades/offers
-- Date: 2026-07-25
-- =====================================================
--
-- Fix for a CONFIRMED custody-critical escrow-redirection bypass.
--
-- p2p_fiat_trades still carries a world-open UPDATE policy
-- (trades_anon_update USING(true), migration 20260223160000) because the client
-- legitimately flips status / uploads payment proof with the anon key, and there
-- is no server session to bind row ownership to. The 20260725010000 hardening
-- migration knowingly left this, on the assumption that "marking a trade status
-- does not itself move funds".
--
-- That assumption is INCOMPLETE. The seller-authorized release path
-- (confirm-payment edge function) and admin_resolve_dispute() read the fund
-- DESTINATION and AMOUNT from the trade row at release time:
--     release_escrow_internal(trade.seller_id, trade.buyer_id, token, trade.crypto_amount)
-- Because buyer_id / crypto_amount / offer_id are attacker-writable via the anon
-- key, an external attacker can do
--     UPDATE p2p_fiat_trades SET buyer_id = <attacker> WHERE id = <victim_trade>
-- and, when the honest seller signs the (correctly authenticated) release, the
-- escrow is paid to the attacker instead of the buyer who sent fiat. The
-- signature gate is intact but authorizes a row whose routing was tampered.
--
-- Minimal fix (no app-breaking change, no signed-session refactor required):
-- make the fund-routing / amount columns IMMUTABLE after insert via a BEFORE
-- UPDATE trigger. No legitimate code path ever mutates these columns after the
-- trade/offer is created (accept_p2p_offer INSERTs them; every UPDATE — status,
-- proof, timestamps, dispute fields, remaining_amount, price edits — leaves them
-- untouched). The service role is still allowed to change them so future
-- backend tooling / manual reconciliation is not boxed in.

-- -----------------------------------------------------
-- 1. p2p_fiat_trades: freeze routing + amount columns
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_trade_financial_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow the backend service role to change anything (reconciliation).
  IF current_setting('role', true) = 'service_role'
     OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.offer_id            IS DISTINCT FROM OLD.offer_id
     OR NEW.seller_id        IS DISTINCT FROM OLD.seller_id
     OR NEW.buyer_id         IS DISTINCT FROM OLD.buyer_id
     OR NEW.crypto_amount    IS DISTINCT FROM OLD.crypto_amount
     OR NEW.fiat_amount      IS DISTINCT FROM OLD.fiat_amount
     OR NEW.price_per_unit   IS DISTINCT FROM OLD.price_per_unit
     OR NEW.escrow_locked_amount IS DISTINCT FROM OLD.escrow_locked_amount THEN
    RAISE EXCEPTION 'Trade fund-routing columns are immutable (offer_id, seller_id, buyer_id, crypto_amount, fiat_amount, price_per_unit, escrow_locked_amount)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_freeze_trade_financials ON public.p2p_fiat_trades;
CREATE TRIGGER trg_freeze_trade_financials
  BEFORE UPDATE ON public.p2p_fiat_trades
  FOR EACH ROW EXECUTE FUNCTION public.enforce_trade_financial_immutability();

-- -----------------------------------------------------
-- 2. p2p_fiat_offers: freeze token / seller / original amount
--    (token drives WHICH balance release_escrow_internal moves; seller_id is the
--    escrow owner). Status, remaining_amount, price and fiat fields stay editable
--    so the existing offer edit / pause / partial-fill flows keep working.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_offer_financial_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.seller_id      IS DISTINCT FROM OLD.seller_id
     OR NEW.token       IS DISTINCT FROM OLD.token
     OR NEW.amount_crypto IS DISTINCT FROM OLD.amount_crypto THEN
    RAISE EXCEPTION 'Offer fund-routing columns are immutable (seller_id, token, amount_crypto)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_freeze_offer_financials ON public.p2p_fiat_offers;
CREATE TRIGGER trg_freeze_offer_financials
  BEFORE UPDATE ON public.p2p_fiat_offers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_offer_financial_immutability();

COMMENT ON FUNCTION public.enforce_trade_financial_immutability IS
'Blocks anon/authenticated UPDATEs from changing a trade''s fund-routing/amount
columns (escrow redirection defense). Service role is exempt.';
COMMENT ON FUNCTION public.enforce_offer_financial_immutability IS
'Blocks anon/authenticated UPDATEs from changing an offer''s seller/token/amount
(escrow token mis-routing defense). Service role is exempt.';

-- ---------------------------------------------------------------------------
-- 3. Remove the dead legacy escrow-mover from the anon attack surface.
--    resolve_p2p_dispute() is SECURITY DEFINER and moves escrow, but its
--    auth.uid() admin gate is NULL under the public anon key, so it already
--    fails closed for anon. Revoking PUBLIC/anon/authenticated EXECUTE removes
--    it as an attack surface entirely (dispute resolution now flows through the
--    wallet-signed resolve-dispute edge function + admin_resolve_dispute).
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION resolve_p2p_dispute FROM PUBLIC, anon, authenticated;
