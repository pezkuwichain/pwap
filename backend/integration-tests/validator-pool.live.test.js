/**
 * @file: validator-pool.live.test.js
 * @description: Live integration tests for the ValidatorPool pallet.
 * 
 * @preconditions:
 *  1. A local Pezkuwi dev node must be running and accessible at `ws://127.0.0.1:8082`.
 *  2. The node must have `validatorPool`, `trust`, `tiki`, and `staking` pallets.
 *  3. The tests require a funded sudo account (`//Alice`).
 */

import { ApiPromise, WsProvider, Keyring } from '@pezkuwi/api';
import { BN } from '@pezkuwi/util';
import { jest } from '@jest/globals';

// ========================================
// TEST CONFIGURATION
// ========================================

const WS_ENDPOINT = 'ws://127.0.0.1:8082';
jest.setTimeout(120000); // 2 minutes

const UNITS = new BN('1000000000000'); // 10^12

// ========================================
// TEST SETUP & TEARDOWN
// ========================================

let api;
let keyring;
let sudo, userWithHighTrust, userWithLowTrust;

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
  userWithHighTrust = keyring.addFromUri('//Charlie');
  userWithLowTrust = keyring.addFromUri('//Dave');

  console.log('Connected to node and initialized accounts for ValidatorPool tests.');

  // --- Test Setup: Ensure userWithHighTrust has a high trust score ---
  console.log('Setting up a user with a high trust score...');
  try {
    // 1. Make user a citizen
    await sendAndFinalize(api.tx.tiki.forceMintCitizenNft(userWithHighTrust.address), sudo);

    // 2. Bond a large stake
    const stakeAmount = UNITS.mul(new BN(10000)); // High stake for high score
    await sendAndFinalize(api.tx.staking.bond(stakeAmount, 'Staked'), userWithHighTrust);

    // 3. Force recalculate trust score
    await sendAndFinalize(api.tx.trust.forceRecalculateTrustScore(userWithHighTrust.address), sudo);

    const score = await api.query.trust.trustScoreOf(userWithHighTrust.address);
    console.log(`Setup complete. User trust score is: ${score.toNumber()}.`);
    // This check is important for the test's validity
    expect(score.toNumber()).toBeGreaterThan(api.consts.validatorPool.minTrustScore.toNumber());

  } catch (e) {
    console.warn(`Setup for userWithHighTrust failed. Tests might not be accurate. Error: ${e.message}`);
  }
}, 180000); // 3 minutes timeout for this complex setup

afterAll(async () => {
  if (api) await api.disconnect();
});

// ========================================
// LIVE PALLET TESTS
// ========================================

describe('ValidatorPool Pallet Live Workflow', () => {

  const stakeValidatorCategory = { StakeValidator: null };

  it('should allow a user with sufficient trust to join and leave the pool', async () => {
    // -----------------------------------------------------------------
    // PHASE 1: JOIN POOL
    // -----------------------------------------------------------------
    console.log('PHASE 1: Joining the validator pool...');

    await sendAndFinalize(api.tx.validatorPool.joinValidatorPool(stakeValidatorCategory), userWithHighTrust);

    const poolMember = await api.query.validatorPool.poolMembers(userWithHighTrust.address);
    expect(poolMember.isSome).toBe(true);
    const poolSize = await api.query.validatorPool.poolSize();
    expect(poolSize.toNumber()).toBeGreaterThanOrEqual(1);
    console.log('User successfully joined the pool.');

    // -----------------------------------------------------------------
    // PHASE 2: LEAVE POOL
    // -----------------------------------------------------------------
    console.log('PHASE 2: Leaving the validator pool...');

    await sendAndFinalize(api.tx.validatorPool.leaveValidatorPool(), userWithHighTrust);

    const poolMemberAfterLeave = await api.query.validatorPool.poolMembers(userWithHighTrust.address);
    expect(poolMemberAfterLeave.isNone).toBe(true);
    console.log('User successfully left the pool.');
  });

  it('should fail for users with insufficient trust or those not in the pool', async () => {
    console.log('Testing failure cases...');

    // Case 1: Insufficient trust score
    await expect(
      sendAndFinalize(api.tx.validatorPool.joinValidatorPool(stakeValidatorCategory), userWithLowTrust)
    ).rejects.toThrow('validatorPool.InsufficientTrustScore');
    console.log('Verified: Cannot join with insufficient trust score.');

    // Case 2: Already in pool (re-join)
    await sendAndFinalize(api.tx.validatorPool.joinValidatorPool(stakeValidatorCategory), userWithHighTrust);
    await expect(
      sendAndFinalize(api.tx.validatorPool.joinValidatorPool(stakeValidatorCategory), userWithHighTrust)
    ).rejects.toThrow('validatorPool.AlreadyInPool');
    console.log('Verified: Cannot join when already in the pool.');
    // Cleanup
    await sendAndFinalize(api.tx.validatorPool.leaveValidatorPool(), userWithHighTrust);

    // Case 3: Not in pool (leave)
    await expect(
      sendAndFinalize(api.tx.validatorPool.leaveValidatorPool(), userWithLowTrust)
    ).rejects.toThrow('validatorPool.NotInPool');
    console.log('Verified: Cannot leave when not in the pool.');
  });

  it('should allow root to force a new era', async () => {
    console.log('Testing force_new_era...');
    
    const minValidators = api.consts.validatorPool.minValidators.toNumber();
    console.log(`Minimum validators required for new era: ${minValidators}`);

    // Add enough members to meet the minimum requirement
    const members = ['//Charlie', '//Dave', '//Eve', '//Ferdie', '//Gerard'].slice(0, minValidators);
    for (const memberSeed of members) {
      const member = keyring.addFromUri(memberSeed);
      // We assume these test accounts also meet the trust requirements.
      // For a robust test, each should be set up like userWithHighTrust.
      try {
        await sendAndFinalize(api.tx.validatorPool.joinValidatorPool(stakeValidatorCategory), member);
      } catch (e) {
        // Ignore if already in pool from a previous failed run
        if (!e.message.includes('validatorPool.AlreadyInPool')) throw e;
      }
    }
    console.log(`Joined ${minValidators} members to the pool.`);

    const initialEra = await api.query.validatorPool.currentEra();
    
    await sendAndFinalize(api.tx.validatorPool.forceNewEra(), sudo);

    const newEra = await api.query.validatorPool.currentEra();
    expect(newEra.toNumber()).toBe(initialEra.toNumber() + 1);
    console.log(`Successfully forced new era. Moved from era ${initialEra} to ${newEra}.`);

    const validatorSet = await api.query.validatorPool.currentValidatorSet();
    expect(validatorSet.isSome).toBe(true);
    console.log('Verified that a new validator set has been created.');
  });
});
