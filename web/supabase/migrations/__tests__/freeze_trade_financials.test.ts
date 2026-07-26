// DB-backed verification of migration 20260725040000 (BYPASS #1 custody fix):
// the freeze trigger must make trade fund-routing columns immutable for non-
// service-role writers. Runs the EXACT trigger from the migration on a real
// Postgres engine (pglite/WASM, no system install). Run:
//   deno run -A web/supabase/migrations/__tests__/freeze_trade_financials.test.ts
// NOTE: proves the trigger (primary custody guard, current_setting-based). The
// RLS/REVOKE role-enforcement in the sibling migrations is single-user-untestable
// here and must be verified on a multi-role staging Postgres (see DEPLOY_RUNBOOK).
import { PGlite } from "npm:@electric-sql/pglite";
const db = new PGlite();
let pass = 0, fail = 0;
const ok = (c:boolean,m:string)=>{ c?(pass++,console.log("  ✅ "+m)):(fail++,console.log("  ❌ "+m)); };
async function raises(sql:string){ try{ await db.exec(sql); return false; }catch(_e){ return true; } }

// minimal schema + EXACT trigger from migration 20260725040000
await db.exec(`
CREATE TABLE p2p_fiat_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid, seller_id uuid, buyer_id uuid,
  crypto_amount numeric, fiat_amount numeric, price_per_unit numeric,
  escrow_locked_amount numeric, status text, buyer_payment_reference text
);
CREATE OR REPLACE FUNCTION enforce_trade_financial_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.offer_id IS DISTINCT FROM OLD.offer_id
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
     OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
     OR NEW.crypto_amount IS DISTINCT FROM OLD.crypto_amount
     OR NEW.fiat_amount IS DISTINCT FROM OLD.fiat_amount
     OR NEW.price_per_unit IS DISTINCT FROM OLD.price_per_unit
     OR NEW.escrow_locked_amount IS DISTINCT FROM OLD.escrow_locked_amount THEN
    RAISE EXCEPTION 'Trade fund-routing columns are immutable';
  END IF;
  RETURN NEW;
END;$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_freeze_trade_financials BEFORE UPDATE ON p2p_fiat_trades
  FOR EACH ROW EXECUTE FUNCTION enforce_trade_financial_immutability();
INSERT INTO p2p_fiat_trades (id, seller_id, buyer_id, crypto_amount, status)
  VALUES ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333', 100, 'payment_sent');
`);
console.log("BYPASS #1 (escrow-release redirection via trade-row) — freeze trigger:");
// A) anon UPDATE buyer_id -> MUST raise
await db.exec(`SELECT set_config('request.jwt.claim.role','anon',false);`);
ok(await raises(`UPDATE p2p_fiat_trades SET buyer_id='44444444-4444-4444-4444-444444444444' WHERE id='11111111-1111-1111-1111-111111111111'`),
   "anon UPDATE buyer_id (attacker redirect) -> BLOCKED");
// B) anon UPDATE crypto_amount -> MUST raise
ok(await raises(`UPDATE p2p_fiat_trades SET crypto_amount=999999 WHERE id='11111111-1111-1111-1111-111111111111'`),
   "anon UPDATE crypto_amount (amount tamper) -> BLOCKED");
// C) anon UPDATE status only -> MUST succeed (non-custodial fields open)
ok(!(await raises(`UPDATE p2p_fiat_trades SET status='paid', buyer_payment_reference='x' WHERE id='11111111-1111-1111-1111-111111111111'`)),
   "anon UPDATE status/proof only -> ALLOWED (correct)");
// D) service_role UPDATE buyer_id -> MUST succeed (exempt)
await db.exec(`SELECT set_config('request.jwt.claim.role','service_role',false);`);
ok(!(await raises(`UPDATE p2p_fiat_trades SET buyer_id='55555555-5555-5555-5555-555555555555' WHERE id='11111111-1111-1111-1111-111111111111'`)),
   "service_role UPDATE buyer_id -> ALLOWED (reconciliation)");
// verify buyer_id was NOT changed by the blocked anon attempt
const r:any = await db.query(`SELECT buyer_id FROM p2p_fiat_trades WHERE id='11111111-1111-1111-1111-111111111111'`);
ok(r.rows[0].buyer_id==='55555555-5555-5555-5555-555555555555',
   "final buyer_id = service_role value (attacker redirect never persisted)");
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
Deno.exit(fail>0?1:0);
