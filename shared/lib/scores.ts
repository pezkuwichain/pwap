// ========================================
// Score Systems Integration
// ========================================
// Centralized score fetching from blockchain pallets

import type { ApiPromise } from '@pezkuwi/api';

// ========================================
// TYPE DEFINITIONS
// ========================================

export interface UserScores {
  trustScore: number;
  referralScore: number;
  stakingScore: number;
  lpStakingScore: number;
  tikiScore: number;
  totalScore: number;
}

export interface TrustScoreDetails {
  totalScore: number;
  stakingPoints: number;
  referralPoints: number;
  tikiPoints: number;
  activityPoints: number;
  historyLength: number;
}

// ========================================
// TRUST SCORE (pallet_trust)
// ========================================

/**
 * Fetch user's trust score from blockchain
 * pallet_trust::TrustScores storage
 */
export async function getTrustScore(
  api: ApiPromise,
  address: string
): Promise<number> {
  try {
    if (!api?.query?.trust) {
      // Trust pallet not available on this chain - this is expected
      return 0;
    }

    const score = await api.query.trust.trustScores(address);

    if (score.isEmpty) {
      return 0;
    }

    return Number(score.toString());
  } catch (error) {
    console.error('Error fetching trust score:', error);
    return 0;
  }
}

/**
 * Fetch detailed trust score breakdown
 * pallet_trust::ScoreHistory storage
 */
export async function getTrustScoreDetails(
  api: ApiPromise,
  address: string
): Promise<TrustScoreDetails | null> {
  try {
    if (!api?.query?.trust) {
      return null;
    }

    const totalScore = await getTrustScore(api, address);

    // Get score history to show detailed breakdown
    const historyResult = await api.query.trust.scoreHistory(address);

    if (historyResult.isEmpty) {
      return {
        totalScore,
        stakingPoints: 0,
        referralPoints: 0,
        tikiPoints: 0,
        activityPoints: 0,
        historyLength: 0
      };
    }

    const history = historyResult.toJSON() as any[];

    // Calculate points from history
    // History format: [{blockNumber, score, reason}]
    let stakingPoints = 0;
    let referralPoints = 0;
    let tikiPoints = 0;
    let activityPoints = 0;

    for (const entry of history) {
      const reason = entry.reason || '';
      const score = entry.score || 0;

      if (reason.includes('Staking')) stakingPoints += score;
      else if (reason.includes('Referral')) referralPoints += score;
      else if (reason.includes('Tiki') || reason.includes('Role')) tikiPoints += score;
      else activityPoints += score;
    }

    return {
      totalScore,
      stakingPoints,
      referralPoints,
      tikiPoints,
      activityPoints,
      historyLength: history.length
    };
  } catch (error) {
    console.error('Error fetching trust score details:', error);
    return null;
  }
}

// ========================================
// REFERRAL SCORE (pallet_trust)
// ========================================

/**
 * Fetch user's referral score
 * Reads from pallet_referral::ReferralCount storage
 *
 * Score calculation based on referral count:
 * - 0 referrals: 0 points
 * - 1-5 referrals: count × 4 points (4, 8, 12, 16, 20)
 * - 6-20 referrals: 20 + (count - 5) × 2 points
 * - 21+ referrals: capped at 50 points
 */
export async function getReferralScore(
  api: ApiPromise,
  address: string
): Promise<number> {
  try {
    if (!api?.query?.referral?.referralCount) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('Referral pallet not available');
      return 0;
    }

    const count = await api.query.referral.referralCount(address);
    const referralCount = Number(count.toString());

    // Calculate score based on referral count
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
 * Get referral count for user
 * pallet_trust::Referrals storage
 */
export async function getReferralCount(
  api: ApiPromise,
  address: string
): Promise<number> {
  try {
    if (!api?.query?.trust?.referrals) {
      return 0;
    }

    const referrals = await api.query.trust.referrals(address);

    if (referrals.isEmpty) {
      return 0;
    }

    const referralList = referrals.toJSON() as any[];
    return Array.isArray(referralList) ? referralList.length : 0;
  } catch (error) {
    console.error('Error fetching referral count:', error);
    return 0;
  }
}

// ========================================
// STAKING SCORE (pallet_staking_score)
// ========================================

/**
 * Get staking score from pallet_staking_score
 * NOTE: stakingScore pallet is on People Chain, but staking.ledger is on Relay Chain
 * So this function needs both APIs
 *
 * @param peopleApi - API for People Chain (stakingScore pallet)
 * @param relayApi - API for Relay Chain (staking pallet) - optional, if not provided uses peopleApi
 */
export async function getStakingScoreFromPallet(
  peopleApi: ApiPromise,
  address: string,
  relayApi?: ApiPromise
): Promise<number> {
  try {
    if (!peopleApi?.query?.stakingScore) {
      // Staking score pallet not available on this chain
      return 0;
    }

    // Check if user has started score tracking (People Chain)
    const scoreResult = await peopleApi.query.stakingScore.stakingStartBlock(address);

    if (scoreResult.isNone) {
      return 0;
    }

    // Get staking info from staking pallet (Relay Chain)
    const stakingApi = relayApi || peopleApi;
    if (!stakingApi?.query?.staking?.ledger) {
      // Staking pallet not available - can't calculate full score
      // Return base score from duration only
      const scoreCodec = scoreResult.unwrap() as { toString: () => string };
      const startBlock = Number(scoreCodec.toString());
      const currentBlock = Number((await peopleApi.query.system.number()).toString());
      const durationInBlocks = currentBlock - startBlock;

      const MONTH_IN_BLOCKS = 30 * 24 * 60 * 10;
      if (durationInBlocks >= 12 * MONTH_IN_BLOCKS) return 40;
      if (durationInBlocks >= 6 * MONTH_IN_BLOCKS) return 34;
      if (durationInBlocks >= 3 * MONTH_IN_BLOCKS) return 28;
      if (durationInBlocks >= MONTH_IN_BLOCKS) return 24;
      return 20;
    }

    const ledger = await stakingApi.query.staking.ledger(address);

    if (ledger.isNone) {
      return 0;
    }

    const ledgerCodec = ledger.unwrap() as { toJSON: () => unknown };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ledgerData = ledgerCodec.toJSON() as any;
    const stakedAmount = Number(ledgerData.total || 0) / 1e12; // Convert to HEZ

    // Get duration from People Chain
    const scoreCodec = scoreResult.unwrap() as { toString: () => string };
    const startBlock = Number(scoreCodec.toString());
    const currentBlock = Number((await peopleApi.query.system.number()).toString());
    const durationInBlocks = currentBlock - startBlock;

    // Calculate score based on amount and duration
    // Amount-based score (20-50 points)
    let amountScore = 20;
    if (stakedAmount <= 100) amountScore = 20;
    else if (stakedAmount <= 250) amountScore = 30;
    else if (stakedAmount <= 750) amountScore = 40;
    else amountScore = 50;

    // Duration multiplier
    const MONTH_IN_BLOCKS = 30 * 24 * 60 * 10; // ~30 days
    let durationMultiplier = 1.0;

    if (durationInBlocks >= 12 * MONTH_IN_BLOCKS) durationMultiplier = 2.0;
    else if (durationInBlocks >= 6 * MONTH_IN_BLOCKS) durationMultiplier = 1.7;
    else if (durationInBlocks >= 3 * MONTH_IN_BLOCKS) durationMultiplier = 1.4;
    else if (durationInBlocks >= MONTH_IN_BLOCKS) durationMultiplier = 1.2;

    return Math.min(100, Math.floor(amountScore * durationMultiplier));
  } catch (error) {
    console.error('Error fetching staking score:', error);
    return 0;
  }
}

// ========================================
// LP STAKING SCORE (Asset Hub assetRewards pallet)
// ========================================

/**
 * Get LP staking score from Asset Hub
 * Based on total LP tokens staked across all pools
 *
 * @param assetHubApi - API for Asset Hub (assetRewards pallet)
 * @param address - User's blockchain address
 */
export async function getLpStakingScore(
  assetHubApi: ApiPromise,
  address: string
): Promise<number> {
  try {
    if (!assetHubApi?.query?.assetRewards?.poolStakers) {
      return 0;
    }

    // Query all staking pool entries
    const poolEntries = await assetHubApi.query.assetRewards.pools.entries();

    let totalStaked = BigInt(0);

    for (const [key] of poolEntries) {
      const poolId = parseInt(key.args[0].toString());

      try {
        const stakeInfo = await assetHubApi.query.assetRewards.poolStakers([poolId, address]);
        if (stakeInfo && (stakeInfo as { isSome: boolean }).isSome) {
          const stakeData = (stakeInfo as { unwrap: () => { toJSON: () => { amount: string } } }).unwrap().toJSON();
          totalStaked += BigInt(stakeData.amount || '0');
        }
      } catch {
        // Skip this pool on error
      }
    }

    // Convert to human readable (12 decimals for LP tokens)
    const stakedAmount = Number(totalStaked) / 1e12;

    // Calculate score based on amount staked
    // 0-10 LP: 0 points
    // 10-50 LP: 10 points
    // 50-100 LP: 20 points
    // 100-500 LP: 30 points
    // 500-1000 LP: 40 points
    // 1000+ LP: 50 points
    if (stakedAmount < 10) return 0;
    if (stakedAmount < 50) return 10;
    if (stakedAmount < 100) return 20;
    if (stakedAmount < 500) return 30;
    if (stakedAmount < 1000) return 40;
    return 50;
  } catch (error) {
    console.error('Error fetching LP staking score:', error);
    return 0;
  }
}

// ========================================
// TIKI SCORE (from lib/tiki.ts)
// ========================================

/**
 * Calculate Tiki score from user's roles
 * Import from lib/tiki.ts
 */
import { fetchUserTikis, calculateTikiScore } from './tiki';

export async function getTikiScore(
  api: ApiPromise,
  address: string
): Promise<number> {
  try {
    const tikis = await fetchUserTikis(api, address);
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
 *
 * @param peopleApi - API for People Chain (trust, referral, tiki, stakingScore pallets)
 * @param address - User's blockchain address
 * @param relayApi - Optional API for Relay Chain (staking pallet for validator staking score)
 * @param assetHubApi - Optional API for Asset Hub (assetRewards pallet for LP staking score)
 */
export async function getAllScores(
  peopleApi: ApiPromise,
  address: string,
  relayApi?: ApiPromise,
  assetHubApi?: ApiPromise
): Promise<UserScores> {
  try {
    if (!peopleApi || !address) {
      return {
        trustScore: 0,
        referralScore: 0,
        stakingScore: 0,
        lpStakingScore: 0,
        tikiScore: 0,
        totalScore: 0
      };
    }

    // Fetch all scores in parallel
    // - Trust, referral, tiki scores: People Chain
    // - Staking score: People Chain (stakingScore pallet) + Relay Chain (staking.ledger)
    // - LP Staking score: Asset Hub (assetRewards pallet)
    const [trustScore, referralScore, stakingScore, lpStakingScore, tikiScore] = await Promise.all([
      getTrustScore(peopleApi, address),
      getReferralScore(peopleApi, address),
      getStakingScoreFromPallet(peopleApi, address, relayApi),
      assetHubApi ? getLpStakingScore(assetHubApi, address) : Promise.resolve(0),
      getTikiScore(peopleApi, address)
    ]);

    const totalScore = trustScore + referralScore + stakingScore + lpStakingScore + tikiScore;

    return {
      trustScore,
      referralScore,
      stakingScore,
      lpStakingScore,
      tikiScore,
      totalScore
    };
  } catch (error) {
    console.error('Error fetching all scores:', error);
    return {
      trustScore: 0,
      referralScore: 0,
      stakingScore: 0,
      lpStakingScore: 0,
      tikiScore: 0,
      totalScore: 0
    };
  }
}

// ========================================
// SCORE DISPLAY HELPERS
// ========================================

/**
 * Get color class based on score
 */
export function getScoreColor(score: number): string {
  if (score >= 200) return 'text-purple-500';
  if (score >= 150) return 'text-pink-500';
  if (score >= 100) return 'text-blue-500';
  if (score >= 70) return 'text-cyan-500';
  if (score >= 40) return 'text-teal-500';
  if (score >= 20) return 'text-green-500';
  return 'text-gray-500';
}

/**
 * Get score rating label
 */
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

/**
 * Format score for display
 */
export function formatScore(score: number): string {
  return score.toFixed(0);
}
