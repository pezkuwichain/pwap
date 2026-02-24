/**
 * Cleanup expired payment proofs
 *
 * Schedule: Daily via Supabase Dashboard > Database > Extensions > pg_cron
 * Or call manually: supabase functions invoke cleanup-proofs
 *
 * Flow:
 * 1. Call DB function to get expired proof URLs and clear them
 * 2. Delete actual files from Supabase Storage
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Find expired proofs (not disputed, past expiry)
    const { data: expiredTrades, error: fetchError } = await supabase
      .from('p2p_fiat_trades')
      .select('id, buyer_payment_proof_url')
      .not('buyer_payment_proof_url', 'is', null)
      .not('proof_expires_at', 'is', null)
      .lt('proof_expires_at', new Date().toISOString())
      .not('status', 'eq', 'disputed')

    if (fetchError) throw fetchError

    let deleted = 0

    for (const trade of expiredTrades || []) {
      // 2. Extract storage path from URL
      const url = trade.buyer_payment_proof_url
      const pathMatch = url?.match(/p2p-payment-proofs\/(.+)$/)

      if (pathMatch) {
        // 3. Delete file from storage
        await supabase.storage
          .from('p2p-payment-proofs')
          .remove([pathMatch[1]])
      }

      // 4. Clear URL in DB
      await supabase
        .from('p2p_fiat_trades')
        .update({
          buyer_payment_proof_url: null,
          proof_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', trade.id)

      deleted++
    }

    return new Response(
      JSON.stringify({ success: true, deleted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
