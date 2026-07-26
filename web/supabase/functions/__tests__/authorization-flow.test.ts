// Handler-flow authorization tests.
//
// Run:  deno test -A web/supabase/functions/__tests__/authorization-flow.test.ts
//
// The edge-function index.ts files call serve() at import time (binding a port
// and constructing a live Supabase client from env), so they cannot be imported
// directly in a unit test. These tests instead re-run each handler's EXACT guard
// sequence against the REAL _shared gate functions + a stateful in-memory Supabase
// mock, proving the composed money-move gates hold: bad signature rejected, a
// verified signer acting on ANOTHER user's id rejected, replayed nonce rejected,
// wrong trade state rejected, the fund DESTINATION is read from the server-side
// trade row, and the confirm-payment compare-and-swap prevents double-release.

import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { Keyring } from 'npm:@pezkuwi/keyring@14.0.25'
import { cryptoWaitReady } from 'npm:@pezkuwi/util-crypto@14.0.25'
import { stringToU8a, u8aToHex, u8aWrapBytes } from 'npm:@pezkuwi/util@14.0.25'

import {
  identityToUUID,
  verifyWalletSignature,
  buildWithdrawChallenge,
  buildConfirmPaymentChallenge,
  assertIdentityOwnedByWallet,
  consumeNonce,
  isFreshTimestamp,
} from '../_shared/identity-auth.ts'

await cryptoWaitReady()
const kr = new Keyring({ type: 'sr25519' })
const seller = kr.addFromUri('//Seller')
const attacker = kr.addFromUri('//Attacker')

// ---------------------------------------------------------------------------
// Stateful in-memory Supabase mock (trades + offers + visa + nonces + rpc)
// ---------------------------------------------------------------------------
interface Trade {
  id: string; seller_id: string; buyer_id: string; offer_id: string
  crypto_amount: number; status: string
}
interface Offer { id: string; token: string }

function makeDb(init: { trades?: Trade[]; offers?: Offer[]; visa?: { visa_number: string; wallet_address: string; status: string }[] }) {
  const trades = new Map<string, Trade>((init.trades ?? []).map(t => [t.id, { ...t }]))
  const offers = new Map<string, Offer>((init.offers ?? []).map(o => [o.id, o]))
  const visa = init.visa ?? []
  const nonces = new Set<string>()
  const releaseCalls: any[] = []

  const client: any = {
    releaseCalls,
    tradesState: trades,
    from(table: string) {
      if (table === 'p2p_visa') {
        const f: Record<string, string> = {}
        const b: any = {
          select() { return b }, eq(c: string, v: string) { f[c] = v; return b },
          async maybeSingle() {
            const row = visa.find(r => r.visa_number === f['visa_number'] && r.wallet_address === f['wallet_address'] && r.status === f['status'])
            return { data: row ?? null, error: null }
          },
        }
        return b
      }
      if (table === 'p2p_challenge_nonces') {
        return { async insert(row: { nonce: string }) { if (nonces.has(row.nonce)) return { error: { code: '23505' } }; nonces.add(row.nonce); return { error: null } } }
      }
      if (table === 'p2p_fiat_trades') {
        const f: Record<string, string> = {}
        let updateVals: Record<string, unknown> | null = null
        const b: any = {
          select() { return b },
          update(vals: Record<string, unknown>) { updateVals = vals; return b },
          eq(c: string, v: string) { f[c] = v; return b },
          async single() { const t = trades.get(f['id']); return { data: t ?? null, error: t ? null : { message: 'not found' } } },
          // Terminal for the CAS update: .update().eq('id').eq('status').select('id')
          then(resolve: (r: any) => void) {
            // Only reached for the update+select CAS chain.
            const t = trades.get(f['id'])
            if (!t || !updateVals) { resolve({ data: [], error: null }); return }
            // compare-and-swap: status filter must still match current row.
            if (f['status'] !== undefined && t.status !== f['status']) { resolve({ data: [], error: null }); return }
            Object.assign(t, updateVals)
            resolve({ data: [{ id: t.id }], error: null })
          },
        }
        return b
      }
      if (table === 'p2p_fiat_offers') {
        const f: Record<string, string> = {}
        const b: any = { select() { return b }, eq(c: string, v: string) { f[c] = v; return b }, async single() { const o = offers.get(f['id']); return { data: o ?? null, error: o ? null : { message: 'nf' } } } }
        return b
      }
      throw new Error('unexpected table ' + table)
    },
    async rpc(fn: string, args: any) {
      if (fn === 'release_escrow_internal') {
        releaseCalls.push(args)
        return { data: { success: true }, error: null }
      }
      throw new Error('unexpected rpc ' + fn)
    },
  }
  return client
}

const getPeopleApiStub = async () => ({ query: { tiki: { citizenNft: async () => ({ isEmpty: true }) } } }) as any

// ---------------------------------------------------------------------------
// Faithful re-implementation of confirm-payment/index.ts guard sequence
// (kept in lockstep with the edge function, including the CAS fix).
// ---------------------------------------------------------------------------
async function runConfirmPayment(db: any, body: any): Promise<{ status: number; body: any }> {
  const J = (status: number, obj: any) => ({ status, body: obj })
  const { tradeId, sellerIdentity, signerAddress, signature, timestamp, nonce } = body
  if (!tradeId || !sellerIdentity || !signerAddress || !signature || !nonce || typeof timestamp !== 'number')
    return J(401, { success: false, error: 'Missing authorization fields' })
  if (!isFreshTimestamp(timestamp)) return J(401, { success: false, error: 'expired' })
  const challenge = buildConfirmPaymentChallenge({ tradeId, sellerIdentity, signerAddress, timestamp, nonce })
  if (!(await verifyWalletSignature(challenge, signature, signerAddress))) return J(401, { success: false, error: 'Invalid signature' })
  const ownership = await assertIdentityOwnedByWallet(db, sellerIdentity, signerAddress, getPeopleApiStub)
  if (!ownership.ok) return J(403, { success: false, error: ownership.error })
  const sellerUserId = await identityToUUID(sellerIdentity)
  const { data: trade, error: tradeErr } = await db.from('p2p_fiat_trades').select('*').eq('id', tradeId).single()
  if (tradeErr || !trade) return J(404, { success: false, error: 'Trade not found' })
  if (trade.seller_id !== sellerUserId) return J(403, { success: false, error: 'Only the trade seller can release this escrow' })
  if (trade.status !== 'payment_sent') return J(400, { success: false, error: 'not awaiting confirmation' })
  const { data: offer } = await db.from('p2p_fiat_offers').select('token').eq('id', trade.offer_id).single()
  if (!offer?.token) return J(400, { success: false, error: 'Offer/token not found' })
  if (!(await consumeNonce(db, nonce, 'confirm_payment'))) return J(401, { success: false, error: 'replay' })
  const nowIso = new Date().toISOString()
  const { data: claimed } = await db.from('p2p_fiat_trades')
    .update({ status: 'completed', seller_confirmed_at: nowIso, escrow_released_at: nowIso, completed_at: nowIso })
    .eq('id', tradeId).eq('status', 'payment_sent').select('id')
  if (!claimed || claimed.length === 0) return J(409, { success: false, error: 'already released' })
  const { data: releaseRes } = await db.rpc('release_escrow_internal', {
    p_from_user_id: trade.seller_id, p_to_user_id: trade.buyer_id, p_token: offer.token,
    p_amount: trade.crypto_amount, p_reference_type: 'trade', p_reference_id: tradeId,
  })
  if (!releaseRes?.success) return J(400, { success: false, error: 'Release failed' })
  return J(200, { success: true, sellerId: trade.seller_id, buyerId: trade.buyer_id, amount: trade.crypto_amount })
}

async function setupTrade() {
  const sellerId = await identityToUUID('V-100001')
  const buyerId = await identityToUUID('V-200002')
  const db = makeDb({
    trades: [{ id: 'T1', seller_id: sellerId, buyer_id: buyerId, offer_id: 'O1', crypto_amount: 50, status: 'payment_sent' }],
    offers: [{ id: 'O1', token: 'HEZ' }],
    visa: [{ visa_number: 'V-100001', wallet_address: seller.address, status: 'active' }],
  })
  return { db, sellerId, buyerId }
}

function sign(pair: any, msg: string) { return u8aToHex(pair.sign(u8aWrapBytes(msg))) }

// ---------------------------------------------------------------------------
// confirm-payment (escrow RELEASE) tests
// ---------------------------------------------------------------------------
Deno.test('confirm-payment: missing signature -> 401', async () => {
  const { db } = await setupTrade()
  const r = await runConfirmPayment(db, { tradeId: 'T1', sellerIdentity: 'V-100001', signerAddress: seller.address, timestamp: Date.now(), nonce: 'cp-11112222' })
  assertEquals(r.status, 401)
})

Deno.test('confirm-payment: invalid signature -> 401 (no release)', async () => {
  const { db } = await setupTrade()
  const r = await runConfirmPayment(db, { tradeId: 'T1', sellerIdentity: 'V-100001', signerAddress: seller.address, signature: '0xdeadbeef', timestamp: Date.now(), nonce: 'cp-11112222' })
  assertEquals(r.status, 401)
  assertEquals(db.releaseCalls.length, 0)
})

Deno.test('confirm-payment: valid signer who does NOT own the seller identity -> 403 (no release)', async () => {
  const { db } = await setupTrade()
  const ts = Date.now(), nonce = 'cp-attacker1'
  // Attacker signs a well-formed challenge for the seller identity, with a valid
  // signature over it — but the attacker wallet does not own visa V-100001.
  const challenge = buildConfirmPaymentChallenge({ tradeId: 'T1', sellerIdentity: 'V-100001', signerAddress: attacker.address, timestamp: ts, nonce })
  const r = await runConfirmPayment(db, { tradeId: 'T1', sellerIdentity: 'V-100001', signerAddress: attacker.address, signature: sign(attacker, challenge), timestamp: ts, nonce })
  assertEquals(r.status, 403)
  assertEquals(db.releaseCalls.length, 0)
})

Deno.test('confirm-payment: verified seller BUT trade not in payment_sent -> 400 (no release)', async () => {
  const { db } = await setupTrade()
  db.tradesState.get('T1').status = 'pending'
  const ts = Date.now(), nonce = 'cp-state001'
  const challenge = buildConfirmPaymentChallenge({ tradeId: 'T1', sellerIdentity: 'V-100001', signerAddress: seller.address, timestamp: ts, nonce })
  const r = await runConfirmPayment(db, { tradeId: 'T1', sellerIdentity: 'V-100001', signerAddress: seller.address, signature: sign(seller, challenge), timestamp: ts, nonce })
  assertEquals(r.status, 400)
  assertEquals(db.releaseCalls.length, 0)
})

Deno.test('confirm-payment: happy path releases to the trade-row buyer_id (destination from server row)', async () => {
  const { db, sellerId, buyerId } = await setupTrade()
  const ts = Date.now(), nonce = 'cp-happy001'
  const challenge = buildConfirmPaymentChallenge({ tradeId: 'T1', sellerIdentity: 'V-100001', signerAddress: seller.address, timestamp: ts, nonce })
  const r = await runConfirmPayment(db, { tradeId: 'T1', sellerIdentity: 'V-100001', signerAddress: seller.address, signature: sign(seller, challenge), timestamp: ts, nonce })
  assertEquals(r.status, 200)
  assertEquals(db.releaseCalls.length, 1)
  assertEquals(db.releaseCalls[0].p_from_user_id, sellerId)
  assertEquals(db.releaseCalls[0].p_to_user_id, buyerId) // funds go to the row's buyer_id
  assertEquals(db.releaseCalls[0].p_amount, 50)
})

Deno.test('confirm-payment: replayed nonce after success -> 401 (no second release)', async () => {
  const { db } = await setupTrade()
  const ts = Date.now(), nonce = 'cp-replay01'
  const challenge = buildConfirmPaymentChallenge({ tradeId: 'T1', sellerIdentity: 'V-100001', signerAddress: seller.address, timestamp: ts, nonce })
  const body = { tradeId: 'T1', sellerIdentity: 'V-100001', signerAddress: seller.address, signature: sign(seller, challenge), timestamp: ts, nonce }
  const r1 = await runConfirmPayment(db, body)
  assertEquals(r1.status, 200)
  // Reset status so ONLY the nonce guard can stop the replay (proving replay defense).
  db.tradesState.get('T1').status = 'payment_sent'
  const r2 = await runConfirmPayment(db, body)
  assertEquals(r2.status, 401)
  assertEquals(db.releaseCalls.length, 1)
})

Deno.test('confirm-payment: concurrent double-release (two nonces) -> only ONE release via CAS', async () => {
  const { db } = await setupTrade()
  const ts = Date.now()
  const mk = (nonce: string) => {
    const c = buildConfirmPaymentChallenge({ tradeId: 'T1', sellerIdentity: 'V-100001', signerAddress: seller.address, timestamp: ts, nonce })
    return { tradeId: 'T1', sellerIdentity: 'V-100001', signerAddress: seller.address, signature: sign(seller, c), timestamp: ts, nonce }
  }
  const [a, b] = await Promise.all([runConfirmPayment(db, mk('cp-conc0001')), runConfirmPayment(db, mk('cp-conc0002'))])
  const oks = [a, b].filter(x => x.status === 200)
  assertEquals(oks.length, 1)              // exactly one succeeds
  assertEquals(db.releaseCalls.length, 1)  // escrow moved exactly once
})

// ---------------------------------------------------------------------------
// process-withdraw auth-gate mirror (server derives user_id; client value ignored)
// ---------------------------------------------------------------------------
async function runWithdrawAuth(db: any, body: any): Promise<{ status: number; userId?: string }> {
  const { identityId, signerAddress, signature, timestamp, nonce, token, amount, walletAddress } = body
  if (!identityId || !signerAddress || !signature || !nonce || typeof timestamp !== 'number') return { status: 401 }
  if (!isFreshTimestamp(timestamp)) return { status: 401 }
  const challenge = buildWithdrawChallenge({ identityId, token: String(token ?? ''), amount: Number(amount ?? 0), destination: String(walletAddress ?? ''), signerAddress, timestamp, nonce })
  if (!(await verifyWalletSignature(challenge, signature, signerAddress))) return { status: 401 }
  const ownership = await assertIdentityOwnedByWallet(db, identityId, signerAddress, getPeopleApiStub)
  if (!ownership.ok) return { status: 403 }
  if (!(await consumeNonce(db, nonce, 'withdraw'))) return { status: 401 }
  const userId = await identityToUUID(identityId) // server-derived; body.user_id ignored
  return { status: 200, userId }
}

Deno.test('process-withdraw: signer acting on ANOTHER identity is rejected (ownership) ', async () => {
  const db = makeDb({ visa: [{ visa_number: 'V-100001', wallet_address: seller.address, status: 'active' }] })
  const ts = Date.now(), nonce = 'wd-otheruser'
  // Attacker owns nothing; claims victim identity V-100001.
  const challenge = buildWithdrawChallenge({ identityId: 'V-100001', token: 'HEZ', amount: 5, destination: '5EVIL', signerAddress: attacker.address, timestamp: ts, nonce })
  const r = await runWithdrawAuth(db, { identityId: 'V-100001', token: 'HEZ', amount: 5, walletAddress: '5EVIL', signerAddress: attacker.address, signature: u8aToHex(attacker.sign(u8aWrapBytes(challenge))), timestamp: ts, nonce })
  assertEquals(r.status, 403)
})

Deno.test('process-withdraw: valid owner passes and user_id is derived from identity (client user_id irrelevant)', async () => {
  const db = makeDb({ visa: [{ visa_number: 'V-100001', wallet_address: seller.address, status: 'active' }] })
  const ts = Date.now(), nonce = 'wd-gooduser'
  const challenge = buildWithdrawChallenge({ identityId: 'V-100001', token: 'HEZ', amount: 5, destination: '5DEST', signerAddress: seller.address, timestamp: ts, nonce })
  const r = await runWithdrawAuth(db, { identityId: 'V-100001', token: 'HEZ', amount: 5, walletAddress: '5DEST', signerAddress: seller.address, signature: u8aToHex(seller.sign(u8aWrapBytes(challenge))), timestamp: ts, nonce, user_id: 'client-supplied-garbage' })
  assertEquals(r.status, 200)
  assertEquals(r.userId, await identityToUUID('V-100001'))
})

Deno.test('process-withdraw: signature bound to amount+destination — tampering either invalidates it', async () => {
  const db = makeDb({ visa: [{ visa_number: 'V-100001', wallet_address: seller.address, status: 'active' }] })
  const ts = Date.now()
  const signed = buildWithdrawChallenge({ identityId: 'V-100001', token: 'HEZ', amount: 5, destination: '5DEST', signerAddress: seller.address, timestamp: ts, nonce: 'wd-tamper01' })
  const sig = u8aToHex(seller.sign(u8aWrapBytes(signed)))
  // Attacker keeps the signature but bumps amount + redirects destination.
  const r = await runWithdrawAuth(db, { identityId: 'V-100001', token: 'HEZ', amount: 999999, walletAddress: '5EVIL', signerAddress: seller.address, signature: sig, timestamp: ts, nonce: 'wd-tamper01' })
  assertEquals(r.status, 401)
})
