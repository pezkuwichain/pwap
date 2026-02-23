// verify-deposit Edge Function
// OKX-level security: Verifies blockchain transactions before crediting balances
// Uses HTTP RPC for block search + @pezkuwi/api for event verification

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { ApiPromise, WsProvider } from 'npm:@pezkuwi/api@16.5.11'
import { blake2b } from 'npm:@noble/hashes@1.7.1/blake2b'
import { base58 } from 'npm:@scure/base@1.2.4'

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

// Platform hot wallet address (PRODUCTION) - Treasury_3
const PLATFORM_WALLET = '5H18ZZBU4LwPYbeEZ1JBGvibCU2edhhM8HNUtFi7GgC36CgS'

// RPC endpoints for PezkuwiChain
const RPC_HTTP = 'https://rpc.pezkuwichain.io'
const RPC_WS = 'wss://rpc.pezkuwichain.io'

// Token decimals
const DECIMALS = 12

// Generate deterministic UUID v5 from wallet address
async function walletToUUID(walletAddress: string): Promise<string> {
  const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
  const data = new TextEncoder().encode(walletAddress)
  const namespaceBytes = new Uint8Array(16)
  const hex = NAMESPACE.replace(/-/g, '')
  for (let i = 0; i < 16; i++) {
    namespaceBytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  const combined = new Uint8Array(namespaceBytes.length + data.length)
  combined.set(namespaceBytes)
  combined.set(data, namespaceBytes.length)

  const hashBuffer = await crypto.subtle.digest('SHA-1', combined)
  const hashArray = new Uint8Array(hashBuffer)

  hashArray[6] = (hashArray[6] & 0x0f) | 0x50
  hashArray[8] = (hashArray[8] & 0x3f) | 0x80

  const hex2 = Array.from(hashArray.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${hex2.slice(0,8)}-${hex2.slice(8,12)}-${hex2.slice(12,16)}-${hex2.slice(16,20)}-${hex2.slice(20,32)}`
}

// PEZ asset ID
const PEZ_ASSET_ID = 1

interface DepositRequest {
  txHash: string
  token: 'HEZ' | 'PEZ'
  expectedAmount: number
  walletAddress: string
  blockNumber?: number
}

// --- HTTP RPC helpers ---
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function rpcCall(method: string, params: unknown[] = []): Promise<unknown> {
  const res = await fetch(RPC_HTTP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params })
  })
  const data = await res.json()
  if (data.error) throw new Error(`RPC ${method}: ${data.error.message}`)
  return data.result
}

// Search a single block for the transaction hash using HTTP RPC + blake2b
async function searchBlockHttp(
  blockNumber: number,
  txHash: string
): Promise<{ blockHash: string; extrinsicIndex: number } | null> {
  const blockHash = await rpcCall('chain_getBlockHash', [blockNumber]) as string
  if (!blockHash) return null

  // deno-lint-ignore no-explicit-any
  const blockData = await rpcCall('chain_getBlock', [blockHash]) as any
  if (!blockData?.block?.extrinsics) return null

  const extrinsics: string[] = blockData.block.extrinsics

  for (let j = 0; j < extrinsics.length; j++) {
    const extBytes = hexToBytes(extrinsics[j])
    const hash = blake2b(extBytes, { dkLen: 32 })
    const extHash = bytesToHex(hash)

    if (extHash === txHash) {
      return { blockHash, extrinsicIndex: j }
    }
  }
  return null
}

// Get latest block number via HTTP RPC
async function getLatestBlockNumber(): Promise<number> {
  // deno-lint-ignore no-explicit-any
  const header = await rpcCall('chain_getHeader') as any
  return parseInt(header.number, 16)
}

// Find transaction in blocks - returns blockHash + extrinsicIndex
async function findTransaction(
  txHash: string,
  hintBlockNumber?: number
): Promise<{ blockHash: string; extrinsicIndex: number; blockNumber: number } | null> {
  const latestBlock = await getLatestBlockNumber()

  // Strategy 1: Check hint block and neighbors
  if (hintBlockNumber && hintBlockNumber > 0 && hintBlockNumber <= latestBlock) {
    console.log(`Searching hint block ${hintBlockNumber} and neighbors...`)
    for (const offset of [0, -1, 1, -2, 2, -3, 3]) {
      const bn = hintBlockNumber + offset
      if (bn > 0 && bn <= latestBlock) {
        try {
          const result = await searchBlockHttp(bn, txHash)
          if (result) {
            console.log(`Found in block ${bn}`)
            return { ...result, blockNumber: bn }
          }
        } catch (err) {
          console.error(`Error searching block ${bn}:`, err)
        }
      }
    }
  }

  // Strategy 2: Search recent blocks in parallel batches
  const searchDepth = 300
  const batchSize = 10
  console.log(`Searching last ${searchDepth} blocks from #${latestBlock}...`)

  for (let i = 0; i < searchDepth; i += batchSize) {
    const promises: Promise<{ blockHash: string; extrinsicIndex: number; blockNumber: number } | null>[] = []
    for (let j = 0; j < batchSize && (i + j) < searchDepth; j++) {
      const bn = latestBlock - (i + j)
      if (bn < 0) break
      promises.push(
        searchBlockHttp(bn, txHash)
          .then(r => r ? { ...r, blockNumber: bn } : null)
          .catch(() => null)
      )
    }

    const results = await Promise.all(promises)
    for (const result of results) {
      if (result) return result
    }
  }

  return null
}

// Cache API connection for event verification
let apiInstance: ApiPromise | null = null

async function getApi(): Promise<ApiPromise> {
  if (apiInstance && apiInstance.isConnected) {
    return apiInstance
  }
  const provider = new WsProvider(RPC_WS)
  apiInstance = await ApiPromise.create({ provider })
  return apiInstance
}

// Verify transaction events using @pezkuwi/api
async function verifyTransactionOnChain(
  txHash: string,
  token: string,
  expectedAmount: number,
  hintBlockNumber?: number
): Promise<{ valid: boolean; actualAmount?: number; from?: string; error?: string }> {
  try {
    if (!txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
      return { valid: false, error: 'Invalid transaction hash format' }
    }

    // Step 1: Find the transaction using HTTP RPC (fast, reliable)
    console.log(`Finding transaction ${txHash}...`)
    const found = await findTransaction(txHash, hintBlockNumber)

    if (!found) {
      const latest = await getLatestBlockNumber()
      return {
        valid: false,
        error: `Transaction not found (searched hint block ${hintBlockNumber || 'none'} and last 300 blocks from #${latest}). The transaction may be too old.`
      }
    }

    console.log(`Transaction found in block #${found.blockNumber}, extrinsic index ${found.extrinsicIndex}`)

    // Step 2: Verify events using @pezkuwi/api (needs type registry)
    const api = await getApi()

    const apiAt = await api.at(found.blockHash)
    const events = await apiAt.query.system.events()

    // Find events for our extrinsic
    // deno-lint-ignore no-explicit-any
    const extrinsicEvents = (events as any[]).filter((event: any) => {
      const { phase } = event
      return phase.isApplyExtrinsic && phase.asApplyExtrinsic.toNumber() === found.extrinsicIndex
    })

    // Check for success
    // deno-lint-ignore no-explicit-any
    const successEvent = extrinsicEvents.find((event: any) =>
      api.events.system.ExtrinsicSuccess.is(event.event)
    )

    if (!successEvent) {
      // deno-lint-ignore no-explicit-any
      const failedEvent = extrinsicEvents.find((event: any) =>
        api.events.system.ExtrinsicFailed.is(event.event)
      )
      if (failedEvent) {
        return { valid: false, error: 'Transaction failed on-chain' }
      }
      return { valid: false, error: 'Transaction status unknown' }
    }

    // Find transfer event
    // deno-lint-ignore no-explicit-any
    let transferEvent: any = null
    let from = ''
    let to = ''
    let amount = BigInt(0)

    if (token === 'HEZ') {
      // deno-lint-ignore no-explicit-any
      transferEvent = extrinsicEvents.find((event: any) =>
        api.events.balances.Transfer.is(event.event)
      )
      if (transferEvent) {
        const [fromAddr, toAddr, value] = transferEvent.event.data
        from = fromAddr.toString()
        to = toAddr.toString()
        amount = BigInt(value.toString())
      }
    } else if (token === 'PEZ') {
      // deno-lint-ignore no-explicit-any
      transferEvent = extrinsicEvents.find((event: any) =>
        api.events.assets.Transferred.is(event.event)
      )
      if (transferEvent) {
        const [assetId, fromAddr, toAddr, value] = transferEvent.event.data
        if (assetId.toNumber() !== PEZ_ASSET_ID) {
          return { valid: false, error: 'Wrong asset transferred' }
        }
        from = fromAddr.toString()
        to = toAddr.toString()
        amount = BigInt(value.toString())
      }
    }

    if (!transferEvent) {
      return { valid: false, error: 'No transfer event found in transaction' }
    }

    // Normalize addresses to raw hex for reliable comparison
    // Event data may return raw hex or SS58 with different prefix
    const toRawHex = (addr: string): string => {
      if (addr.startsWith('0x') && addr.length === 66) {
        return addr.toLowerCase()
      }
      // Decode SS58: base58decode -> remove prefix byte(s) and 2-byte checksum
      try {
        const decoded = base58.decode(addr)
        // Simple SS58: 1 prefix byte + 32 pubkey + 2 checksum = 35 bytes
        // Extended: 2 prefix bytes + 32 pubkey + 2 checksum = 36 bytes
        const pubkey = decoded.length === 35
          ? decoded.slice(1, 33)
          : decoded.slice(2, 34)
        return '0x' + Array.from(pubkey).map(b => b.toString(16).padStart(2, '0')).join('')
      } catch {
        return addr
      }
    }

    const normalizedTo = toRawHex(to)
    const normalizedPlatform = toRawHex(PLATFORM_WALLET)

    // Verify recipient is platform wallet
    if (normalizedTo !== normalizedPlatform) {
      return {
        valid: false,
        error: `Transaction recipient (${normalizedTo}) does not match platform wallet (${normalizedPlatform})`
      }
    }

    // Keep from as-is (will be compared as raw hex later)

    // Convert amount to human readable
    const actualAmount = Number(amount) / Math.pow(10, DECIMALS)

    // Verify amount matches (allow 0.1% tolerance)
    const tolerance = expectedAmount * 0.001
    if (Math.abs(actualAmount - expectedAmount) > tolerance) {
      return {
        valid: false,
        error: `Amount mismatch. Expected: ${expectedAmount}, Actual: ${actualAmount}`,
        actualAmount
      }
    }

    // Check if block is finalized
    const finalizedHash = await api.rpc.chain.getFinalizedHead()
    const finalizedHeader = await api.rpc.chain.getHeader(finalizedHash)
    const finalizedNumber = finalizedHeader.number.toNumber()

    if (found.blockNumber > finalizedNumber) {
      return {
        valid: false,
        error: 'Transaction not yet finalized. Please wait a few more blocks.'
      }
    }

    return {
      valid: true,
      actualAmount,
      from
    }

  } catch (error) {
    console.error('Blockchain verification error:', error)
    return {
      valid: false,
      error: `Verification failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'))

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    const body: DepositRequest = await req.json()
    const { txHash, token, expectedAmount, walletAddress, blockNumber } = body

    if (!txHash || !token || !expectedAmount || !walletAddress) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: txHash, token, expectedAmount, walletAddress' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!['HEZ', 'PEZ'].includes(token)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token. Must be HEZ or PEZ' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (expectedAmount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Amount must be greater than 0' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if TX hash already processed
    const { data: existingRequest } = await serviceClient
      .from('p2p_deposit_withdraw_requests')
      .select('id, status')
      .eq('blockchain_tx_hash', txHash)
      .single()

    if (existingRequest) {
      if (existingRequest.status === 'completed') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'This transaction has already been processed',
            existingRequestId: existingRequest.id
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Map wallet address to deterministic UUID
    const userId = await walletToUUID(walletAddress)

    // Create or update deposit request
    const { data: depositRequest, error: requestError } = await serviceClient
      .from('p2p_deposit_withdraw_requests')
      .upsert({
        user_id: userId,
        request_type: 'deposit',
        token,
        amount: expectedAmount,
        wallet_address: walletAddress,
        blockchain_tx_hash: txHash,
        status: 'processing'
      }, {
        onConflict: 'blockchain_tx_hash'
      })
      .select()
      .single()

    if (requestError) {
      console.error('Failed to create deposit request:', requestError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create deposit request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify transaction on blockchain
    console.log(`Verifying deposit: TX=${txHash}, Token=${token}, Amount=${expectedAmount}`)
    const verification = await verifyTransactionOnChain(txHash, token, expectedAmount, blockNumber)

    if (!verification.valid) {
      await serviceClient
        .from('p2p_deposit_withdraw_requests')
        .update({
          status: 'failed',
          error_message: verification.error,
          processed_at: new Date().toISOString()
        })
        .eq('id', depositRequest.id)

      return new Response(
        JSON.stringify({
          success: false,
          error: verification.error || 'Transaction verification failed'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify on-chain sender matches claimed wallet address
    // Normalize both to raw hex for reliable comparison
    const addrToHex = (addr: string): string => {
      if (addr.startsWith('0x') && addr.length === 66) return addr.toLowerCase()
      try {
        const decoded = base58.decode(addr)
        const pubkey = decoded.length === 35 ? decoded.slice(1, 33) : decoded.slice(2, 34)
        return '0x' + Array.from(pubkey).map(b => b.toString(16).padStart(2, '0')).join('')
      } catch { return addr }
    }
    if (addrToHex(verification.from || '') !== addrToHex(walletAddress)) {
      await serviceClient
        .from('p2p_deposit_withdraw_requests')
        .update({
          status: 'failed',
          error_message: `Sender mismatch: on-chain sender ${verification.from} does not match claimed wallet ${walletAddress}`,
          processed_at: new Date().toISOString()
        })
        .eq('id', depositRequest.id)

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Wallet address does not match the transaction sender'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process deposit
    const { data: processResult, error: processError } = await serviceClient
      .rpc('process_deposit', {
        p_user_id: userId,
        p_token: token,
        p_amount: verification.actualAmount || expectedAmount,
        p_tx_hash: txHash,
        p_request_id: depositRequest.id
      })

    if (processError) {
      console.error('Failed to process deposit:', processError)

      await serviceClient
        .from('p2p_deposit_withdraw_requests')
        .update({
          status: 'failed',
          error_message: processError.message,
          processed_at: new Date().toISOString()
        })
        .eq('id', depositRequest.id)

      return new Response(
        JSON.stringify({ success: false, error: 'Failed to process deposit' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!processResult?.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: processResult?.error || 'Deposit processing failed'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Deposit successful: Wallet=${walletAddress}, Amount=${verification.actualAmount || expectedAmount} ${token}`)

    return new Response(
      JSON.stringify({
        success: true,
        amount: verification.actualAmount || expectedAmount,
        token,
        newBalance: processResult.new_balance,
        txHash,
        message: 'Deposit verified and credited successfully'
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
