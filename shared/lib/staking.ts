// ========================================
// Staking Helper Functions (Asset Hub)
// ========================================
// Helper functions for pallet_staking_async on Asset Hub and pallet_staking_score on People Chain.
// Staking was moved from Relay Chain to Asset Hub.
// The `api` parameter in all functions refers to the Asset Hub API connection.

import { ApiPromise } from '@pezkuwi/api';
import { formatBalance } from './wallet';
import { getPezRewards, type PezRewardInfo } from './scores';

export interface StakingLedger {
  stash: string;
  total: string;
  active: string;
  unlocking: { value: string; era: number }[];
  claimedRewards: number[];
}

export interface NominatorInfo {
  targets: string[];
  submittedIn: number;
  suppressed: boolean;
}

export interface ValidatorPrefs {
  commission: number;
  blocked: boolean;
}

export interface EraRewardPoints {
  total: number;
  individual: Record<string, number>;
}

export interface StakingInfo {
  bonded: string;
  active: string;
  unlocking: { amount: string; era: number; blocksRemaining: number }[];
  redeemable: string;
  nominations: string[];
  stakingScore: number | null;
  stakingDuration: number | null; // Duration in blocks
  hasStartedScoreTracking: boolean;
  hasCachedStakingData: boolean; // Whether noter has submitted staking data to People Chain
  isValidator: boolean;
  pezRewards: PezRewardInfo | null; // PEZ rewards information
}

/**
 * Get staking ledger for an account
 * In Substrate staking, we need to query using the controller account.
 * If stash == controller (modern setup), we can query directly.
 */
export async function getStakingLedger(
  api: ApiPromise,
  address: string
): Promise<StakingLedger | null> {
  try {
    // Method 1: Try direct ledger query (modern Substrate where stash == controller)
    let ledgerResult = await api.query.staking.ledger(address);

    // Method 2: If not found, check if address is a stash and get controller
    if (ledgerResult.isNone) {
      const bondedController = await api.query.staking.bonded(address);
      if (bondedController.isSome) {
        const controllerCodec = bondedController.unwrap() as { toString: () => string };
        const controllerAddress = controllerCodec.toString();
        console.log(`Found controller ${controllerAddress} for stash ${address}`);
        ledgerResult = await api.query.staking.ledger(controllerAddress);
      }
    }

    if (ledgerResult.isNone) {
      console.warn(`No staking ledger found for ${address}`);
      return null;
    }

    const ledger = ledgerResult.unwrap() as { toJSON: () => unknown };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ledgerJson = ledger.toJSON() as any;

    console.log('Staking ledger:', ledgerJson);

    return {
      stash: ledgerJson.stash?.toString() || address,
      total: ledgerJson.total?.toString() || '0',
      active: ledgerJson.active?.toString() || '0',
      unlocking: (ledgerJson.unlocking || []).map((u: any) => ({
        value: u.value?.toString() || '0',
        era: u.era || 0
      })),
      claimedRewards: ledgerJson.claimedRewards || []
    };
  } catch (error) {
    console.error('Error fetching staking ledger:', error);
    return null;
  }
}

/**
 * Get nominations for an account
 */
export async function getNominations(
  api: ApiPromise,
  address: string
): Promise<NominatorInfo | null> {
  try {
    const nominatorsOption = await api.query.staking.nominators(address);

    if (nominatorsOption.isNone) {
      return null;
    }

    const nominator = nominatorsOption.unwrap() as { toJSON: () => unknown };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nominatorJson = nominator.toJSON() as any;

    return {
      targets: nominatorJson.targets || [],
      submittedIn: nominatorJson.submittedIn || 0,
      suppressed: nominatorJson.suppressed || false
    };
  } catch (error) {
    console.error('Error fetching nominations:', error);
    return null;
  }
}

/**
 * Get current active era
 */
export async function getCurrentEra(api: ApiPromise): Promise<number> {
  try {
    const activeEraOption = await api.query.staking.activeEra();
    if (activeEraOption.isNone) {
      return 0;
    }
    const activeEra = activeEraOption.unwrap() as { index: { toString: () => string } };
    return Number(activeEra.index.toString());
  } catch (error) {
    console.error('Error fetching current era:', error);
    return 0;
  }
}

/**
 * Get estimated time remaining until an era (in seconds).
 * Asset Hub uses Aura (no babe.epochDuration), so we estimate based on
 * activeEra.start timestamp + sessionsPerEra * estimated session duration.
 */
export async function getBlocksUntilEra(
  api: ApiPromise,
  targetEra: number
): Promise<number> {
  try {
    const currentEra = await getCurrentEra(api);
    if (targetEra <= currentEra) {
      return 0;
    }

    const erasRemaining = targetEra - currentEra;

    // Try to get sessionsPerEra from staking constants
    const sessionsPerEra = api.consts.staking?.sessionsPerEra
      ? Number(api.consts.staking.sessionsPerEra.toString())
      : 6; // Default: 6 sessions per era on AH

    // Estimate session duration: ~1 hour (3600 seconds / 6s block time = 600 blocks)
    const ESTIMATED_SESSION_BLOCKS = 600;
    const blocksPerEra = sessionsPerEra * ESTIMATED_SESSION_BLOCKS;

    // Try to estimate blocks remaining in current era using activeEra.start
    const activeEraOption = await api.query.staking.activeEra();
    if (activeEraOption.isSome) {
      const activeEra = activeEraOption.unwrap() as { start: { unwrapOr: (def: number) => { toString: () => string } } };
      const eraStartSlot = Number(activeEra.start.unwrapOr(0).toString());

      if (eraStartSlot > 0) {
        const currentBlock = Number((await api.query.system.number()).toString());
        const blocksIntoCurrentEra = currentBlock - eraStartSlot;
        const blocksRemainingInCurrentEra = Math.max(0, blocksPerEra - blocksIntoCurrentEra);
        return blocksRemainingInCurrentEra + (blocksPerEra * (erasRemaining - 1));
      }
    }

    // Fallback: just multiply eras remaining by estimated blocks per era
    return blocksPerEra * erasRemaining;
  } catch (error) {
    console.error('Error calculating blocks until era:', error);
    return 0;
  }
}

/**
 * Get comprehensive staking info for an account
 * @param api - Asset Hub API (staking pallet moved from RC to AH)
 * @param address - User address
 * @param peopleApi - Optional People Chain API (for pezRewards and stakingScore pallets)
 */
export async function getStakingInfo(
  api: ApiPromise,
  address: string,
  peopleApi?: ApiPromise
): Promise<StakingInfo> {
  const ledger = await getStakingLedger(api, address);
  const nominations = await getNominations(api, address);
  const currentEra = await getCurrentEra(api);

  const unlocking = ledger?.unlocking || [];
  const unlockingWithBlocks = await Promise.all(
    unlocking.map(async (u) => {
      const blocks = await getBlocksUntilEra(api, u.era);
      return {
        amount: formatBalance(u.value),
        era: u.era,
        blocksRemaining: blocks
      };
    })
  );

  // Calculate redeemable (unlocking chunks where era has passed)
  const redeemableChunks = unlocking.filter(u => u.era <= currentEra);
  const redeemable = redeemableChunks.reduce((sum, u) => {
    return sum + BigInt(u.value);
  }, BigInt(0));

  // Get staking score if available
  //
  // IMPORTANT: This calculation MUST match pallet_staking_score::get_staking_score() exactly!
  // The pallet calculates this score and reports it to pallet_pez_rewards.
  // Any changes here must be synchronized with pallets/staking-score/src/lib.rs
  //
  // Score Formula:
  // 1. Amount Score (20-50 points based on staked HEZ)
  //    - 0-100 HEZ: 20 points
  //    - 101-250 HEZ: 30 points
  //    - 251-750 HEZ: 40 points
  //    - 751+ HEZ: 50 points
  // 2. Duration Multiplier (based on time staked)
  //    - < 1 month: x1.0
  //    - 1-2 months: x1.2
  //    - 3-5 months: x1.4
  //    - 6-11 months: x1.7
  //    - 12+ months: x2.0
  // 3. Final Score = min(100, floor(amountScore * durationMultiplier))
  //
  let stakingScore: number | null = null;
  let stakingDuration: number | null = null;
  let hasStartedScoreTracking = false;
  let hasCachedStakingData = false;

  try {
    // stakingScore pallet is on People Chain - uses cached staking data submitted by noter
    const scoreApi = peopleApi || api;
    if (scoreApi.query.stakingScore && scoreApi.query.stakingScore.stakingStartBlock) {
      // Check if user has started score tracking
      const scoreResult = await scoreApi.query.stakingScore.stakingStartBlock(address);

      if (scoreResult.isSome) {
        hasStartedScoreTracking = true;
        const startBlockCodec = scoreResult.unwrap() as { toString: () => string };
        const startBlock = Number(startBlockCodec.toString());
        const currentBlock = Number((await scoreApi.query.system.number()).toString());
        const durationInBlocks = currentBlock - startBlock;
        stakingDuration = durationInBlocks;

        // Check if noter has submitted cached staking data to People Chain
        // CachedStakingDetails is a DoubleMap: (AccountId, StakingSource) -> StakingDetails
        // StakingSource: RelayChain = 0, AssetHub = 1
        // StakingDetails: { staked_amount, nominations_count, unlocking_chunks_count }
        let totalCachedStakeWei = BigInt(0);
        if (scoreApi.query.stakingScore.cachedStakingDetails) {
          try {
            const [relayResult, assetHubResult] = await Promise.all([
              scoreApi.query.stakingScore.cachedStakingDetails(address, 'RelayChain')
                .catch(() => null),
              scoreApi.query.stakingScore.cachedStakingDetails(address, 'AssetHub')
                .catch(() => null),
            ]);

            if (relayResult && !relayResult.isEmpty && relayResult.isSome) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const json = (relayResult.unwrap() as any).toJSON() as any;
              totalCachedStakeWei += BigInt(json.stakedAmount ?? json.staked_amount ?? '0');
              hasCachedStakingData = true;
            }
            if (assetHubResult && !assetHubResult.isEmpty && assetHubResult.isSome) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const json = (assetHubResult.unwrap() as any).toJSON() as any;
              totalCachedStakeWei += BigInt(json.stakedAmount ?? json.staked_amount ?? '0');
              hasCachedStakingData = true;
            }
          } catch {
            hasCachedStakingData = false;
          }
        }

        if (hasCachedStakingData) {
          // Use cached stake from People Chain (matches on-chain pallet calculation)
          const stakedHEZ = Number(totalCachedStakeWei / BigInt(10 ** 12));
          let amountScore = 20; // Default

          if (stakedHEZ <= 100) {
            amountScore = 20;
          } else if (stakedHEZ <= 250) {
            amountScore = 30;
          } else if (stakedHEZ <= 750) {
            amountScore = 40;
          } else {
            amountScore = 50; // 751+ HEZ
          }

          // Calculate duration multiplier
          const MONTH_IN_BLOCKS = 30 * 24 * 60 * 10; // 432,000 blocks (~30 days, 6s per block)
          let durationMultiplier = 1.0;

          if (durationInBlocks >= 12 * MONTH_IN_BLOCKS) {
            durationMultiplier = 2.0; // 12+ months
          } else if (durationInBlocks >= 6 * MONTH_IN_BLOCKS) {
            durationMultiplier = 1.7; // 6-11 months
          } else if (durationInBlocks >= 3 * MONTH_IN_BLOCKS) {
            durationMultiplier = 1.4; // 3-5 months
          } else if (durationInBlocks >= MONTH_IN_BLOCKS) {
            durationMultiplier = 1.2; // 1-2 months
          } else {
            durationMultiplier = 1.0; // < 1 month
          }

          // Final score calculation (max 100)
          stakingScore = Math.min(100, Math.floor(amountScore * durationMultiplier));

          console.log('Staking score calculated:', {
            stakedHEZ,
            amountScore,
            durationInBlocks,
            durationMultiplier,
            finalScore: stakingScore
          });
        }
      }
    }
  } catch (error) {
    console.warn('Staking score not available:', error);
  }

  // Check if validator
  const validatorsOption = await api.query.staking.validators(address);
  const isValidator = validatorsOption.isSome;

  // Get PEZ rewards information (from People Chain)
  const pezRewards = peopleApi ? await getPezRewards(peopleApi, address) : null;

  return {
    bonded: ledger ? formatBalance(ledger.total) : '0',
    active: ledger ? formatBalance(ledger.active) : '0',
    unlocking: unlockingWithBlocks,
    redeemable: formatBalance(redeemable.toString()),
    nominations: nominations?.targets || [],
    stakingScore,
    stakingDuration,
    hasStartedScoreTracking,
    hasCachedStakingData,
    isValidator,
    pezRewards
  };
}

/**
 * Get list of active validators from Asset Hub staking pallet.
 * Note: validatorPool pallet is on Relay Chain, not AH. We only use staking.validators here.
 */
export async function getActiveValidators(api: ApiPromise): Promise<string[]> {
  try {
    // Method 1: Query staking.validators.entries() on Asset Hub
    try {
      const validatorEntries = await api.query.staking.validators.entries();
      if (validatorEntries.length > 0) {
        const validators = validatorEntries.map(([key]) => key.args[0].toString());
        console.log(`Found ${validators.length} validators from staking.validators.entries()`);
        return validators;
      }
    } catch (err) {
      console.warn('staking.validators.entries() query failed:', err);
    }

    // Method 2: Fallback to session.validators() if available on AH
    if (api.query.session?.validators) {
      const sessionValidators = await api.query.session.validators();
      const validatorArray = Array.isArray(sessionValidators)
        ? sessionValidators
        : (sessionValidators as unknown as { toJSON: () => string[] }).toJSON();
      const validators = validatorArray.map((v: unknown) => String(v));
      console.log(`Found ${validators.length} validators from session.validators()`);
      return validators;
    }

    return [];
  } catch (error) {
    console.error('Error fetching validators:', error);
    return [];
  }
}

/**
 * Get minimum nominator bond
 */
export async function getMinNominatorBond(api: ApiPromise): Promise<string> {
  try {
    const minBond = await api.query.staking.minNominatorBond();
    return formatBalance(minBond.toString());
  } catch (error) {
    console.error('Error fetching min nominator bond:', error);
    return '0';
  }
}

/**
 * Get bonding duration in eras
 */
export async function getBondingDuration(api: ApiPromise): Promise<number> {
  try {
    const duration = api.consts.staking.bondingDuration;
    return Number(duration.toString());
  } catch (error) {
    console.error('Error fetching bonding duration:', error);
    return 2; // Default 2 eras (AH bonding duration)
  }
}

/**
 * Parse amount to blockchain format (12 decimals for HEZ)
 */
export function parseAmount(amount: string | number, decimals: number = 12): string {
  const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(amountNum) || amountNum <= 0) {
    throw new Error('Invalid amount');
  }
  const value = BigInt(Math.floor(amountNum * Math.pow(10, decimals)));
  return value.toString();
}
