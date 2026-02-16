/**
 * @file: staking-score.live.test.js
 * @description: Live integration tests for the StakingScore pallet (v1020007+).
 *
 * Tests the noter-based staking score system:
 * - start_score_tracking() — no stake requirement, user opt-in
 * - receive_staking_details() — noter/root submits cached staking data
 * - CachedStakingDetails storage — dual-source (RelayChain, AssetHub)
 * - Zero stake cleanup
 *
 * @preconditions:
 *  1. A local Pezkuwi dev node must be running at WS_ENDPOINT.
 *  2. The node must have stakingScore pallet (spec >= 1020007).
 *  3. Sudo account (//Alice) must be available for root-origin calls.
 */

import { ApiPromise, WsProvider, Keyring } from '@pezkuwi/api';
import { BN } from '@pezkuwi/util';
import { jest } from '@jest/globals';

// ========================================
// TEST CONFIGURATION
// ========================================

const WS_ENDPOINT = process.env.WS_ENDPOINT || 'ws://127.0.0.1:8082';
jest.setTimeout(120000);

const UNITS = new BN('1000000000000'); // 10^12

// ========================================
// HELPERS
// ========================================

let api;
let keyring;
let sudo;
let user1;

const sendAndFinalize = (tx, signer) => {
  return new Promise((resolve, reject) => {
    tx.signAndSend(signer, ({ status, dispatchError }) => {
      if (status.isFinalized) {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            reject(new Error(`${decoded.section}.${decoded.name}`));
          } else {
            reject(new Error(dispatchError.toString()));
          }
        } else {
          resolve();
        }
      }
    }).catch(reject);
  });
};

const sendSudoAndFinalize = (call) => {
  const sudoTx = api.tx.sudo.sudo(call);
  return sendAndFinalize(sudoTx, sudo);
};

beforeAll(async () => {
  const wsProvider = new WsProvider(WS_ENDPOINT);
  api = await ApiPromise.create({ provider: wsProvider });
  keyring = new Keyring({ type: 'sr25519' });

  sudo = keyring.addFromUri('//Alice');
  user1 = keyring.addFromUri(`//StakingScoreUser${Date.now()}`);

  // Fund test account
  const transferTx = api.tx.balances.transferKeepAlive(user1.address, UNITS.mul(new BN(100)));
  await sendAndFinalize(transferTx, sudo);

  console.log('Setup complete. User1:', user1.address);
}, 60000);

afterAll(async () => {
  if (api) await api.disconnect();
});

// ========================================
// TESTS
// ========================================

describe('StakingScore Pallet (v1020007+)', () => {

  it('start_score_tracking() succeeds without any stake', async () => {
    // User1 has no staking ledger — should still succeed (no NoStakeFound error)
    const tx = api.tx.stakingScore.startScoreTracking();
    await sendAndFinalize(tx, user1);

    // Verify StakingStartBlock is set
    const startBlock = await api.query.stakingScore.stakingStartBlock(user1.address);
    expect(startBlock.isSome).toBe(true);
    console.log('start_score_tracking succeeded, startBlock:', startBlock.unwrap().toNumber());
  });

  it('start_score_tracking() fails with TrackingAlreadyStarted', async () => {
    const tx = api.tx.stakingScore.startScoreTracking();
    await expect(sendAndFinalize(tx, user1))
      .rejects.toThrow('stakingScore.TrackingAlreadyStarted');
  });

  it('receive_staking_details() fails without noter authority', async () => {
    // User1 is not a noter — should fail with NotAuthorized
    const tx = api.tx.stakingScore.receiveStakingDetails(
      user1.address,
      'RelayChain',
      UNITS.mul(new BN(500)).toString(), // 500 HEZ
      3,  // nominations_count
      0,  // unlocking_chunks_count
    );
    await expect(sendAndFinalize(tx, user1))
      .rejects.toThrow('stakingScore.NotAuthorized');
  });

  it('receive_staking_details() succeeds via sudo (root origin)', async () => {
    const call = api.tx.stakingScore.receiveStakingDetails(
      user1.address,
      'RelayChain',
      UNITS.mul(new BN(500)).toString(), // 500 HEZ
      3,  // nominations_count
      1,  // unlocking_chunks_count
    );
    await sendSudoAndFinalize(call);

    // Verify CachedStakingDetails is set
    const cached = await api.query.stakingScore.cachedStakingDetails(
      user1.address, 'RelayChain'
    );
    expect(cached.isSome).toBe(true);

    const details = cached.unwrap().toJSON();
    const stakedAmount = BigInt(details.stakedAmount ?? details.staked_amount ?? '0');
    expect(stakedAmount).toBe(UNITS.mul(new BN(500)).toBigInt());
    expect(details.nominationsCount ?? details.nominations_count).toBe(3);
    expect(details.unlockingChunksCount ?? details.unlocking_chunks_count).toBe(1);

    console.log('CachedStakingDetails verified:', details);
  });

  it('receive_staking_details() supports dual-source (AssetHub)', async () => {
    const call = api.tx.stakingScore.receiveStakingDetails(
      user1.address,
      'AssetHub',
      UNITS.mul(new BN(200)).toString(), // 200 HEZ from Asset Hub pool
      0,
      0,
    );
    await sendSudoAndFinalize(call);

    // Both sources should exist
    const relay = await api.query.stakingScore.cachedStakingDetails(user1.address, 'RelayChain');
    const assetHub = await api.query.stakingScore.cachedStakingDetails(user1.address, 'AssetHub');
    expect(relay.isSome).toBe(true);
    expect(assetHub.isSome).toBe(true);

    console.log('Dual-source staking data verified');
  });

  it('zero stake cleans up CachedStakingDetails for a source', async () => {
    // Send zero stake for AssetHub — should remove that entry
    const call = api.tx.stakingScore.receiveStakingDetails(
      user1.address,
      'AssetHub',
      '0', // zero stake
      0,
      0,
    );
    await sendSudoAndFinalize(call);

    // AssetHub entry should be gone
    const assetHub = await api.query.stakingScore.cachedStakingDetails(user1.address, 'AssetHub');
    expect(assetHub.isNone || assetHub.isEmpty).toBe(true);

    // RelayChain entry should still exist
    const relay = await api.query.stakingScore.cachedStakingDetails(user1.address, 'RelayChain');
    expect(relay.isSome).toBe(true);

    // StakingStartBlock should still exist (still has relay stake)
    const startBlock = await api.query.stakingScore.stakingStartBlock(user1.address);
    expect(startBlock.isSome).toBe(true);

    console.log('Zero stake cleanup verified (AssetHub removed, RelayChain kept)');
  });

  it('zero stake on all sources removes StakingStartBlock', async () => {
    // Remove relay chain stake too
    const call = api.tx.stakingScore.receiveStakingDetails(
      user1.address,
      'RelayChain',
      '0',
      0,
      0,
    );
    await sendSudoAndFinalize(call);

    // Both sources should be empty
    const relay = await api.query.stakingScore.cachedStakingDetails(user1.address, 'RelayChain');
    const assetHub = await api.query.stakingScore.cachedStakingDetails(user1.address, 'AssetHub');
    expect(relay.isNone || relay.isEmpty).toBe(true);
    expect(assetHub.isNone || assetHub.isEmpty).toBe(true);

    // StakingStartBlock should also be cleaned up
    const startBlock = await api.query.stakingScore.stakingStartBlock(user1.address);
    expect(startBlock.isNone || startBlock.isEmpty).toBe(true);

    console.log('Full cleanup verified (all sources + StakingStartBlock removed)');
  });
});
