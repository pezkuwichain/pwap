// ========================================
// Score Systems Integration
// ========================================
// All score pallets live on People Chain:
// - Trust Score: pezpallet-trust (People Chain) - composite score
// - Referral Score: pezpallet-referral (People Chain)
// - Staking Score: pezpallet-staking-score (People Chain) - uses cached staking data from Asset Hub via XCM
// - Tiki Score: pezpallet-tiki (People Chain)
// - Perwerde Score: pezpallet-perwerde (People Chain)

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
  hasCachedData: boolean; // Whether noter has submitted staking data
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
 * Fetch user's referral score from on-chain stats
 * Storage: referral.referrerStatsStorage(address) → { totalReferrals, revokedReferrals, penaltyScore }
 *
 * On-chain tiered scoring (matches pezpallet-referral):
 * - 0 referrals: 0 points
 * - 1-10 referrals: count × 10 points (max 100)
 * - 11-50 referrals: 100 + (count - 10) × 5 points (max 300)
 * - 51-100 referrals: 300 + (count - 50) × 4 points (max 500)
 * - 101+ referrals: 500 points (maximum)
 * Then subtract penalty_score from revoked referrals
 */
export async function getReferralScore(
  peopleApi: ApiPromise,
  address: string
): Promise<number> {
  try {
    // Try reading from referrerStatsStorage for full stats with penalties
    if (peopleApi?.query?.referral?.referrerStatsStorage) {
      const stats = await peopleApi.query.referral.referrerStatsStorage(address);
      if (!stats.isEmpty) {
        const statsJson = stats.toJSON() as {
          totalReferrals?: number;
          total_referrals?: number;
          revokedReferrals?: number;
          revoked_referrals?: number;
          penaltyScore?: number;
          penalty_score?: number;
        };
        const totalReferrals = statsJson.totalReferrals ?? statsJson.total_referrals ?? 0;
        const revokedReferrals = statsJson.revokedReferrals ?? statsJson.revoked_referrals ?? 0;
        const penaltyScore = statsJson.penaltyScore ?? statsJson.penalty_score ?? 0;

        // Step 1: Remove revoked referrals from count
        const goodReferrals = Math.max(0, totalReferrals - revokedReferrals);

        // Step 2: Tiered scoring
        let baseScore: number;
        if (goodReferrals === 0) baseScore = 0;
        else if (goodReferrals <= 10) baseScore = goodReferrals * 10;
        else if (goodReferrals <= 50) baseScore = 100 + ((goodReferrals - 10) * 5);
        else if (goodReferrals <= 100) baseScore = 300 + ((goodReferrals - 50) * 4);
        else baseScore = 500;

        // Step 3: Subtract penalty
        return Math.max(0, baseScore - penaltyScore);
      }
    }

    // Fallback: simple count-based scoring
    if (peopleApi?.query?.referral?.referralCount) {
      const count = await peopleApi.query.referral.referralCount(address);
      const referralCount = Number(count.toString());
      if (referralCount === 0) return 0;
      if (referralCount <= 10) return referralCount * 10;
      if (referralCount <= 50) return 100 + ((referralCount - 10) * 5);
      if (referralCount <= 100) return 300 + ((referralCount - 50) * 4);
      return 500;
    }

    return 0;
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
// STAKING SCORE (pezpallet-staking-score on People Chain)
// ========================================

/**
 * Check staking score tracking status
 * Storage: stakingScore.stakingStartBlock(address)
 *
 * The stakingScore pallet is on People Chain. It receives staking data
 * from Asset Hub via XCM (stored in cachedStakingDetails).
 */
export async function getStakingScoreStatus(
  peopleApi: ApiPromise,
  address: string
): Promise<StakingScoreStatus> {
  try {
    if (!peopleApi?.query?.stakingScore?.stakingStartBlock) {
      return { isTracking: false, hasCachedData: false, startBlock: null, currentBlock: 0, durationBlocks: 0 };
    }

    const startBlockResult = await peopleApi.query.stakingScore.stakingStartBlock(address);
    const currentBlock = Number((await peopleApi.query.system.number()).toString());

    if (startBlockResult.isEmpty || startBlockResult.isNone) {
      return { isTracking: false, hasCachedData: false, startBlock: null, currentBlock, durationBlocks: 0 };
    }

    const startBlock = Number(startBlockResult.toString());
    const durationBlocks = currentBlock - startBlock;

    // Check if noter has submitted cached staking data
    let hasCachedData = false;
    if (peopleApi.query.stakingScore.cachedStakingDetails) {
      try {
        const [relayResult, assetHubResult] = await Promise.all([
          peopleApi.query.stakingScore.cachedStakingDetails(address, 'RelayChain')
            .catch(() => ({ isSome: false, isEmpty: true })),
          peopleApi.query.stakingScore.cachedStakingDetails(address, 'AssetHub')
            .catch(() => ({ isSome: false, isEmpty: true })),
        ]);
        hasCachedData = (relayResult.isSome || !relayResult.isEmpty) ||
                         (assetHubResult.isSome || !assetHubResult.isEmpty);
      } catch {
        hasCachedData = false;
      }
    }

    return {
      isTracking: true,
      hasCachedData,
      startBlock,
      currentBlock,
      durationBlocks
    };
  } catch (error) {
    console.error('Error fetching staking score status:', error);
    return { isTracking: false, hasCachedData: false, startBlock: null, currentBlock: 0, durationBlocks: 0 };
  }
}

/**
 * Start staking score tracking
 * Calls: stakingScore.startScoreTracking()
 *
 * Called on People Chain. No stake requirement - user opts in, then a
 * noter-authorized account submits staking data via receive_staking_details().
 */
export async function startScoreTracking(
  peopleApi: ApiPromise,
  address: string,
  signer: any
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!peopleApi?.tx?.stakingScore?.startScoreTracking) {
      return { success: false, error: 'stakingScore pallet not available on this chain' };
    }

    const tx = peopleApi.tx.stakingScore.startScoreTracking();

    return new Promise((resolve) => {
      tx.signAndSend(address, { signer }, ({ status, dispatchError }) => {
        if (status.isInBlock || status.isFinalized) {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = peopleApi.registry.findMetaError(dispatchError.asModule);
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
 *
 * Queries studentCourses for enrolled course IDs, then checks enrollments
 * for completed courses and sums their points.
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

    // Get user's enrolled course IDs
    if (!peopleApi.query.perwerde.studentCourses) {
      return 0;
    }

    const coursesResult = await peopleApi.query.perwerde.studentCourses(address);
    const courseIds = coursesResult.toJSON() as number[];

    if (!Array.isArray(courseIds) || courseIds.length === 0) {
      return 0;
    }

    // Sum points from completed courses
    let totalPoints = 0;
    for (const courseId of courseIds) {
      try {
        if (!peopleApi.query.perwerde.enrollments) break;
        const enrollment = await peopleApi.query.perwerde.enrollments([address, courseId]);
        if (enrollment.isEmpty || enrollment.isNone) continue;

        const enrollmentJson = enrollment.toJSON() as {
          completedAt?: number | null;
          completed_at?: number | null;
          pointsEarned?: number;
          points_earned?: number;
        };

        const completedAt = enrollmentJson.completedAt ?? enrollmentJson.completed_at;
        if (completedAt !== null && completedAt !== undefined) {
          totalPoints += enrollmentJson.pointsEarned ?? enrollmentJson.points_earned ?? 0;
        }
      } catch {
        // Skip individual enrollment errors
      }
    }

    return totalPoints;
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
 * Uses correct storage query names from live People Chain metadata:
 * - epochInfo() → epoch info (ValueQuery)
 * - epochStatus(epoch) → Open | ClaimPeriod | Closed
 * - userEpochScores(epoch, addr) → user's recorded score (OptionQuery)
 * - claimedRewards(epoch, addr) → claimed reward amount (OptionQuery)
 * - epochRewardPools(epoch) → reward pool info (OptionQuery)
 */
export async function getPezRewards(
  peopleApi: ApiPromise,
  address: string
): Promise<PezRewardInfo | null> {
  try {
    if (!peopleApi?.query?.pezRewards?.epochInfo) {
      console.warn('PezRewards pallet not available on People Chain');
      return null;
    }

    // Get current epoch info
    const epochInfoResult = await peopleApi.query.pezRewards.epochInfo();
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
      const userScoreResult = await peopleApi.query.pezRewards.userEpochScores(currentEpoch, address);
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
        const claimedResult = await peopleApi.query.pezRewards.claimedRewards(i, address);
        if (claimedResult.isSome) continue;

        // Check if user has a score for this epoch
        const userScoreResult = await peopleApi.query.pezRewards.userEpochScores(i, address);
        if (!userScoreResult.isSome) continue;

        // Get epoch reward pool
        const epochPoolResult = await peopleApi.query.pezRewards.epochRewardPools(i);
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
