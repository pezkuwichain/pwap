// ========================================
// Score Systems Integration
// ========================================
// Score pallets are distributed across chains:
// - Trust Score: pezpallet-trust (People Chain)
// - Referral Score: pezpallet-referral (People Chain)
// - Staking Score: pezpallet-staking-score (Relay Chain - needs staking.ledger access)
// - Tiki Score: pezpallet-tiki (People Chain)

import type { ApiPromise } from '@pezkuwi/api';
import { formatBalance } from './wallet';

// ========================================
// TYPE DEFINITIONS
// ========================================

export interface UserScores {
  trustScore: number;
  referralScore: number;
  stakingScore: number;
  tikiScore: number;
  totalScore: number;
}

export interface StakingScoreStatus {
  isTracking: boolean;
  startBlock: number | null;
  currentBlock: number;
  durationBlocks: number;
}

export type EpochStatus = 'Open' | 'ClaimPeriod' | 'Closed';

export interface EpochRewardPool {
  totalRewardPool: string;
  totalTrustScore: number;
  participantsCount: number;
  rewardPerTrustPoint: string;
  claimDeadline: number;
}

export interface PezRewardInfo {
  currentEpoch: number;
  epochStatus: EpochStatus;
  hasRecordedThisEpoch: boolean;
  userScoreCurrentEpoch: number;
  claimableRewards: { epoch: number; amount: string }[];
  totalClaimable: string;
  hasPendingClaim: boolean;
}

// ========================================
// TRUST SCORE (pezpallet-trust on People Chain)
// ========================================

/**
 * Fetch user's trust score from blockchain
 * Storage: trust.trustScores(address)
 */
export async function getTrustScore(
  peopleApi: ApiPromise,
  address: string
): Promise<number> {
  try {
    if (!peopleApi?.query?.trust?.trustScores) {
      return 0;
    }

    const score = await peopleApi.query.trust.trustScores(address);

    if (score.isEmpty) {
      return 0;
    }

    return Number(score.toString());
  } catch (error) {
    console.error('Error fetching trust score:', error);
    return 0;
  }
}

// ========================================
// REFERRAL SCORE (pezpallet-referral on People Chain)
// ========================================

/**
 * Fetch user's referral count and calculate score
 * Storage: referral.referralCount(address)
 *
 * Score calculation:
 * - 0 referrals: 0 points
 * - 1-5 referrals: count × 4 points
 * - 6-20 referrals: 20 + (count - 5) × 2 points
 * - 21+ referrals: capped at 50 points
 */
export async function getReferralScore(
  peopleApi: ApiPromise,
  address: string
): Promise<number> {
  try {
    if (!peopleApi?.query?.referral?.referralCount) {
      return 0;
    }

    const count = await peopleApi.query.referral.referralCount(address);
    const referralCount = Number(count.toString());

    if (referralCount === 0) return 0;
    if (referralCount <= 5) return referralCount * 4;
    if (referralCount <= 20) return 20 + ((referralCount - 5) * 2);
    return 50; // Capped at 50 points
  } catch (error) {
    console.error('Error fetching referral score:', error);
    return 0;
  }
}

/**
 * Get raw referral count
 */
export async function getReferralCount(
  peopleApi: ApiPromise,
  address: string
): Promise<number> {
  try {
    if (!peopleApi?.query?.referral?.referralCount) {
      return 0;
    }

    const count = await peopleApi.query.referral.referralCount(address);
    return Number(count.toString());
  } catch (error) {
    console.error('Error fetching referral count:', error);
    return 0;
  }
}

// ========================================
// STAKING SCORE (pezpallet-staking-score on Relay Chain)
// ========================================

/**
 * Check staking score tracking status
 * Storage: stakingScore.stakingStartBlock(address)
 *
 * IMPORTANT: stakingScore pallet is on the Relay Chain (not People Chain),
 * because it needs access to staking.ledger for score calculation.
 */
export async function getStakingScoreStatus(
  relayApi: ApiPromise,
  address: string
): Promise<StakingScoreStatus> {
  try {
    if (!relayApi?.query?.stakingScore?.stakingStartBlock) {
      return { isTracking: false, startBlock: null, currentBlock: 0, durationBlocks: 0 };
    }

    const startBlockResult = await relayApi.query.stakingScore.stakingStartBlock(address);
    const currentBlock = Number((await relayApi.query.system.number()).toString());

    if (startBlockResult.isEmpty || startBlockResult.isNone) {
      return { isTracking: false, startBlock: null, currentBlock, durationBlocks: 0 };
    }

    const startBlock = Number(startBlockResult.toString());
    const durationBlocks = currentBlock - startBlock;

    return {
      isTracking: true,
      startBlock,
      currentBlock,
      durationBlocks
    };
  } catch (error) {
    console.error('Error fetching staking score status:', error);
    return { isTracking: false, startBlock: null, currentBlock: 0, durationBlocks: 0 };
  }
}

/**
 * Start staking score tracking
 * Calls: stakingScore.startScoreTracking()
 *
 * IMPORTANT: This must be called on the Relay Chain API (not People Chain),
 * because the stakingScore pallet needs access to staking.ledger to verify
 * the user has an active stake. The staking pallet only exists on Relay Chain.
 */
export async function startScoreTracking(
  relayApi: ApiPromise,
  address: string,
  signer: any
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!relayApi?.tx?.stakingScore?.startScoreTracking) {
      return { success: false, error: 'stakingScore pallet not available on this chain' };
    }

    const tx = relayApi.tx.stakingScore.startScoreTracking();

    return new Promise((resolve) => {
      tx.signAndSend(address, { signer }, ({ status, dispatchError }) => {
        if (status.isInBlock || status.isFinalized) {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = relayApi.registry.findMetaError(dispatchError.asModule);
              resolve({ success: false, error: `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}` });
            } else {
              resolve({ success: false, error: dispatchError.toString() });
            }
          } else {
            resolve({ success: true });
          }
        }
      });
    });
  } catch (error) {
    console.error('Error starting score tracking:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ========================================
// TIKI SCORE (pezpallet-tiki on People Chain)
// ========================================

import { fetchUserTikis, calculateTikiScore } from './tiki';

/**
 * Get tiki score from user's roles
 */
export async function getTikiScore(
  peopleApi: ApiPromise,
  address: string
): Promise<number> {
  try {
    const tikis = await fetchUserTikis(peopleApi, address);
    return calculateTikiScore(tikis);
  } catch (error) {
    console.error('Error fetching tiki score:', error);
    return 0;
  }
}

// ========================================
// COMPREHENSIVE SCORE FETCHING
// ========================================

/**
 * Fetch all scores for a user from People Chain
 * Trust pallet computes composite score on-chain (includes staking, referral, tiki, perwerde)
 */
export async function getAllScores(
  peopleApi: ApiPromise | null,
  address: string
): Promise<UserScores> {
  if (!peopleApi || !address) {
    return { trustScore: 0, referralScore: 0, stakingScore: 0, tikiScore: 0, totalScore: 0 };
  }

  try {
    const [trustScore, referralScore, tikiScore] = await Promise.all([
      getTrustScore(peopleApi, address),
      getReferralScore(peopleApi, address),
      getTikiScore(peopleApi, address),
    ]);

    return {
      trustScore,
      referralScore,
      stakingScore: 0,  // Trust pallet already includes staking
      tikiScore,
      totalScore: trustScore,  // Trust score = composite score (on-chain calculated)
    };
  } catch (error) {
    console.error('Error fetching scores:', error);
    return { trustScore: 0, referralScore: 0, stakingScore: 0, tikiScore: 0, totalScore: 0 };
  }
}

// ========================================
// SCORE DISPLAY HELPERS
// ========================================

export function getScoreColor(score: number): string {
  if (score >= 200) return 'text-purple-500';
  if (score >= 150) return 'text-pink-500';
  if (score >= 100) return 'text-blue-500';
  if (score >= 70) return 'text-cyan-500';
  if (score >= 40) return 'text-teal-500';
  if (score >= 20) return 'text-green-500';
  return 'text-gray-500';
}

export function getScoreRating(score: number): string {
  if (score >= 250) return 'Legendary';
  if (score >= 200) return 'Excellent';
  if (score >= 150) return 'Very Good';
  if (score >= 100) return 'Good';
  if (score >= 70) return 'Average';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Low';
  return 'Very Low';
}

export function formatScore(score: number): string {
  return score.toFixed(0);
}

export function formatDuration(blocks: number): string {
  const BLOCKS_PER_MINUTE = 10;
  const minutes = blocks / BLOCKS_PER_MINUTE;
  const hours = minutes / 60;
  const days = hours / 24;
  const months = days / 30;

  if (months >= 1) return `${Math.floor(months)} month${Math.floor(months) > 1 ? 's' : ''}`;
  if (days >= 1) return `${Math.floor(days)} day${Math.floor(days) > 1 ? 's' : ''}`;
  if (hours >= 1) return `${Math.floor(hours)} hour${Math.floor(hours) > 1 ? 's' : ''}`;
  return `${Math.floor(minutes)} minute${Math.floor(minutes) > 1 ? 's' : ''}`;
}

// ========================================
// CITIZENSHIP & PERWERDE
// ========================================

/**
 * Check if user is a citizen (KYC approved)
 */
export async function checkCitizenshipStatus(
  peopleApi: ApiPromise | null,
  address: string
): Promise<boolean> {
  if (!peopleApi || !address) return false;

  try {
    if (!peopleApi.query?.identityKyc?.kycStatuses) {
      return false;
    }

    const status = await peopleApi.query.identityKyc.kycStatuses(address);
    const statusStr = status.toString();

    // KycLevel::Approved = "Approved" or numeric value 3
    return statusStr === 'Approved' || statusStr === '3';
  } catch (err) {
    console.error('Error checking citizenship status:', err);
    return false;
  }
}

/**
 * Get Perwerde (education) score
 * This is from pezpallet-perwerde on People Chain
 */
export async function getPerwerdeScore(
  peopleApi: ApiPromise | null,
  address: string
): Promise<number> {
  if (!peopleApi || !address) return 0;

  try {
    // Check if perwerde pallet exists
    if (!peopleApi.query?.perwerde) {
      return 0;
    }

    // Try to get user's completed courses/certifications
    if (peopleApi.query.perwerde.userScores) {
      const score = await peopleApi.query.perwerde.userScores(address);
      if (!score.isEmpty) {
        return Number(score.toString());
      }
    }

    // Alternative: count completed courses
    if (peopleApi.query.perwerde.completedCourses) {
      const courses = await peopleApi.query.perwerde.completedCourses(address);
      const coursesJson = courses.toJSON() as unknown[];
      if (Array.isArray(coursesJson)) {
        // Each completed course = 10 points, max 50
        return Math.min(coursesJson.length * 10, 50);
      }
    }

    return 0;
  } catch (err) {
    console.error('Error fetching perwerde score:', err);
    return 0;
  }
}

// ========================================
// PEZ REWARDS (pezRewards pallet on People Chain)
// ========================================

/**
 * Get PEZ rewards information for an account
 * Uses correct storage query names from pezRewards pallet:
 * - getCurrentEpochInfo() → epoch info
 * - epochStatus(epoch) → Open | ClaimPeriod | Closed
 * - getUserTrustScoreForEpoch(epoch, addr) → user's recorded score
 * - getClaimedReward(epoch, addr) → claimed reward amount
 * - getEpochRewardPool(epoch) → reward pool info
 */
export async function getPezRewards(
  peopleApi: ApiPromise,
  address: string
): Promise<PezRewardInfo | null> {
  try {
    if (!peopleApi?.query?.pezRewards?.getCurrentEpochInfo) {
      console.warn('PezRewards pallet not available on People Chain');
      return null;
    }

    // Get current epoch info
    const epochInfoResult = await peopleApi.query.pezRewards.getCurrentEpochInfo();
    if (!epochInfoResult) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const epochInfo = epochInfoResult.toJSON() as any;
    const currentEpoch: number = epochInfo.currentEpoch ?? epochInfo.current_epoch ?? 0;

    // Get current epoch status
    let epochStatus: EpochStatus = 'Open';
    try {
      const statusResult = await peopleApi.query.pezRewards.epochStatus(currentEpoch);
      const statusStr = statusResult.toString();
      if (statusStr === 'ClaimPeriod') epochStatus = 'ClaimPeriod';
      else if (statusStr === 'Closed') epochStatus = 'Closed';
      else epochStatus = 'Open';
    } catch {
      // Default to Open if query fails
    }

    // Check if user has recorded their score this epoch
    let hasRecordedThisEpoch = false;
    let userScoreCurrentEpoch = 0;
    try {
      const userScoreResult = await peopleApi.query.pezRewards.getUserTrustScoreForEpoch(currentEpoch, address);
      if (userScoreResult.isSome) {
        hasRecordedThisEpoch = true;
        const scoreCodec = userScoreResult.unwrap() as { toString: () => string };
        userScoreCurrentEpoch = Number(scoreCodec.toString());
      }
    } catch {
      // User hasn't recorded
    }

    // Check for claimable rewards from completed epochs
    const claimableRewards: { epoch: number; amount: string }[] = [];
    let totalClaimable = BigInt(0);

    for (let i = Math.max(0, currentEpoch - 3); i < currentEpoch; i++) {
      try {
        // Check epoch status - only ClaimPeriod epochs are claimable
        const pastStatusResult = await peopleApi.query.pezRewards.epochStatus(i);
        const pastStatus = pastStatusResult.toString();
        if (pastStatus !== 'ClaimPeriod') continue;

        // Check if user already claimed
        const claimedResult = await peopleApi.query.pezRewards.getClaimedReward(i, address);
        if (claimedResult.isSome) continue;

        // Check if user has a score for this epoch
        const userScoreResult = await peopleApi.query.pezRewards.getUserTrustScoreForEpoch(i, address);
        if (!userScoreResult.isSome) continue;

        // Get epoch reward pool
        const epochPoolResult = await peopleApi.query.pezRewards.getEpochRewardPool(i);
        if (!epochPoolResult.isSome) continue;

        const epochPoolCodec = epochPoolResult.unwrap() as { toJSON: () => unknown };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const epochPool = epochPoolCodec.toJSON() as any;
        const userScoreCodec = userScoreResult.unwrap() as { toString: () => string };
        const userScore = BigInt(userScoreCodec.toString());
        const rewardPerPoint = BigInt(epochPool.rewardPerTrustPoint || epochPool.reward_per_trust_point || '0');

        const rewardAmount = userScore * rewardPerPoint;
        const rewardFormatted = formatBalance(rewardAmount.toString());

        if (parseFloat(rewardFormatted) > 0) {
          claimableRewards.push({ epoch: i, amount: rewardFormatted });
          totalClaimable += rewardAmount;
        }
      } catch (err) {
        console.warn(`Error checking epoch ${i} rewards:`, err);
      }
    }

    return {
      currentEpoch,
      epochStatus,
      hasRecordedThisEpoch,
      userScoreCurrentEpoch,
      claimableRewards,
      totalClaimable: formatBalance(totalClaimable.toString()),
      hasPendingClaim: claimableRewards.length > 0,
    };
  } catch (error) {
    console.warn('PEZ rewards not available:', error);
    return null;
  }
}

/**
 * Record trust score for the current epoch
 * Calls: pezRewards.recordTrustScore()
 */
export async function recordTrustScore(
  peopleApi: ApiPromise,
  address: string,
  signer: any
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!peopleApi?.tx?.pezRewards?.recordTrustScore) {
      return { success: false, error: 'pezRewards pallet not available' };
    }

    const tx = peopleApi.tx.pezRewards.recordTrustScore();

    return new Promise((resolve) => {
      tx.signAndSend(address, { signer }, ({ status, dispatchError }: any) => {
        if (status.isInBlock || status.isFinalized) {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = peopleApi.registry.findMetaError(dispatchError.asModule);
              resolve({ success: false, error: `${decoded.section}.${decoded.name}` });
            } else {
              resolve({ success: false, error: dispatchError.toString() });
            }
          } else {
            resolve({ success: true });
          }
        }
      });
    });
  } catch (error) {
    console.error('Error recording trust score:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Claim PEZ reward for a specific epoch
 * Calls: pezRewards.claimReward(epochIndex)
 */
export async function claimPezReward(
  peopleApi: ApiPromise,
  address: string,
  epochIndex: number,
  signer: any
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!peopleApi?.tx?.pezRewards?.claimReward) {
      return { success: false, error: 'pezRewards pallet not available' };
    }

    const tx = peopleApi.tx.pezRewards.claimReward(epochIndex);

    return new Promise((resolve) => {
      tx.signAndSend(address, { signer }, ({ status, dispatchError }: any) => {
        if (status.isInBlock || status.isFinalized) {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = peopleApi.registry.findMetaError(dispatchError.asModule);
              resolve({ success: false, error: `${decoded.section}.${decoded.name}` });
            } else {
              resolve({ success: false, error: dispatchError.toString() });
            }
          } else {
            resolve({ success: true });
          }
        }
      });
    });
  } catch (error) {
    console.error('Error claiming PEZ reward:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
