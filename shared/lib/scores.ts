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
 * Get staking score from pallet
 * Requires: User must have called startScoreTracking() first
 * Score based on staking duration + amount staked on Relay Chain
 *
 * @param peopleApi - People Chain API (stakingScore pallet)
 * @param address - User's blockchain address
 * @param relayApi - Relay Chain API (staking.ledger for staked amount)
 */
export async function getStakingScore(
  peopleApi: ApiPromise,
  address: string,
  relayApi?: ApiPromise
): Promise<number> {
  try {
    const status = await getStakingScoreStatus(peopleApi, address);

    if (!status.isTracking) {
      return 0; // User hasn't started score tracking
    }

    // Get staked amount from Relay Chain if available
    let stakedAmount = 0;
    if (relayApi?.query?.staking?.ledger) {
      const ledger = await relayApi.query.staking.ledger(address);
      if (!ledger.isEmpty && !ledger.isNone) {
        const ledgerData = (ledger as any).unwrap().toJSON();
        stakedAmount = Number(ledgerData.total || 0) / 1e12;
      }
    }

    // Calculate score based on amount
    // Amount-based score (0-50 points)
    let amountScore = 0;
    if (stakedAmount > 0) {
      if (stakedAmount <= 10) amountScore = 10;
      else if (stakedAmount <= 100) amountScore = 20;
      else if (stakedAmount <= 250) amountScore = 30;
      else if (stakedAmount <= 750) amountScore = 40;
      else amountScore = 50;
    }

    // Duration multiplier
    const MONTH_IN_BLOCKS = 30 * 24 * 60 * 10; // ~432000 blocks per month
    let durationMultiplier = 1.0;

    if (status.durationBlocks >= 12 * MONTH_IN_BLOCKS) durationMultiplier = 2.0;
    else if (status.durationBlocks >= 6 * MONTH_IN_BLOCKS) durationMultiplier = 1.7;
    else if (status.durationBlocks >= 3 * MONTH_IN_BLOCKS) durationMultiplier = 1.4;
    else if (status.durationBlocks >= MONTH_IN_BLOCKS) durationMultiplier = 1.2;

    // If no staking amount but tracking is active, give base points for duration
    if (amountScore === 0 && status.isTracking) {
      if (status.durationBlocks >= 12 * MONTH_IN_BLOCKS) return 20;
      if (status.durationBlocks >= 6 * MONTH_IN_BLOCKS) return 15;
      if (status.durationBlocks >= 3 * MONTH_IN_BLOCKS) return 10;
      if (status.durationBlocks >= MONTH_IN_BLOCKS) return 5;
      return 0;
    }

    return Math.min(100, Math.floor(amountScore * durationMultiplier));
  } catch (error) {
    console.error('Error fetching staking score:', error);
    return 0;
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
 * Fetch all scores for a user in one call
 * All scores come from People Chain except staking amount (Relay Chain)
 *
 * @param peopleApi - People Chain API (trust, referral, stakingScore, tiki pallets)
 * @param address - User's blockchain address
 * @param relayApi - Optional Relay Chain API (for staking.ledger amount)
 */
export async function getAllScores(
  peopleApi: ApiPromise,
  address: string,
  relayApi?: ApiPromise
): Promise<UserScores> {
  try {
    if (!peopleApi || !address) {
      return {
        trustScore: 0,
        referralScore: 0,
        stakingScore: 0,
        tikiScore: 0,
        totalScore: 0
      };
    }

    // Fetch all scores in parallel from People Chain
    const [trustScore, referralScore, stakingScore, tikiScore] = await Promise.all([
      getTrustScore(peopleApi, address),
      getReferralScore(peopleApi, address),
      getStakingScore(peopleApi, address, relayApi),
      getTikiScore(peopleApi, address)
    ]);

    const totalScore = trustScore + referralScore + stakingScore + tikiScore;

    return {
      trustScore,
      referralScore,
      stakingScore,
      tikiScore,
      totalScore
    };
  } catch (error) {
    console.error('Error fetching all scores:', error);
    return {
      trustScore: 0,
      referralScore: 0,
      stakingScore: 0,
      tikiScore: 0,
      totalScore: 0
    };
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
