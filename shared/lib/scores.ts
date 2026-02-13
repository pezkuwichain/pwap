// ========================================
// Score Systems Integration
// ========================================
// All scores come from People Chain (people-rpc.pezkuwichain.io)
// - Trust Score: pezpallet-trust
// - Referral Score: pezpallet-referral
// - Staking Score: pezpallet-staking-score
// - Tiki Score: pezpallet-tiki

import type { ApiPromise } from '@pezkuwi/api';

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
// STAKING SCORE (pezpallet-staking-score on People Chain)
// ========================================

/**
 * Check staking score tracking status
 * Storage: stakingScore.stakingStartBlock(address)
 */
export async function getStakingScoreStatus(
  peopleApi: ApiPromise,
  address: string
): Promise<StakingScoreStatus> {
  try {
    if (!peopleApi?.query?.stakingScore?.stakingStartBlock) {
      return { isTracking: false, startBlock: null, currentBlock: 0, durationBlocks: 0 };
    }

    const startBlockResult = await peopleApi.query.stakingScore.stakingStartBlock(address);
    const currentBlock = Number((await peopleApi.query.system.number()).toString());

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
 */
export async function startScoreTracking(
  peopleApi: ApiPromise,
  address: string,
  signer: any
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!peopleApi?.tx?.stakingScore?.startScoreTracking) {
      return { success: false, error: 'stakingScore pallet not available' };
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
