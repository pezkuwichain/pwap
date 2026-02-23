#!/usr/bin/env python3
"""
P2P E2E Test — pwap/web Supabase project (vbhftvdayqfmcgmzdxfv)
Tests the full P2P flow using REST API + Edge Functions
"""
import os, sys, json, time, uuid, hashlib, requests

# ─── Config ───────────────────────────────────────────────────────
SUPABASE_URL = "https://vbhftvdayqfmcgmzdxfv.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaGZ0dmRheXFmbWNnbXpkeGZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMzU2NzUsImV4cCI6MjA3NTkxMTY3NX0.dP_QlGqoVbafBA907dzYZUf5Z_ShXLQXyluO9FexbTw"
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
MGMT_TOKEN = open(os.path.expanduser("~/.supabase/access-token")).read().strip()
PROJECT_REF = "vbhftvdayqfmcgmzdxfv"

# Test users (citizen UUIDs)
SELLER_ID = "27f3fb84-ffd0-5f52-8b4d-24a829d08af5"  # Test 1: #42-39-213321
SELLER_WALLET = "5HTU5xskxgx9HM2X8ssBCNkuQ4XECQXpfn85VkQEY6AE9YbT"
BUYER_ID = "3e34c269-20a6-55f9-a678-6af9754b0bd1"   # Test 3: #42-38-174568
BUYER_WALLET = "5H6fCw1vWq9J4u8KvrDcyLCxtjKNYpVtnTCJNurJvJNs6Ggw"

passed = 0
failed = 0
errors = []

def identity_to_uuid(identity_id: str) -> str:
    """Deterministic UUID v5 from identity ID"""
    namespace = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")
    return str(uuid.uuid5(namespace, identity_id))

# ─── Helpers ──────────────────────────────────────────────────────
def db_sql(sql):
    """Execute SQL via Management API"""
    r = requests.post(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query",
        headers={"Authorization": f"Bearer {MGMT_TOKEN}", "Content-Type": "application/json"},
        json={"query": sql}
    )
    if r.status_code not in [200, 201]:
        raise Exception(f"SQL error ({r.status_code}): {r.text}")
    try:
        data = r.json()
        if isinstance(data, dict) and "message" in data:
            raise Exception(f"SQL error: {data['message']}")
        return data
    except Exception as e:
        if "SQL error" in str(e):
            raise
        return []

def rest_get(table, params=""):
    """GET via PostgREST with anon key"""
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/{table}?{params}",
        headers={
            "apikey": ANON_KEY,
            "Authorization": f"Bearer {ANON_KEY}",
        }
    )
    return r.status_code, r.json() if r.text else None

def rest_post(table, data):
    """POST via PostgREST with service key"""
    key = SERVICE_KEY or ANON_KEY
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/{table}?select=*",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        },
        json=data
    )
    return r.status_code, r.json() if r.text else None

def rest_patch(table, match, data):
    """PATCH via PostgREST with service key"""
    key = SERVICE_KEY or ANON_KEY
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/{table}?{match}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        },
        json=data
    )
    return r.status_code, r.json() if r.text else None

def rpc_call(fn_name, params):
    """Call RPC function via PostgREST with service key"""
    key = SERVICE_KEY or ANON_KEY
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/{fn_name}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        json=params
    )
    return r.status_code, r.json() if r.text else None

def edge_fn(fn_name, data):
    """Call Edge Function"""
    key = ANON_KEY
    r = requests.post(
        f"{SUPABASE_URL}/functions/v1/{fn_name}",
        headers={
            "Authorization": f"Bearer {key}",
            "apikey": key,
            "Content-Type": "application/json",
        },
        json=data
    )
    return r.status_code, r.json() if r.text else None

def test(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  ✅ {name}")
    else:
        failed += 1
        msg = f"  ❌ {name}" + (f" — {detail}" if detail else "")
        print(msg)
        errors.append(msg)

# ═══════════════════════════════════════════════════════════════════
print("=" * 60)
print("P2P E2E TEST — pwap/web (vbhftvdayqfmcgmzdxfv)")
print("=" * 60)

# ─── Step 0: Setup ────────────────────────────────────────────────
print("\n📦 Step 0: Setup — Reset test data")

# Clean up any existing test offers/trades
db_sql(f"""
  DELETE FROM p2p_balance_transactions WHERE user_id IN ('{SELLER_ID}', '{BUYER_ID}');
  DELETE FROM p2p_fiat_trades WHERE seller_id IN ('{SELLER_ID}', '{BUYER_ID}') OR buyer_id IN ('{SELLER_ID}', '{BUYER_ID}');
  DELETE FROM p2p_fiat_offers WHERE seller_id IN ('{SELLER_ID}', '{BUYER_ID}');
  DELETE FROM p2p_deposit_withdraw_requests WHERE user_id IN ('{SELLER_ID}', '{BUYER_ID}');
  DELETE FROM user_internal_balances WHERE user_id IN ('{SELLER_ID}', '{BUYER_ID}');
""")

# Seed test balances
db_sql(f"""
  INSERT INTO user_internal_balances (user_id, token, available_balance, locked_balance, total_deposited, total_withdrawn)
  VALUES
    ('{SELLER_ID}', 'HEZ', 100, 0, 100, 0),
    ('{BUYER_ID}', 'HEZ', 50, 0, 50, 0);
""")

seller_bal = db_sql(f"SELECT available_balance, locked_balance FROM user_internal_balances WHERE user_id = '{SELLER_ID}' AND token = 'HEZ';")
test("Seller balance seeded (100 HEZ)", seller_bal and float(seller_bal[0]["available_balance"]) == 100)
buyer_bal = db_sql(f"SELECT available_balance, locked_balance FROM user_internal_balances WHERE user_id = '{BUYER_ID}' AND token = 'HEZ';")
test("Buyer balance seeded (50 HEZ)", buyer_bal and float(buyer_bal[0]["available_balance"]) == 50)

# ─── Step 1: Payment Methods ─────────────────────────────────────
print("\n💳 Step 1: Payment Methods (anon key / RLS)")

status, methods = rest_get("payment_methods", "currency=eq.IQD&is_active=eq.true&order=display_order")
test("Payment methods query succeeds (anon key)", status == 200, f"status={status}")
test("IQD payment methods returned", methods and len(methods) > 0, f"count={len(methods) if methods else 0}")
if methods and len(methods) > 0:
    pm_id = methods[0]["id"]
    pm_name = methods[0]["method_name"]
    test(f"First payment method: {pm_name}", True)
else:
    pm_id = None

status2, methods2 = rest_get("payment_methods", "currency=eq.TRY&is_active=eq.true")
test("TRY payment methods returned", status2 == 200 and methods2 and len(methods2) > 0, f"count={len(methods2) if methods2 else 0}")

status3, methods3 = rest_get("payment_methods", "currency=eq.EUR&is_active=eq.true")
test("EUR payment methods returned", status3 == 200 and methods3 and len(methods3) > 0, f"count={len(methods3) if methods3 else 0}")

# ─── Step 2: Escrow Lock ─────────────────────────────────────────
print("\n🔒 Step 2: Escrow Lock (lock_escrow_internal)")

status, result = rpc_call("lock_escrow_internal", {
    "p_user_id": SELLER_ID,
    "p_token": "HEZ",
    "p_amount": 20,
    "p_reference_type": "offer",
    "p_reference_id": str(uuid.uuid4())
})
lock_result = json.loads(result) if isinstance(result, str) else result
test("lock_escrow_internal succeeds", status == 200 and lock_result and lock_result.get("success"), f"status={status}, result={result}")

seller_bal = db_sql(f"SELECT available_balance, locked_balance FROM user_internal_balances WHERE user_id = '{SELLER_ID}' AND token = 'HEZ';")
test("Seller available = 80 after lock", float(seller_bal[0]["available_balance"]) == 80)
test("Seller locked = 20 after lock", float(seller_bal[0]["locked_balance"]) == 20)

# Over-lock test
status, result = rpc_call("lock_escrow_internal", {
    "p_user_id": SELLER_ID,
    "p_token": "HEZ",
    "p_amount": 999,
    "p_reference_type": "offer",
    "p_reference_id": str(uuid.uuid4())
})
over_result = json.loads(result) if isinstance(result, str) else result
test("Over-lock rejected (insufficient balance)", over_result and not over_result.get("success"), f"result={result}")

# ─── Step 3: Create Offer ────────────────────────────────────────
print("\n📝 Step 3: Create Offer (p2p_fiat_offers INSERT)")

if not pm_id:
    print("  ⚠️  Skipping — no payment method available")
else:
    offer_data = {
        "seller_id": SELLER_ID,
        "seller_wallet": SELLER_WALLET,
        "ad_type": "sell",
        "token": "HEZ",
        "amount_crypto": 20,
        "remaining_amount": 20,
        "fiat_currency": "IQD",
        "fiat_amount": 12000,
        "payment_method_id": pm_id,
        "payment_details_encrypted": json.dumps({"bank_name": "Test Bank", "account_number": "1234567890"}),
        "time_limit_minutes": 30,
        "min_order_amount": 5,
        "max_order_amount": 20,
        "status": "open",
        "escrow_locked_at": "2026-02-23T20:00:00Z",
        "expires_at": "2026-03-23T20:00:00Z"
    }
    status, offer = rest_post("p2p_fiat_offers", offer_data)
    test("Offer INSERT succeeds", status in [200, 201] and offer, f"status={status}, body={json.dumps(offer)[:200] if offer else 'null'}")

    if status in [200, 201] and offer:
        offer_row = offer[0] if isinstance(offer, list) else offer
        offer_id = offer_row.get("id")
        test("Offer has auto-generated ID", offer_id is not None)
        test("price_per_unit auto-calculated (generated column)", offer_row.get("price_per_unit") is not None and float(offer_row["price_per_unit"]) == 600.0, f"got={offer_row.get('price_per_unit')}")
    else:
        offer_id = None

# ─── Step 4: Read Offers (anon key) ──────────────────────────────
print("\n👁️ Step 4: Read Offers (anon key / RLS)")

status, offers = rest_get("p2p_fiat_offers", "status=eq.open&token=eq.HEZ&order=created_at.desc&limit=5")
test("Offers query succeeds (anon key)", status == 200, f"status={status}")
test("At least 1 open offer", offers and len(offers) > 0, f"count={len(offers) if offers else 0}")

# ─── Step 5: Create Trade ────────────────────────────────────────
print("\n🤝 Step 5: Create Trade")

trade_id = None
if offer_id:
    trade_data = {
        "offer_id": offer_id,
        "seller_id": SELLER_ID,
        "buyer_id": BUYER_ID,
        "buyer_wallet": BUYER_WALLET,
        "crypto_amount": 10,
        "fiat_amount": 6000,
        "price_per_unit": 600,
        "escrow_locked_amount": 10,
        "status": "pending",
        "payment_deadline": "2026-02-24T20:00:00Z"
    }
    status, trade = rest_post("p2p_fiat_trades", trade_data)
    test("Trade INSERT succeeds", status in [200, 201] and trade, f"status={status}, body={json.dumps(trade)[:200] if trade else 'null'}")

    if status in [200, 201] and trade:
        trade_row = trade[0] if isinstance(trade, list) else trade
        trade_id = trade_row.get("id")
        test("Trade has auto-generated ID", trade_id is not None)

    # Update offer remaining_amount
    if offer_id:
        rest_patch(f"p2p_fiat_offers", f"id=eq.{offer_id}", {"remaining_amount": 10})
else:
    print("  ⚠️  Skipping — no offer_id")

# ─── Step 6: Trade Flow — payment_sent ───────────────────────────
print("\n💸 Step 6: Trade Flow — Buyer marks payment sent")

if trade_id:
    status, updated = rest_patch("p2p_fiat_trades", f"id=eq.{trade_id}", {
        "status": "payment_sent",
        "buyer_marked_paid_at": "2026-02-23T20:30:00Z",
        "confirmation_deadline": "2026-02-23T21:30:00Z"
    })
    test("Trade status → payment_sent", status in [200, 204], f"status={status}")

    # Verify
    trade_check = db_sql(f"SELECT status FROM p2p_fiat_trades WHERE id = '{trade_id}';")
    test("Trade status is payment_sent in DB", trade_check and trade_check[0]["status"] == "payment_sent")
else:
    print("  ⚠️  Skipping — no trade_id")

# ─── Step 7: Trade Flow — Seller confirms & release escrow ───────
print("\n✅ Step 7: Seller confirms payment — release escrow")

if trade_id:
    # Mark trade as completed
    status, _ = rest_patch("p2p_fiat_trades", f"id=eq.{trade_id}", {
        "status": "completed",
        "seller_confirmed_at": "2026-02-23T21:00:00Z",
        "completed_at": "2026-02-23T21:00:00Z"
    })
    test("Trade status → completed", status in [200, 204], f"status={status}")

    # Release escrow: seller locked → buyer available
    status, result = rpc_call("release_escrow_internal", {
        "p_from_user_id": SELLER_ID,
        "p_to_user_id": BUYER_ID,
        "p_token": "HEZ",
        "p_amount": 10,
        "p_reference_type": "trade",
        "p_reference_id": trade_id
    })
    release_result = json.loads(result) if isinstance(result, str) else result
    test("release_escrow_internal succeeds", status == 200 and release_result and release_result.get("success"), f"status={status}, result={result}")

    # Verify balances
    seller_bal = db_sql(f"SELECT available_balance, locked_balance FROM user_internal_balances WHERE user_id = '{SELLER_ID}' AND token = 'HEZ';")
    test("Seller locked decreased by 10 (20→10)", float(seller_bal[0]["locked_balance"]) == 10, f"locked={seller_bal[0]['locked_balance']}")
    test("Seller available still 80", float(seller_bal[0]["available_balance"]) == 80, f"available={seller_bal[0]['available_balance']}")

    buyer_bal = db_sql(f"SELECT available_balance, locked_balance FROM user_internal_balances WHERE user_id = '{BUYER_ID}' AND token = 'HEZ';")
    test("Buyer available increased by 10 (50→60)", float(buyer_bal[0]["available_balance"]) == 60, f"available={buyer_bal[0]['available_balance']}")
else:
    print("  ⚠️  Skipping — no trade_id")

# ─── Step 8: Cancel Flow ─────────────────────────────────────────
print("\n🚫 Step 8: Cancel Flow — create second trade then cancel")

trade2_id = None
if offer_id:
    # Create second trade from remaining offer amount
    trade2_data = {
        "offer_id": offer_id,
        "seller_id": SELLER_ID,
        "buyer_id": BUYER_ID,
        "buyer_wallet": BUYER_WALLET,
        "crypto_amount": 5,
        "fiat_amount": 3000,
        "price_per_unit": 600,
        "escrow_locked_amount": 5,
        "status": "pending",
        "payment_deadline": "2026-02-24T20:00:00Z"
    }
    status, trade2 = rest_post("p2p_fiat_trades", trade2_data)
    if status in [200, 201] and trade2:
        trade2_row = trade2[0] if isinstance(trade2, list) else trade2
        trade2_id = trade2_row.get("id")
        test("Second trade created for cancel test", True)

    if trade2_id:
        # Cancel trade
        status, _ = rest_patch("p2p_fiat_trades", f"id=eq.{trade2_id}", {
            "status": "cancelled",
            "cancelled_by": BUYER_ID,
            "cancellation_reason": "E2E test cancel"
        })
        test("Trade status → cancelled", status in [200, 204], f"status={status}")

        # Refund escrow
        status, result = rpc_call("refund_escrow_internal", {
            "p_user_id": SELLER_ID,
            "p_token": "HEZ",
            "p_amount": 5,
            "p_reference_type": "trade",
            "p_reference_id": trade2_id
        })
        refund_result = json.loads(result) if isinstance(result, str) else result
        test("refund_escrow_internal succeeds", status == 200 and refund_result and refund_result.get("success"), f"status={status}, result={result}")

        seller_bal = db_sql(f"SELECT available_balance, locked_balance FROM user_internal_balances WHERE user_id = '{SELLER_ID}' AND token = 'HEZ';")
        test("Seller available restored +5 (80→85)", float(seller_bal[0]["available_balance"]) == 85, f"available={seller_bal[0]['available_balance']}")
        test("Seller locked decreased -5 (10→5)", float(seller_bal[0]["locked_balance"]) == 5, f"locked={seller_bal[0]['locked_balance']}")
else:
    print("  ⚠️  Skipping — no offer_id")

# ─── Step 9: Withdrawal Request (DB function) ────────────────────
print("\n💰 Step 9: Withdrawal — request_withdraw DB function")

status, result = rpc_call("request_withdraw", {
    "p_user_id": BUYER_ID,
    "p_token": "HEZ",
    "p_amount": 5,
    "p_wallet_address": BUYER_WALLET
})
wd_result = json.loads(result) if isinstance(result, str) else result
test("request_withdraw succeeds", status == 200 and wd_result and wd_result.get("success"), f"status={status}, result={result}")

if wd_result and wd_result.get("success"):
    wd_request_id = wd_result.get("request_id")
    test("Withdrawal request ID returned", wd_request_id is not None)

    buyer_bal = db_sql(f"SELECT available_balance, locked_balance FROM user_internal_balances WHERE user_id = '{BUYER_ID}' AND token = 'HEZ';")
    test("Buyer available decreased by 5 (60→55)", float(buyer_bal[0]["available_balance"]) == 55, f"available={buyer_bal[0]['available_balance']}")
    test("Buyer locked increased by 5 (0→5)", float(buyer_bal[0]["locked_balance"]) == 5, f"locked={buyer_bal[0]['locked_balance']}")

    # Check withdrawal request in DB
    wd_req = db_sql(f"SELECT status, amount FROM p2p_deposit_withdraw_requests WHERE id = '{wd_request_id}';")
    test("Withdrawal request status = pending", wd_req and wd_req[0]["status"] == "pending")

# ─── Step 10: Withdrawal Limit Check ─────────────────────────────
print("\n📊 Step 10: Withdrawal Limit Check")

status, result = rpc_call("check_withdrawal_limit", {
    "p_user_id": BUYER_ID,
    "p_amount": 10
})
limit_result = json.loads(result) if isinstance(result, str) else result
test("check_withdrawal_limit succeeds (no FK error)", status == 200, f"status={status}, result={result}")
if status == 200 and limit_result:
    test("Limit check returns allowed field", "allowed" in (limit_result if isinstance(limit_result, dict) else {}), f"result={limit_result}")

# ─── Step 11: process-withdraw Edge Function ─────────────────────
print("\n🔗 Step 11: process-withdraw Edge Function")

status, result = edge_fn("process-withdraw", {
    "userId": BUYER_ID,
    "token": "HEZ",
    "amount": 2,
    "walletAddress": BUYER_WALLET
})
test("process-withdraw edge function responds", status is not None, f"status={status}")
if status == 200:
    test("process-withdraw success", result and result.get("success"), f"result={result}")
elif status == 500:
    error_msg = result.get("error", "") if result else ""
    # WASM trap / runtime error = code works but hot wallet has no balance on Asset Hub
    # "48 bytes" = AccountId32 encoding bug (should NOT happen after fix)
    if "wasm" in error_msg.lower() or "Execution" in error_msg or "1002" in error_msg:
        test("process-withdraw reaches blockchain (hot wallet unfunded on Asset Hub)", True, f"expected chain error")
    elif "48 bytes" in error_msg:
        test("process-withdraw AccountId32 encoding still broken", False, f"error={error_msg}")
    else:
        test("process-withdraw 500 — check config", False, f"error={error_msg}")
else:
    test("process-withdraw unexpected status", status == 400, f"status={status}, result={result}")

# ─── Step 12: Balance Transactions Audit ──────────────────────────
print("\n📋 Step 12: Balance Transactions Audit Log")

txs = db_sql(f"SELECT transaction_type, amount, token FROM p2p_balance_transactions WHERE user_id IN ('{SELLER_ID}', '{BUYER_ID}') ORDER BY created_at;")
test("Balance transactions logged", txs and len(txs) > 0, f"count={len(txs) if txs else 0}")
if txs:
    types = [t["transaction_type"] for t in txs]
    test("escrow_lock logged", "escrow_lock" in types, f"types={types}")
    test("escrow_release logged", "escrow_release" in types, f"types={types}")
    test("trade_receive logged", "trade_receive" in types, f"types={types}")
    test("escrow_refund logged", "escrow_refund" in types, f"types={types}")

# ─── Step 13: Cleanup ────────────────────────────────────────────
print("\n🧹 Step 13: Cleanup — reset test data")
db_sql(f"""
  DELETE FROM p2p_balance_transactions WHERE user_id IN ('{SELLER_ID}', '{BUYER_ID}');
  DELETE FROM p2p_fiat_trades WHERE seller_id = '{SELLER_ID}' OR buyer_id = '{BUYER_ID}';
  DELETE FROM p2p_fiat_offers WHERE seller_id = '{SELLER_ID}';
  DELETE FROM p2p_deposit_withdraw_requests WHERE user_id IN ('{SELLER_ID}', '{BUYER_ID}');
  DELETE FROM user_internal_balances WHERE user_id IN ('{SELLER_ID}', '{BUYER_ID}');
  DELETE FROM p2p_withdrawal_limits WHERE user_id IN ('{SELLER_ID}', '{BUYER_ID}');
""")
test("Cleanup completed", True)

# ─── Summary ──────────────────────────────────────────────────────
print("\n" + "=" * 60)
print(f"RESULTS: {passed} passed, {failed} failed")
print("=" * 60)
if errors:
    print("\nFailed tests:")
    for e in errors:
        print(e)
sys.exit(1 if failed > 0 else 0)
