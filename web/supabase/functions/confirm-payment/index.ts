// confirm-payment Edge Function
//
// Seller-authorized escrow RELEASE (the money-OUT path that was previously
// callable by anyone holding the public anon key via rpc('release_escrow_internal')).
//
// Authorization chain:
//   1. Seller signs a canonical challenge with their wallet.
//   2. verifyWalletSignature (raw + <Bytes>) proves control of `signerAddress`.
//   3. assertIdentityOwnedByWallet proves the wallet owns the claimed seller
//      identity (citizen NFT / active visa).
//   4. The derived seller user_id MUST equal the trade's seller_id, and the
//      trade MUST be in 'payment_sent'.
//   5. Single-use nonce (replay protection).
//   6. Only then release_escrow_internal(seller -> buyer) runs with the service
//      role, atomically with the trade status update.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { ApiPromise, WsProvider } from 'npm:@pezkuwi/api@16.5.36'
import {
  identityToUUID,
  verifyWalletSignature,
  buildConfirmPaymentChallenge,
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
  tradeId?: string
  sellerIdentity?: string
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
    const { tradeId, sellerIdentity, signerAddress, signature, timestamp, nonce }: Body = await req.json()

    if (!tradeId || !sellerIdentity || !signerAddress || !signature || !nonce || typeof timestamp !== 'number') {
      return json(401, { success: false, error: 'Missing authorization fields' })
    }
    if (!isFreshTimestamp(timestamp)) {
      return json(401, { success: false, error: 'Authorization challenge expired. Please retry.' })
    }

    // 1) Verify signature
    const challenge = buildConfirmPaymentChallenge({ tradeId, sellerIdentity, signerAddress, timestamp, nonce })
    if (!(await verifyWalletSignature(challenge, signature, signerAddress))) {
      return json(401, { success: false, error: 'Invalid signature' })
    }

    // 2) Prove the signer owns the claimed seller identity
    const ownership = await assertIdentityOwnedByWallet(serviceClient, sellerIdentity, signerAddress, getPeopleApi)
    if (!ownership.ok) {
      return json(403, { success: false, error: ownership.error || 'Identity ownership verification failed' })
    }
    const sellerUserId = await identityToUUID(sellerIdentity)

    // 3) Load trade and enforce it belongs to this seller and is releasable
    const { data: trade, error: tradeErr } = await serviceClient
      .from('p2p_fiat_trades')
      .select('id, seller_id, buyer_id, offer_id, crypto_amount, status')
      .eq('id', tradeId)
      .single()
    if (tradeErr || !trade) return json(404, { success: false, error: 'Trade not found' })
    if (trade.seller_id !== sellerUserId) {
      return json(403, { success: false, error: 'Only the trade seller can release this escrow' })
    }
    if (trade.status !== 'payment_sent') {
      return json(400, { success: false, error: `Trade is not awaiting confirmation (status: ${trade.status})` })
    }

    // 4) Resolve token from offer
    const { data: offer } = await serviceClient
      .from('p2p_fiat_offers')
      .select('token')
      .eq('id', trade.offer_id)
      .single()
    if (!offer?.token) return json(400, { success: false, error: 'Offer/token not found' })

    // 5) Consume nonce (single use)
    if (!(await consumeNonce(serviceClient, nonce, 'confirm_payment'))) {
      return json(401, { success: false, error: 'Authorization already used (replay detected)' })
    }

    // 6) Release escrow (service role) + mark trade completed
    const { data: releaseRes, error: releaseErr } = await serviceClient.rpc('release_escrow_internal', {
      p_from_user_id: trade.seller_id,
      p_to_user_id: trade.buyer_id,
      p_token: offer.token,
      p_amount: trade.crypto_amount,
      p_reference_type: 'trade',
      p_reference_id: tradeId,
    })
    if (releaseErr) return json(500, { success: false, error: releaseErr.message || 'Release failed' })
    const parsed = typeof releaseRes === 'string' ? JSON.parse(releaseRes) : releaseRes
    if (!parsed?.success) return json(400, { success: false, error: parsed?.error || 'Release failed' })

    const nowIso = new Date().toISOString()
    const { error: updErr } = await serviceClient
      .from('p2p_fiat_trades')
      .update({
        seller_confirmed_at: nowIso,
        escrow_released_at: nowIso,
        status: 'completed',
        completed_at: nowIso,
      })
      .eq('id', tradeId)
    if (updErr) {
      // Funds released but status update failed — log for reconciliation.
      console.error('Trade status update failed after release:', updErr)
    }

    return json(200, {
      success: true,
      tradeId,
      sellerId: trade.seller_id,
      buyerId: trade.buyer_id,
      token: offer.token,
      amount: trade.crypto_amount,
    })
  } catch (error) {
    console.error('confirm-payment error:', error)
    return json(500, { success: false, error: 'Internal server error' })
  }
})
