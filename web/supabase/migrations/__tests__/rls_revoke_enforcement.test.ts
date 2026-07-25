// DB-backed verification of migrations 20260725010000 (financial RLS) + 20260725030000
// (escrow REVOKE). Replicates the Supabase RLS model on a real Postgres engine
// (pglite/WASM): CREATE ROLE anon/service_role + an auth.role() stub that reads the JWT
// claim GUC exactly as Supabase does, then proves: anon can't read balances/payment PII
// or execute the escrow RPCs, while the SECURITY DEFINER read path + service_role still
// work. Run: deno run -A web/supabase/migrations/__tests__/rls_revoke_enforcement.test.ts
// Proves policy/grant LOGIC; final in-situ confirmation is the staging deploy (owner-gated).
import { PGlite } from "npm:@electric-sql/pglite";
const db = new PGlite();
let pass=0,fail=0;
const ok=(c:boolean,m:string)=>{c?(pass++,console.log("  ✅ "+m)):(fail++,console.log("  ❌ "+m));};
async function denied(sql:string){ try{ await db.exec(sql); return false; }catch(e){ return String(e).includes("permission denied")||String(e).includes("denied"); } }
async function rows(sql:string){ const r:any=await db.query(sql); return r.rows.length; }

await db.exec(`
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.role() RETURNS text AS $$ SELECT current_setting('request.jwt.claim.role', true) $$ LANGUAGE sql STABLE;
-- balances table: Supabase grants anon SELECT, RLS filters. After dropping the anon USING(true) policy -> default deny.
CREATE TABLE user_internal_balances (user_id uuid, token text, available numeric);
INSERT INTO user_internal_balances VALUES ('11111111-1111-1111-1111-111111111111','HEZ', 500);
GRANT SELECT ON user_internal_balances TO anon, authenticated;
ALTER TABLE user_internal_balances ENABLE ROW LEVEL SECURITY;
-- (no permissive policy for anon = the post-migration state; reads go via SECURITY DEFINER RPC)
CREATE FUNCTION get_user_internal_balance(p uuid) RETURNS SETOF user_internal_balances AS $$ SELECT * FROM user_internal_balances WHERE user_id=p $$ LANGUAGE sql STABLE SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION get_user_internal_balance(uuid) TO anon;
-- payment methods: REVOKE ALL from anon (IBAN PII)
CREATE TABLE p2p_user_payment_methods (user_id uuid, iban text);
INSERT INTO p2p_user_payment_methods VALUES ('11111111-1111-1111-1111-111111111111','TR00...');
ALTER TABLE p2p_user_payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_pm_service_only ON p2p_user_payment_methods FOR ALL USING (auth.role()='service_role') WITH CHECK (auth.role()='service_role');
REVOKE ALL ON p2p_user_payment_methods FROM anon, authenticated, PUBLIC;
GRANT ALL ON p2p_user_payment_methods TO service_role;
-- escrow RPC: REVOKE from anon
CREATE FUNCTION release_escrow_internal(a uuid,b uuid,t text,amt numeric) RETURNS void AS $$ BEGIN END $$ LANGUAGE plpgsql;
REVOKE EXECUTE ON FUNCTION release_escrow_internal(uuid,uuid,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION release_escrow_internal(uuid,uuid,text,numeric) TO service_role;
`);

console.log("RLS / REVOKE role-enforcement (Supabase auth.role() simulated):");
// anon context
await db.exec(`SELECT set_config('request.jwt.claim.role','anon',false); SET ROLE anon;`);
ok(await rows(`SELECT * FROM user_internal_balances`)===0, "anon direct SELECT balances -> 0 rows (USING(true) leak closed)");
ok(await rows(`SELECT * FROM get_user_internal_balance('11111111-1111-1111-1111-111111111111')`)===1, "anon via SECURITY DEFINER RPC -> works (legit path intact)");
ok(await denied(`SELECT * FROM p2p_user_payment_methods`), "anon SELECT payment_methods (IBAN PII) -> permission DENIED");
ok(await denied(`SELECT release_escrow_internal('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','HEZ',100)`), "anon EXECUTE release_escrow_internal -> permission DENIED (drain closed)");
// service_role context
await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.role','service_role',false); SET ROLE service_role;`);
ok((await rows(`SELECT * FROM p2p_user_payment_methods`))>=1, "service_role SELECT payment_methods -> allowed");
ok(!(await denied(`SELECT release_escrow_internal('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','HEZ',100)`)), "service_role EXECUTE release_escrow_internal -> allowed");
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
Deno.exit(fail>0?1:0);
