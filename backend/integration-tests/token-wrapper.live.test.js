/**
 * @file: token-wrapper.live.test.js
 * @description: Live integration tests for the TokenWrapper pallet.
 * 
 * @preconditions:
 *  1. A local Pezkuwi dev node must be running and accessible at `ws://127.0.0.1:8082`.
 *  2. The node must have the `tokenWrapper`, `balances`, and `assets` pallets.
 *  3. Test accounts must be funded with the native currency (e.g., PEZ).
 */

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { BN } from '@polkadot/util';
import { jest } from '@jest/globals';

// ========================================
// TEST CONFIGURATION
// ========================================

const WS_ENDPOINT = 'ws://127.0.0.1:8082';
jest.setTimeout(60000); // 60 seconds

// ========================================
// TEST SETUP & TEARDOWN
// ========================================

let api;
let keyring;
let user1, user2;

// Asset ID for the wrapped token (assumed from mock.rs)
const WRAPPED_ASSET_ID = 0;

// Helper to send a transaction and wait for it to be finalized
const sendAndFinalize = (tx, signer) => {
  return new Promise((resolve, reject) => {
    tx.signAndSend(signer, ({ status, dispatchError }) => {
      if (status.isFinalized) {
        if (dispatchError) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          reject(new Error(`${decoded.section}.${decoded.name}`));
        } else {
          resolve();
        }
      }
    }).catch(reject);
  });
};

// Helper to get native balance
const getNativeBalance = async (address) => {
  const { data: { free } } = await api.query.system.account(address);
  return new BN(free.toString());
};

// Helper to get asset balance
const getAssetBalance = async (assetId, address) => {
  const accountInfo = await api.query.assets.account(assetId, address);
  return new BN(accountInfo ? accountInfo.unwrapOrDefault().balance.toString() : '0');
};

beforeAll(async () => {
  const wsProvider = new WsProvider(WS_ENDPOINT);
  api = await ApiPromise.create({ provider: wsProvider });
  keyring = new Keyring({ type: 'sr25519' });
  
  user1 = keyring.addFromUri('//Charlie');
  user2 = keyring.addFromUri('//Dave');

  console.log('Connected to node and initialized accounts for TokenWrapper tests.');
}, 40000);

afterAll(async () => {
  if (api) await api.disconnect();
});

// ========================================
// LIVE PALLET TESTS
// ========================================

describe('TokenWrapper Pallet Live Workflow', () => {

  it('should allow a user to wrap and unwrap native tokens', async () => {
    const wrapAmount = new BN('1000000000000000'); // 1000 units with 12 decimals

    const nativeBalanceBefore = await getNativeBalance(user1.address);
    const wrappedBalanceBefore = await getAssetBalance(WRAPPED_ASSET_ID, user1.address);
    const totalLockedBefore = await api.query.tokenWrapper.totalLocked();

    // -----------------------------------------------------------------
    // PHASE 1: WRAP
    // -----------------------------------------------------------------
    console.log('PHASE 1: Wrapping tokens...');

    await sendAndFinalize(api.tx.tokenWrapper.wrap(wrapAmount), user1);

    const nativeBalanceAfterWrap = await getNativeBalance(user1.address);
    const wrappedBalanceAfterWrap = await getAssetBalance(WRAPPED_ASSET_ID, user1.address);
    const totalLockedAfterWrap = await api.query.tokenWrapper.totalLocked();

    // Verify user's native balance decreased (approximately, considering fees)
    expect(nativeBalanceAfterWrap.lt(nativeBalanceBefore.sub(wrapAmount))).toBe(true);
    // Verify user's wrapped balance increased by the exact amount
    expect(wrappedBalanceAfterWrap.sub(wrappedBalanceBefore).eq(wrapAmount)).toBe(true);
    // Verify total locked amount increased
    expect(totalLockedAfterWrap.sub(totalLockedBefore).eq(wrapAmount)).toBe(true);

    console.log(`Successfully wrapped ${wrapAmount}.`);

    // -----------------------------------------------------------------
    // PHASE 2: UNWRAP
    // -----------------------------------------------------------------
    console.log('PHASE 2: Unwrapping tokens...');

    await sendAndFinalize(api.tx.tokenWrapper.unwrap(wrapAmount), user1);

    const nativeBalanceAfterUnwrap = await getNativeBalance(user1.address);
    const wrappedBalanceAfterUnwrap = await getAssetBalance(WRAPPED_ASSET_ID, user1.address);
    const totalLockedAfterUnwrap = await api.query.tokenWrapper.totalLocked();

    // Verify user's wrapped balance is back to its original state
    expect(wrappedBalanceAfterUnwrap.eq(wrappedBalanceBefore)).toBe(true);
    // Verify total locked amount is back to its original state
    expect(totalLockedAfterUnwrap.eq(totalLockedBefore)).toBe(true);
    // Native balance should be close to original, minus two transaction fees
    expect(nativeBalanceAfterUnwrap.lt(nativeBalanceBefore)).toBe(true);
    expect(nativeBalanceAfterUnwrap.gt(nativeBalanceAfterWrap)).toBe(true);

    console.log(`Successfully unwrapped ${wrapAmount}.`);
  });

  it('should handle multiple users and track total locked amount correctly', async () => {
    const amount1 = new BN('500000000000000');
    const amount2 = new BN('800000000000000');

    const totalLockedBefore = await api.query.tokenWrapper.totalLocked();

    // Both users wrap
    await sendAndFinalize(api.tx.tokenWrapper.wrap(amount1), user1);
    await sendAndFinalize(api.tx.tokenWrapper.wrap(amount2), user2);

    let totalLocked = await api.query.tokenWrapper.totalLocked();
    expect(totalLocked.sub(totalLockedBefore).eq(amount1.add(amount2))).toBe(true);
    console.log('Total locked is correct after two wraps.');

    // User 1 unwraps
    await sendAndFinalize(api.tx.tokenWrapper.unwrap(amount1), user1);

    totalLocked = await api.query.tokenWrapper.totalLocked();
    expect(totalLocked.sub(totalLockedBefore).eq(amount2)).toBe(true);
    console.log('Total locked is correct after one unwrap.');

    // User 2 unwraps
    await sendAndFinalize(api.tx.tokenWrapper.unwrap(amount2), user2);

    totalLocked = await api.query.tokenWrapper.totalLocked();
    expect(totalLocked.eq(totalLockedBefore)).toBe(true);
    console.log('Total locked is correct after both unwrap.');
  });

  it('should fail with insufficient balance errors', async () => {
    const hugeAmount = new BN('1000000000000000000000'); // An amount no one has

    console.log('Testing failure cases...');

    // Case 1: Insufficient native balance to wrap
    await expect(
      sendAndFinalize(api.tx.tokenWrapper.wrap(hugeAmount), user1)
    ).rejects.toThrow('balances.InsufficientBalance');
    console.log('Verified: Cannot wrap with insufficient native balance.');

    // Case 2: Insufficient wrapped balance to unwrap
    await expect(
      sendAndFinalize(api.tx.tokenWrapper.unwrap(hugeAmount), user1)
    ).rejects.toThrow('tokenWrapper.InsufficientWrappedBalance');
    console.log('Verified: Cannot unwrap with insufficient wrapped balance.');
  });
});
