/**
 * @file: referral.live.test.js
 * @description: Live integration tests for the Referral pallet.
 * 
 * @preconditions:
 *  1. A local Pezkuwi dev node must be running and accessible at `ws://127.0.0.1:8082`.
 *  2. The node must have the `referral` and `identityKyc` pallets included.
 *  3. The tests require a funded sudo account (`//Alice`).
 */

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
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
let sudo, referrer, referred1, referred2;

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
  referrer = keyring.addFromUri('//Bob');
  referred1 = keyring.addFromUri('//Charlie');
  referred2 = keyring.addFromUri('//Dave');

  console.log('Connected to node and initialized accounts for Referral tests.');
}, 40000); // Increased timeout for initial connection

afterAll(async () => {
  if (api) await api.disconnect();
  console.log('Disconnected from node.');
});

// ========================================
// LIVE PALLET TESTS
// ========================================

describe('Referral Pallet Live Workflow', () => {

  it('should run a full referral lifecycle: Initiate -> Approve KYC -> Confirm', async () => {
    // -----------------------------------------------------------------
    // PHASE 1: INITIATE REFERRAL
    // -----------------------------------------------------------------
    console.log(`PHASE 1: ${referrer.meta.name} is referring ${referred1.meta.name}...`);

    await sendAndFinalize(api.tx.referral.initiateReferral(referred1.address), referrer);

    // Verify pending referral is created
    const pending = (await api.query.referral.pendingReferrals(referred1.address)).unwrap();
    expect(pending.toString()).toBe(referrer.address);
    console.log('Pending referral successfully created.');

    // -----------------------------------------------------------------
    // PHASE 2: KYC APPROVAL (SUDO ACTION)
    // -----------------------------------------------------------------
    console.log(`PHASE 2: Sudo is approving KYC for ${referred1.meta.name}...`);

    // To trigger the `on_kyc_approved` hook, we need to approve the user's KYC.
    // In a real scenario, this would happen via the KYC council. In tests, we use sudo.
    // Note: This assumes the `identityKyc` pallet has a `approveKyc` function callable by Sudo.
    const approveKycTx = api.tx.identityKyc.approveKyc(referred1.address);
    const sudoTx = api.tx.sudo.sudo(approveKycTx);
    await sendAndFinalize(sudoTx, sudo);
    console.log('KYC Approved. The on_kyc_approved hook should have triggered.');
    
    // -----------------------------------------------------------------
    // PHASE 3: VERIFICATION
    // -----------------------------------------------------------------
    console.log('PHASE 3: Verifying referral confirmation...');

    // 1. Pending referral should be deleted
    const pendingAfter = await api.query.referral.pendingReferrals(referred1.address);
    expect(pendingAfter.isNone).toBe(true);

    // 2. Referrer's referral count should be 1
    const referrerCount = await api.query.referral.referralCount(referrer.address);
    expect(referrerCount.toNumber()).toBe(1);

    // 3. Permanent referral record should be created
    const referralInfo = (await api.query.referral.referrals(referred1.address)).unwrap();
    expect(referralInfo.referrer.toString()).toBe(referrer.address);
    console.log('Referral successfully confirmed and stored.');
  });

  it('should fail for self-referrals', async () => {
    console.log('Testing self-referral failure...');
    await expect(
      sendAndFinalize(api.tx.referral.initiateReferral(referrer.address), referrer)
    ).rejects.toThrow('referral.SelfReferral');
    console.log('Verified: Self-referral correctly fails.');
  });

  it('should fail if a user is already referred', async () => {
    console.log('Testing failure for referring an already-referred user...');

    // referred2 will be referred by referrer
    await sendAndFinalize(api.tx.referral.initiateReferral(referred2.address), referrer);

    // another user (sudo in this case) tries to refer the same person
    await expect(
      sendAndFinalize(api.tx.referral.initiateReferral(referred2.address), sudo)
    ).rejects.toThrow('referral.AlreadyReferred');
    console.log('Verified: Referring an already-referred user correctly fails.');
  });
  
  it('should allow root to force confirm a referral', async () => {
    console.log('Testing sudo force_confirm_referral...');
    const userToForceRefer = keyring.addFromUri('//Eve');

    await sendAndFinalize(
      api.tx.referral.forceConfirmReferral(referrer.address, userToForceRefer.address),
      sudo
    );

    // Referrer count should now be 2 (1 from the first test, 1 from this one)
    const referrerCount = await api.query.referral.referralCount(referrer.address);
    expect(referrerCount.toNumber()).toBe(2);

    // Permanent referral record should be created
    const referralInfo = (await api.query.referral.referrals(userToForceRefer.address)).unwrap();
    expect(referralInfo.referrer.toString()).toBe(referrer.address);
    console.log('Verified: Sudo can successfully force-confirm a referral.');
  });
});
