import request from 'supertest';
import { ApiPromise, WsProvider, Keyring } from '@pezkuwi/api';
import { app, supabase } from '../src/server.js';

// ========================================
// TEST SETUP
// ========================================

let api;
let keyring;
let sudo;
let councilMember1;
let userToApprove;

const API_URL = 'http://localhost:3001';

// Helper function to wait for the next block to be finalized
const nextBlock = () => new Promise(res => api.rpc.chain.subscribeNewHeads(head => res()));

beforeAll(async () => {
  const wsProvider = new WsProvider(process.env.WS_ENDPOINT || 'ws://127.0.0.1:9944');
  api = await ApiPromise.create({ provider: wsProvider });
  keyring = new Keyring({ type: 'sr25519' });
  
  sudo = keyring.addFromUri('//Alice');
  councilMember1 = keyring.addFromUri('//Bob');
  userToApprove = keyring.addFromUri('//Charlie');
  
  // Ensure accounts have funds if needed (dev node usually handles this)
  console.log('Test accounts initialized.');
}, 40000); // Increase timeout for initial connection

afterAll(async () => {
  if (api) await api.disconnect();
});

beforeEach(async () => {
  // Clean database tables before each test
  await supabase.from('votes').delete().neq('voter_address', 'null');
  await supabase.from('kyc_proposals').delete().neq('user_address', 'null');
  await supabase.from('council_members').delete().neq('address', 'null');

  // Reset relevant blockchain state if necessary
  // For example, revoking KYC for the test user to ensure a clean slate
  try {
    const status = await api.query.identityKyc.kycStatusOf(userToApprove.address);
    if (status.isApproved || status.isPending) {
        await new Promise((resolve, reject) => {
            api.tx.sudo.sudo(
                api.tx.identityKyc.revokeKyc(userToApprove.address)
            ).signAndSend(sudo, ({ status }) => {
                if (status.isFinalized) resolve();
            });
        });
    }
  } catch(e) { /* Ignore if pallet or storage doesn't exist */ }
}, 20000);

// ========================================
// LIVE INTEGRATION TESTS
// ========================================

describe('KYC Approval Workflow via API', () => {

  it('should process a KYC application from proposal to approval', async () => {
    // ===============================================================
    // PHASE 1: SETUP (Direct Blockchain Interaction & API Setup)
    // ===============================================================
    
    // 1a. Add council member to the DB via API
    // Note: We are skipping signature checks for now as per previous discussions.
    // The endpoint must be temporarily adjusted to allow this for the test.
    const addMemberRes = await request(app)
      .post('/api/council/add-member')
      .send({ 
        newMemberAddress: councilMember1.address,
        signature: '0x00', 
        message: `addCouncilMember:${councilMember1.address}`
      });
    expect(addMemberRes.statusCode).toBe(200);

    // 1b. User sets identity and applies for KYC (direct blockchain tx)
    await api.tx.identityKyc.setIdentity("Charlie", "charlie@test.com").signAndSend(userToApprove);
    await api.tx.identityKyc.applyForKyc([], "Notes").signAndSend(userToApprove);
    await nextBlock(); // Wait for tx to be included

    let kycStatus = await api.query.identityKyc.kycStatusOf(userToApprove.address);
    expect(kycStatus.toString()).toBe('Pending');

    // ===============================================================
    // PHASE 2: ACTION (API Interaction)
    // ===============================================================

    // 2a. Council member proposes the user for KYC approval via API
    const proposeRes = await request(app)
      .post('/api/kyc/propose')
      .send({
        userAddress: userToApprove.address,
        proposerAddress: councilMember1.address,
        signature: '0x00', // Skipped
        message: `proposeKYC:${userToApprove.address}`
      });
    expect(proposeRes.statusCode).toBe(201);
    
    // In a multi-member scenario, more votes would be needed here.
    // Since our checkAndExecute has a threshold of 60% and we have 1 member,
    // this single "propose" action (which includes an auto "aye" vote)
    // should be enough to trigger the `approve_kyc` transaction.
    
    // Wait for the backend's async `checkAndExecute` to finalize the tx
    console.log("Waiting for backend to execute and finalize the transaction...");
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds

    // ===============================================================
    // PHASE 3: VERIFICATION (Direct Blockchain Query)
    // ===============================================================

    // 3a. Verify the user's KYC status is now "Approved" on-chain
    kycStatus = await api.query.identityKyc.kycStatusOf(userToApprove.address);
    expect(kycStatus.toString()).toBe('Approved');

    // 3b. Verify the proposal is marked as "executed" in the database
    const { data: proposal, error } = await supabase
      .from('kyc_proposals')
      .select('executed')
      .eq('user_address', userToApprove.address)
      .single();
    expect(error).toBeNull();
    expect(proposal.executed).toBe(true);
  });
});