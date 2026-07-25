// _shared/identity-auth.ts
//
// Server-side identity + wallet-signature authorization for fund-moving edge
// functions (withdrawals, deposits). This is the security boundary that binds
// an incoming request to a real, cryptographically-proven principal:
//
//   1. The caller signs a canonical challenge with their Substrate wallet.
//   2. We verify that signature server-side (sr25519/ed25519) -> proves control
//      of `signerAddress`.
//   3. We prove `signerAddress` OWNS the claimed identity (citizen number / visa):
//        - citizen  -> People Chain `tiki.citizenNft(signerAddress)` + the
//          deterministic 6-digit derivation must match the claimed number.
//        - visa     -> `p2p_visa` row (wallet_address == signerAddress, active).
//   4. Only then do we derive `userId = identityToUUID(identityId)` SERVER-SIDE.
//
// The client-supplied `userId` is NEVER trusted for authorization. Every
// caller can only ever act on the balance of the identity their wallet owns.

import { signatureVerify, cryptoWaitReady } from 'npm:@pezkuwi/util-crypto@14.0.25'
import { stringToU8a, u8aWrapBytes } from 'npm:@pezkuwi/util@14.0.25'
import type { ApiPromise } from 'npm:@pezkuwi/api@16.5.36'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

// Max age of a signed challenge (replay window). Nonce dedup (see caller)
// provides exact-once semantics; this bounds how long a captured signature
// could even be presented.
export const CHALLENGE_MAX_AGE_MS = 5 * 60 * 1000 // 5 minutes

// UUID v5 namespace (RFC 4122 DNS namespace) — MUST match shared/lib/identity.ts
const UUID_V5_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

/**
 * Deterministic UUID v5 from a citizen/visa number. Identical algorithm to
 * shared/lib/identity.ts (client) and verify-deposit — the value MUST match so
 * balances resolve to the same row everywhere.
 */
export async function identityToUUID(identityId: string): Promise<string> {
  const namespaceHex = UUID_V5_NAMESPACE.replace(/-/g, '')
  const namespaceBytes = new Uint8Array(16)
  for (let i = 0; i < 16; i++) {
    namespaceBytes[i] = parseInt(namespaceHex.substr(i * 2, 2), 16)
  }
  const nameBytes = new TextEncoder().encode(identityId)
  const combined = new Uint8Array(namespaceBytes.length + nameBytes.length)
  combined.set(namespaceBytes)
  combined.set(nameBytes, namespaceBytes.length)

  const hashBuffer = await crypto.subtle.digest('SHA-1', combined)
  const h = new Uint8Array(hashBuffer)
  h[6] = (h[6] & 0x0f) | 0x50
  h[8] = (h[8] & 0x3f) | 0x80
  const hex = Array.from(h.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/**
 * Deterministic 6-digit citizen number derivation. Identical algorithm to
 * shared/lib/tiki.ts generateCitizenNumber — used to bind a citizen number to
 * the wallet that owns the NFT.
 */
export function generateCitizenNumber(ownerAddress: string, collectionId: number, itemId: number): string {
  let hash = 0
  for (let i = 0; i < ownerAddress.length; i++) {
    hash = ((hash << 5) - hash) + ownerAddress.charCodeAt(i)
    hash = hash & hash
  }
  hash += collectionId * 1000 + itemId
  hash = Math.abs(hash)
  return (hash % 1000000).toString().padStart(6, '0')
}

/**
 * Verify a wallet signature over `message`. Handles both the raw-bytes form and
 * the `<Bytes>...</Bytes>` wrapped form that Polkadot-style extensions apply to
 * signRaw payloads, so extension, WalletConnect and native signers all verify.
 */
export async function verifyWalletSignature(
  message: string,
  signature: string,
  signerAddress: string
): Promise<boolean> {
  try {
    await cryptoWaitReady()
    const raw = stringToU8a(message)
    const wrapped = u8aWrapBytes(message)
    for (const candidate of [raw, wrapped]) {
      const res = signatureVerify(candidate, signature, signerAddress)
      if (res.isValid) return true
    }
    return false
  } catch (_e) {
    return false
  }
}

/**
 * Canonical challenge string for a withdrawal. MUST be byte-identical to what
 * the client builds and signs (see shared/lib/p2p-fiat.ts buildWithdrawChallenge).
 */
export function buildWithdrawChallenge(p: {
  identityId: string
  token: string
  amount: number
  destination: string
  signerAddress: string
  timestamp: number
  nonce: string
}): string {
  return [
    'Pezkuwi P2P Withdrawal',
    `identity:${p.identityId}`,
    `token:${p.token}`,
    `amount:${p.amount}`,
    `destination:${p.destination}`,
    `signer:${p.signerAddress}`,
    `timestamp:${p.timestamp}`,
    `nonce:${p.nonce}`,
  ].join('\n')
}

/**
 * Canonical challenge string for a deposit-credit. Binds the on-chain tx and the
 * identity being credited to the wallet that signs.
 */
export function buildDepositChallenge(p: {
  identityId: string
  token: string
  txHash: string
  signerAddress: string
  timestamp: number
  nonce: string
}): string {
  return [
    'Pezkuwi P2P Deposit',
    `identity:${p.identityId}`,
    `token:${p.token}`,
    `tx:${p.txHash}`,
    `signer:${p.signerAddress}`,
    `timestamp:${p.timestamp}`,
    `nonce:${p.nonce}`,
  ].join('\n')
}

/**
 * Canonical challenge for a seller confirming payment / releasing escrow.
 * MUST be byte-identical to the client (shared/lib/p2p-fiat.ts).
 */
export function buildConfirmPaymentChallenge(p: {
  tradeId: string
  sellerIdentity: string
  signerAddress: string
  timestamp: number
  nonce: string
}): string {
  return [
    'Pezkuwi P2P Confirm Payment',
    `trade:${p.tradeId}`,
    `identity:${p.sellerIdentity}`,
    `signer:${p.signerAddress}`,
    `timestamp:${p.timestamp}`,
    `nonce:${p.nonce}`,
  ].join('\n')
}

/**
 * Canonical challenge for locking one's OWN balance into escrow (offer create).
 * MUST be byte-identical to the client (shared/lib/p2p-fiat.ts).
 */
export function buildLockEscrowChallenge(p: {
  identityId: string
  token: string
  amount: number
  signerAddress: string
  timestamp: number
  nonce: string
}): string {
  return [
    'Pezkuwi P2P Lock Escrow',
    `identity:${p.identityId}`,
    `token:${p.token}`,
    `amount:${p.amount}`,
    `signer:${p.signerAddress}`,
    `timestamp:${p.timestamp}`,
    `nonce:${p.nonce}`,
  ].join('\n')
}

/**
 * Canonical challenge string for a privileged admin action (dispute claim /
 * resolve). MUST be byte-identical to the client (DisputeResolutionPanel).
 */
export function buildAdminChallenge(p: {
  action: string
  disputeId: string
  tradeId: string
  decision: string
  adminAddress: string
  timestamp: number
  nonce: string
}): string {
  return [
    'Pezkuwi P2P Admin Action',
    `action:${p.action}`,
    `dispute:${p.disputeId}`,
    `trade:${p.tradeId}`,
    `decision:${p.decision}`,
    `admin:${p.adminAddress}`,
    `timestamp:${p.timestamp}`,
    `nonce:${p.nonce}`,
  ].join('\n')
}

export interface OwnershipResult {
  ok: boolean
  error?: string
  /** 'citizen' | 'visa' */
  kind?: 'citizen' | 'visa'
}

/**
 * Prove that `signerAddress` owns `identityId`.
 *
 * - Visa numbers ("V-XXXXXX"): must have an active p2p_visa row bound to the
 *   signer's wallet_address.
 * - Citizen numbers ("#42-<item>-<6digit>"): the People Chain must report that
 *   signerAddress owns the citizen NFT with that item id, and the deterministic
 *   6-digit derivation for (signerAddress, 42, itemId) must equal the claimed
 *   6-digit — i.e. the number is cryptographically tied to the wallet.
 *
 * `peopleApi` may be lazily created by the caller; it is only required for
 * citizen identities.
 */
export async function assertIdentityOwnedByWallet(
  serviceClient: SupabaseClient,
  identityId: string,
  signerAddress: string,
  getPeopleApi: () => Promise<ApiPromise>
): Promise<OwnershipResult> {
  if (!identityId || !signerAddress) {
    return { ok: false, error: 'Missing identity or signer' }
  }

  // ---- Visa identity ----
  if (identityId.startsWith('V-')) {
    const { data: visa, error } = await serviceClient
      .from('p2p_visa')
      .select('visa_number, wallet_address, status')
      .eq('visa_number', identityId)
      .eq('wallet_address', signerAddress)
      .eq('status', 'active')
      .maybeSingle()

    if (error) return { ok: false, error: 'Visa lookup failed' }
    if (!visa) return { ok: false, error: 'Signing wallet does not own this visa identity' }
    return { ok: true, kind: 'visa' }
  }

  // ---- Citizen identity: "#<collection>-<item>-<6digit>" ----
  const clean = identityId.trim().replace('#', '')
  const parts = clean.split('-')
  if (parts.length !== 3) {
    return { ok: false, error: 'Invalid citizen identity format' }
  }
  const collectionId = parseInt(parts[0], 10)
  const itemId = parseInt(parts[1], 10)
  const providedSixDigit = parts[2]
  if (isNaN(collectionId) || isNaN(itemId) || providedSixDigit.length !== 6) {
    return { ok: false, error: 'Invalid citizen identity format' }
  }
  if (collectionId !== 42) {
    return { ok: false, error: 'Invalid citizen collection' }
  }

  let peopleApi: ApiPromise
  try {
    peopleApi = await getPeopleApi()
  } catch (_e) {
    return { ok: false, error: 'People Chain unavailable for identity verification' }
  }

  try {
    if (!peopleApi.query?.tiki?.citizenNft) {
      return { ok: false, error: 'Citizen NFT pallet unavailable' }
    }
    const res: any = await peopleApi.query.tiki.citizenNft(signerAddress)
    if (res.isEmpty || (res.isSome === false && typeof res.isSome === 'boolean')) {
      return { ok: false, error: 'Signing wallet owns no citizen NFT' }
    }
    const actualItemId = res.isSome ? res.unwrap().toNumber() : (typeof res.toNumber === 'function' ? res.toNumber() : null)
    if (actualItemId === null || actualItemId !== itemId) {
      return { ok: false, error: 'Citizen NFT does not match signing wallet' }
    }
    const expected = generateCitizenNumber(signerAddress, collectionId, itemId)
    if (expected !== providedSixDigit) {
      return { ok: false, error: 'Citizen number does not match signing wallet' }
    }
    return { ok: true, kind: 'citizen' }
  } catch (_e) {
    return { ok: false, error: 'Citizen identity verification failed' }
  }
}

/**
 * Atomically record a used challenge nonce for replay protection. Returns false
 * if the nonce was already used (replay) — caller MUST reject in that case.
 * Requires table public.p2p_challenge_nonces(nonce text primary key, ...).
 */
export async function consumeNonce(
  serviceClient: SupabaseClient,
  nonce: string,
  purpose: string
): Promise<boolean> {
  if (!nonce || nonce.length < 8) return false
  const { error } = await serviceClient
    .from('p2p_challenge_nonces')
    .insert({ nonce, purpose })
  // Unique violation => already used => replay.
  if (error) return false
  return true
}

/** Basic timestamp freshness check for a signed challenge. */
export function isFreshTimestamp(timestamp: number): boolean {
  if (!Number.isFinite(timestamp)) return false
  const age = Date.now() - timestamp
  return age >= -60_000 && age <= CHALLENGE_MAX_AGE_MS // allow 60s clock skew
}
