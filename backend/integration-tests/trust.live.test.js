/**
 * @file: trust.live.test.js
 * @description: Live integration tests for the Trust pallet.
 * 
 * @preconditions:
 *  1. A local Pezkuwi dev node must be running and accessible at `ws://127.0.0.1:8082`.
 *  2. The node must have the `trust`, `staking`, and `tiki` pallets.
 *  3. The tests require a funded sudo account (`//Alice`).
 */

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { BN } from '@polkadot/util';
import { jest } from '@jest/globals';

// ========================================
// TEST CONFIGURATION
// ========================================

const WS_ENDPOINT = 'ws://127.0.0.1:8082';
jest.setTimeout(90000); // 90 seconds

const UNITS = new BN('1000000000000'); // 10^12

// ========================================
// TEST SETUP & TEARDOWN
// ========================================

let api;
let keyring;
let sudo, user1;

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

beforeAll(async () => {
  const wsProvider = new WsProvider(WS_ENDPOINT);
  api = await ApiPromise.create({ provider: wsProvider });
  keyring = new Keyring({ type: 'sr25519' });
  
  sudo = keyring.addFromUri('//Alice');
  user1 = keyring.addFromUri('//Charlie');

  console.log('Connected to node and initialized accounts for Trust tests.');

  // --- Test Setup: Ensure user1 has some score components ---
  console.log('Setting up user1 with score components (Staking and Tiki)...');
  try {
    // 1. Make user a citizen to avoid NotACitizen error
    await sendAndFinalize(api.tx.tiki.forceMintCitizenNft(user1.address), sudo);

    // 2. Bond some stake to get a staking score
    const stakeAmount = UNITS.mul(new BN(500));
    await sendAndFinalize(api.tx.staking.bond(stakeAmount, 'Staked'), user1);

    console.log('User1 setup complete.');
  } catch (e) {
    console.warn(`Setup for user1 failed. Tests might not be accurate. Error: ${e.message}`);
  }
}, 120000);

afterAll(async () => {
  if (api) await api.disconnect();
});

// ========================================
// LIVE PALLET TESTS
// ========================================

describe('Trust Pallet Live Workflow', () => {

  it('should allow root to recalculate trust score for a user', async () => {
    console.log('Testing force_recalculate_trust_score...');

    const scoreBefore = await api.query.trust.trustScoreOf(user1.address);
    expect(scoreBefore.toNumber()).toBe(0); // Should be 0 initially

    // Recalculate score as root
    await sendAndFinalize(api.tx.trust.forceRecalculateTrustScore(user1.address), sudo);

    const scoreAfter = await api.query.trust.trustScoreOf(user1.address);
    // Score should be greater than zero because user has staking and tiki scores
    expect(scoreAfter.toNumber()).toBeGreaterThan(0);
    console.log(`Trust score for user1 successfully updated to ${scoreAfter.toNumber()}.`);
  });

  it('should NOT allow a non-root user to recalculate score', async () => {
    console.log('Testing BadOrigin for force_recalculate_trust_score...');

    await expect(
      sendAndFinalize(api.tx.trust.forceRecalculateTrustScore(user1.address), user1)
    ).rejects.toThrow('system.BadOrigin');
    console.log('Verified: Non-root cannot force a recalculation.');
  });

  it('should allow root to update all trust scores', async () => {
    console.log('Testing update_all_trust_scores...');

    // This transaction should succeed
    await sendAndFinalize(api.tx.trust.updateAllTrustScores(), sudo);
    
    // We can't easily verify the result without knowing all citizens, 
    // but we can confirm the transaction itself doesn't fail.
    console.log('Successfully called update_all_trust_scores.');

    // The score for user1 should still be what it was, as nothing has changed
    const scoreAfterAll = await api.query.trust.trustScoreOf(user1.address);
    expect(scoreAfterAll.toNumber()).toBeGreaterThan(0);
  });

  it('should NOT allow a non-root user to update all scores', async () => {
    console.log('Testing BadOrigin for update_all_trust_scores...');

    await expect(
      sendAndFinalize(api.tx.trust.updateAllTrustScores(), user1)
    ).rejects.toThrow('system.BadOrigin');
    console.log('Verified: Non-root cannot update all scores.');
  });

  it('should fail to calculate score for a non-citizen', async () => {
      console.log('Testing failure for non-citizen...');
      const nonCitizen = keyring.addFromUri('//Eve');
      
      // This extrinsic requires root, but the underlying `calculate_trust_score` function
      // should return a `NotACitizen` error, which is what we expect the extrinsic to fail with.
      await expect(
          sendAndFinalize(api.tx.trust.forceRecalculateTrustScore(nonCitizen.address), sudo)
      ).rejects.toThrow('trust.NotACitizen');
      console.log('Verified: Cannot calculate score for a non-citizen.');
  });
});
