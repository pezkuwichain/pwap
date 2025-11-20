/**
 * @file: presale.live.test.js
 * @description: Live integration tests for the Presale pallet.
 * 
 * @preconditions:
 *  1. A local Pezkuwi dev node must be running and accessible at `ws://127.0.0.1:8082`.
 *  2. The node must have the `presale` pallet included.
 *  3. The node must have asset IDs for PEZ (1) and wUSDT (2) configured and functional.
 *  4. Test accounts (e.g., //Alice, //Bob) must have initial balances of wUSDT.
 */

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { BN } from '@polkadot/util';
import { jest } from '@jest/globals';

// ========================================
// TEST CONFIGURATION
// ========================================

const WS_ENDPOINT = 'ws://127.0.0.1:8082';
jest.setTimeout(90000); // 90 seconds

// ========================================
// TEST SETUP & TEARDOWN
// ========================================

let api;
let keyring;
let sudo, alice, bob;

// Asset IDs (assumed from mock.rs)
const PEZ_ASSET_ID = 1;
const WUSDT_ASSET_ID = 2; // Assuming wUSDT has 6 decimals

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

// Helper to get asset balance
const getAssetBalance = async (assetId, address) => {
  const accountInfo = await api.query.assets.account(assetId, address);
  return new BN(accountInfo.balance.toString());
};

beforeAll(async () => {
  const wsProvider = new WsProvider(WS_ENDPOINT);
  api = await ApiPromise.create({ provider: wsProvider });
  keyring = new Keyring({ type: 'sr25519' });
  
  sudo = keyring.addFromUri('//Alice');
  alice = keyring.addFromUri('//Bob'); // User for contributions
  bob = keyring.addFromUri('//Charlie'); // Another user

  console.log('Connected to node and initialized accounts for Presale tests.');
}, 40000); // Increased timeout for initial connection

afterAll(async () => {
  if (api) await api.disconnect();
  console.log('Disconnected from node.');
});

// ========================================
// LIVE PALLET TESTS
// ========================================

describe('Presale Pallet Live Workflow', () => {

  // This test covers the main lifecycle: Start -> Contribute -> Finalize
  it('should allow root to start presale, users to contribute, and root to finalize and distribute PEZ', async () => {
    // Ensure presale is not active from previous runs or default state
    const presaleActiveInitial = (await api.query.presale.presaleActive()).isTrue;
    if (presaleActiveInitial) {
        // If active, try to finalize it to clean up
        console.warn('Presale was active initially. Attempting to finalize to clean state.');
        try {
            await sendAndFinalize(api.tx.presale.finalizePresale(), sudo);
            await waitForBlocks(5); // Give time for state to update
        } catch (e) {
            console.warn('Could not finalize initial presale (might not have ended): ', e.message);
            // If it can't be finalized, it might be in an unrecoverable state for this test run.
            // For real-world cleanup, you might need a `reset_pallet` sudo call if available.
        }
    }
    
    // -----------------------------------------------------------------
    // PHASE 1: START PRESALE
    // -----------------------------------------------------------------
    console.log('PHASE 1: Starting presale...');

    await sendAndFinalize(api.tx.presale.startPresale(), sudo);
    let presaleActive = (await api.query.presale.presaleActive()).isTrue;
    expect(presaleActive).toBe(true);
    console.log('Presale successfully started.');

    const startBlock = (await api.query.presale.presaleStartBlock()).unwrap().toNumber();
    const duration = api.consts.presale.presaleDuration.toNumber();
    const endBlock = startBlock + duration; // Assuming pallet counts current block as 1
    console.log(`Presale active from block ${startBlock} until block ${endBlock}.`);

    // Verify cannot start twice
    await expect(
      sendAndFinalize(api.tx.presale.startPresale(), sudo)
    ).rejects.toThrow('presale.AlreadyStarted');
    console.log('Verified: Presale cannot be started twice.');

    // -----------------------------------------------------------------
    // PHASE 2: CONTRIBUTE
    // -----------------------------------------------------------------
    console.log('PHASE 2: Users contributing to presale...');
    
    const contributionAmountWUSDT = new BN(100_000_000); // 100 wUSDT (6 decimals)
    const expectedPezAmount = new BN(10_000_000_000_000_000); // 10,000 PEZ (12 decimals)

    const aliceWUSDTBalanceBefore = await getAssetBalance(WUSDT_ASSET_ID, alice.address);
    const alicePezBalanceBefore = await getAssetBalance(PEZ_ASSET_ID, alice.address);

    expect(aliceWUSDTBalanceBefore.gte(contributionAmountWUSDT)).toBe(true); // Ensure Alice has enough wUSDT

    await sendAndFinalize(api.tx.presale.contribute(contributionAmountWUSDT), alice);
    console.log(`Alice contributed ${contributionAmountWUSDT.div(new BN(1_000_000))} wUSDT.`);

    // Verify contribution tracked
    const aliceContribution = await api.query.presale.contributions(alice.address);
    expect(aliceContribution.toString()).toBe(contributionAmountWUSDT.toString());

    // Verify wUSDT transferred to treasury
    const presaleTreasuryAccount = await api.query.presale.presaleTreasuryAccountId();
    const treasuryWUSDTBalance = await getAssetBalance(WUSDT_ASSET_ID, presaleTreasuryAccount.toString());
    expect(treasuryWUSDTBalance.toString()).toBe(contributionAmountWUSDT.toString());

    // -----------------------------------------------------------------
    // PHASE 3: FINALIZE PRESALE
    // -----------------------------------------------------------------
    console.log('PHASE 3: Moving past presale end and finalizing...');

    const currentBlock = (await api.rpc.chain.getHeader()).number.toNumber();
    const blocksUntilEnd = endBlock - currentBlock + 1; // +1 to ensure we are past the end block
    if (blocksUntilEnd > 0) {
        console.log(`Waiting for ${blocksUntilEnd} blocks until presale ends.`);
        await waitForBlocks(blocksUntilEnd);
    }
    
    await sendAndFinalize(api.tx.presale.finalizePresale(), sudo);
    presaleActive = (await api.query.presale.presaleActive()).isFalse;
    expect(presaleActive).toBe(true);
    console.log('Presale successfully finalized.');

    // -----------------------------------------------------------------
    // PHASE 4: VERIFICATION
    // -----------------------------------------------------------------
    console.log('PHASE 4: Verifying PEZ distribution...');

    const alicePezBalanceAfter = await getAssetBalance(PEZ_ASSET_ID, alice.address);
    expect(alicePezBalanceAfter.sub(alicePezBalanceBefore).toString()).toBe(expectedPezAmount.toString());
    console.log(`Alice received ${expectedPezAmount.div(PARITY)} PEZ.`);

    // Verify cannot contribute after finalize
    await expect(
      sendAndFinalize(api.tx.presale.contribute(new BN(10_000_000)), alice)
    ).rejects.toThrow('presale.PresaleEnded');
    console.log('Verified: Cannot contribute after presale ended.');
  });

  it('should allow root to pause and unpause presale', async () => {
    // Ensure presale is inactive for this test
    const presaleActiveInitial = (await api.query.presale.presaleActive()).isTrue;
    if (presaleActiveInitial) {
        try {
            await sendAndFinalize(api.tx.presale.finalizePresale(), sudo);
            await waitForBlocks(5); 
        } catch (e) { /* Ignore */ }
    }
    
    // Start a new presale instance
    await sendAndFinalize(api.tx.presale.startPresale(), sudo);
    let paused = (await api.query.presale.paused()).isFalse;
    expect(paused).toBe(true);

    // Pause
    await sendAndFinalize(api.tx.presale.emergencyPause(), sudo);
    paused = (await api.query.presale.paused()).isTrue;
    expect(paused).toBe(true);
    console.log('Presale paused.');

    // Try to contribute while paused
    const contributionAmountWUSDT = new BN(1_000_000); // 1 wUSDT
    await expect(
      sendAndFinalize(api.tx.presale.contribute(contributionAmountWUSDT), bob)
    ).rejects.toThrow('presale.PresalePaused');
    console.log('Verified: Cannot contribute while paused.');

    // Unpause
    await sendAndFinalize(api.tx.presale.emergencyUnpause(), sudo);
    paused = (await api.query.presale.paused()).isFalse;
    expect(paused).toBe(true);
    console.log('Presale unpaused.');

    // Should be able to contribute now (assuming it's still active)
    const bobWUSDTBalanceBefore = await getAssetBalance(WUSDT_ASSET_ID, bob.address);
    expect(bobWUSDTBalanceBefore.gte(contributionAmountWUSDT)).toBe(true);

    await sendAndFinalize(api.tx.presale.contribute(contributionAmountWUSDT), bob);
    const bobContribution = await api.query.presale.contributions(bob.address);
    expect(bobContribution.toString()).toBe(contributionAmountWUSDT.toString());
    console.log('Verified: Can contribute after unpausing.');

  });
});
