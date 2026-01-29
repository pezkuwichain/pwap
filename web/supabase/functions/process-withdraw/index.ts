// process-withdraw Edge Function
// Processes withdrawal requests by sending tokens from hot wallet to user wallet
// Uses @pezkuwi/api for blockchain transactions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { ApiPromise, WsProvider, Keyring } from 'npm:@pezkuwi/api@16.5.11'
import { cryptoWaitReady } from 'npm:@pezkuwi/util-crypto@14.0.11'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Platform hot wallet address
const PLATFORM_WALLET = '5HN6sFM7TbPQazmfhJP1kU8itw7Tb2A9UML8TwSYRwiN9q5Z'

// RPC endpoint
const RPC_ENDPOINT = 'wss://rpc.pezkuwichain.io'

// Token decimals
const DECIMALS = 12

// PEZ asset ID
const PEZ_ASSET_ID = 1

// Minimum withdrawal amounts
const MIN_WITHDRAW = {
  HEZ: 1,
  PEZ: 10
}

// Withdrawal fee (in tokens)
const WITHDRAW_FEE = {
  HEZ: 0.1,
  PEZ: 1
}

interface WithdrawRequest {
  requestId?: string  // If processing specific request
  token?: 'HEZ' | 'PEZ'
  amount?: number
  walletAddress?: string
}

// Cache API connection
let apiInstance: ApiPromise | null = null

async function getApi(): Promise<ApiPromise> {
  if (apiInstance && apiInstance.isConnected) {
    return apiInstance
  }

  const provider = new WsProvider(RPC_ENDPOINT)
  apiInstance = await ApiPromise.create({ provider })
  return apiInstance
}

// Send tokens from hot wallet
async function sendTokens(
  api: ApiPromise,
  privateKey: string,
  toAddress: string,
  token: string,
  amount: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    // Initialize crypto
    await cryptoWaitReady()

    // Create keyring and add hot wallet
    const keyring = new Keyring({ type: 'sr25519' })
    const hotWallet = keyring.addFromUri(privateKey)

    // Verify hot wallet address matches expected
    if (hotWallet.address !== PLATFORM_WALLET) {
      return {
        success: false,
        error: 'CRITICAL: Private key does not match platform wallet address!'
      }
    }

    // Convert amount to chain units
    const amountBN = BigInt(Math.floor(amount * Math.pow(10, DECIMALS)))

    // Build transaction
    let tx
    if (token === 'HEZ') {
      // Native token transfer
      tx = api.tx.balances.transferKeepAlive(toAddress, amountBN)
    } else if (token === 'PEZ') {
      // Asset transfer
      tx = api.tx.assets.transfer(PEZ_ASSET_ID, toAddress, amountBN)
    } else {
      return { success: false, error: 'Invalid token' }
    }

    // Sign and send transaction
    return new Promise((resolve) => {
      let txHash: string

      tx.signAndSend(hotWallet, { nonce: -1 }, (result) => {
        txHash = result.txHash.toHex()

        if (result.status.isInBlock) {
          console.log(`TX in block: ${result.status.asInBlock.toHex()}`)
        }

        if (result.status.isFinalized) {
          // Check for errors
          const dispatchError = result.dispatchError

          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule)
              resolve({
                success: false,
                txHash,
                error: `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`
              })
            } else {
              resolve({
                success: false,
                txHash,
                error: dispatchError.toString()
              })
            }
          } else {
            resolve({
              success: true,
              txHash
            })
          }
        }

        if (result.isError) {
          resolve({
            success: false,
            txHash,
            error: 'Transaction failed'
          })
        }
      }).catch((error) => {
        resolve({
          success: false,
          error: error.message
        })
      })

      // Timeout after 60 seconds
      setTimeout(() => {
        resolve({
          success: false,
          txHash,
          error: 'Transaction timeout - please check explorer for status'
        })
      }, 60000)
    })

  } catch (error) {
    console.error('Send tokens error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Get hot wallet private key from secrets
    const hotWalletPrivateKey = Deno.env.get('PLATFORM_PRIVATE_KEY')
    if (!hotWalletPrivateKey) {
      console.error('PLATFORM_PRIVATE_KEY not configured')
      return new Response(
        JSON.stringify({ success: false, error: 'Withdrawal service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // User client (to get user ID)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Service role client
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    // Get current user
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: WithdrawRequest = await req.json()
    let { requestId, token, amount, walletAddress } = body

    // Mode 1: Process existing request by ID
    if (requestId) {
      const { data: request, error: reqError } = await serviceClient
        .from('p2p_deposit_withdraw_requests')
        .select('*')
        .eq('id', requestId)
        .eq('user_id', user.id)
        .eq('request_type', 'withdraw')
        .eq('status', 'pending')
        .single()

      if (reqError || !request) {
        return new Response(
          JSON.stringify({ success: false, error: 'Withdrawal request not found or already processed' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      token = request.token as 'HEZ' | 'PEZ'
      amount = parseFloat(request.amount)
      walletAddress = request.wallet_address
    }
    // Mode 2: Create new withdrawal request
    else {
      if (!token || !amount || !walletAddress) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required fields: token, amount, walletAddress' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Validate token
      if (!['HEZ', 'PEZ'].includes(token)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid token. Must be HEZ or PEZ' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Validate amount
      if (amount < MIN_WITHDRAW[token]) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Minimum withdrawal is ${MIN_WITHDRAW[token]} ${token}`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Validate wallet address format (Substrate SS58)
      if (!walletAddress.match(/^5[A-HJ-NP-Za-km-z1-9]{47}$/)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid wallet address format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check withdrawal limits first
      const { data: limitCheck, error: limitError } = await serviceClient
        .rpc('check_withdrawal_limit', {
          p_user_id: user.id,
          p_amount: amount
        })

      if (limitError || !limitCheck?.allowed) {
        return new Response(
          JSON.stringify({
            success: false,
            error: limitCheck?.error || 'Withdrawal limit check failed',
            dailyRemaining: limitCheck?.daily_remaining,
            monthlyRemaining: limitCheck?.monthly_remaining
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create withdrawal request using database function
      const { data: requestResult, error: requestError } = await serviceClient
        .rpc('request_withdraw', {
          p_user_id: user.id,
          p_token: token,
          p_amount: amount,
          p_wallet_address: walletAddress
        })

      if (requestError || !requestResult?.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: requestResult?.error || requestError?.message || 'Failed to create withdrawal request'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      requestId = requestResult.request_id
    }

    // Update request status to processing
    await serviceClient
      .from('p2p_deposit_withdraw_requests')
      .update({ status: 'processing' })
      .eq('id', requestId)

    // Calculate net amount after fee
    const fee = WITHDRAW_FEE[token as 'HEZ' | 'PEZ']
    const netAmount = amount! - fee

    if (netAmount <= 0) {
      await serviceClient
        .from('p2p_deposit_withdraw_requests')
        .update({
          status: 'failed',
          error_message: 'Amount too small after fee deduction'
        })
        .eq('id', requestId)

      return new Response(
        JSON.stringify({ success: false, error: 'Amount too small after fee deduction' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing withdrawal: ${netAmount} ${token} to ${walletAddress}`)

    // Connect to blockchain
    const api = await getApi()

    // Send tokens
    const sendResult = await sendTokens(
      api,
      hotWalletPrivateKey,
      walletAddress!,
      token!,
      netAmount
    )

    if (!sendResult.success) {
      // Refund the locked balance
      await serviceClient.rpc('refund_escrow_internal', {
        p_user_id: user.id,
        p_token: token,
        p_amount: amount,
        p_reference_type: 'withdraw_failed',
        p_reference_id: requestId
      })

      await serviceClient
        .from('p2p_deposit_withdraw_requests')
        .update({
          status: 'failed',
          error_message: sendResult.error,
          processed_at: new Date().toISOString()
        })
        .eq('id', requestId)

      return new Response(
        JSON.stringify({
          success: false,
          error: sendResult.error || 'Blockchain transaction failed',
          txHash: sendResult.txHash
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Success! Complete the withdrawal using database function
    const { data: completeResult, error: completeError } = await serviceClient
      .rpc('complete_withdraw', {
        p_user_id: user.id,
        p_token: token,
        p_amount: amount,
        p_tx_hash: sendResult.txHash,
        p_request_id: requestId
      })

    if (completeError) {
      console.error('Failed to complete withdrawal in DB:', completeError)
      // TX was sent, but DB update failed - log for manual reconciliation
    }

    // Update request status
    await serviceClient
      .from('p2p_deposit_withdraw_requests')
      .update({
        status: 'completed',
        blockchain_tx_hash: sendResult.txHash,
        fee_amount: fee,
        net_amount: netAmount,
        processed_at: new Date().toISOString()
      })
      .eq('id', requestId)

    // Record in withdrawal limits
    await serviceClient.rpc('record_withdrawal_limit', {
      p_user_id: user.id,
      p_amount: amount
    })

    // Log to audit
    await serviceClient
      .from('p2p_audit_log')
      .insert({
        user_id: user.id,
        action: 'withdraw_completed',
        entity_type: 'withdraw_request',
        entity_id: requestId,
        details: {
          token,
          amount: amount,
          net_amount: netAmount,
          fee,
          wallet_address: walletAddress,
          tx_hash: sendResult.txHash
        }
      })

    console.log(`Withdrawal successful: ${sendResult.txHash}`)

    return new Response(
      JSON.stringify({
        success: true,
        txHash: sendResult.txHash,
        amount: netAmount,
        fee,
        token,
        walletAddress,
        message: 'Withdrawal processed successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
