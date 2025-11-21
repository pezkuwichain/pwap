/**
 * @file: kyc.live.test.js
 * @description: Live integration tests for the KYC backend API.
 * 
 * @preconditions:
 *  1. A local Pezkuwi dev node must be running and accessible at `ws://127.0.0.1:8082`.
 *  2. The KYC backend server must be running and accessible at `http://127.0.0.1:8082`.
 *  3. The Supabase database must be clean, or the tests will fail on unique constraints.
 *  4. The backend's .env file must be correctly configured (SUDO_SEED, FOUNDER_ADDRESS, etc.).
 *  5. The backend must be running in a mode that bypasses signature checks for these tests (e.g., NODE_ENV=test).
 * 
 * @execution:
 *  Run this file with Jest: `npx jest kyc.live.test.js`
 */

import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import axios from 'axios'; // Using axios for HTTP requests

// ========================================
// TEST CONFIGURATION
// ========================================

const API_BASE_URL = 'http://127.0.0.1:8082/api';
const WS_ENDPOINT = 'ws://127.0.0.1:8082';

// Set a long timeout for all tests in this file
jest.setTimeout(60000); // 60 seconds

// ========================================
// TEST SETUP & TEARDOWN
// ========================================

let api;
let keyring;
let sudo, founder, councilMember, user1, user2;

beforeAll(async () => {
  const wsProvider = new WsProvider(WS_ENDPOINT);
  api = await ApiPromise.create({ provider: wsProvider });
  keyring = new Keyring({ type: 'sr25519' });
  
  // Define accounts from the well-known dev seeds
  sudo = keyring.addFromUri('//Alice');
  founder = keyring.addFromUri('//Alice'); // Assuming founder is also sudo for tests
  councilMember = keyring.addFromUri('//Bob');
  user1 = keyring.addFromUri('//Charlie');
  user2 = keyring.addFromUri('//Dave');

  console.log('Connected to node and initialized accounts.');
});

afterAll(async () => {
  if (api) await api.disconnect();
  console.log('Disconnected from node.');
});

// Helper to wait for the next finalized block
const nextBlock = () => new Promise(res => api.rpc.chain.subscribeFinalizedHeads(() => res()));

// ========================================
// LIVE INTEGRATION TESTS
// ========================================

describe('Live KYC Workflow', () => {

  it('should run a full KYC lifecycle: Setup -> Propose -> Vote -> Approve -> Verify', async () => {
    
    // -----------------------------------------------------------------
    // PHASE 1: SETUP
    // -----------------------------------------------------------------
    console.log('PHASE 1: Setting up initial state...');
    
    // 1a. Clear and set up the council in the database via API
    await axios.post(`${API_BASE_URL}/council/add-member`, {
      newMemberAddress: councilMember.address,
      signature: '0x00', message: `addCouncilMember:${councilMember.address}`
    });
    
    // 1b. User1 sets their identity on-chain
    await api.tx.identityKyc.setIdentity("User1", "user1@test.com").signAndSend(user1);
    
    // 1c. User1 applies for KYC on-chain
    await api.tx.identityKyc.applyForKyc([], "Live test application").signAndSend(user1);

    await nextBlock(); // Wait for setup transactions to be finalized

    // Verification of setup
    let kycStatus = (await api.query.identityKyc.kycStatusOf(user1.address)).toString();
    expect(kycStatus).toBe('Pending');
    console.log('User1 KYC status is correctly set to Pending.');

    // -----------------------------------------------------------------
    // PHASE 2: API ACTION (Propose & Vote)
    // -----------------------------------------------------------------
    console.log('PHASE 2: Council member proposes user via API...');

    const proposeResponse = await axios.post(`${API_BASE_URL}/kyc/propose`, {
      userAddress: user1.address,
      proposerAddress: councilMember.address,
      signature: '0x00', message: `proposeKYC:${user1.address}`
    });
    expect(proposeResponse.status).toBe(201);
    console.log('Proposal successful. Backend should now be executing `approve_kyc`...');

    // Since we have 1 council member and the threshold is 60%, the proposer's
    // automatic "aye" vote is enough to trigger `checkAndExecute`.
    // We need to wait for the backend to see the vote, execute the transaction,
    // and for that transaction to be finalized on-chain. This can take time.
    await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15s for finalization

    // -----------------------------------------------------------------
    // PHASE 3: VERIFICATION
    // -----------------------------------------------------------------
    console.log('PHASE 3: Verifying final state on-chain and in DB...');

    // 3a. Verify on-chain status is now 'Approved'
    kycStatus = (await api.query.identityKyc.kycStatusOf(user1.address)).toString();
    expect(kycStatus).toBe('Approved');
    console.log('SUCCESS: On-chain KYC status for User1 is now Approved.');

    // 3b. Verify via API that the proposal is no longer pending
    const pendingResponse = await axios.get(`${API_BASE_URL}/kyc/pending`);
    const pendingForUser1 = pendingResponse.data.pending.find(p => p.userAddress === user1.address);
    expect(pendingForUser1).toBeUndefined();
    console.log('SUCCESS: Pending proposals list is correctly updated.');
  });

  it('should reject a proposal from a non-council member', async () => {
    console.log('Testing rejection of non-council member proposal...');
    const nonCouncilMember = keyring.addFromUri('//Eve');

    // Attempt to propose from an address not in the council DB
    await expect(axios.post(`${API_BASE_URL}/kyc/propose`, {
      userAddress: user2.address,
      proposerAddress: nonCouncilMember.address,
      signature: '0x00', message: `proposeKYC:${user2.address}`
    })).rejects.toThrow('Request failed with status code 403');
    
    console.log('SUCCESS: API correctly returned 403 Forbidden.');
  });
});
