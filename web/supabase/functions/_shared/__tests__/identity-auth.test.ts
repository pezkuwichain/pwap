// Unit tests for the fund-custody authorization boundary (_shared/identity-auth.ts).
//
// Run:  deno test -A web/supabase/functions/_shared/__tests__/identity-auth.test.ts
//
// These exercise the REAL module (real sr25519 sign/verify via @pezkuwi/*), with
// the Supabase client and People-Chain API mocked. They prove the gates that the
// edge functions compose: signature verification, canonical money-bound
// challenges, identity-ownership, single-use nonces and timestamp freshness.

import {
  assertEquals,
  assert,
  assertNotEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { Keyring } from 'npm:@pezkuwi/keyring@14.0.25'
import { cryptoWaitReady, encodeAddress } from 'npm:@pezkuwi/util-crypto@14.0.25'
import { stringToU8a, u8aToHex, u8aWrapBytes } from 'npm:@pezkuwi/util@14.0.25'

import {
  verifyWalletSignature,
  buildWithdrawChallenge,
  buildConfirmPaymentChallenge,
  buildLockEscrowChallenge,
  buildDepositChallenge,
  buildAdminChallenge,
  assertIdentityOwnedByWallet,
  consumeNonce,
  isFreshTimestamp,
  generateCitizenNumber,
  identityToUUID,
  CHALLENGE_MAX_AGE_MS,
} from '../identity-auth.ts'

// ---------------------------------------------------------------------------
// Test key material
// ---------------------------------------------------------------------------
await cryptoWaitReady()
const kr = new Keyring({ type: 'sr25519' })
const alice = kr.addFromUri('//Alice')
const bob = kr.addFromUri('//Bob')

// ---------------------------------------------------------------------------
// verifyWalletSignature
// ---------------------------------------------------------------------------
Deno.test('verifyWalletSignature: valid raw signature passes', async () => {
  const msg = 'Pezkuwi P2P Withdrawal\ntoken:HEZ'
  const sig = u8aToHex(alice.sign(stringToU8a(msg)))
  assert(await verifyWalletSignature(msg, sig, alice.address))
})

Deno.test('verifyWalletSignature: <Bytes>-wrapped signature passes (extension signRaw form)', async () => {
  const msg = 'Pezkuwi P2P Confirm Payment\ntrade:abc'
  const sig = u8aToHex(alice.sign(u8aWrapBytes(msg)))
  assert(await verifyWalletSignature(msg, sig, alice.address))
})

Deno.test('verifyWalletSignature: wrong signer is rejected', async () => {
  const msg = 'authorize me'
  const sig = u8aToHex(alice.sign(stringToU8a(msg))) // signed by Alice
  assertEquals(await verifyWalletSignature(msg, sig, bob.address), false)
})

Deno.test('verifyWalletSignature: signature over a DIFFERENT message is rejected (no malleability/reuse)', async () => {
  const sig = u8aToHex(alice.sign(stringToU8a('message-A')))
  assertEquals(await verifyWalletSignature('message-B', sig, alice.address), false)
})

Deno.test('verifyWalletSignature: empty / malformed signatures return false (no throw)', async () => {
  assertEquals(await verifyWalletSignature('m', '', alice.address), false)
  assertEquals(await verifyWalletSignature('m', '0x', alice.address), false)
  assertEquals(await verifyWalletSignature('m', 'not-hex', alice.address), false)
  assertEquals(await verifyWalletSignature('m', '0xdeadbeef', alice.address), false)
})

// ---------------------------------------------------------------------------
// Canonical challenge builders — money-param binding
// ---------------------------------------------------------------------------
Deno.test('buildWithdrawChallenge: canonical shape + binds token/amount/destination/nonce', () => {
  const base = { identityId: 'V-100001', token: 'HEZ', amount: 5, destination: '5DEST', signerAddress: '5SIGN', timestamp: 111, nonce: 'n-1234abcd' }
  const c = buildWithdrawChallenge(base)
  assertEquals(c.split('\n')[0], 'Pezkuwi P2P Withdrawal')
  assert(c.includes('token:HEZ'))
  assert(c.includes('amount:5'))
  assert(c.includes('destination:5DEST'))
  // Any change to a money field changes the signed bytes:
  assertNotEquals(c, buildWithdrawChallenge({ ...base, token: 'PEZ' }))
  assertNotEquals(c, buildWithdrawChallenge({ ...base, amount: 6 }))
  assertNotEquals(c, buildWithdrawChallenge({ ...base, destination: '5EVIL' }))
  assertNotEquals(c, buildWithdrawChallenge({ ...base, nonce: 'n-otherabcd' }))
})

Deno.test('buildConfirmPaymentChallenge: binds tradeId + seller identity', () => {
  const base = { tradeId: 'T1', sellerIdentity: 'V-1', signerAddress: '5S', timestamp: 1, nonce: 'nnnnnnnn' }
  const c = buildConfirmPaymentChallenge(base)
  assertEquals(c.split('\n')[0], 'Pezkuwi P2P Confirm Payment')
  assertNotEquals(c, buildConfirmPaymentChallenge({ ...base, tradeId: 'T2' }))
  assertNotEquals(c, buildConfirmPaymentChallenge({ ...base, sellerIdentity: 'V-2' }))
})

Deno.test('buildLockEscrowChallenge: binds token + amount', () => {
  const base = { identityId: 'V-1', token: 'HEZ', amount: 10, signerAddress: '5S', timestamp: 1, nonce: 'nnnnnnnn' }
  const c = buildLockEscrowChallenge(base)
  assertEquals(c.split('\n')[0], 'Pezkuwi P2P Lock Escrow')
  assertNotEquals(c, buildLockEscrowChallenge({ ...base, amount: 11 }))
  assertNotEquals(c, buildLockEscrowChallenge({ ...base, token: 'PEZ' }))
})

Deno.test('challenge prefixes are distinct — a signature for one action cannot satisfy another', () => {
  const t = 1, n = 'nnnnnnnn', s = '5S'
  const prefixes = new Set([
    buildWithdrawChallenge({ identityId: 'i', token: 'HEZ', amount: 1, destination: 'd', signerAddress: s, timestamp: t, nonce: n }).split('\n')[0],
    buildConfirmPaymentChallenge({ tradeId: 'x', sellerIdentity: 'i', signerAddress: s, timestamp: t, nonce: n }).split('\n')[0],
    buildLockEscrowChallenge({ identityId: 'i', token: 'HEZ', amount: 1, signerAddress: s, timestamp: t, nonce: n }).split('\n')[0],
    buildDepositChallenge({ identityId: 'i', token: 'HEZ', txHash: '0x', signerAddress: s, timestamp: t, nonce: n }).split('\n')[0],
    buildAdminChallenge({ action: 'resolve', disputeId: 'd', tradeId: 'x', decision: 'split', adminAddress: s, timestamp: t, nonce: n }).split('\n')[0],
  ])
  assertEquals(prefixes.size, 5) // all unique
})

Deno.test('end-to-end: a withdraw signature does NOT verify against a tampered amount challenge', async () => {
  const p = { identityId: 'V-1', token: 'HEZ', amount: 5, destination: '5DEST', signerAddress: alice.address, timestamp: Date.now(), nonce: 'wd-abcdefgh' }
  const sig = u8aToHex(alice.sign(u8aWrapBytes(buildWithdrawChallenge(p))))
  // Attacker replays the signature but bumps the amount -> server rebuilds a
  // different challenge -> verification fails.
  const tampered = buildWithdrawChallenge({ ...p, amount: 5000 })
  assertEquals(await verifyWalletSignature(tampered, sig, alice.address), false)
  // sanity: the untampered challenge does verify
  assert(await verifyWalletSignature(buildWithdrawChallenge(p), sig, alice.address))
})

// ---------------------------------------------------------------------------
// identityToUUID / generateCitizenNumber
// ---------------------------------------------------------------------------
Deno.test('identityToUUID: deterministic + distinct per identity', async () => {
  const a = await identityToUUID('V-100001')
  const b = await identityToUUID('V-100001')
  const c = await identityToUUID('V-100002')
  assertEquals(a, b)
  assertNotEquals(a, c)
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(a), 'valid v5 uuid shape')
})

Deno.test('generateCitizenNumber: deterministic 6-digit tied to (address, collection, item)', () => {
  const n = generateCitizenNumber(alice.address, 42, 7)
  assertEquals(n, generateCitizenNumber(alice.address, 42, 7))
  assertEquals(n.length, 6)
  // Different owner or item generally yields a different number.
  assertNotEquals(generateCitizenNumber(alice.address, 42, 7), generateCitizenNumber(bob.address, 42, 7))
})

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------
type VisaRow = { visa_number: string; wallet_address: string; status: string }

function makeSupabaseMock(opts: { visaRows?: VisaRow[]; nonceStore?: Set<string> } = {}) {
  const visaRows = opts.visaRows ?? []
  const nonceStore = opts.nonceStore ?? new Set<string>()
  return {
    nonceStore,
    from(table: string) {
      if (table === 'p2p_visa') {
        const filters: Record<string, string> = {}
        const builder: any = {
          select() { return builder },
          eq(col: string, val: string) { filters[col] = val; return builder },
          async maybeSingle() {
            const row = visaRows.find(r =>
              r.visa_number === filters['visa_number'] &&
              r.wallet_address === filters['wallet_address'] &&
              r.status === filters['status'])
            return { data: row ?? null, error: null }
          },
        }
        return builder
      }
      if (table === 'p2p_challenge_nonces') {
        return {
          async insert(row: { nonce: string; purpose: string }) {
            if (nonceStore.has(row.nonce)) {
              return { error: { code: '23505', message: 'duplicate key value violates unique constraint' } }
            }
            nonceStore.add(row.nonce)
            return { error: null }
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  } as any
}

// People-chain API mock. `ownedItem === null` => wallet owns no citizen NFT.
function makePeopleApi(ownedItem: number | null) {
  const res = ownedItem === null
    ? { isEmpty: true }
    : { isEmpty: false, isSome: true, unwrap: () => ({ toNumber: () => ownedItem }) }
  return async () => ({ query: { tiki: { citizenNft: async (_addr: string) => res } } }) as any
}

// ---------------------------------------------------------------------------
// assertIdentityOwnedByWallet — visa
// ---------------------------------------------------------------------------
Deno.test('ownership(visa): active visa bound to signer -> ok', async () => {
  const sb = makeSupabaseMock({ visaRows: [{ visa_number: 'V-100001', wallet_address: alice.address, status: 'active' }] })
  const r = await assertIdentityOwnedByWallet(sb, 'V-100001', alice.address, makePeopleApi(null))
  assertEquals(r.ok, true)
  assertEquals(r.kind, 'visa')
})

Deno.test('ownership(visa): signer B cannot act on identity A (visa bound to A) -> rejected', async () => {
  const sb = makeSupabaseMock({ visaRows: [{ visa_number: 'V-100001', wallet_address: alice.address, status: 'active' }] })
  const r = await assertIdentityOwnedByWallet(sb, 'V-100001', bob.address, makePeopleApi(null))
  assertEquals(r.ok, false)
})

Deno.test('ownership(visa): inactive visa -> rejected', async () => {
  const sb = makeSupabaseMock({ visaRows: [{ visa_number: 'V-100001', wallet_address: alice.address, status: 'revoked' }] })
  const r = await assertIdentityOwnedByWallet(sb, 'V-100001', alice.address, makePeopleApi(null))
  assertEquals(r.ok, false)
})

// ---------------------------------------------------------------------------
// assertIdentityOwnedByWallet — citizen
// ---------------------------------------------------------------------------
Deno.test('ownership(citizen): chain owns item + derivation matches -> ok', async () => {
  const item = 7
  const six = generateCitizenNumber(alice.address, 42, item)
  const sb = makeSupabaseMock()
  const r = await assertIdentityOwnedByWallet(sb, `#42-${item}-${six}`, alice.address, makePeopleApi(item))
  assertEquals(r.ok, true)
  assertEquals(r.kind, 'citizen')
})

Deno.test('ownership(citizen): claimed item != chain-owned item -> rejected (no NFT theft)', async () => {
  const claimedItem = 7
  const six = generateCitizenNumber(alice.address, 42, claimedItem)
  const sb = makeSupabaseMock()
  // Chain says alice actually owns item 9, not the claimed 7.
  const r = await assertIdentityOwnedByWallet(sb, `#42-${claimedItem}-${six}`, alice.address, makePeopleApi(9))
  assertEquals(r.ok, false)
})

Deno.test('ownership(citizen): correct item but forged 6-digit -> rejected', async () => {
  const item = 7
  const sb = makeSupabaseMock()
  const r = await assertIdentityOwnedByWallet(sb, `#42-${item}-000000`, alice.address, makePeopleApi(item))
  assertEquals(r.ok, false)
})

Deno.test('ownership(citizen): wallet owns no NFT -> rejected', async () => {
  const item = 7
  const six = generateCitizenNumber(alice.address, 42, item)
  const sb = makeSupabaseMock()
  const r = await assertIdentityOwnedByWallet(sb, `#42-${item}-${six}`, alice.address, makePeopleApi(null))
  assertEquals(r.ok, false)
})

Deno.test('ownership: malformed identity / wrong collection -> rejected', async () => {
  const sb = makeSupabaseMock()
  assertEquals((await assertIdentityOwnedByWallet(sb, 'garbage', alice.address, makePeopleApi(1))).ok, false)
  assertEquals((await assertIdentityOwnedByWallet(sb, '#1-2-345678', alice.address, makePeopleApi(2))).ok, false) // collection != 42
  assertEquals((await assertIdentityOwnedByWallet(sb, '', alice.address, makePeopleApi(1))).ok, false)
})

// ---------------------------------------------------------------------------
// consumeNonce — single use / replay
// ---------------------------------------------------------------------------
Deno.test('consumeNonce: first use ok, second use (replay) rejected', async () => {
  const sb = makeSupabaseMock()
  assertEquals(await consumeNonce(sb, 'wd-11112222', 'withdraw'), true)
  assertEquals(await consumeNonce(sb, 'wd-11112222', 'withdraw'), false) // replay
})

Deno.test('consumeNonce: concurrent double-spend of one nonce yields exactly one success', async () => {
  const sb = makeSupabaseMock()
  const [a, b] = await Promise.all([
    consumeNonce(sb, 'wd-race0001', 'withdraw'),
    consumeNonce(sb, 'wd-race0001', 'withdraw'),
  ])
  assertEquals([a, b].filter(Boolean).length, 1)
})

Deno.test('consumeNonce: too-short nonce rejected', async () => {
  const sb = makeSupabaseMock()
  assertEquals(await consumeNonce(sb, 'short', 'withdraw'), false)
})

// ---------------------------------------------------------------------------
// isFreshTimestamp
// ---------------------------------------------------------------------------
Deno.test('isFreshTimestamp: now is fresh; expired and non-finite rejected', () => {
  assert(isFreshTimestamp(Date.now()))
  assertEquals(isFreshTimestamp(Date.now() - CHALLENGE_MAX_AGE_MS - 5000), false)
  assertEquals(isFreshTimestamp(Date.now() + 120_000), false) // beyond 60s skew
  assertEquals(isFreshTimestamp(NaN), false)
  assertEquals(isFreshTimestamp(Infinity), false)
})
