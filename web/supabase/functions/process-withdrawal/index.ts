/**
 * P2P Withdrawal Processing Edge Function
 *
 * This function processes pending withdrawal requests from the P2P internal balance system.
 * It should be called by a cron job or triggered manually by admin.
 *
 * Security:
 * - Uses service role key for database operations
 * - Platform wallet private key stored in environment variables
 * - All transactions are logged for auditing
 *
 * Flow:
 * 1. Fetch pending withdrawal requests
 * 2. For each request:
 *    a. Lock the request (status = 'processing')
 *    b. Execute blockchain transfer
 *    c. Update request with tx hash
 *    d. Deduct from user's internal balance
 *    e. Mark as completed
 */

// @ts-ignore - Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore - Polkadot imports for Deno
import { ApiPromise, WsProvider, Keyring } from "https://esm.sh/@polkadot/api@11.0.2";
// @ts-ignore - Deno imports
import { cryptoWaitReady } from "https://esm.sh/@polkadot/util-crypto@12.6.2";

// Configuration
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PLATFORM_WALLET_SEED = Deno.env.get("PLATFORM_WALLET_SEED")!;
const RPC_ENDPOINT = Deno.env.get("RPC_ENDPOINT") || "wss://rpc.pezkuwichain.io:9944";

// Asset IDs
const ASSET_IDS: Record<string, number | null> = {
  HEZ: null, // Native token
  PEZ: 1,
};

// Decimals
const DECIMALS = 12;

interface WithdrawRequest {
  id: string;
  user_id: string;
  token: string;
  amount: number;
  wallet_address: string;
  status: string;
}

/**
 * Process a single withdrawal request
 */
async function processWithdrawal(
  api: ApiPromise,
  keyring: Keyring,
  supabase: ReturnType<typeof createClient>,
  request: WithdrawRequest
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const { id, token, amount, wallet_address } = request;

  try {
    console.log(`Processing withdrawal ${id}: ${amount} ${token} to ${wallet_address}`);

    // 1. Get platform wallet from keyring
    const platformWallet = keyring.addFromUri(PLATFORM_WALLET_SEED);

    // 2. Calculate amount in planck (smallest unit)
    const amountPlanck = BigInt(Math.floor(amount * Math.pow(10, DECIMALS)));

    // 3. Build transaction based on token type
    let tx;
    if (token === "HEZ" || ASSET_IDS[token] === null) {
      // Native token transfer
      tx = api.tx.balances.transferKeepAlive(wallet_address, amountPlanck);
    } else {
      // Asset transfer
      const assetId = ASSET_IDS[token];
      if (assetId === undefined) {
        throw new Error(`Unknown token: ${token}`);
      }
      tx = api.tx.assets.transfer(assetId, wallet_address, amountPlanck);
    }

    // 4. Sign and send transaction
    const txHash = await new Promise<string>((resolve, reject) => {
      let unsubscribe: () => void;

      tx.signAndSend(platformWallet, { nonce: -1 }, ({ status, dispatchError }) => {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(" ")}`));
          } else {
            reject(new Error(dispatchError.toString()));
          }
          if (unsubscribe) unsubscribe();
          return;
        }

        if (status.isInBlock) {
          console.log(`Transaction in block: ${status.asInBlock.toString()}`);
        }

        if (status.isFinalized) {
          const hash = tx.hash.toHex();
          console.log(`Transaction finalized: ${hash}`);
          resolve(hash);
          if (unsubscribe) unsubscribe();
        }
      })
        .then((unsub) => {
          unsubscribe = unsub;
        })
        .catch(reject);
    });

    // 5. Update request with tx hash and complete status
    const { error: updateError } = await supabase
      .from("p2p_deposit_withdraw_requests")
      .update({
        status: "completed",
        blockchain_tx_hash: txHash,
        processed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error(`Failed to update request ${id}:`, updateError);
      // Transaction was successful, but we couldn't update the database
      // This should be handled manually
      return { success: true, txHash, error: "Database update failed after successful tx" };
    }

    // 6. Log the withdrawal in balance transactions
    const { error: logError } = await supabase.from("p2p_balance_transactions").insert({
      user_id: request.user_id,
      token,
      transaction_type: "withdraw",
      amount: -amount,
      balance_before: 0, // Will be calculated by trigger
      balance_after: 0, // Will be calculated by trigger
      reference_type: "withdrawal",
      reference_id: id,
      description: `Withdrawal to ${wallet_address.slice(0, 8)}...${wallet_address.slice(-6)}`,
    });

    if (logError) {
      console.error(`Failed to log transaction for ${id}:`, logError);
    }

    console.log(`Successfully processed withdrawal ${id}: ${txHash}`);
    return { success: true, txHash };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed to process withdrawal ${id}:`, errorMessage);

    // Update request with error
    await supabase
      .from("p2p_deposit_withdraw_requests")
      .update({
        status: "failed",
        error_message: errorMessage,
        processed_at: new Date().toISOString(),
      })
      .eq("id", id);

    return { success: false, error: errorMessage };
  }
}

/**
 * Main handler
 */
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
    // Verify authorization (should be called with service role key or admin JWT)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers }
      );
    }

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request body for optional filters
    let requestBody: { limit?: number; requestId?: string } = {};
    try {
      requestBody = await req.json();
    } catch {
      // No body provided, use defaults
    }

    const { limit = 10, requestId } = requestBody;

    // 1. Fetch pending withdrawal requests
    let query = supabase
      .from("p2p_deposit_withdraw_requests")
      .select("*")
      .eq("request_type", "withdraw")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit);

    // If specific request ID provided, fetch only that one
    if (requestId) {
      query = supabase
        .from("p2p_deposit_withdraw_requests")
        .select("*")
        .eq("id", requestId)
        .eq("request_type", "withdraw")
        .in("status", ["pending", "failed"]);
    }

    const { data: pendingRequests, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch pending requests: ${fetchError.message}`);
    }

    if (!pendingRequests || pendingRequests.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending withdrawal requests", processed: 0 }),
        { headers }
      );
    }

    console.log(`Found ${pendingRequests.length} pending withdrawal requests`);

    // 2. Lock the requests (set status to processing)
    const requestIds = pendingRequests.map((r: WithdrawRequest) => r.id);
    const { error: lockError } = await supabase
      .from("p2p_deposit_withdraw_requests")
      .update({ status: "processing" })
      .in("id", requestIds);

    if (lockError) {
      throw new Error(`Failed to lock requests: ${lockError.message}`);
    }

    // 3. Initialize Polkadot API
    console.log(`Connecting to blockchain: ${RPC_ENDPOINT}`);
    await cryptoWaitReady();

    const provider = new WsProvider(RPC_ENDPOINT);
    const api = await ApiPromise.create({ provider });
    await api.isReady;

    const keyring = new Keyring({ type: "sr25519" });

    // 4. Process each withdrawal
    const results = [];
    for (const request of pendingRequests as WithdrawRequest[]) {
      const result = await processWithdrawal(api, keyring, supabase, request);
      results.push({
        id: request.id,
        ...result,
      });

      // Small delay between transactions to avoid nonce issues
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // 5. Cleanup
    await api.disconnect();

    // 6. Return results
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} withdrawal requests`,
        processed: results.length,
        success: successCount,
        failed: failCount,
        results,
      }),
      { headers }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing withdrawals:", errorMessage);

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers }
    );
  }
});
