// ========================================
// Presale Helper Functions
// ========================================
// Helper functions for pezpallet_presale integration
// Multi-presale launchpad platform for PezkuwiChain

import type { ApiPromise } from '@pezkuwi/api';
import type { InjectedAccountWithMeta } from '@pezkuwi/extension-inject/types';

// ========================================
// Types & Interfaces
// ========================================

export type PresaleStatus = 'Pending' | 'Active' | 'Paused' | 'Successful' | 'Failed' | 'Cancelled' | 'Finalized';
export type AccessControl = 'Public' | 'Whitelist';

export interface ContributionLimits {
  minContribution: string;
  maxContribution: string;
  softCap: string;
  hardCap: string;
}

export interface VestingSchedule {
  immediateReleasePercent: number;
  vestingDurationBlocks: number;
  cliffBlocks: number;
}

export interface RefundConfig {
  gracePeriodBlocks: number;
  refundFeePercent: number;
  graceRefundFeePercent: number;
}

export interface BonusTier {
  minContribution: string;
  bonusPercentage: number;
}

export interface PresaleConfig {
  id: number;
  owner: string;
  paymentAsset: number;
  rewardAsset: number;
  tokensForSale: string;
  startBlock: number;
  duration: number;
  status: PresaleStatus;
  accessControl: AccessControl;
  limits: ContributionLimits;
  bonusTiers: BonusTier[];
  vesting: VestingSchedule | null;
  gracePeriodBlocks: number;
  refundFeePercent: number;
  graceRefundFeePercent: number;
}

export interface ContributionInfo {
  amount: string;
  contributedAt: number;
  refunded: boolean;
  refundedAt: number | null;
  refundFeePaid: string;
}

export interface PresaleInfo extends PresaleConfig {
  totalRaised: string;
  contributorCount: number;
  endBlock: number;
  progress: number;
  timeRemaining: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  };
  isEnded: boolean;
  softCapReached: boolean;
  hardCapReached: boolean;
}

export interface UserPresaleInfo {
  contribution: ContributionInfo | null;
  isWhitelisted: boolean;
  vestedClaimed: string;
  claimableVested: string;
}

export interface PlatformStats {
  totalPresales: number;
  activePresales: number;
  successfulPresales: number;
  totalPlatformVolume: string;
  totalPlatformFees: string;
}

export interface CreatePresaleParams {
  paymentAsset: number;
  rewardAsset: number;
  tokensForSale: string;
  duration: number;
  isWhitelist: boolean;
  limits: ContributionLimits;
  vesting?: VestingSchedule;
  refundConfig: RefundConfig;
}

// Constants
export const PLATFORM_FEE_PERCENT = 2;
export const BLOCK_TIME_SECONDS = 6;
export const WUSDT_DECIMALS = 6;
export const PEZ_DECIMALS = 12;

// ========================================
// Query Functions
// ========================================

/**
 * Get total number of presales
 */
export async function getPresaleCount(api: ApiPromise): Promise<number> {
  try {
    const nextId = await api.query.presale.nextPresaleId();
    return nextId.toNumber();
  } catch (error) {
    console.error('Error getting presale count:', error);
    return 0;
  }
}

/**
 * Get presale configuration by ID
 */
export async function getPresaleConfig(
  api: ApiPromise,
  presaleId: number
): Promise<PresaleConfig | null> {
  try {
    const presaleData = await api.query.presale.presales(presaleId);

    if (presaleData.isNone) {
      return null;
    }

    const presale = presaleData.unwrap();
    const config = presale.toJSON() as any;

    return {
      id: presaleId,
      owner: config.owner || '',
      paymentAsset: config.paymentAsset || 0,
      rewardAsset: config.rewardAsset || 0,
      tokensForSale: config.tokensForSale?.toString() || '0',
      startBlock: config.startBlock || 0,
      duration: config.duration || 0,
      status: config.status || 'Pending',
      accessControl: config.accessControl || 'Public',
      limits: {
        minContribution: config.limits?.minContribution?.toString() || '0',
        maxContribution: config.limits?.maxContribution?.toString() || '0',
        softCap: config.limits?.softCap?.toString() || '0',
        hardCap: config.limits?.hardCap?.toString() || '0',
      },
      bonusTiers: (config.bonusTiers || []).map((tier: any) => ({
        minContribution: tier.minContribution?.toString() || '0',
        bonusPercentage: tier.bonusPercentage || 0,
      })),
      vesting: config.vesting ? {
        immediateReleasePercent: config.vesting.immediateReleasePercent || 0,
        vestingDurationBlocks: config.vesting.vestingDurationBlocks || 0,
        cliffBlocks: config.vesting.cliffBlocks || 0,
      } : null,
      gracePeriodBlocks: config.gracePeriodBlocks || 0,
      refundFeePercent: config.refundFeePercent || 0,
      graceRefundFeePercent: config.graceRefundFeePercent || 0,
    };
  } catch (error) {
    console.error(`Error getting presale ${presaleId}:`, error);
    return null;
  }
}

/**
 * Get presale with computed info (total raised, time remaining, etc.)
 */
export async function getPresaleInfo(
  api: ApiPromise,
  presaleId: number
): Promise<PresaleInfo | null> {
  try {
    const config = await getPresaleConfig(api, presaleId);
    if (!config) return null;

    const [totalRaised, contributors, header] = await Promise.all([
      api.query.presale.totalRaised(presaleId),
      api.query.presale.contributors(presaleId),
      api.rpc.chain.getHeader(),
    ]);

    const currentBlock = header.number.toNumber();
    const endBlock = config.startBlock + config.duration;
    const totalRaisedStr = totalRaised.toString();
    const contributorList = contributors.toHuman() as string[];

    // Calculate progress
    const hardCapNum = parseFloat(config.limits.hardCap);
    const raisedNum = parseFloat(totalRaisedStr);
    const progress = hardCapNum > 0 ? Math.min(100, (raisedNum / hardCapNum) * 100) : 0;

    // Calculate time remaining
    const blocksRemaining = Math.max(0, endBlock - currentBlock);
    const secondsRemaining = blocksRemaining * BLOCK_TIME_SECONDS;
    const timeRemaining = {
      days: Math.floor(secondsRemaining / 86400),
      hours: Math.floor((secondsRemaining % 86400) / 3600),
      minutes: Math.floor((secondsRemaining % 3600) / 60),
      seconds: Math.floor(secondsRemaining % 60),
    };

    // Check caps
    const softCapNum = parseFloat(config.limits.softCap);
    const softCapReached = raisedNum >= softCapNum;
    const hardCapReached = raisedNum >= hardCapNum;

    return {
      ...config,
      totalRaised: totalRaisedStr,
      contributorCount: contributorList?.length || 0,
      endBlock,
      progress,
      timeRemaining,
      isEnded: currentBlock >= endBlock,
      softCapReached,
      hardCapReached,
    };
  } catch (error) {
    console.error(`Error getting presale info ${presaleId}:`, error);
    return null;
  }
}

/**
 * Get all presales
 */
export async function getAllPresales(api: ApiPromise): Promise<PresaleInfo[]> {
  try {
    const count = await getPresaleCount(api);
    const presales: PresaleInfo[] = [];

    for (let i = 0; i < count; i++) {
      const info = await getPresaleInfo(api, i);
      if (info) {
        presales.push(info);
      }
    }

    // Sort: Active first, then by ID desc
    return presales.sort((a, b) => {
      const statusOrder: Record<PresaleStatus, number> = {
        Active: 0, Pending: 1, Paused: 2, Successful: 3, Failed: 4, Finalized: 5, Cancelled: 6
      };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return b.id - a.id;
    });
  } catch (error) {
    console.error('Error getting all presales:', error);
    return [];
  }
}

/**
 * Get user's contribution info for a presale
 */
export async function getUserContribution(
  api: ApiPromise,
  presaleId: number,
  address: string
): Promise<ContributionInfo | null> {
  try {
    const contribution = await api.query.presale.contributions(presaleId, address);

    if (contribution.isNone) {
      return null;
    }

    const data = contribution.unwrap().toJSON() as any;

    return {
      amount: data.amount?.toString() || '0',
      contributedAt: data.contributedAt || 0,
      refunded: data.refunded || false,
      refundedAt: data.refundedAt || null,
      refundFeePaid: data.refundFeePaid?.toString() || '0',
    };
  } catch (error) {
    console.error(`Error getting contribution for ${address}:`, error);
    return null;
  }
}

/**
 * Check if user is whitelisted for a presale
 */
export async function isUserWhitelisted(
  api: ApiPromise,
  presaleId: number,
  address: string
): Promise<boolean> {
  try {
    const isWhitelisted = await api.query.presale.whitelistedAccounts(presaleId, address);
    return isWhitelisted.isTrue;
  } catch (error) {
    console.error(`Error checking whitelist for ${address}:`, error);
    return false;
  }
}

/**
 * Get user's vesting claimed amount
 */
export async function getVestingClaimed(
  api: ApiPromise,
  presaleId: number,
  address: string
): Promise<string> {
  try {
    const claimed = await api.query.presale.vestingClaimed(presaleId, address);
    return claimed.toString();
  } catch (error) {
    console.error(`Error getting vesting claimed:`, error);
    return '0';
  }
}

/**
 * Get complete user info for a presale
 */
export async function getUserPresaleInfo(
  api: ApiPromise,
  presaleId: number,
  address: string
): Promise<UserPresaleInfo> {
  try {
    const [contribution, isWhitelisted, vestedClaimed] = await Promise.all([
      getUserContribution(api, presaleId, address),
      isUserWhitelisted(api, presaleId, address),
      getVestingClaimed(api, presaleId, address),
    ]);

    // TODO: Calculate claimableVested based on vesting schedule
    return {
      contribution,
      isWhitelisted,
      vestedClaimed,
      claimableVested: '0', // Calculate based on vesting schedule
    };
  } catch (error) {
    console.error(`Error getting user presale info:`, error);
    return {
      contribution: null,
      isWhitelisted: false,
      vestedClaimed: '0',
      claimableVested: '0',
    };
  }
}

/**
 * Get platform-wide statistics
 */
export async function getPlatformStats(api: ApiPromise): Promise<PlatformStats> {
  try {
    const [totalPresales, totalVolume, totalFees, successfulPresales] = await Promise.all([
      getPresaleCount(api),
      api.query.presale.totalPlatformVolume(),
      api.query.presale.totalPlatformFees(),
      api.query.presale.successfulPresales(),
    ]);

    // Count active presales
    let activeCount = 0;
    for (let i = 0; i < totalPresales; i++) {
      const config = await getPresaleConfig(api, i);
      if (config?.status === 'Active') {
        activeCount++;
      }
    }

    return {
      totalPresales,
      activePresales: activeCount,
      successfulPresales: successfulPresales.toNumber(),
      totalPlatformVolume: totalVolume.toString(),
      totalPlatformFees: totalFees.toString(),
    };
  } catch (error) {
    console.error('Error getting platform stats:', error);
    return {
      totalPresales: 0,
      activePresales: 0,
      successfulPresales: 0,
      totalPlatformVolume: '0',
      totalPlatformFees: '0',
    };
  }
}

// ========================================
// Transaction Functions
// ========================================

/**
 * Contribute to a presale
 */
export async function contribute(
  api: ApiPromise,
  account: InjectedAccountWithMeta,
  presaleId: number,
  amount: string, // in raw units (with decimals)
  onStatus?: (status: string) => void
): Promise<{ success: boolean; error?: string; txHash?: string }> {
  try {
    onStatus?.('Preparing transaction...');

    const tx = api.tx.presale.contribute(presaleId, amount);

    return new Promise((resolve) => {
      tx.signAndSend(
        account.address,
        { signer: account.signer },
        ({ status, dispatchError, txHash }) => {
          if (status.isInBlock) {
            onStatus?.('Transaction in block...');
          }
          if (status.isFinalized) {
            if (dispatchError) {
              let errorMessage = 'Transaction failed';
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
              }
              resolve({ success: false, error: errorMessage });
            } else {
              resolve({ success: true, txHash: txHash.toHex() });
            }
          }
        }
      ).catch((error) => {
        resolve({ success: false, error: error.message });
      });
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Request refund from a presale
 */
export async function refund(
  api: ApiPromise,
  account: InjectedAccountWithMeta,
  presaleId: number,
  onStatus?: (status: string) => void
): Promise<{ success: boolean; error?: string; txHash?: string }> {
  try {
    onStatus?.('Preparing refund...');

    const tx = api.tx.presale.refund(presaleId);

    return new Promise((resolve) => {
      tx.signAndSend(
        account.address,
        { signer: account.signer },
        ({ status, dispatchError, txHash }) => {
          if (status.isInBlock) {
            onStatus?.('Refund in block...');
          }
          if (status.isFinalized) {
            if (dispatchError) {
              let errorMessage = 'Refund failed';
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
              }
              resolve({ success: false, error: errorMessage });
            } else {
              resolve({ success: true, txHash: txHash.toHex() });
            }
          }
        }
      ).catch((error) => {
        resolve({ success: false, error: error.message });
      });
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Claim vested tokens
 */
export async function claimVested(
  api: ApiPromise,
  account: InjectedAccountWithMeta,
  presaleId: number,
  onStatus?: (status: string) => void
): Promise<{ success: boolean; error?: string; txHash?: string }> {
  try {
    onStatus?.('Preparing vesting claim...');

    const tx = api.tx.presale.claimVested(presaleId);

    return new Promise((resolve) => {
      tx.signAndSend(
        account.address,
        { signer: account.signer },
        ({ status, dispatchError, txHash }) => {
          if (status.isInBlock) {
            onStatus?.('Claim in block...');
          }
          if (status.isFinalized) {
            if (dispatchError) {
              let errorMessage = 'Claim failed';
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                errorMessage = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
              }
              resolve({ success: false, error: errorMessage });
            } else {
              resolve({ success: true, txHash: txHash.toHex() });
            }
          }
        }
      ).catch((error) => {
        resolve({ success: false, error: error.message });
      });
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ========================================
// Utility Functions
// ========================================

/**
 * Format wUSDT amount (6 decimals) to human readable
 */
export function formatWUSDT(amount: string): string {
  const num = parseFloat(amount) / Math.pow(10, WUSDT_DECIMALS);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * Format PEZ amount (12 decimals) to human readable
 */
export function formatPEZ(amount: string): string {
  const num = parseFloat(amount) / Math.pow(10, PEZ_DECIMALS);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/**
 * Parse human readable amount to raw units
 */
export function parseWUSDT(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return Math.floor(num * Math.pow(10, WUSDT_DECIMALS)).toString();
}

/**
 * Calculate expected reward tokens for a contribution
 * Formula: (contribution / totalRaised) * tokensForSale
 */
export function calculateExpectedReward(
  contribution: string,
  totalRaised: string,
  tokensForSale: string
): string {
  const contrib = parseFloat(contribution);
  const raised = parseFloat(totalRaised);
  const tokens = parseFloat(tokensForSale);

  if (raised === 0) return '0';

  const reward = (contrib / raised) * tokens;
  return Math.floor(reward).toString();
}

/**
 * Calculate platform fee for an amount
 */
export function calculatePlatformFee(amount: string): {
  fee: string;
  net: string;
  toTreasury: string;
  toBurn: string;
  toStakers: string;
} {
  const amountNum = parseFloat(amount);
  const fee = amountNum * (PLATFORM_FEE_PERCENT / 100);
  const net = amountNum - fee;
  const toTreasury = fee * 0.5; // 50%
  const toBurn = fee * 0.25; // 25%
  const toStakers = fee * 0.25; // 25%

  return {
    fee: Math.floor(fee).toString(),
    net: Math.floor(net).toString(),
    toTreasury: Math.floor(toTreasury).toString(),
    toBurn: Math.floor(toBurn).toString(),
    toStakers: Math.floor(toStakers).toString(),
  };
}

/**
 * Check if refund is in grace period (lower fee)
 */
export function isInGracePeriod(
  contributedAtBlock: number,
  gracePeriodBlocks: number,
  currentBlock: number
): boolean {
  return currentBlock <= contributedAtBlock + gracePeriodBlocks;
}

/**
 * Get refund fee percentage based on grace period
 */
export function getRefundFeePercent(
  contributedAtBlock: number,
  gracePeriodBlocks: number,
  graceRefundFeePercent: number,
  normalRefundFeePercent: number,
  currentBlock: number
): number {
  return isInGracePeriod(contributedAtBlock, gracePeriodBlocks, currentBlock)
    ? graceRefundFeePercent
    : normalRefundFeePercent;
}
