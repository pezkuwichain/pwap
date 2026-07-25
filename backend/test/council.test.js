// Offline council / KYC tests — real signature crypto, mocked chain + Supabase.
// Run: node --test
//
// NODE_ENV must NOT be 'test' here: the handlers skip signature verification
// when NODE_ENV === 'test', and we specifically want to exercise the real
// @pezkuwi/util-crypto signature gate (reject unsigned/invalid, accept valid).

process.env.NODE_ENV = 'ci-offline'

import { test } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { Keyring } from '@pezkuwi/keyring'
import { cryptoWaitReady } from '@pezkuwi/util-crypto'
import { u8aToHex } from '@pezkuwi/util'
import { createApp } from '../src/council.js'
import { makeFakeSupabase } from './helpers/fake-supabase.js'

await cryptoWaitReady()

const keyring = new Keyring({ type: 'sr25519' })
const founder = keyring.addFromUri('//Founder')
const proposer = keyring.addFromUri('//Proposer')
const stranger = keyring.addFromUri('//Stranger')
const user = keyring.addFromUri('//KycUser')

const sign = (pair, message) => u8aToHex(pair.sign(message))

const silentLogger = { info () {}, warn () {}, error () {}, fatal () {}, debug () {} }

// Stubbed chain: approveKyc(...).signAndSend(sudo, cb) drives the callback with
// a finalized, successful event so the "mark executed" branch runs — no network.
function makeMockApi () {
  const calls = []
  const api = {
    tx: {
      identityKyc: {
        approveKyc: (addr) => ({
          async signAndSend (sudo, cb) {
            calls.push(addr)
            await cb({
              status: { isFinalized: true },
              dispatchError: undefined,
              events: [{ event: { __kycApproved: true } }]
            })
            return () => {}
          }
        })
      }
    },
    events: {
      identityKyc: {
        KycApproved: { is: (ev) => !!(ev && ev.__kycApproved) }
      }
    },
    registry: { findMetaError: () => ({ section: 's', name: 'n', docs: [] }) }
  }
  return { api, calls }
}

// --- /api/council/add-member ------------------------------------------------

test('add-member: 500 when FOUNDER_ADDRESS not configured', async () => {
  delete process.env.FOUNDER_ADDRESS
  const app = createApp({ supabase: makeFakeSupabase(), logger: silentLogger })
  const res = await request(app).post('/api/council/add-member').send({
    newMemberAddress: stranger.address,
    signature: '0x00',
    message: `addCouncilMember:${stranger.address}`
  })
  assert.equal(res.statusCode, 500)
  assert.equal(res.body.error.key, 'errors.server.founder_not_configured')
})

test('add-member: 401 on invalid signature', async () => {
  process.env.FOUNDER_ADDRESS = founder.address
  const app = createApp({ supabase: makeFakeSupabase(), logger: silentLogger })
  const message = `addCouncilMember:${stranger.address}`
  const res = await request(app).post('/api/council/add-member').send({
    newMemberAddress: stranger.address,
    signature: sign(stranger, message), // well-formed, but NOT the founder's key
    message
  })
  assert.equal(res.statusCode, 401)
  assert.equal(res.body.error.key, 'errors.auth.invalid_signature')
})

test('add-member: 400 when signed message does not match the action', async () => {
  process.env.FOUNDER_ADDRESS = founder.address
  const message = 'addCouncilMember:5SomeoneElse'
  const app = createApp({ supabase: makeFakeSupabase(), logger: silentLogger })
  const res = await request(app).post('/api/council/add-member').send({
    newMemberAddress: stranger.address,
    signature: sign(founder, message),
    message
  })
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.error.key, 'errors.request.message_mismatch')
})

test('add-member: 200 on valid founder signature', async () => {
  process.env.FOUNDER_ADDRESS = founder.address
  const message = `addCouncilMember:${stranger.address}`
  const supabase = makeFakeSupabase()
  const app = createApp({ supabase, logger: silentLogger })
  const res = await request(app).post('/api/council/add-member').send({
    newMemberAddress: stranger.address,
    signature: sign(founder, message),
    message
  })
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.success, true)
  assert.equal(supabase._tables.council_members.length, 1)
})

test('add-member: 409 when member already exists', async () => {
  process.env.FOUNDER_ADDRESS = founder.address
  const message = `addCouncilMember:${stranger.address}`
  const supabase = makeFakeSupabase({ council_members: [{ address: stranger.address }] })
  const app = createApp({ supabase, logger: silentLogger })
  const res = await request(app).post('/api/council/add-member').send({
    newMemberAddress: stranger.address,
    signature: sign(founder, message),
    message
  })
  assert.equal(res.statusCode, 409)
  assert.equal(res.body.error.key, 'errors.council.member_exists')
})

// --- /api/kyc/propose -------------------------------------------------------

test('propose: 401 on invalid proposer signature', async () => {
  const app = createApp({ supabase: makeFakeSupabase(), logger: silentLogger })
  const message = `proposeKYC:${user.address}`
  const res = await request(app).post('/api/kyc/propose').send({
    userAddress: user.address,
    proposerAddress: proposer.address,
    signature: sign(stranger, message), // signed by a different key than proposerAddress
    message
  })
  assert.equal(res.statusCode, 401)
})

test('propose: 403 when proposer is not a council member', async () => {
  const message = `proposeKYC:${user.address}`
  const app = createApp({ supabase: makeFakeSupabase(), logger: silentLogger })
  const res = await request(app).post('/api/kyc/propose').send({
    userAddress: user.address,
    proposerAddress: proposer.address, // not seeded into council_members
    signature: sign(proposer, message),
    message
  })
  assert.equal(res.statusCode, 403)
  assert.equal(res.body.error.key, 'errors.auth.proposer_not_member')
})

test('propose: 201 and auto-executes when threshold reached (chain mocked)', async () => {
  const message = `proposeKYC:${user.address}`
  const supabase = makeFakeSupabase({ council_members: [{ address: proposer.address }] })
  const { api, calls } = makeMockApi()
  const app = createApp({
    supabase,
    getApi: () => api,
    getSudo: () => ({ address: founder.address }), // stub signer
    logger: silentLogger
  })

  const res = await request(app).post('/api/kyc/propose').send({
    userAddress: user.address,
    proposerAddress: proposer.address,
    signature: sign(proposer, message),
    message
  })

  assert.equal(res.statusCode, 201)
  assert.equal(res.body.success, true)
  // Single-member council → 60% threshold (ceil(1*0.6)=1) met by the auto-aye,
  // so approveKyc was signed+sent for the user and the proposal marked executed.
  assert.deepEqual(calls, [user.address])
  const proposal = supabase._tables.kyc_proposals[0]
  assert.equal(proposal.executed, true)
})

test('propose: does NOT execute below threshold (multi-member council)', async () => {
  const message = `proposeKYC:${user.address}`
  const supabase = makeFakeSupabase({
    council_members: [
      { address: proposer.address },
      { address: founder.address },
      { address: stranger.address }
    ]
  })
  const { api, calls } = makeMockApi()
  const app = createApp({
    supabase,
    getApi: () => api,
    getSudo: () => ({ address: founder.address }),
    logger: silentLogger
  })

  const res = await request(app).post('/api/kyc/propose').send({
    userAddress: user.address,
    proposerAddress: proposer.address,
    signature: sign(proposer, message),
    message
  })

  assert.equal(res.statusCode, 201)
  // 3 members → required = ceil(3*0.6)=2, only 1 aye → no on-chain execution.
  assert.deepEqual(calls, [])
  assert.equal(supabase._tables.kyc_proposals[0].executed, false)
})

// --- /api/kyc/pending -------------------------------------------------------

test('GET /api/kyc/pending lists non-executed proposals', async () => {
  const supabase = makeFakeSupabase({
    kyc_proposals: [
      { user_address: user.address, proposer_address: proposer.address, executed: false },
      { user_address: stranger.address, proposer_address: proposer.address, executed: true }
    ]
  })
  const app = createApp({ supabase, logger: silentLogger })
  const res = await request(app).get('/api/kyc/pending')
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.pending.length, 1)
  assert.equal(res.body.pending[0].user_address, user.address)
})
