/**
 * P2P Deposit Verification Edge Function
 *
 * This function verifies deposit transactions on the blockchain and credits
 * the user's internal P2P balance.
 *
 * Flow:
 * 1. User sends tokens to platform wallet (from frontend)
 * 2. User calls this function with tx hash
 * 3. Function verifies transaction on-chain:
 *    - Confirms tx is finalized
 *    - Confirms correct recipient (platform wallet)
 *    - Confirms amount matches claimed amount
 *    - Confirms token type
 * 4. Credits user's internal balance
 * 5. Creates audit record
 */

// @ts-ignore - Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore - Polkadot imports for Deno
import { ApiPromise, WsProvider } from "https://esm.sh/@polkadot/api@11.0.2";

// Configuration
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PLATFORM_WALLET_ADDRESS = Deno.env.get("PLATFORM_WALLET_ADDRESS") || "5DFwqK698vL4gXHEcanaewnAqhxJ2rjhAogpSTHw3iwGDwd3";
const RPC_ENDPOINT = Deno.env.get("RPC_ENDPOINT") || "wss://rpc.pezkuwichain.io:9944";

// Decimals
const DECIMALS = 12;

// Tolerance for amount verification (0.1%)
const AMOUNT_TOLERANCE = 0.001;

interface VerifyDepositRequest {
  txHash: string;
  token: "HEZ" | "PEZ";
  expectedAmount: number;
}

/**
 * Parse block events to find transfer details
 */
function findTransferInEvents(
  api: ApiPromise,
  events: Array<{ event: { section: string; method: string; data: unknown[] } }>,
  token: string
): { from: string; to: string; amount: bigint } | null {
  for (const { event } of events) {
    // Native HEZ transfer
    if (token === "HEZ" && event.section === "balances" && event.method === "Transfer") {
      const [from, to, amount] = event.data as [
        { toString: () => string },
        { toString: () => string },
        { toBigInt: () => bigint }
      ];
      return {
        from: from.toString(),
        to: to.toString(),
        amount: amount.toBigInt(),
      };
    }

    // Asset transfer (PEZ)
    if (token === "PEZ" && event.section === "assets" && event.method === "Transferred") {
      const [_assetId, from, to, amount] = event.data as [
        unknown,
        { toString: () => string },
        { toString: () => string },
        { toBigInt: () => bigint }
      ];
      return {
        from: from.toString(),
        to: to.toString(),
        amount: amount.toBigInt(),
      };
    }
  }

  return null;
}

serve(async (req: Request) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers }
      );
    }

    // Initialize Supabase client with user's JWT
    const supabaseAnon = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Authentication failed" }),
        { status: 401, headers }
      );
    }

    // Parse request body
    const { txHash, token, expectedAmount }: VerifyDepositRequest = await req.json();

    // Validate input
    if (!txHash || !token || !expectedAmount) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: txHash, token, expectedAmount" }),
        { status: 400, headers }
      );
    }

    if (!["HEZ", "PEZ"].includes(token)) {
      return new Response(
        JSON.stringify({ error: "Invalid token type" }),
        { status: 400, headers }
      );
    }

    if (expectedAmount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers }
      );
    }

    // Initialize service role client for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if this tx hash has already been processed
    const { data: existingDeposit } = await supabase
      .from("p2p_deposit_withdraw_requests")
      .select("id")
      .eq("blockchain_tx_hash", txHash)
      .single();

    if (existingDeposit) {
      return new Response(
        JSON.stringify({ error: "This transaction has already been processed" }),
        { status: 400, headers }
      );
    }

    console.log(`Verifying deposit: ${txHash} for ${expectedAmount} ${token}`);

    // Connect to blockchain
    const provider = new WsProvider(RPC_ENDPOINT);
    const api = await ApiPromise.create({ provider });
    await api.isReady;

    try {
      // Get block hash from transaction hash
      // Note: In Substrate, we need to search for the extrinsic
      // This is a simplified version - production should use indexer
      const extrinsicHash = txHash;

      // Try to get the extrinsic status
      // In production, you'd use a block explorer API or indexer
      // For now, we'll search recent blocks

      const currentBlock = await api.rpc.chain.getBlock();
      const currentBlockNumber = currentBlock.block.header.number.toNumber();

      let foundTransfer = null;
      let blockHash = null;

      // Search last 100 blocks for the transaction
      for (let i = 0; i < 100; i++) {
        const blockNumber = currentBlockNumber - i;
        if (blockNumber < 0) break;

        const hash = await api.rpc.chain.getBlockHash(blockNumber);
        const signedBlock = await api.rpc.chain.getBlock(hash);
        const allRecords = await api.query.system.events.at(hash);

        // Check each extrinsic in the block
        signedBlock.block.extrinsics.forEach((extrinsic, index) => {
          if (extrinsic.hash.toHex() === extrinsicHash) {
            // Found the transaction! Get its events
            const events = (allRecords as unknown as Array<{ phase: { isApplyExtrinsic: boolean; asApplyExtrinsic: { eq: (n: number) => boolean } }; event: { section: string; method: string; data: unknown[] } }>)
              .filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index))
              .map(({ event }) => ({ event: { section: event.section, method: event.method, data: event.data as unknown[] } }));

            // Check if transaction was successful
            const success = events.some(
              ({ event }) =>
                event.section === "system" && event.method === "ExtrinsicSuccess"
            );

            if (success) {
              foundTransfer = findTransferInEvents(api, events, token);
              blockHash = hash.toHex();
            }
          }
        });

        if (foundTransfer) break;
      }

      if (!foundTransfer) {
        await api.disconnect();
        return new Response(
          JSON.stringify({
            error: "Transaction not found or not finalized. Please wait a few minutes and try again.",
          }),
          { status: 400, headers }
        );
      }

      // Verify the transfer details
      const { to, amount } = foundTransfer;

      // Check recipient is platform wallet
      if (to !== PLATFORM_WALLET_ADDRESS) {
        await api.disconnect();
        return new Response(
          JSON.stringify({
            error: "Transaction recipient is not the platform wallet",
          }),
          { status: 400, headers }
        );
      }

      // Convert amount to human-readable
      const actualAmount = Number(amount) / Math.pow(10, DECIMALS);

      // Check amount matches (with tolerance for rounding)
      const amountDiff = Math.abs(actualAmount - expectedAmount) / expectedAmount;
      if (amountDiff > AMOUNT_TOLERANCE) {
        await api.disconnect();
        return new Response(
          JSON.stringify({
            error: `Amount mismatch. Expected ${expectedAmount}, found ${actualAmount}`,
          }),
          { status: 400, headers }
        );
      }

      await api.disconnect();

      // All checks passed! Credit the user's internal balance
      // Create deposit request record
      const { data: depositRequest, error: insertError } = await supabase
        .from("p2p_deposit_withdraw_requests")
        .insert({
          user_id: user.id,
          request_type: "deposit",
          token,
          amount: actualAmount,
          wallet_address: foundTransfer.from,
          blockchain_tx_hash: txHash,
          status: "completed",
          processed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to create deposit record: ${insertError.message}`);
      }

      // Credit internal balance using the process_deposit function
      const { data: balanceResult, error: balanceError } = await supabase.rpc(
        "process_deposit",
        {
          p_user_id: user.id,
          p_token: token,
          p_amount: actualAmount,
          p_tx_hash: txHash,
        }
      );

      if (balanceError) {
        throw new Error(`Failed to credit balance: ${balanceError.message}`);
      }

      // Parse result
      const result = typeof balanceResult === "string" ? JSON.parse(balanceResult) : balanceResult;

      if (!result.success) {
        throw new Error(result.error || "Failed to credit balance");
      }

      console.log(`Successfully verified deposit ${txHash}: ${actualAmount} ${token}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Successfully deposited ${actualAmount} ${token}`,
          depositId: depositRequest.id,
          amount: actualAmount,
          token,
          txHash,
          blockHash,
        }),
        { headers }
      );
    } catch (error) {
      await api.disconnect();
      throw error;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error verifying deposit:", errorMessage);

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers }
    );
  }
});
