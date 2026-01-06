/**
 * @file: pez-treasury.live.test.js
 * @description: Live integration tests for the PezTreasury pallet.
 * 
 * @preconditions:
 *  1. A local Pezkuwi dev node must be running and accessible at `ws://127.0.0.1:8082`.
 *  2. The node must have the `pezTreasury` pallet.
 *  3. The tests require a funded sudo account (`//Alice`).
 */

import { ApiPromise, WsProvider, Keyring } from '@pezkuwi/api';
import { BN } from '@pezkuwi/util';
import { jest } from '@jest/globals';

// ========================================
// TEST CONFIGURATION
// ========================================

const WS_ENDPOINT = 'ws://127.0.0.1:8082';
jest.setTimeout(300000); // 5 minutes, as this involves waiting for many blocks (months)

// ========================================
// TEST SETUP & TEARDOWN
// ========================================

let api;
let keyring;
let sudo, alice;

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

// Helper to get Pez balance
const getPezBalance = async (address) => {
  const accountInfo = await api.query.system.account(address);
  return new BN(accountInfo.data.free.toString());
};

// Account IDs for treasury pots (from mock.rs)
let treasuryAccountId, incentivePotAccountId, governmentPotAccountId;

beforeAll(async () => {
  const wsProvider = new WsProvider(WS_ENDPOINT);
  api = await ApiPromise.create({ provider: wsProvider });
  keyring = new Keyring({ type: 'sr25519' });
  
  sudo = keyring.addFromUri('//Alice');
  alice = keyring.addFromUri('//Bob'); // Non-root user for BadOrigin tests

  // Get actual account IDs from the pallet (if exposed as getters)
  // Assuming the pallet exposes these as storage maps or constants for JS access
  // If not, we'd need to get them from the chain state using a more complex method
  treasuryAccountId = (await api.query.pezTreasury.treasuryAccountId()).toString();
  incentivePotAccountId = (await api.query.pezTreasury.incentivePotAccountId()).toString();
  governmentPotAccountId = (await api.query.pezTreasury.governmentPotAccountId()).toString();

  console.log('Connected to node and initialized accounts for PezTreasury tests.');
  console.log(`Treasury Account ID: ${treasuryAccountId}`);
  console.log(`Incentive Pot Account ID: ${incentivePotAccountId}`);
  console.log(`Government Pot Account ID: ${governmentPotAccountId}`);
}, 40000); 

afterAll(async () => {
  if (api) await api.disconnect();
  console.log('Disconnected from node.');
});


describe('PezTreasury Pallet Live Workflow', () => {

  // We run the tests in a single, sequential `it` block to manage state
  // across different periods without complex cleanup.
  it('should execute a full treasury lifecycle including genesis, initialization, monthly releases, and halving', async () => {
    // Constants from the pallet (assuming they are exposed)
    const BLOCKS_PER_MONTH = api.consts.pezTreasury.blocksPerMonth.toNumber();
    const HALVING_PERIOD_MONTHS = api.consts.pezTreasury.halvingPeriodMonths.toNumber();
    const PARITY = new BN(1_000_000_000_000); // 10^12 for 1 PEZ

    // -----------------------------------------------------------------
    // PHASE 1: GENESIS DISTRIBUTION
    // -----------------------------------------------------------------
    console.log('PHASE 1: Performing genesis distribution...');

    await sendAndFinalize(api.tx.pezTreasury.doGenesisDistribution(), sudo);
    
    const treasuryBalanceAfterGenesis = await getPezBalance(treasuryAccountId);
    expect(treasuryBalanceAfterGenesis.gt(new BN(0))).toBe(true);
    console.log(`Treasury balance after genesis: ${treasuryBalanceAfterGenesis}`);
    
    // Verify cannot distribute twice
    await expect(
      sendAndFinalize(api.tx.pezTreasury.doGenesisDistribution(), sudo)
    ).rejects.toThrow('pezTreasury.GenesisDistributionAlreadyDone');
    console.log('Verified: Genesis distribution cannot be done twice.');

    // -----------------------------------------------------------------
    // PHASE 2: INITIALIZE TREASURY
    // -----------------------------------------------------------------
    console.log('PHASE 2: Initializing treasury...');

    await sendAndFinalize(api.tx.pezTreasury.initializeTreasury(), sudo);
    
    let halvingInfo = await api.query.pezTreasury.halvingInfo();
    expect(halvingInfo.currentPeriod.toNumber()).toBe(0);
    expect(halvingInfo.monthlyAmount.gt(new BN(0))).toBe(true);
    console.log(`Treasury initialized. Initial monthly amount: ${halvingInfo.monthlyAmount}`);

    // Verify cannot initialize twice
    await expect(
      sendAndFinalize(api.tx.pezTreasury.initializeTreasury(), sudo)
    ).rejects.toThrow('pezTreasury.TreasuryAlreadyInitialized');
    console.log('Verified: Treasury cannot be initialized twice.');

    // -----------------------------------------------------------------
    // PHASE 3: MONTHLY RELEASES (Before Halving)
    // -----------------------------------------------------------------
    console.log('PHASE 3: Performing monthly releases (before halving)...');

    const initialMonthlyAmount = halvingInfo.monthlyAmount;
    const monthsToReleaseBeforeHalving = HALVING_PERIOD_MONTHS - 1; // Release up to 47th month

    for (let month = 0; month < monthsToReleaseBeforeHalving; month++) {
      console.log(`Releasing for month ${month}... (Current Block: ${(await api.rpc.chain.getHeader()).number.toNumber()})`);
      await waitForBlocks(BLOCKS_PER_MONTH + 1); // +1 to ensure we are past the boundary
      await sendAndFinalize(api.tx.pezTreasury.releaseMonthlyFunds(), sudo);

      const nextReleaseMonth = (await api.query.pezTreasury.nextReleaseMonth()).toNumber();
      expect(nextReleaseMonth).toBe(month + 1);
    }
    console.log(`Released funds for ${monthsToReleaseBeforeHalving} months.`);

    // -----------------------------------------------------------------
    // PHASE 4: HALVING
    // -----------------------------------------------------------------
    console.log('PHASE 4: Triggering halving at month 48...');
    // Release the 48th month, which should trigger halving
    await waitForBlocks(BLOCKS_PER_MONTH + 1); 
    await sendAndFinalize(api.tx.pezTreasury.releaseMonthlyFunds(), sudo);

    halvingInfo = await api.query.pezTreasury.halvingInfo();
    expect(halvingInfo.currentPeriod.toNumber()).toBe(1);
    expect(halvingInfo.monthlyAmount.toString()).toBe(initialMonthlyAmount.div(new BN(2)).toString());
    console.log(`Halving successful. New monthly amount: ${halvingInfo.monthlyAmount}`);

    // -----------------------------------------------------------------
    // PHASE 5: VERIFY BAD ORIGIN
    // -----------------------------------------------------------------
    console.log('PHASE 5: Verifying BadOrigin errors...');

    // Try to initialize treasury as non-root
    await expect(
      sendAndFinalize(api.tx.pezTreasury.initializeTreasury(), alice)
    ).rejects.toThrow('system.BadOrigin');
    console.log('Verified: Non-root cannot initialize treasury.');

    // Try to release funds as non-root
    await expect(
      sendAndFinalize(api.tx.pezTreasury.releaseMonthlyFunds(), alice)
    ).rejects.toThrow('system.BadOrigin');
    console.log('Verified: Non-root cannot release monthly funds.');

  });
});
