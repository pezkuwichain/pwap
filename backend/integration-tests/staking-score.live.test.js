/**
 * @file: staking-score.live.test.js
 * @description: Live integration tests for the StakingScore pallet.
 * 
 * @preconditions:
 *  1. A local Pezkuwi dev node must be running and accessible at `ws://127.0.0.1:8082`.
 *  2. The node must have the `stakingScore` and `staking` pallets.
 *  3. Test accounts must be funded to be able to bond stake.
 */

import { ApiPromise, WsProvider, Keyring } from '@pezkuwi/api';
import { BN } from '@pezkuwi/util';
import { jest } from '@jest/globals';

// ========================================
// TEST CONFIGURATION
// ========================================

const WS_ENDPOINT = 'ws://127.0.0.1:8082';
jest.setTimeout(120000); // 2 minutes, as this involves waiting for blocks

const UNITS = new BN('1000000000000'); // 10^12

// ========================================
// TEST SETUP & TEARDOWN
// ========================================

let api;
let keyring;
let user1; 

// Helper to wait for N finalized blocks
const waitForBlocks = async (count) => {
  let blocksLeft = count;
  return new Promise(resolve => {
    const unsubscribe = api.rpc.chain.subscribeFinalizedHeads(() => {
      blocksLeft--;
      if (blocksLeft <= 0) {
        unsubscribe();
        resolve();
      }
    });
  });
};

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
  keyring = new Keyring({ type: 'sr5519' });
  
  // Using a fresh account for each test run to avoid state conflicts
  user1 = keyring.addFromUri(`//StakingScoreUser${Date.now()}`)

  // You may need to fund this account using sudo if it has no balance
  // For example:
  // const sudo = keyring.addFromUri('//Alice');
  // const transferTx = api.tx.balances.transfer(user1.address, UNITS.mul(new BN(10000)));
  // await sendAndFinalize(transferTx, sudo);

  console.log('Connected to node and initialized account for StakingScore tests.');
}, 40000);

afterAll(async () => {
  if (api) await api.disconnect();
});

// ========================================
// LIVE PALLET TESTS
// ========================================

describe('StakingScore Pallet Live Workflow', () => {

  it('should calculate the base score correctly based on staked amount only', async () => {
    console.log('Testing base score calculation...');

    // Stake 500 PEZ (should result in a base score of 40)
    const stakeAmount = UNITS.mul(new BN(500));
    const bondTx = api.tx.staking.bond(stakeAmount, 'Staked'); // Bond to self
    await sendAndFinalize(bondTx, user1);

    // Without starting tracking, score should be based on amount only
    const { score: scoreBeforeTracking } = await api.query.stakingScore.getStakingScore(user1.address);
    expect(scoreBeforeTracking.toNumber()).toBe(40);
    console.log(`Verified base score for ${stakeAmount} stake is ${scoreBeforeTracking.toNumber()}.`);

    // Even after waiting, score should not change
    await waitForBlocks(5);
    const { score: scoreAfterWaiting } = await api.query.stakingScore.getStakingScore(user1.address);
    expect(scoreAfterWaiting.toNumber()).toBe(40);
    console.log('Verified score does not change without tracking enabled.');
  });

  it('should apply duration multiplier after tracking is started', async () => {
    console.log('Testing duration multiplier...');
    const MONTH_IN_BLOCKS = api.consts.stakingScore.monthInBlocks.toNumber();

    // User1 already has 500 PEZ staked from the previous test.
    // Now, let's start tracking.
    const startTrackingTx = api.tx.stakingScore.startScoreTracking();
    await sendAndFinalize(startTrackingTx, user1);
    console.log('Score tracking started for User1.');

    // Wait for 4 months
    console.log(`Waiting for 4 months (${4 * MONTH_IN_BLOCKS} blocks)...`);
    await waitForBlocks(4 * MONTH_IN_BLOCKS);

    // Score should now be 40 (base) * 1.5 (4 month multiplier) = 60
    const { score: scoreAfter4Months } = await api.query.stakingScore.getStakingScore(user1.address);
    expect(scoreAfter4Months.toNumber()).toBe(60);
    console.log(`Verified score after 4 months is ${scoreAfter4Months.toNumber()}.`);

    // Wait for another 9 months (total 13 months) to reach max multiplier
    console.log(`Waiting for another 9 months (${9 * MONTH_IN_BLOCKS} blocks)...`);
    await waitForBlocks(9 * MONTH_IN_BLOCKS);

    // Score should be 40 (base) * 2.0 (12+ month multiplier) = 80
    const { score: scoreAfter13Months } = await api.query.stakingScore.getStakingScore(user1.address);
    expect(scoreAfter13Months.toNumber()).toBe(80);
    console.log(`Verified score after 13 months is ${scoreAfter13Months.toNumber()}.`);
  });

  it('should fail to start tracking if no stake is found or already tracking', async () => {
    const freshUser = keyring.addFromUri(`//FreshUser${Date.now()}`);
    // You would need to fund this freshUser account for it to pay transaction fees.

    console.log('Testing failure cases for start_score_tracking...');

    // Case 1: No stake found
    await expect(
      sendAndFinalize(api.tx.stakingScore.startScoreTracking(), freshUser)
    ).rejects.toThrow('stakingScore.NoStakeFound');
    console.log('Verified: Cannot start tracking without a stake.');

    // Case 2: Already tracking (using user1 from previous tests)
    await expect(
      sendAndFinalize(api.tx.stakingScore.startScoreTracking(), user1)
    ).rejects.toThrow('stakingScore.TrackingAlreadyStarted');
    console.log('Verified: Cannot start tracking when already started.');
  });
});
