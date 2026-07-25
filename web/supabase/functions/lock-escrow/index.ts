// lock-escrow Edge Function
//
// Locks a caller's OWN available balance into escrow (used by offer creation).
// lock_escrow_internal only ever moves the caller's own funds available->locked,
// so it is not a theft vector — but an anon caller could previously lock a
// VICTIM's balance (griefing/DoS on their funds). This gates it so a caller can
// only ever lock the balance of the identity their wallet owns.
//
// Authorization: wallet signature -> identity ownership -> derived user_id ->
// lock_escrow_internal with the service role.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { ApiPromise, WsProvider } from 'npm:@pezkuwi/api@16.5.36'
import {
  identityToUUID,
  verifyWalletSignature,
  buildLockEscrowChallenge,
  assertIdentityOwnedByWallet,
  consumeNonce,
  isFreshTimestamp,
} from '../_shared/identity-auth.ts'

const ALLOWED_ORIGINS = [
  'https://app.pezkuwichain.io',
  'https://www.pezkuwichain.io',
  'https://pezkuwichain.io',
]

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  }
}

const PEOPLE_RPC_ENDPOINT = Deno.env.get('PEOPLE_RPC_ENDPOINT') || 'wss://people-rpc.pezkuwichain.io'
let peopleApiInstance: ApiPromise | null = null
async function getPeopleApi(): Promise<ApiPromise> {
  if (peopleApiInstance && peopleApiInstance.isConnected) return peopleApiInstance
  peopleApiInstance = await ApiPromise.create({ provider: new WsProvider(PEOPLE_RPC_ENDPOINT) })
  return peopleApiInstance
}

interface Body {
  identityId?: string
  token?: 'HEZ' | 'PEZ'
  amount?: number
  signerAddress?: string
  signature?: string
  timestamp?: number
  nonce?: string
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'))
  const json = (status: number, obj: unknown) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { identityId, token, amount, signerAddress, signature, timestamp, nonce }: Body = await req.json()

    if (!identityId || !token || !signerAddress || !signature || !nonce || typeof timestamp !== 'number') {
      return json(401, { success: false, error: 'Missing authorization fields' })
    }
    if (!['HEZ', 'PEZ'].includes(token)) {
      return json(400, { success: false, error: 'Invalid token' })
    }
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      return json(400, { success: false, error: 'Amount must be greater than 0' })
    }
    if (!isFreshTimestamp(timestamp)) {
      return json(401, { success: false, error: 'Authorization challenge expired. Please retry.' })
    }

    // 1) Verify signature over the exact lock intent
    const challenge = buildLockEscrowChallenge({ identityId, token, amount: amt, signerAddress, timestamp, nonce })
    if (!(await verifyWalletSignature(challenge, signature, signerAddress))) {
      return json(401, { success: false, error: 'Invalid signature' })
    }

    // 2) Prove the signer owns the identity whose balance is being locked
    const ownership = await assertIdentityOwnedByWallet(serviceClient, identityId, signerAddress, getPeopleApi)
    if (!ownership.ok) {
      return json(403, { success: false, error: ownership.error || 'Identity ownership verification failed' })
    }
    const userId = await identityToUUID(identityId)

    // 3) Replay protection
    if (!(await consumeNonce(serviceClient, nonce, 'lock_escrow'))) {
      return json(401, { success: false, error: 'Authorization already used (replay detected)' })
    }

    // 4) Lock the caller's OWN balance (service role)
    const { data: lockRes, error: lockErr } = await serviceClient.rpc('lock_escrow_internal', {
      p_user_id: userId,
      p_token: token,
      p_amount: amt,
    })
    if (lockErr) return json(500, { success: false, error: lockErr.message || 'Lock failed' })
    const parsed = typeof lockRes === 'string' ? JSON.parse(lockRes) : lockRes
    if (!parsed?.success) return json(400, { success: false, error: parsed?.error || 'Lock failed' })

    return json(200, { success: true, userId, token, amount: amt, ...parsed })
  } catch (error) {
    console.error('lock-escrow error:', error)
    return json(500, { success: false, error: 'Internal server error' })
  }
})
