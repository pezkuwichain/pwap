// process-withdraw Edge Function
// Processes withdrawal requests by sending tokens from hot wallet to user wallet
// Uses @pezkuwi/api for blockchain transactions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { ApiPromise, WsProvider, Keyring } from 'npm:@pezkuwi/api@16.5.11'
import { cryptoWaitReady } from 'npm:@pezkuwi/util-crypto@14.0.11'

// Decode SS58 address to raw 32-byte public key hex
function ss58ToHex(address: string): string {
  const CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let leadingZeros = 0
  for (const c of address) {
    if (c !== '1') break
    leadingZeros++
  }
  let num = 0n
  for (const c of address) {
    num = num * 58n + BigInt(CHARS.indexOf(c))
  }
  const hex = num.toString(16)
  const paddedHex = hex.length % 2 ? '0' + hex : hex
  const decoded = new Uint8Array(leadingZeros + paddedHex.length / 2)
  for (let i = 0; i < leadingZeros; i++) decoded[i] = 0
  for (let i = 0; i < paddedHex.length / 2; i++) {
    decoded[leadingZeros + i] = parseInt(paddedHex.slice(i * 2, i * 2 + 2), 16)
  }
  // SS58: [1-byte prefix] [32 bytes pubkey] [2 bytes checksum]
  const pubkey = decoded.slice(1, 33)
  return '0x' + Array.from(pubkey, (b: number) => b.toString(16).padStart(2, '0')).join('')
}

// Allowed origins for CORS
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

// Platform hot wallet address
const PLATFORM_WALLET = '5HN6sFM7TbPQazmfhJP1kU8itw7Tb2A9UML8TwSYRwiN9q5Z'

// RPC endpoint — defaults to Asset Hub where user balances live
const RPC_ENDPOINT = Deno.env.get('RPC_ENDPOINT') || 'wss://asset-hub-rpc.pezkuwichain.io'

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
  userId: string      // Identity-based UUID (from citizen/visa number)
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

    // Convert all addresses to hex (Deno npm shim breaks SS58 decoding in @pezkuwi/api types)
    const destHex = ss58ToHex(toAddress)
    const signerHex = '0x' + Array.from(hotWallet.publicKey, (b: number) => b.toString(16).padStart(2, '0')).join('')
    console.log(`Sending ${amount} ${token}: ${signerHex} → ${destHex}`)

    let tx
    if (token === 'HEZ') {
      tx = api.tx.balances.transferKeepAlive({ Id: destHex }, amountBN)
    } else if (token === 'PEZ') {
      tx = api.tx.assets.transfer(PEZ_ASSET_ID, { Id: destHex }, amountBN)
    } else {
      return { success: false, error: 'Invalid token' }
    }

    // Fetch nonce via hex pubkey to avoid SS58 → AccountId32 decoding issue
    const accountInfo = await api.query.system.account(signerHex)
    const nonce = accountInfo.nonce

    // Sign and send transaction
    return new Promise((resolve) => {
      let txHash: string

      tx.signAndSend(hotWallet, { nonce }, (result) => {
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
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'))

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

    // Service role client
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const body: WithdrawRequest = await req.json()
    const { userId } = body
    let { requestId, token, amount, walletAddress } = body

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required field: userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Mode 1: Process existing request by ID
    if (requestId) {
      const { data: request, error: reqError } = await serviceClient
        .from('p2p_deposit_withdraw_requests')
        .select('*')
        .eq('id', requestId)
        .eq('user_id', userId)
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
          p_user_id: userId,
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
          p_user_id: userId,
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
        p_user_id: userId,
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
    const { error: completeError } = await serviceClient
      .rpc('complete_withdraw', {
        p_user_id: userId,
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
      p_user_id: userId,
      p_amount: amount
    })

    // Log to audit
    await serviceClient
      .from('p2p_audit_log')
      .insert({
        user_id: userId,
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
