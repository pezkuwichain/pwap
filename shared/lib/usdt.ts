// ========================================
// USDT Bridge Utilities
// ========================================
// Handles wUSDT minting, burning, and reserve management

import type { ApiPromise } from '@pezkuwi/api';
import { encodeAddress } from '@pezkuwi/util-crypto';
import { ASSET_IDS, ASSET_CONFIGS } from './wallet';
import { getMultisigMembers, createMultisigTx } from './multisig';

// ========================================
// CONSTANTS
// ========================================

export const WUSDT_ASSET_ID = ASSET_CONFIGS.WUSDT.id;
export const WUSDT_DECIMALS = ASSET_CONFIGS.WUSDT.decimals;

// ========================================
// BRIDGE CUSTODY (3-of-5 multisig)
// ========================================
// See res/validators-tiki.md "USDT Bridge Custody Multisig" and the
// usdt-bridge-multisig-migration memory for how these were derived/verified on-chain.
// Deliberately NOT env-overridable like the constants in wallet.ts - these are fixed,
// security-critical addresses, not per-deployment config; an env misconfiguration must
// never be able to silently point this UI at the wrong custody account.

/** The 3-of-5 multisig's own account on Pezkuwi Asset Hub - owns/issues wUSDT (asset 1000). */
export const WUSDT_BRIDGE_CUSTODY_PEZKUWI = '5GvwxmCDp3PC33KHoeWSgj3S7ocE7nzk1jiCCZMPSDBFeNcj';

/** Delegate key the multisig grants a bounded, auto-renewing Assets.approve_transfer allowance
 *  to (see pezkuwi-DKS/tools/usdt-bridge/src/bin/pezbridge_bot.rs) so small/routine deposits
 *  don't need a live 3-of-5 signature every time. */
export const WUSDT_AUTOMATION_KEY_ADDRESS = '5GQu4PFUb1f3MTJ7i7c1CtLgDk3TVvpSW1VbQCRmfkMoC8cM';

/** The standard top-up amount the multisig renews the automation key's allowance to (6
 *  decimals) - used to reconstruct and auto-describe that one deterministic pending call.
 *  MUST match pezbridge_bot_config.json's topup_amount AND the Android wallet's
 *  BridgeMultisigConstants.TOPUP_AMOUNT: all three signing channels build the SAME on-chain
 *  call, so a different amount here computes a different call hash - real renewals would
 *  show as "Unknown call" instead of auto-matching. 10,000 (the bot's old built-in default)
 *  was stale; the live config renews to 200,000 (renewal_threshold 40,000). */
export const STANDARD_RENEWAL_TOPUP = 200_000_000_000n; // 200,000 wUSDT

// Withdrawal limits and timeouts
export const WITHDRAWAL_LIMITS = {
  instant: {
    maxAmount: 1000, // $1,000
    delay: 0, // No delay
  },
  standard: {
    maxAmount: 10000, // $10,000
    delay: 3600, // 1 hour in seconds
  },
  large: {
    maxAmount: Infinity,
    delay: 86400, // 24 hours
  },
};

// ========================================
// ASSET QUERIES
// ========================================

/**
 * Get wUSDT balance for an account
 * @param api - Polkadot API instance
 * @param address - Account address
 * @returns Balance in human-readable format
 */
export async function getWUSDTBalance(api: ApiPromise, address: string): Promise<number> {
  try {
    const balance = await api.query.assets.account(WUSDT_ASSET_ID, address);

    if (balance.isSome) {
      const balanceCodec = balance.unwrap() as { toJSON: () => unknown };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const balanceData = balanceCodec.toJSON() as any;
      return Number(balanceData.balance) / Math.pow(10, WUSDT_DECIMALS);
    }

    return 0;
  } catch (error) {
    console.error('Error fetching wUSDT balance:', error);
    return 0;
  }
}

/**
 * Get total wUSDT supply
 * @param api - Polkadot API instance
 * @returns Total supply in human-readable format
 */
export async function getWUSDTTotalSupply(api: ApiPromise): Promise<number> {
  try {
    const assetDetails = await api.query.assets.asset(WUSDT_ASSET_ID);

    if (assetDetails.isSome) {
      const assetCodec = assetDetails.unwrap() as { toJSON: () => unknown };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const details = assetCodec.toJSON() as any;
      return Number(details.supply) / Math.pow(10, WUSDT_DECIMALS);
    }

    return 0;
  } catch (error) {
    console.error('Error fetching wUSDT supply:', error);
    return 0;
  }
}

/**
 * Get wUSDT asset metadata
 * @param api - Polkadot API instance
 * @returns Asset metadata
 */
export async function getWUSDTMetadata(api: ApiPromise) {
  try {
    const metadata = await api.query.assets.metadata(WUSDT_ASSET_ID);
    return metadata.toJSON();
  } catch (error) {
    console.error('Error fetching wUSDT metadata:', error);
    return null;
  }
}

// ========================================
// MULTISIG OPERATIONS
// ========================================

/**
 * Create multisig transaction to mint wUSDT
 * @param api - Polkadot API instance
 * @param beneficiary - Who will receive the wUSDT
 * @param amount - Amount in human-readable format (e.g., 100.50 USDT)
 * @param signerAddress - Address of the signer creating this tx
 * @param specificAddresses - Addresses for non-unique multisig members
 * @returns Multisig transaction
 */
export async function createMintWUSDTTx(
  api: ApiPromise,
  beneficiary: string,
  amount: number,
  signerAddress: string,
  specificAddresses: Record<string, string> = {}
) {
  // Convert to smallest unit
  const amountBN = BigInt(Math.floor(amount * Math.pow(10, WUSDT_DECIMALS)));

  // Create the mint call
  const mintCall = api.tx.assets.mint(WUSDT_ASSET_ID, beneficiary, amountBN.toString());

  // Get all multisig members
  const allMembers = await getMultisigMembers(api, specificAddresses);

  // Other signatories (excluding current signer)
  const otherSignatories = allMembers.filter((addr) => addr !== signerAddress);

  // Create multisig transaction
  return createMultisigTx(api, mintCall, otherSignatories);
}

/**
 * Create multisig transaction to burn wUSDT
 * @param api - Polkadot API instance
 * @param from - Who will have their wUSDT burned
 * @param amount - Amount in human-readable format
 * @param signerAddress - Address of the signer creating this tx
 * @param specificAddresses - Addresses for non-unique multisig members
 * @returns Multisig transaction
 */
export async function createBurnWUSDTTx(
  api: ApiPromise,
  from: string,
  amount: number,
  signerAddress: string,
  specificAddresses: Record<string, string> = {}
) {
  const amountBN = BigInt(Math.floor(amount * Math.pow(10, WUSDT_DECIMALS)));

  const burnCall = api.tx.assets.burn(WUSDT_ASSET_ID, from, amountBN.toString());

  const allMembers = await getMultisigMembers(api, specificAddresses);
  const otherSignatories = allMembers.filter((addr) => addr !== signerAddress);

  return createMultisigTx(api, burnCall, otherSignatories);
}

// ========================================
// WITHDRAWAL HELPERS
// ========================================

/**
 * Builds the plain, single-signer transfer a user submits THEMSELVES to initiate a withdrawal:
 * sending their own wUSDT to the multisig custody account. This is what usdt-bridge's
 * listen_withdrawals() actually watches for (an Assets.Transferred event targeting the custody
 * account) - the user never calls Assets.burn directly. Burning is the multisig's job, later,
 * once real USDT has actually been released on the Polkadot side; burn requires Admin origin
 * (the multisig), so a user-submitted burn call has always failed on-chain with NoPermission -
 * see the fixed bug in USDTBridge.tsx's handleWithdrawal, which used to call burn directly and
 * report success purely from `status.isFinalized` without checking whether the extrinsic
 * actually succeeded (a failed dispatch is still included/finalized, so it always "succeeded").
 * @param api - Polkadot API instance
 * @param amount - Amount in human-readable format (e.g., 100.50 USDT)
 * @returns Plain (non-multisig) transfer extrinsic the user signs with their own key
 */
export function createWithdrawalInitiationTx(api: ApiPromise, amount: number) {
  const amountBN = parseWUSDT(amount);
  return api.tx.assets.transfer(WUSDT_ASSET_ID, WUSDT_BRIDGE_CUSTODY_PEZKUWI, amountBN.toString());
}

/**
 * Where real USDT actually gets released to on Polkadot Asset Hub: usdt-bridge's relayer
 * (listen_withdrawals in main.rs) derives it by re-encoding the SENDER's own address under
 * Polkadot's SS58 prefix (0) - the same underlying sr25519/ed25519 key, just a different
 * network's address format. It does NOT read a separately user-specified destination, so the
 * UI must show this derived address rather than pretend an arbitrary one can be entered.
 */
export function deriveWithdrawalDestination(pezkuwiAddress: string): string {
  return encodeAddress(pezkuwiAddress, 0);
}

/**
 * Calculate withdrawal delay based on amount
 * @param amount - Withdrawal amount in USDT
 * @returns Delay in seconds
 */
export function calculateWithdrawalDelay(amount: number): number {
  if (amount <= WITHDRAWAL_LIMITS.instant.maxAmount) {
    return WITHDRAWAL_LIMITS.instant.delay;
  } else if (amount <= WITHDRAWAL_LIMITS.standard.maxAmount) {
    return WITHDRAWAL_LIMITS.standard.delay;
  } else {
    return WITHDRAWAL_LIMITS.large.delay;
  }
}

/**
 * Get withdrawal tier name
 * @param amount - Withdrawal amount
 * @returns Tier name
 */
export function getWithdrawalTier(amount: number): string {
  if (amount <= WITHDRAWAL_LIMITS.instant.maxAmount) return 'Instant';
  if (amount <= WITHDRAWAL_LIMITS.standard.maxAmount) return 'Standard';
  return 'Large';
}

/**
 * Format delay time for display
 * @param seconds - Delay in seconds
 * @returns Human-readable format
 */
export function formatDelay(seconds: number): string {
  if (seconds === 0) return 'Instant';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
  return `${Math.floor(seconds / 86400)} days`;
}

// ========================================
// RESERVE CHECKING
// ========================================

export interface ReserveStatus {
  wusdtSupply: number;
  offChainReserve: number; // This would come from off-chain oracle/API
  collateralRatio: number;
  isHealthy: boolean;
}

/**
 * Check reserve health
 * @param api - Polkadot API instance
 * @param offChainReserve - Off-chain USDT reserve amount (from treasury)
 * @returns Reserve status
 */
export async function checkReserveHealth(
  api: ApiPromise,
  offChainReserve: number
): Promise<ReserveStatus> {
  const wusdtSupply = await getWUSDTTotalSupply(api);

  const collateralRatio = wusdtSupply > 0 ? (offChainReserve / wusdtSupply) * 100 : 0;

  return {
    wusdtSupply,
    offChainReserve,
    collateralRatio,
    isHealthy: collateralRatio >= 100, // At least 100% backed
  };
}

// ========================================
// EVENT MONITORING
// ========================================

/**
 * Subscribe to wUSDT mint events
 * @param api - Polkadot API instance
 * @param callback - Callback function for each mint event
 */
export function subscribeToMintEvents(
  api: ApiPromise,
  callback: (beneficiary: string, amount: number, txHash: string) => void
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return api.query.system.events((events: any[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    events.forEach((record: any) => {
      const { event } = record;

      if (api.events.assets.Issued.is(event)) {
        const [assetId, beneficiary, amount] = event.data;

        if (assetId.toNumber() === WUSDT_ASSET_ID) {
          const amountNum = Number(amount.toString()) / Math.pow(10, WUSDT_DECIMALS);
          callback(beneficiary.toString(), amountNum, record.hash.toHex());
        }
      }
    });
  });
}

/**
 * Subscribe to wUSDT burn events
 * @param api - Polkadot API instance
 * @param callback - Callback function for each burn event
 */
export function subscribeToBurnEvents(
  api: ApiPromise,
  callback: (account: string, amount: number, txHash: string) => void
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return api.query.system.events((events: any[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    events.forEach((record: any) => {
      const { event } = record;

      if (api.events.assets.Burned.is(event)) {
        const [assetId, account, amount] = event.data;

        if (assetId.toNumber() === WUSDT_ASSET_ID) {
          const amountNum = Number(amount.toString()) / Math.pow(10, WUSDT_DECIMALS);
          callback(account.toString(), amountNum, record.hash.toHex());
        }
      }
    });
  });
}

// ========================================
// DISPLAY HELPERS
// ========================================

/**
 * Format wUSDT amount for display
 * @param amount - Amount in smallest unit or human-readable
 * @param fromSmallestUnit - Whether input is in smallest unit
 * @returns Formatted string
 */
export function formatWUSDT(amount: number | string, fromSmallestUnit = false): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (fromSmallestUnit) {
    return (value / Math.pow(10, WUSDT_DECIMALS)).toFixed(2);
  }

  return value.toFixed(2);
}

/**
 * Parse human-readable USDT to smallest unit
 * @param amount - Human-readable amount
 * @returns Amount in smallest unit (BigInt)
 */
export function parseWUSDT(amount: number | string): bigint {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  return BigInt(Math.floor(value * Math.pow(10, WUSDT_DECIMALS)));
}
