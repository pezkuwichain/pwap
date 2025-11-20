/**
 * @file: pez-rewards.live.test.js
 * @description: Live integration tests for the PezRewards pallet.
 * 
 * @preconditions:
 *  1. A local Pezkuwi dev node must be running and accessible at `ws://127.0.0.1:8082`.
 *  2. The node must have the `pezRewards` pallet.
 *  3. The tests require a funded sudo account (`//Alice`).
 */

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { jest } from '@jest/globals';

// ========================================
// TEST CONFIGURATION
// ========================================

const WS_ENDPOINT = 'ws://127.0.0.1:8082';
jest.setTimeout(120000); // 2 minutes, as this involves waiting for blocks

// ========================================
// TEST SETUP & TEARDOWN
// ========================================

let api;
let keyring;
let sudo, user1, user2;

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
  keyring = new Keyring({ type: 'sr25519' });
  
  sudo = keyring.addFromUri('//Alice');
  user1 = keyring.addFromUri('//Charlie');
  user2 = keyring.addFromUri('//Dave');

  console.log('Connected to node for PezRewards tests.');
});

afterAll(async () => {
  if (api) await api.disconnect();
});

// ========================================
// LIVE PALLET TESTS
// ========================================

describe('PezRewards Pallet Live Workflow', () => {

  // We run the tests in a single, sequential `it` block to manage state
  // across different epochs without complex cleanup.
  it('should run a full epoch lifecycle: Record -> Finalize -> Claim', async () => {
    
    // -----------------------------------------------------------------
    // PHASE 1: RECORD SCORES (in the current epoch)
    // -----------------------------------------------------------------
    console.log('PHASE 1: Recording trust scores...');
    
    const currentEpoch = (await api.query.pezRewards.getCurrentEpochInfo()).currentEpoch.toNumber();
    console.log(`Operating in Epoch ${currentEpoch}.`);

    await sendAndFinalize(api.tx.pezRewards.recordTrustScore(), user1);
    await sendAndFinalize(api.tx.pezRewards.recordTrustScore(), user2);

    const score1 = (await api.query.pezRewards.getUserTrustScoreForEpoch(currentEpoch, user1.address)).unwrap().toNumber();
    const score2 = (await api.query.pezRewards.getUserTrustScoreForEpoch(currentEpoch, user2.address)).unwrap().toNumber();

    // These values depend on the mock trust score provider in the dev node
    console.log(`Scores recorded: User1 (${score1}), User2 (${score2})`);
    expect(score1).toBeGreaterThan(0);
    expect(score2).toBeGreaterThanOrEqual(0); // Dave might have 0 score

    // -----------------------------------------------------------------
    // PHASE 2: FINALIZE EPOCH
    // -----------------------------------------------------------------
    console.log('PHASE 2: Waiting for epoch to end and finalizing...');

    // Wait for the epoch duration to pass. Get this from the pallet's constants.
    const blocksPerEpoch = api.consts.pezRewards.blocksPerEpoch.toNumber();
    console.log(`Waiting for ${blocksPerEpoch} blocks to pass...`);
    await waitForBlocks(blocksPerEpoch);

    await sendAndFinalize(api.tx.pezRewards.finalizeEpoch(), sudo);

    const epochStatus = (await api.query.pezRewards.epochStatus(currentEpoch)).toString();
    expect(epochStatus).toBe('ClaimPeriod');
    console.log(`Epoch ${currentEpoch} is now in ClaimPeriod.`);

    // -----------------------------------------------------------------
    // PHASE 3: CLAIM REWARDS
    // -----------------------------------------------------------------
    console.log('PHASE 3: Claiming rewards...');

    // User 1 claims their reward
    await sendAndFinalize(api.tx.pezRewards.claimReward(currentEpoch), user1);
    const claimedReward = await api.query.pezRewards.getClaimedReward(currentEpoch, user1.address);
    expect(claimedReward.isSome).toBe(true);
    console.log(`User1 successfully claimed a reward of ${claimedReward.unwrap().toNumber()}.`);

    // -----------------------------------------------------------------
    // PHASE 4: VERIFY FAILURE CASES
    // -----------------------------------------------------------------
    console.log('PHASE 4: Verifying failure cases...');

    // User 1 tries to claim again
    await expect(
      sendAndFinalize(api.tx.pezRewards.claimReward(currentEpoch), user1)
    ).rejects.toThrow('pezRewards.RewardAlreadyClaimed');
    console.log('Verified that a user cannot claim twice.');
    
    // Wait for the claim period to expire
    const claimPeriodBlocks = api.consts.pezRewards.claimPeriodBlocks.toNumber();
    console.log(`Waiting for claim period (${claimPeriodBlocks} blocks) to expire...`);
    await waitForBlocks(claimPeriodBlocks + 1); // +1 to be safe
    
    // User 2 tries to claim after the period is over
    await expect(
      sendAndFinalize(api.tx.pezRewards.claimReward(currentEpoch), user2)
    ).rejects.toThrow('pezRewards.ClaimPeriodExpired');
    console.log('Verified that a user cannot claim after the claim period.');
  });
});
