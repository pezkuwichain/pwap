// ========================================
// Multisig Pending Operations (higher-level orchestration for the review/approve UI)
// ========================================
// Sits on top of multisig.ts's low-level pallet-multisig calls and usdt.ts's bridge constants.
// There is no code path connecting this web app to the usdt-bridge relayer's private local
// database (confirmed while researching this feature - see the usdt-bridge-multisig-migration
// memory), so pending calls are described purely from on-chain state: the one deterministic,
// always-reconstructible candidate (the automation key's periodic allowance renewal) is
// auto-matched by hash; anything else needs a signer to paste the known call data, exactly
// like the Android wallet's "Enter Call Data" fallback exists for the same reason - a call
// hash alone is cryptographically insufficient to recover the original call.

import type { ApiPromise } from '@pezkuwi/api';
import type { SubmittableExtrinsic } from '@pezkuwi/api/types';
import {
  getPendingMultisigCalls,
  USDT_MULTISIG_CONFIG,
  type MultisigTimepoint,
} from './multisig';
import { WUSDT_ASSET_ID, WUSDT_AUTOMATION_KEY_ADDRESS, STANDARD_RENEWAL_TOPUP } from './usdt';

export interface PendingOperation {
  callHash: string;
  when: MultisigTimepoint;
  deposit: string;
  depositor: string;
  approvals: string[];
  approvalsCount: number;
  threshold: number;
  description: string;
  resolvedCall: SubmittableExtrinsic<'promise'> | null;
  isAutoMatched: boolean;
}

/**
 * The one deterministic, always-reconstructible pending-call shape this UI can auto-describe:
 * the automation key's periodic Assets.approve_transfer renewal (see PezbridgeBot /
 * pezkuwi-DKS/tools/usdt-bridge/src/bin/pezbridge_bot.rs, which builds the exact same call).
 */
export function buildRenewalCandidateCall(api: ApiPromise): SubmittableExtrinsic<'promise'> {
  return api.tx.assets.approveTransfer(
    WUSDT_ASSET_ID,
    WUSDT_AUTOMATION_KEY_ADDRESS,
    STANDARD_RENEWAL_TOPUP.toString()
  ) as unknown as SubmittableExtrinsic<'promise'>;
}

/**
 * Lists every pending Multisig.Multisigs entry for the bridge's custody account and attaches a
 * human-readable description + the real call object wherever it can be determined.
 */
export async function listPendingOperations(
  api: ApiPromise,
  multisigAddress: string
): Promise<PendingOperation[]> {
  const raw = await getPendingMultisigCalls(api, multisigAddress);
  const renewalCandidate = buildRenewalCandidateCall(api);
  const renewalHash = renewalCandidate.method.hash.toHex().toLowerCase();

  return raw.map((entry) => {
    const approvals = (entry.approvals ?? []) as string[];
    const isRenewal = String(entry.callHash).toLowerCase() === renewalHash;

    return {
      callHash: entry.callHash,
      when: entry.when,
      deposit: String(entry.deposit),
      depositor: entry.depositor,
      approvals,
      approvalsCount: approvals.length,
      threshold: USDT_MULTISIG_CONFIG.threshold,
      description: isRenewal
        ? `Automation key allowance renewal (${(Number(STANDARD_RENEWAL_TOPUP) / 1e6).toFixed(2)} wUSDT)`
        : 'Unknown call - paste the call data below to decode it',
      resolvedCall: isRenewal ? renewalCandidate : null,
      isAutoMatched: isRenewal,
    };
  });
}

/**
 * Decodes raw hex call data a signer pasted in (the manual fallback for any pending call this
 * UI couldn't auto-reconstruct) and verifies its hash actually matches the pending entry before
 * returning it - pasted data is never trusted blindly.
 */
export function decodeAndVerifyCallData(
  api: ApiPromise,
  callDataHex: string,
  expectedCallHash: string
): { call: SubmittableExtrinsic<'promise'>; description: string } {
  const decoded = api.createType('Call', callDataHex);
  const call = api.tx(decoded) as unknown as SubmittableExtrinsic<'promise'>;
  const actualHash = call.method.hash.toHex().toLowerCase();

  if (actualHash !== expectedCallHash.toLowerCase()) {
    throw new Error(
      `Call data does not match this operation: decoded hash ${actualHash}, expected ${expectedCallHash.toLowerCase()}`
    );
  }

  const method = call.method as unknown as { section: string; method: string; args: unknown[] };
  const argsText = method.args.map((a) => String(a)).join(', ');

  return { call, description: `${method.section}.${method.method}(${argsText})` };
}
