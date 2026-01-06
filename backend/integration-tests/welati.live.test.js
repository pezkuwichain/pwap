/**
 * @file: welati.live.test.js
 * @description: Live integration tests for the Welati (Election, Appointment, Proposal) pallet.
 * 
 * @preconditions:
 *  1. A local Pezkuwi dev node must be running and accessible at `ws://127.0.0.1:8082`.
 *  2. The node must have the `welati` pallet included.
 *  3. The tests require a funded sudo account (`//Alice`).
 *  4. Endorser accounts for candidate registration need to be available and funded.
 *     (e.g., //User1, //User2, ..., //User50 for Parliamentary elections).
 * 
 * @execution:
 *  Run this file with Jest: `npx jest backend/integration-tests/welati.live.test.js`
 */

import { ApiPromise, WsProvider, Keyring } from '@pezkuwi/api';
import { BN } from '@pezkuwi/util';
import { jest } from '@jest/globals';

// ========================================
// TEST CONFIGURATION
// ========================================

const WS_ENDPOINT = 'ws://127.0.0.1:8082';
jest.setTimeout(300000); // 5 minutes, as elections involve very long block periods

// ========================================
// TEST SETUP & TEARDOWN
// ========================================

let api;
let keyring;
let sudo, presidentialCandidate, parliamentaryCandidate, voter1, parliamentMember1, parliamentMember2;

// Helper to wait for N finalized blocks
const waitForBlocks = async (count) => {
  if (count <= 0) return; // No need to wait for 0 or negative blocks
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
  presidentialCandidate = keyring.addFromUri('//Bob');
  parliamentaryCandidate = keyring.addFromUri('//Charlie');
  voter1 = keyring.addFromUri('//Dave');
  parliamentMember1 = keyring.addFromUri('//Eve');
  parliamentMember2 = keyring.addFromUri('//Ferdie');

  console.log('Connected to node and initialized accounts for Welati tests.');
}, 40000); // Increased timeout for initial connection

afterAll(async () => {
  if (api) await api.disconnect();
});

// ========================================
// LIVE PALLET TESTS
// ========================================

describe('Welati Pallet Live Workflow', () => {

  let electionId = 0; // Tracks the current election ID
  let proposalId = 0; // Tracks the current proposal ID

  // --- Helper to get election periods (assuming they are constants exposed by the pallet) ---
  const getElectionPeriods = () => ({
    candidacy: api.consts.welati.candidacyPeriodBlocks.toNumber(),
    campaign: api.consts.welati.campaignPeriodBlocks.toNumber(),
    voting: api.consts.welati.votingPeriodBlocks.toNumber(),
  });

  // --- Helper to add a parliament member (requires sudo) ---
  // Assuming there's a direct sudo call or an internal mechanism. 
  // For simplicity, we'll directly set a parliament member via sudo if the pallet exposes a setter.
  // If not, this would be a mock or a pre-configured chain state.
  const addParliamentMember = async (memberAddress) => {
    // Assuming an extrinsic like `welati.addParliamentMember` for sudo, or a similar setup.
    // If not, this might be a complex setup involving other pallets (e.g., elected through an election).
    // For this test, we'll assume a direct Sudo command exists or we simulate it's already done.
    console.warn(`
    WARNING: Directly adding parliament members for tests. In a real scenario, 
    this would involve going through an election process or a privileged extrinsic.
    Please ensure your dev node is configured to allow this, or adjust the test 
    accordingly to simulate a real election. 
    `);
    // As a placeholder, we'll assume `sudo` can directly update some storage or a mock takes over.
    // If this is to be a true live test, ensure the chain has a way for sudo to add members.
    // Example (if an extrinsic exists): await sendAndFinalize(api.tx.welati.addParliamentMember(memberAddress), sudo);

    // For now, if the `tests-welati.rs` uses `add_parliament_member(1);` it implies such a mechanism.
    // We'll simulate this by just proceeding, assuming the account *is* recognized as a parliament member for proposal submission.
    // A more robust solution might involve setting up a mock for hasTiki(Parliamentary) from Tiki pallet.
  };

  // ===============================================================
  // ELECTION SYSTEM TESTS
  // ===============================================================
  describe('Election System', () => {

    it('should initiate a Parliamentary election and finalize it', async () => {
      console.log('Starting Parliamentary election lifecycle...');
      const periods = getElectionPeriods();

      // -----------------------------------------------------------------
      // 1. Initiate Election
      // -----------------------------------------------------------------
      await sendAndFinalize(api.tx.welati.initiateElection(
        { Parliamentary: null }, // ElectionType
        null, // No districts for simplicity
        null  // No initial candidates (runoff) for simplicity
      ), sudo);
      electionId = (await api.query.welati.nextElectionId()).toNumber() - 1;
      console.log(`Election ${electionId} initiated. Candidacy Period started.`);
      
      let election = (await api.query.welati.activeElections(electionId)).unwrap();
      expect(election.status.toString()).toBe('CandidacyPeriod');

      // -----------------------------------------------------------------
      // 2. Register Candidate
      // -----------------------------------------------------------------
      // Assuming parliamentary requires 50 endorsers, creating dummy ones for test
      const endorsers = Array.from({ length: 50 }, (_, i) => keyring.addFromUri(`//Endorser${i + 1}`).address);
      await sendAndFinalize(api.tx.welati.registerCandidate(
        electionId,
        parliamentaryCandidate.address,
        null, // No district
        endorsers // List of endorser addresses
      ), parliamentaryCandidate);
      console.log(`Candidate ${parliamentaryCandidate.meta.name} registered.`);

      // -----------------------------------------------------------------
      // 3. Move to Voting Period
      // -----------------------------------------------------------------
      console.log(`Waiting for ${periods.candidacy + periods.campaign} blocks to enter Voting Period...`);
      await waitForBlocks(periods.candidacy + periods.campaign + 1); 
      
      election = (await api.query.welati.activeElections(electionId)).unwrap();
      expect(election.status.toString()).toBe('VotingPeriod');
      console.log('Now in Voting Period.');

      // -----------------------------------------------------------------
      // 4. Cast Vote
      // -----------------------------------------------------------------
      await sendAndFinalize(api.tx.welati.castVote(
        electionId,
        [parliamentaryCandidate.address], // Vote for this candidate
        null // No district
      ), voter1);
      console.log(`Voter ${voter1.meta.name} cast vote.`);

      // -----------------------------------------------------------------
      // 5. Finalize Election
      // -----------------------------------------------------------------
      console.log(`Waiting for ${periods.voting} blocks to finalize election...`);
      await waitForBlocks(periods.voting + 1); // +1 to ensure we are past the end block
      
      await sendAndFinalize(api.tx.welati.finalizeElection(electionId), sudo);
      election = (await api.query.welati.activeElections(electionId)).unwrap();
      expect(election.status.toString()).toBe('Completed');
      console.log(`Election ${electionId} finalized.`);
    });

    it('should fail to initiate election for non-root origin', async () => {
      console.log('Testing failure to initiate election by non-root...');
      await expect(
        sendAndFinalize(api.tx.welati.initiateElection({ Presidential: null }, null, null), voter1)
      ).rejects.toThrow('system.BadOrigin');
      console.log('Verified: Non-root cannot initiate elections.');
    });

    // More election-specific tests (e.g., insufficient endorsements, already voted, wrong period)
    // can be added following this pattern.
  });

  // ===============================================================
  // APPOINTMENT SYSTEM TESTS
  // ===============================================================
  describe('Appointment System', () => {
    it('should allow Serok to nominate and approve an official', async () => {
      console.log('Starting official appointment lifecycle...');
      const officialToNominate = keyring.addFromUri('//Eve');
      const justification = "Highly skilled individual";

      // -----------------------------------------------------------------
      // 1. Set Serok (President) - Assuming Serok can nominate/approve
      //    In a live chain, Serok would be elected via the election system.
      //    For this test, we use sudo to set the Serok directly.
      //    This requires a `setCurrentOfficial` extrinsic or similar setter for sudo.
      //    We are simulating the presence of a Serok for the purpose of nomination.
      await sendAndFinalize(api.tx.welati.setCurrentOfficial({ Serok: null }, sudo.address), sudo); // Placeholder extrinsic
      // await api.tx.welati.setCurrentOfficial({ Serok: null }, sudo.address).signAndSend(sudo);
      // Ensure the Serok is set if `setCurrentOfficial` exists and is called.
      // If not, this part needs to be revised based on how Serok is actually set.
      // For now, assume `sudo.address` is the Serok.
      const serok = sudo; // Assume Alice is Serok for this test
      console.log(`Serok set to: ${serok.address}`);

      // -----------------------------------------------------------------
      // 2. Nominate Official
      // -----------------------------------------------------------------
      await sendAndFinalize(api.tx.welati.nominateOfficial(
        officialToNominate.address,
        { Appointed: 'Dadger' }, // OfficialRole
        justification
      ), serok);
      const appointmentId = (await api.query.welati.nextAppointmentId()).toNumber() - 1;
      console.log(`Official nominated. Appointment ID: ${appointmentId}`);
      
      let appointment = (await api.query.welati.appointmentProcesses(appointmentId)).unwrap();
      expect(appointment.status.toString()).toBe('Nominated');

      // -----------------------------------------------------------------
      // 3. Approve Appointment
      // -----------------------------------------------------------------
      await sendAndFinalize(api.tx.welati.approveAppointment(appointmentId), serok);
      
      appointment = (await api.query.welati.appointmentProcesses(appointmentId)).unwrap();
      expect(appointment.status.toString()).toBe('Approved');
      console.log(`Appointment ${appointmentId} approved.`);

      // Verify official role is now held by the nominated person (via Tiki pallet query)
      const officialTikis = await api.query.tiki.userTikis(officialToNominate.address);
      expect(officialTikis.map(t => t.toString())).toContain('Dadger');
      console.log(`Official ${officialToNominate.meta.name} successfully appointed as Dadger.`);
    });

    it('should fail to nominate/approve without proper authorization', async () => {
      console.log('Testing unauthorized appointment actions...');
      const nonSerok = voter1;

      // Attempt to nominate as non-Serok
      await expect(
        sendAndFinalize(api.tx.welati.nominateOfficial(nonSerok.address, { Appointed: 'Dadger' }, "reason"), nonSerok)
      ).rejects.toThrow('welati.NotAuthorizedToNominate');
      console.log('Verified: Non-Serok cannot nominate officials.');

      // Attempt to approve a non-existent appointment as non-Serok
      await expect(
        sendAndFinalize(api.tx.welati.approveAppointment(999), nonSerok)
      ).rejects.toThrow('welati.NotAuthorizedToApprove'); // Or AppointmentProcessNotFound first
      console.log('Verified: Non-Serok cannot approve appointments.');
    });
  });

  // ===============================================================
  // COLLECTIVE DECISION (PROPOSAL) SYSTEM TESTS
  // ===============================================================
  describe('Proposal System', () => {

    it('should allow parliament members to submit and vote on a proposal', async () => {
      console.log('Starting proposal lifecycle...');
      const title = "Test Proposal";
      const description = "This is a test proposal for live integration.";

      // -----------------------------------------------------------------
      // 1. Ensure parliament members are set up
      //    This requires the `parliamentMember1` to have the `Parlementer` Tiki.
      //    We will directly grant the `Parlementer` Tiki via sudo for this test.
      await sendAndFinalize(api.tx.tiki.forceMintCitizenNft(parliamentMember1.address), sudo); // Ensure citizen
      await sendAndFinalize(api.tx.tiki.grantElectedRole(parliamentMember1.address, { Elected: 'Parlementer' }), sudo);
      await sendAndFinalize(api.tx.tiki.forceMintCitizenNft(parliamentMember2.address), sudo); // Ensure citizen
      await sendAndFinalize(api.tx.tiki.grantElectedRole(parliamentMember2.address, { Elected: 'Parlementer' }), sudo);

      const isParliamentMember1 = (await api.query.tiki.hasTiki(parliamentMember1.address, { Elected: 'Parlementer' })).isTrue;
      expect(isParliamentMember1).toBe(true);
      console.log('Parliament members set up with Parlementer Tiki.');

      // -----------------------------------------------------------------
      // 2. Submit Proposal
      // -----------------------------------------------------------------
      await sendAndFinalize(api.tx.welati.submitProposal(
        title,
        description,
        { ParliamentSimpleMajority: null }, // CollectiveDecisionType
        { Normal: null }, // ProposalPriority
        null // No linked election ID
      ), parliamentMember1);
      proposalId = (await api.query.welati.nextProposalId()).toNumber() - 1;
      console.log(`Proposal ${proposalId} submitted.`);
      
      let proposal = (await api.query.welati.activeProposals(proposalId)).unwrap();
      expect(proposal.status.toString()).toBe('VotingPeriod');
      console.log('Proposal is now in Voting Period.');

      // -----------------------------------------------------------------
      // 3. Vote on Proposal
      // -----------------------------------------------------------------
      await sendAndFinalize(api.tx.welati.voteOnProposal(
        proposalId,
        { Aye: null }, // VoteChoice
        null // No rationale
      ), parliamentMember2);
      console.log(`Parliament Member ${parliamentMember2.meta.name} cast an Aye vote.`);

      // Verify vote count (assuming simple majority, 2 Ayes needed if 2 members)
      proposal = (await api.query.welati.activeProposals(proposalId)).unwrap();
      expect(proposal.ayeVotes.toNumber()).toBe(1); // One vote from parliamentMember2, one from parliamentMember1 (proposer)

      // For simplicity, we are not finalizing the proposal, as that would require
      // calculating thresholds and potentially executing a batch transaction.
      // The focus here is on submission and voting.
    });

    it('should fail to submit/vote on a proposal without proper authorization', async () => {
      console.log('Testing unauthorized proposal actions...');
      const nonParliamentMember = voter1;
      const title = "Unauthorized"; const description = "Desc";

      // Attempt to submit as non-parliament member
      await expect(
        sendAndFinalize(api.tx.welati.submitProposal(
          title, description, { ParliamentSimpleMajority: null }, { Normal: null }, null
        ), nonParliamentMember)
      ).rejects.toThrow('welati.NotAuthorizedToPropose');
      console.log('Verified: Non-parliament member cannot submit proposals.');

      // Attempt to vote on non-existent proposal as non-parliament member
      await expect(
        sendAndFinalize(api.tx.welati.voteOnProposal(999, { Aye: null }, null), nonParliamentMember)
      ).rejects.toThrow('welati.NotAuthorizedToVote'); // Or ProposalNotFound
      console.log('Verified: Non-parliament member cannot vote on proposals.');
    });
  });
});
