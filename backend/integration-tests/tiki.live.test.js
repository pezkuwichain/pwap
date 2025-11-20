/**
 * @file: tiki.live.test.js
 * @description: Live integration tests for the Tiki pallet.
 * 
 * @preconditions:
 *  1. A local Pezkuwi dev node must be running and accessible at `ws://127.0.0.1:8082`.
 *  2. The node must have the `tiki` pallet.
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
let sudo, user1, user2;

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

  console.log('Connected to node and initialized accounts for Tiki tests.');
}, 40000);

afterAll(async () => {
  if (api) await api.disconnect();
});

// ========================================
// LIVE PALLET TESTS
// ========================================

describe('Tiki Pallet Live Workflow', () => {

  it('should mint a Citizen NFT, grant/revoke roles, and calculate score correctly', async () => {
    // -----------------------------------------------------------------
    // PHASE 1: MINT CITIZEN NFT
    // -----------------------------------------------------------------
    console.log('PHASE 1: Minting Citizen NFT for User1...');

    await sendAndFinalize(api.tx.tiki.forceMintCitizenNft(user1.address), sudo);

    // Verify NFT exists and Welati role is granted
    const citizenNft = await api.query.tiki.citizenNft(user1.address);
    expect(citizenNft.isSome).toBe(true);
    const userTikis = await api.query.tiki.userTikis(user1.address);
    expect(userTikis.map(t => t.toString())).toContain('Welati');
    console.log('Citizen NFT minted. User1 now has Welati tiki.');

    // Verify initial score (Welati = 10 points)
    let tikiScore = await api.query.tiki.getTikiScore(user1.address);
    expect(tikiScore.toNumber()).toBe(10);
    console.log(`Initial Tiki score is ${tikiScore.toNumber()}.`);

    // -----------------------------------------------------------------
    // PHASE 2: GRANT & SCORE
    // -----------------------------------------------------------------
    console.log('PHASE 2: Granting additional roles and verifying score updates...');

    // Grant an Appointed role (Wezir = 100 points)
    await sendAndFinalize(api.tx.tiki.grantTiki(user1.address, { Appointed: 'Wezir' }), sudo);
    tikiScore = await api.query.tiki.getTikiScore(user1.address);
    expect(tikiScore.toNumber()).toBe(110); // 10 (Welati) + 100 (Wezir)
    console.log('Granted Wezir. Score is now 110.');

    // Grant an Earned role (Axa = 250 points)
    await sendAndFinalize(api.tx.tiki.grantEarnedRole(user1.address, { Earned: 'Axa' }), sudo);
    tikiScore = await api.query.tiki.getTikiScore(user1.address);
    expect(tikiScore.toNumber()).toBe(360); // 110 + 250 (Axa)
    console.log('Granted Axa. Score is now 360.');

    // -----------------------------------------------------------------
    // PHASE 3: REVOKE & SCORE
    // -----------------------------------------------------------------
    console.log('PHASE 3: Revoking a role and verifying score update...');

    // Revoke Wezir role (-100 points)
    await sendAndFinalize(api.tx.tiki.revokeTiki(user1.address, { Appointed: 'Wezir' }), sudo);
    tikiScore = await api.query.tiki.getTikiScore(user1.address);
    expect(tikiScore.toNumber()).toBe(260); // 360 - 100
    console.log('Revoked Wezir. Score is now 260.');

    const finalUserTikis = await api.query.tiki.userTikis(user1.address);
    expect(finalUserTikis.map(t => t.toString())).not.toContain('Wezir');
  });

  it('should enforce unique roles', async () => {
    console.log('Testing unique role enforcement (Serok)...');
    const uniqueRole = { Elected: 'Serok' };

    // Mint Citizen NFT for user2
    await sendAndFinalize(api.tx.tiki.forceMintCitizenNft(user2.address), sudo);

    // Grant unique role to user1
    await sendAndFinalize(api.tx.tiki.grantElectedRole(user1.address, uniqueRole), sudo);
    const tikiHolder = (await api.query.tiki.tikiHolder(uniqueRole)).unwrap();
    expect(tikiHolder.toString()).toBe(user1.address);
    console.log('Granted unique role Serok to User1.');

    // Attempt to grant the same unique role to user2
    await expect(
      sendAndFinalize(api.tx.tiki.grantElectedRole(user2.address, uniqueRole), sudo)
    ).rejects.toThrow('tiki.RoleAlreadyTaken');
    console.log('Verified: Cannot grant the same unique role to a second user.');
  });
  
  it('should fail to grant roles to a non-citizen', async () => {
    console.log('Testing failure for granting role to non-citizen...');
    const nonCitizenUser = keyring.addFromUri('//Eve');

    await expect(
        sendAndFinalize(api.tx.tiki.grantTiki(nonCitizenUser.address, { Appointed: 'Wezir' }), sudo)
    ).rejects.toThrow('tiki.CitizenNftNotFound');
    console.log('Verified: Cannot grant role to a user without a Citizen NFT.');
  });
});
