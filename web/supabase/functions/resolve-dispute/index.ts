// resolve-dispute Edge Function
//
// Server-side authorization for privileged P2P dispute actions (claim / resolve).
// The admin authorization is NOT the client isAdmin flag (which is cosmetic and
// bypassable). Here we:
//   1. Verify a wallet signature over a canonical admin-action challenge.
//   2. Check the signing wallet is in the server-side admin wallet set.
//   3. Enforce freshness + single-use nonce (replay protection).
//   4. For 'resolve', invoke admin_resolve_dispute() with the service role so the
//      escrow movement + status changes happen atomically server-side.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  verifyWalletSignature,
  buildAdminChallenge,
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

// Authoritative admin wallet set (server-side). Overridable via ADMIN_WALLETS
// (comma-separated SS58). Defaults mirror the historical client whitelist.
function getAdminWallets(): string[] {
  const env = Deno.env.get('ADMIN_WALLETS')
  if (env) return env.split(',').map(s => s.trim()).filter(Boolean)
  return [
    '5CyuFfbF95rzBxru7c9yEsX4XmQXUxpLUcbj9RLg9K1cGiiF', // Founder
    '5EhCpn82QtdU53MF6PoNFrKHgSrsfcAxFTMwrn3JYf9dioQw', // Treasury admin
    '5ELgySrX5ZyK7EWXjj6bAedyTCcTNWDANbiiipsT5gnpoCEp', // Admin
  ]
}

interface Body {
  action?: 'claim' | 'resolve'
  disputeId?: string
  tradeId?: string
  decision?: string
  reasoning?: string
  adminAddress?: string
  signature?: string
  timestamp?: number
  nonce?: string
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'))
  const json = (status: number, obj: unknown) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    const body: Body = await req.json()
    const { action, disputeId, tradeId, decision, reasoning, adminAddress, signature, timestamp, nonce } = body

    if (!action || !['claim', 'resolve'].includes(action)) {
      return json(400, { success: false, error: 'Invalid action' })
    }
    if (!disputeId || !tradeId || !adminAddress || !signature || !nonce || typeof timestamp !== 'number') {
      return json(401, { success: false, error: 'Missing authorization fields' })
    }
    if (action === 'resolve' && (!decision || !reasoning)) {
      return json(400, { success: false, error: 'Decision and reasoning are required' })
    }

    // 1) Freshness
    if (!isFreshTimestamp(timestamp)) {
      return json(401, { success: false, error: 'Authorization challenge expired. Please retry.' })
    }

    // 2) Verify signature over the canonical admin challenge
    const challenge = buildAdminChallenge({
      action,
      disputeId,
      tradeId,
      decision: String(decision ?? ''),
      adminAddress,
      timestamp,
      nonce,
    })
    const sigOk = await verifyWalletSignature(challenge, signature, adminAddress)
    if (!sigOk) {
      return json(401, { success: false, error: 'Invalid signature' })
    }

    // 3) Server-side admin authorization
    if (!getAdminWallets().includes(adminAddress)) {
      return json(403, { success: false, error: 'Wallet is not authorized for admin actions' })
    }

    // 4) Replay protection
    const nonceOk = await consumeNonce(serviceClient, nonce, `admin_${action}`)
    if (!nonceOk) {
      return json(401, { success: false, error: 'Authorization already used (replay detected)' })
    }

    // ---- CLAIM ----
    if (action === 'claim') {
      const { error } = await serviceClient
        .from('p2p_fiat_disputes')
        .update({ status: 'under_review', assigned_at: new Date().toISOString() })
        .eq('id', disputeId)
      if (error) return json(500, { success: false, error: 'Failed to claim dispute' })
      return json(200, { success: true, action: 'claim' })
    }

    // ---- RESOLVE (atomic escrow movement + status) ----
    const { data, error } = await serviceClient.rpc('admin_resolve_dispute', {
      p_dispute_id: disputeId,
      p_trade_id: tradeId,
      p_decision: decision,
      p_reasoning: reasoning,
      p_admin_ref: adminAddress,
    })

    if (error) {
      console.error('admin_resolve_dispute error:', error)
      return json(500, { success: false, error: error.message || 'Resolution failed' })
    }
    const result = typeof data === 'string' ? JSON.parse(data) : data
    if (!result?.success) {
      return json(400, { success: false, error: result?.error || 'Resolution failed' })
    }

    return json(200, { success: true, ...result })
  } catch (error) {
    console.error('resolve-dispute error:', error)
    return json(500, { success: false, error: 'Internal server error' })
  }
})
