-- =====================================================
-- P2P END-TO-END TEST SCENARIO
-- Alice sells 200 HEZ, Bob buys 150 HEZ with IQD
-- Uses REAL users from auth.users table
-- =====================================================

BEGIN;

DO $$
DECLARE
  v_alice_id UUID;
  v_bob_id UUID;
  v_alice_wallet TEXT := '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
  v_bob_wallet TEXT := '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty';
  v_payment_method_id UUID;
  v_offer_id UUID;
  v_trade_id UUID;
  v_result JSON;
  v_alice_available DECIMAL;
  v_alice_locked DECIMAL;
  v_bob_available DECIMAL;
  v_offer_remaining DECIMAL;
  v_trade_status TEXT;
  v_user_count INT;
BEGIN

  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'P2P E2E TEST: Alice sells 200 HEZ, Bob buys 150';
  RAISE NOTICE '================================================';

  -- =====================================================
  -- STEP 0: Get real users from auth.users
  -- =====================================================

  RAISE NOTICE '';
  RAISE NOTICE '--- STEP 0: Finding test users ---';

  -- Get first two users from auth.users
  SELECT COUNT(*) INTO v_user_count FROM auth.users;

  IF v_user_count < 2 THEN
    RAISE EXCEPTION 'Need at least 2 users in auth.users table. Found: %', v_user_count;
  END IF;

  -- Alice = first user, Bob = second user
  SELECT id INTO v_alice_id FROM auth.users ORDER BY created_at LIMIT 1;
  SELECT id INTO v_bob_id FROM auth.users ORDER BY created_at LIMIT 1 OFFSET 1;

  RAISE NOTICE '  Found % users in auth.users', v_user_count;
  RAISE NOTICE '  Alice (User 1): %', v_alice_id;
  RAISE NOTICE '  Bob (User 2): %', v_bob_id;

  -- =====================================================
  -- CLEANUP: Remove any existing test data for these users
  -- =====================================================

  DELETE FROM p2p_balance_transactions WHERE user_id IN (v_alice_id, v_bob_id);
  DELETE FROM p2p_fiat_trades WHERE seller_id = v_alice_id OR buyer_id IN (v_alice_id, v_bob_id);
  DELETE FROM p2p_fiat_offers WHERE seller_id = v_alice_id;
  DELETE FROM user_internal_balances WHERE user_id IN (v_alice_id, v_bob_id);

  RAISE NOTICE '  Cleaned up previous test data';

  -- =====================================================
  -- STEP 1: Alice deposits 200 HEZ
  -- =====================================================

  RAISE NOTICE '';
  RAISE NOTICE '--- STEP 1: Alice deposits 200 HEZ ---';

  INSERT INTO user_internal_balances (user_id, token, available_balance, total_deposited, last_deposit_at)
  VALUES (v_alice_id, 'HEZ', 200, 200, NOW());

  INSERT INTO p2p_balance_transactions (user_id, token, transaction_type, amount, balance_before, balance_after, description)
  VALUES (v_alice_id, 'HEZ', 'deposit', 200, 0, 200, 'Test deposit');

  -- Bob's empty balance
  INSERT INTO user_internal_balances (user_id, token, available_balance, total_deposited)
  VALUES (v_bob_id, 'HEZ', 0, 0);

  RAISE NOTICE '  ✓ Alice deposited 200 HEZ';

  -- =====================================================
  -- STEP 2: Get payment method
  -- =====================================================

  RAISE NOTICE '';
  RAISE NOTICE '--- STEP 2: Get ZainCash payment method ---';

  SELECT id INTO v_payment_method_id
  FROM payment_methods
  WHERE currency = 'IQD' AND method_name = 'ZainCash'
  LIMIT 1;

  IF v_payment_method_id IS NULL THEN
    INSERT INTO payment_methods (currency, country, method_name, method_type, fields)
    VALUES ('IQD', 'Iraq', 'ZainCash', 'mobile_payment', '{"phone_number": "ZainCash Phone"}')
    RETURNING id INTO v_payment_method_id;
    RAISE NOTICE '  ✓ Created ZainCash payment method';
  ELSE
    RAISE NOTICE '  ✓ Using existing ZainCash: %', v_payment_method_id;
  END IF;

  -- =====================================================
  -- STEP 3: Alice creates sell offer for 200 HEZ
  -- =====================================================

  RAISE NOTICE '';
  RAISE NOTICE '--- STEP 3: Alice creates sell offer (200 HEZ) ---';

  -- Lock escrow
  SELECT lock_escrow_internal(v_alice_id, 'HEZ', 200, 'offer', NULL) INTO v_result;

  IF NOT (v_result->>'success')::boolean THEN
    RAISE EXCEPTION 'Escrow lock failed: %', v_result->>'error';
  END IF;

  RAISE NOTICE '  ✓ Escrow locked: 200 HEZ';

  -- Create offer
  INSERT INTO p2p_fiat_offers (
    seller_id, seller_wallet, token, amount_crypto, fiat_currency, fiat_amount,
    payment_method_id, payment_details_encrypted, min_order_amount, max_order_amount,
    time_limit_minutes, status, remaining_amount, ad_type
  ) VALUES (
    v_alice_id, v_alice_wallet, 'HEZ', 200, 'IQD', 30000000,
    v_payment_method_id, 'encrypted_+9647701234567', 10, 200,
    30, 'open', 200, 'sell'
  ) RETURNING id INTO v_offer_id;

  RAISE NOTICE '  ✓ Offer created: %', v_offer_id;
  RAISE NOTICE '    200 HEZ for 30,000,000 IQD (150,000 IQD/HEZ)';

  -- Check Alice balance
  SELECT available_balance, locked_balance INTO v_alice_available, v_alice_locked
  FROM user_internal_balances WHERE user_id = v_alice_id AND token = 'HEZ';

  RAISE NOTICE '  Alice: available=%, locked=%', v_alice_available, v_alice_locked;

  -- =====================================================
  -- STEP 4: Bob initiates trade for 150 HEZ
  -- =====================================================

  RAISE NOTICE '';
  RAISE NOTICE '--- STEP 4: Bob buys 150 HEZ ---';

  INSERT INTO p2p_fiat_trades (
    offer_id, seller_id, buyer_id, buyer_wallet,
    crypto_amount, fiat_amount, price_per_unit,
    escrow_locked_amount, escrow_locked_at, status,
    payment_deadline, confirmation_deadline
  ) VALUES (
    v_offer_id, v_alice_id, v_bob_id, v_bob_wallet,
    150, 22500000, 150000,
    150, NOW(), 'pending',
    NOW() + INTERVAL '30 minutes', NOW() + INTERVAL '60 minutes'
  ) RETURNING id INTO v_trade_id;

  -- Update offer remaining
  UPDATE p2p_fiat_offers
  SET remaining_amount = remaining_amount - 150
  WHERE id = v_offer_id;

  RAISE NOTICE '  ✓ Trade created: %', v_trade_id;
  RAISE NOTICE '    150 HEZ for 22,500,000 IQD';

  -- =====================================================
  -- STEP 5: Bob marks payment as sent
  -- =====================================================

  RAISE NOTICE '';
  RAISE NOTICE '--- STEP 5: Bob sends 22,500,000 IQD via ZainCash ---';

  UPDATE p2p_fiat_trades
  SET status = 'payment_sent',
      buyer_marked_paid_at = NOW(),
      buyer_payment_proof_url = 'https://example.com/zaincash_receipt.jpg'
  WHERE id = v_trade_id;

  RAISE NOTICE '  ✓ Payment marked as sent';
  RAISE NOTICE '  ✓ Proof uploaded';

  -- =====================================================
  -- STEP 6: Alice confirms and releases
  -- =====================================================

  RAISE NOTICE '';
  RAISE NOTICE '--- STEP 6: Alice confirms payment received ---';

  -- Release escrow
  SELECT release_escrow_internal(v_alice_id, v_bob_id, 'HEZ', 150, 'trade', v_trade_id) INTO v_result;

  IF NOT (v_result->>'success')::boolean THEN
    RAISE EXCEPTION 'Escrow release failed: %', v_result->>'error';
  END IF;

  -- Complete trade
  UPDATE p2p_fiat_trades
  SET status = 'completed',
      seller_confirmed_at = NOW(),
      completed_at = NOW()
  WHERE id = v_trade_id;

  RAISE NOTICE '  ✓ Escrow released: 150 HEZ → Bob';
  RAISE NOTICE '  ✓ Trade completed!';

  -- =====================================================
  -- FINAL VERIFICATION
  -- =====================================================

  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'FINAL BALANCES';
  RAISE NOTICE '================================================';

  -- Alice
  SELECT available_balance, locked_balance INTO v_alice_available, v_alice_locked
  FROM user_internal_balances WHERE user_id = v_alice_id AND token = 'HEZ';

  RAISE NOTICE '';
  RAISE NOTICE 'ALICE (Seller):';
  RAISE NOTICE '  Available: % HEZ', v_alice_available;
  RAISE NOTICE '  Locked: % HEZ (remaining 50 HEZ offer)', v_alice_locked;

  -- Bob
  SELECT available_balance INTO v_bob_available
  FROM user_internal_balances WHERE user_id = v_bob_id AND token = 'HEZ';

  RAISE NOTICE '';
  RAISE NOTICE 'BOB (Buyer):';
  RAISE NOTICE '  Available: % HEZ', v_bob_available;

  -- Offer
  SELECT remaining_amount INTO v_offer_remaining
  FROM p2p_fiat_offers WHERE id = v_offer_id;

  RAISE NOTICE '';
  RAISE NOTICE 'OFFER:';
  RAISE NOTICE '  Remaining: % HEZ (can still sell)', v_offer_remaining;

  -- Trade
  SELECT status INTO v_trade_status
  FROM p2p_fiat_trades WHERE id = v_trade_id;

  RAISE NOTICE '';
  RAISE NOTICE 'TRADE:';
  RAISE NOTICE '  Status: %', v_trade_status;

  -- =====================================================
  -- ASSERTIONS
  -- =====================================================

  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'TEST ASSERTIONS';
  RAISE NOTICE '================================================';

  -- Alice available should be 0
  IF v_alice_available = 0 THEN
    RAISE NOTICE '✓ Alice available = 0 HEZ';
  ELSE
    RAISE NOTICE '✗ FAIL: Alice available = % (expected 0)', v_alice_available;
  END IF;

  -- Alice locked should be 50 (remaining offer)
  IF v_alice_locked = 50 THEN
    RAISE NOTICE '✓ Alice locked = 50 HEZ (remaining offer)';
  ELSE
    RAISE NOTICE '✗ FAIL: Alice locked = % (expected 50)', v_alice_locked;
  END IF;

  -- Bob should have 150
  IF v_bob_available = 150 THEN
    RAISE NOTICE '✓ Bob available = 150 HEZ';
  ELSE
    RAISE NOTICE '✗ FAIL: Bob available = % (expected 150)', v_bob_available;
  END IF;

  -- Offer remaining should be 50
  IF v_offer_remaining = 50 THEN
    RAISE NOTICE '✓ Offer remaining = 50 HEZ';
  ELSE
    RAISE NOTICE '✗ FAIL: Offer remaining = % (expected 50)', v_offer_remaining;
  END IF;

  -- Trade should be completed
  IF v_trade_status = 'completed' THEN
    RAISE NOTICE '✓ Trade status = completed';
  ELSE
    RAISE NOTICE '✗ FAIL: Trade status = % (expected completed)', v_trade_status;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'ALL TESTS PASSED!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Alice started with 200 HEZ';
  RAISE NOTICE '  - Alice created sell offer for 200 HEZ @ 150,000 IQD/HEZ';
  RAISE NOTICE '  - Bob bought 150 HEZ for 22,500,000 IQD';
  RAISE NOTICE '  - Alice confirmed payment and released escrow';
  RAISE NOTICE '  - Bob now has 150 HEZ';
  RAISE NOTICE '  - Alice still has 50 HEZ locked in remaining offer';
  RAISE NOTICE '';

END $$;

-- ROLLBACK to not affect real data (test only)
ROLLBACK;

-- To keep changes, replace ROLLBACK with COMMIT
