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
 * Staking score uses frontend fallback if on-chain pallet is not available
 *
 * @param peopleApi - People Chain API (trust, referral, stakingScore, tiki pallets)
 * @param address - User's blockchain address
 * @param relayApi - Optional Relay Chain API (for staking.ledger amount and frontend fallback)
 */
export async function getAllScores(
  peopleApi: ApiPromise,
  address: string,
  relayApi?: ApiPromise
): Promise<UserScores> {
  try {
    if (!address) {
      return {
        trustScore: 0,
        referralScore: 0,
        stakingScore: 0,
        tikiScore: 0,
        totalScore: 0
      };
    }

    // Fetch all scores in parallel
    const scorePromises: Promise<number>[] = [];

    // Trust and referral scores from People Chain
    if (peopleApi) {
      scorePromises.push(getTrustScore(peopleApi, address));
      scorePromises.push(getReferralScore(peopleApi, address));
      scorePromises.push(getTikiScore(peopleApi, address));
    } else {
      scorePromises.push(Promise.resolve(0));
      scorePromises.push(Promise.resolve(0));
      scorePromises.push(Promise.resolve(0));
    }

    // Staking score with frontend fallback
    const stakingScorePromise = relayApi
      ? getStakingScoreWithFallback(peopleApi, relayApi, address).then(r => r.score)
      : Promise.resolve(0);

    const [trustScore, referralScore, tikiScore, stakingScore] = await Promise.all([
      ...scorePromises,
      stakingScorePromise
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

// ========================================
// FRONTEND STAKING SCORE (Fallback)
// ========================================
// Until runtime upgrade deploys, calculate staking score
// directly from Relay Chain data without People Chain pallet

const STAKING_SCORE_STORAGE_KEY = 'pez_staking_score_tracking';
const UNITS = 1_000_000_000_000; // 10^12
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MONTH_IN_MS = 30 * DAY_IN_MS;

interface StakingTrackingData {
  [address: string]: {
    startTime: number; // Unix timestamp in ms
    lastChecked: number;
    lastStakeAmount: string; // Store as string to preserve precision
  };
}

/**
 * Get tracking data from localStorage
 */
function getStakingTrackingData(): StakingTrackingData {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STAKING_SCORE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save tracking data to localStorage
 */
function saveStakingTrackingData(data: StakingTrackingData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STAKING_SCORE_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save staking tracking data:', err);
  }
}

/**
 * Fetch staking details directly from Relay Chain
 */
export async function fetchRelayStakingDetails(
  relayApi: ApiPromise,
  address: string
): Promise<{ stakedAmount: bigint; nominationsCount: number } | null> {
  try {
    if (!relayApi?.query?.staking) return null;

    // Try to get ledger directly (if address is controller)
    let ledger = await relayApi.query.staking.ledger?.(address);
    let stashAddress = address;

    // If no ledger, check if this is a stash account
    if (!ledger || ledger.isEmpty || ledger.isNone) {
      const bonded = await relayApi.query.staking.bonded?.(address);
      if (bonded && !bonded.isEmpty && !bonded.isNone) {
        // This is a stash, get controller's ledger
        const controller = bonded.toString();
        ledger = await relayApi.query.staking.ledger?.(controller);
        stashAddress = address;
      }
    }

    if (!ledger || ledger.isEmpty || ledger.isNone) {
      return null;
    }

    // Parse ledger data
    const ledgerJson = ledger.toJSON() as { active?: string | number };
    const active = BigInt(ledgerJson?.active || 0);

    // Get nominations
    const nominations = await relayApi.query.staking.nominators?.(stashAddress);
    const nominationsJson = nominations?.toJSON() as { targets?: unknown[] } | null;
    const nominationsCount = nominationsJson?.targets?.length || 0;

    return {
      stakedAmount: active,
      nominationsCount
    };
  } catch (err) {
    console.error('Failed to fetch relay staking details:', err);
    return null;
  }
}

/**
 * Calculate base score from staked HEZ amount (matching pallet algorithm)
 */
function calculateBaseStakingScore(stakedHez: number): number {
  if (stakedHez <= 0) return 0;
  if (stakedHez <= 100) return 20;
  if (stakedHez <= 250) return 30;
  if (stakedHez <= 750) return 40;
  return 50; // 751+ HEZ
}

/**
 * Get time multiplier based on months staked (matching pallet algorithm)
 */
function getStakingTimeMultiplier(monthsStaked: number): number {
  if (monthsStaked >= 12) return 2.0;
  if (monthsStaked >= 6) return 1.7;
  if (monthsStaked >= 3) return 1.4;
  if (monthsStaked >= 1) return 1.2;
  return 1.0;
}

export interface FrontendStakingScoreResult {
  score: number;
  stakedAmount: bigint;
  stakedHez: number;
  trackingStarted: Date | null;
  monthsStaked: number;
  timeMultiplier: number;
  nominationsCount: number;
  isFromFrontend: boolean; // true = frontend fallback, false = on-chain
  needsRefresh: boolean;
}

/**
 * Get staking score using frontend fallback
 * This bypasses the broken People Chain pallet and reads directly from Relay Chain
 *
 * @param relayApi - Relay Chain API (staking pallet)
 * @param address - User's blockchain address
 */
export async function getFrontendStakingScore(
  relayApi: ApiPromise,
  address: string
): Promise<FrontendStakingScoreResult> {
  const emptyResult: FrontendStakingScoreResult = {
    score: 0,
    stakedAmount: 0n,
    stakedHez: 0,
    trackingStarted: null,
    monthsStaked: 0,
    timeMultiplier: 1.0,
    nominationsCount: 0,
    isFromFrontend: true,
    needsRefresh: false
  };

  if (!relayApi || !address) return emptyResult;

  // Fetch staking details from Relay Chain
  const details = await fetchRelayStakingDetails(relayApi, address);

  if (!details || details.stakedAmount === 0n) {
    return emptyResult;
  }

  // Get or initialize tracking data
  const trackingData = getStakingTrackingData();
  const now = Date.now();

  if (!trackingData[address]) {
    // First time seeing stake - start tracking
    trackingData[address] = {
      startTime: now,
      lastChecked: now,
      lastStakeAmount: details.stakedAmount.toString()
    };
    saveStakingTrackingData(trackingData);
  } else {
    // Update last checked time and stake amount
    trackingData[address].lastChecked = now;
    trackingData[address].lastStakeAmount = details.stakedAmount.toString();
    saveStakingTrackingData(trackingData);
  }

  const userTracking = trackingData[address];
  const trackingStarted = new Date(userTracking.startTime);
  const msStaked = now - userTracking.startTime;
  const monthsStaked = Math.floor(msStaked / MONTH_IN_MS);

  // Calculate score (matching pallet algorithm)
  const stakedHez = Number(details.stakedAmount) / UNITS;
  const baseScore = calculateBaseStakingScore(stakedHez);
  const timeMultiplier = getStakingTimeMultiplier(monthsStaked);
  const finalScore = Math.min(Math.floor(baseScore * timeMultiplier), 100);

  // Check if needs refresh (older than 24 hours)
  const needsRefresh = now - userTracking.lastChecked > DAY_IN_MS;

  return {
    score: finalScore,
    stakedAmount: details.stakedAmount,
    stakedHez,
    trackingStarted,
    monthsStaked,
    timeMultiplier,
    nominationsCount: details.nominationsCount,
    isFromFrontend: true,
    needsRefresh
  };
}

/**
 * Get staking score with frontend fallback
 * First tries on-chain pallet, falls back to frontend calculation if it fails
 *
 * @param peopleApi - People Chain API (optional, for on-chain score)
 * @param relayApi - Relay Chain API (required for stake data)
 * @param address - User's blockchain address
 */
export async function getStakingScoreWithFallback(
  peopleApi: ApiPromise | null,
  relayApi: ApiPromise,
  address: string
): Promise<FrontendStakingScoreResult> {
  // First try on-chain score from People Chain
  if (peopleApi) {
    try {
      const status = await getStakingScoreStatus(peopleApi, address);
      if (status.isTracking && status.startBlock) {
        // On-chain tracking is active, use it
        const onChainScore = await getStakingScore(peopleApi, address, relayApi);
        if (onChainScore > 0) {
          const details = await fetchRelayStakingDetails(relayApi, address);
          return {
            score: onChainScore,
            stakedAmount: details?.stakedAmount || 0n,
            stakedHez: details ? Number(details.stakedAmount) / UNITS : 0,
            trackingStarted: new Date(status.startBlock * 6000), // Approximate
            monthsStaked: Math.floor(status.durationBlocks / (30 * 24 * 60 * 10)),
            timeMultiplier: 1.0, // Already applied in on-chain score
            nominationsCount: details?.nominationsCount || 0,
            isFromFrontend: false,
            needsRefresh: false
          };
        }
      }
    } catch (err) {
      console.log('On-chain staking score not available, using frontend fallback');
    }
  }

  // Fall back to frontend calculation
  return getFrontendStakingScore(relayApi, address);
}

/**
 * Format staked amount for display
 */
export function formatStakedAmount(amount: bigint): string {
  const hez = Number(amount) / UNITS;
  if (hez >= 1000000) return `${(hez / 1000000).toFixed(2)}M`;
  if (hez >= 1000) return `${(hez / 1000).toFixed(2)}K`;
  return hez.toFixed(2);
}

// ========================================
// FRONTEND TRUST SCORE (Fallback)
// ========================================
// Until runtime upgrade, calculate trust score using frontend fallback
// Formula from pezpallet-trust:
// weighted_sum = staking*100 + referral*300 + perwerde*300 + tiki*300
// trust_score = (staking * weighted_sum) / 100

const SCORE_MULTIPLIER_BASE = 100;

export interface FrontendTrustScoreResult {
  trustScore: number;
  stakingScore: number;
  referralScore: number;
  perwerdeScore: number;
  tikiScore: number;
  weightedSum: number;
  isFromFrontend: boolean;
  isCitizen: boolean;
}

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
    // The exact storage depends on pallet implementation
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

/**
 * Calculate trust score using frontend fallback
 * Uses the same formula as pezpallet-trust
 *
 * @param peopleApi - People Chain API (optional)
 * @param relayApi - Relay Chain API (required for staking data)
 * @param address - User's blockchain address
 */
export async function getFrontendTrustScore(
  peopleApi: ApiPromise | null,
  relayApi: ApiPromise,
  address: string
): Promise<FrontendTrustScoreResult> {
  const emptyResult: FrontendTrustScoreResult = {
    trustScore: 0,
    stakingScore: 0,
    referralScore: 0,
    perwerdeScore: 0,
    tikiScore: 0,
    weightedSum: 0,
    isFromFrontend: true,
    isCitizen: false
  };

  if (!address) return emptyResult;

  // Check citizenship status
  const isCitizen = await checkCitizenshipStatus(peopleApi, address);

  // Get component scores in parallel
  const [stakingResult, referralScore, perwerdeScore, tikiScore] = await Promise.all([
    getFrontendStakingScore(relayApi, address),
    peopleApi ? getReferralScore(peopleApi, address) : Promise.resolve(0),
    getPerwerdeScore(peopleApi, address),
    peopleApi ? getTikiScore(peopleApi, address) : Promise.resolve(0)
  ]);

  const stakingScore = stakingResult.score;

  // If staking score is 0, trust score is 0 (matches pallet logic)
  if (stakingScore === 0) {
    return {
      ...emptyResult,
      referralScore,
      perwerdeScore,
      tikiScore,
      isCitizen
    };
  }

  // Calculate weighted sum (matching pallet formula)
  const weightedSum =
    stakingScore * 100 +
    referralScore * 300 +
    perwerdeScore * 300 +
    tikiScore * 300;

  // Calculate final trust score
  // trust_score = (staking * weighted_sum) / 100
  const trustScore = Math.floor((stakingScore * weightedSum) / SCORE_MULTIPLIER_BASE);

  return {
    trustScore,
    stakingScore,
    referralScore,
    perwerdeScore,
    tikiScore,
    weightedSum,
    isFromFrontend: true,
    isCitizen
  };
}

/**
 * Get trust score with frontend fallback
 * NOTE: Until runtime upgrade, always use frontend fallback
 * On-chain trust pallet exists but doesn't calculate correctly yet
 */
export async function getTrustScoreWithFallback(
  peopleApi: ApiPromise | null,
  relayApi: ApiPromise,
  address: string
): Promise<FrontendTrustScoreResult> {
  // Always use frontend calculation until runtime upgrade
  // The on-chain trust pallet exists but StakingInfoProvider returns None
  // which causes trust score to be 0 even when user has stake
  return getFrontendTrustScore(peopleApi, relayApi, address);
}

/**
 * Get all scores with frontend fallback for staking and trust
 */
export async function getAllScoresWithFallback(
  peopleApi: ApiPromise | null,
  relayApi: ApiPromise,
  address: string
): Promise<UserScores & { isFromFrontend: boolean }> {
  if (!address) {
    return {
      trustScore: 0,
      referralScore: 0,
      stakingScore: 0,
      tikiScore: 0,
      totalScore: 0,
      isFromFrontend: true
    };
  }

  const trustResult = await getTrustScoreWithFallback(peopleApi, relayApi, address);

  return {
    trustScore: trustResult.trustScore,
    referralScore: trustResult.referralScore,
    stakingScore: trustResult.stakingScore,
    tikiScore: trustResult.tikiScore,
    totalScore: trustResult.trustScore, // Trust score IS the total score
    isFromFrontend: trustResult.isFromFrontend
  };
}
