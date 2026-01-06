import { ApiPromise } from '@pezkuwi/api';
import { InjectedAccountWithMeta } from '@pezkuwi/extension-inject/types';
import { toast } from 'sonner';

/**
 * Validator pool categories from runtime
 */
export enum ValidatorPoolCategory {
  StakeValidator = 'StakeValidator',
  ParliamentaryValidator = 'ParliamentaryValidator',
  MeritValidator = 'MeritValidator',
}

/**
 * Pool member information
 */
export interface PoolMember {
  address: string;
  category: ValidatorPoolCategory;
  joinedAt: number;
}

/**
 * Validator set structure
 */
export interface ValidatorSet {
  stake_validators: string[];
  parliamentary_validators: string[];
  merit_validators: string[];
  total_count: number;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  blocks_produced: number;
  blocks_missed: number;
  era_points: number;
  reputation_score: number;
}

/**
 * Join validator pool with specified category
 */
export async function joinValidatorPool(
  api: ApiPromise,
  account: InjectedAccountWithMeta,
  category: ValidatorPoolCategory
): Promise<void> {
  try {
    // Convert category to runtime enum
    const categoryEnum = { [category]: null };

    const extrinsic = api.tx.validatorPool.joinValidatorPool(categoryEnum);

    await new Promise<void>((resolve, reject) => {
      let unsub: () => void;

      extrinsic.signAndSend(
        account.address,
        ({ status, dispatchError }) => {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              const errorMsg = `${decoded.section}.${decoded.name}`;
              
              // User-friendly error messages
              if (errorMsg === 'validatorPool.InsufficientTrustScore') {
                reject(new Error('Insufficient trust score. Minimum 500 required.'));
              } else if (errorMsg === 'validatorPool.AlreadyInPool') {
                reject(new Error('Already in validator pool'));
              } else if (errorMsg === 'validatorPool.MissingRequiredTiki') {
                reject(new Error('Missing required Tiki citizenship for this category'));
              } else {
                reject(new Error(errorMsg));
              }
            } else {
              reject(new Error(dispatchError.toString()));
            }
            if (unsub) unsub();
            return;
          }

          if (status.isInBlock || status.isFinalized) {
            toast.success(`Joined ${category} pool successfully`);
            resolve();
            if (unsub) unsub();
          }
        }
      ).then((unsubscribe) => {
        unsub = unsubscribe;
      });
    });
  } catch (error) {
    console.error('Join validator pool error:', error);
    toast.error(error instanceof Error ? error.message : 'Failed to join validator pool');
    throw error;
  }
}

/**
 * Leave validator pool
 */
export async function leaveValidatorPool(
  api: ApiPromise,
  account: InjectedAccountWithMeta
): Promise<void> {
  try {
    const extrinsic = api.tx.validatorPool.leaveValidatorPool();

    await new Promise<void>((resolve, reject) => {
      let unsub: () => void;

      extrinsic.signAndSend(
        account.address,
        ({ status, dispatchError }) => {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              const errorMsg = `${decoded.section}.${decoded.name}`;
              
              if (errorMsg === 'validatorPool.NotInPool') {
                reject(new Error('Not currently in validator pool'));
              } else {
                reject(new Error(errorMsg));
              }
            } else {
              reject(new Error(dispatchError.toString()));
            }
            if (unsub) unsub();
            return;
          }

          if (status.isInBlock || status.isFinalized) {
            toast.success('Left validator pool successfully');
            resolve();
            if (unsub) unsub();
          }
        }
      ).then((unsubscribe) => {
        unsub = unsubscribe;
      });
    });
  } catch (error) {
    console.error('Leave validator pool error:', error);
    toast.error(error instanceof Error ? error.message : 'Failed to leave validator pool');
    throw error;
  }
}

/**
 * Update validator category
 */
export async function updateValidatorCategory(
  api: ApiPromise,
  account: InjectedAccountWithMeta,
  newCategory: ValidatorPoolCategory
): Promise<void> {
  try {
    const categoryEnum = { [newCategory]: null };
    const extrinsic = api.tx.validatorPool.updateCategory(categoryEnum);

    await new Promise<void>((resolve, reject) => {
      let unsub: () => void;

      extrinsic.signAndSend(
        account.address,
        ({ status, dispatchError }) => {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              reject(new Error(`${decoded.section}.${decoded.name}`));
            } else {
              reject(new Error(dispatchError.toString()));
            }
            if (unsub) unsub();
            return;
          }

          if (status.isInBlock || status.isFinalized) {
            toast.success(`Category updated to ${newCategory}`);
            resolve();
            if (unsub) unsub();
          }
        }
      ).then((unsubscribe) => {
        unsub = unsubscribe;
      });
    });
  } catch (error) {
    console.error('Update category error:', error);
    toast.error(error instanceof Error ? error.message : 'Failed to update category');
    throw error;
  }
}

/**
 * Get validator pool member info
 */
export async function getPoolMember(
  api: ApiPromise,
  address: string
): Promise<ValidatorPoolCategory | null> {
  try {
    const member = await api.query.validatorPool.poolMembers(address);
    
    if (member.isNone) {
      return null;
    }

    const category = member.unwrap();
    
    // Parse category enum
    if (category.isStakeValidator) {
      return ValidatorPoolCategory.StakeValidator;
    } else if (category.isParliamentaryValidator) {
      return ValidatorPoolCategory.ParliamentaryValidator;
    } else if (category.isMeritValidator) {
      return ValidatorPoolCategory.MeritValidator;
    }

    return null;
  } catch (error) {
    console.error('Get pool member error:', error);
    return null;
  }
}

/**
 * Get total pool size
 */
export async function getPoolSize(api: ApiPromise): Promise<number> {
  try {
    const size = await api.query.validatorPool.poolSize();
    return size.toNumber();
  } catch (error) {
    console.error('Get pool size error:', error);
    return 0;
  }
}

/**
 * Get current validator set
 */
export async function getCurrentValidatorSet(api: ApiPromise): Promise<ValidatorSet | null> {
  try {
    const validatorSet = await api.query.validatorPool.currentValidatorSet();
    
    if (validatorSet.isNone) {
      return null;
    }

    const set = validatorSet.unwrap();
    
    return {
      stake_validators: set.stakeValidators.map((v: any) => v.toString()),
      parliamentary_validators: set.parliamentaryValidators.map((v: any) => v.toString()),
      merit_validators: set.meritValidators.map((v: any) => v.toString()),
      total_count: set.totalCount.toNumber(),
    };
  } catch (error) {
    console.error('Get validator set error:', error);
    return null;
  }
}

/**
 * Get current era
 */
export async function getCurrentEra(api: ApiPromise): Promise<number> {
  try {
    const era = await api.query.validatorPool.currentEra();
    return era.toNumber();
  } catch (error) {
    console.error('Get current era error:', error);
    return 0;
  }
}

/**
 * Get performance metrics for a validator
 */
export async function getPerformanceMetrics(
  api: ApiPromise,
  address: string
): Promise<PerformanceMetrics> {
  try {
    const metrics = await api.query.validatorPool.performanceMetrics(address);
    
    return {
      blocks_produced: metrics.blocksProduced.toNumber(),
      blocks_missed: metrics.blocksMissed.toNumber(),
      era_points: metrics.eraPoints.toNumber(),
      reputation_score: metrics.reputationScore.toNumber(),
    };
  } catch (error) {
    console.error('Get performance metrics error:', error);
    return {
      blocks_produced: 0,
      blocks_missed: 0,
      era_points: 0,
      reputation_score: 0,
    };
  }
}

/**
 * Get all pool members (requires iterating storage)
 */
export async function getAllPoolMembers(api: ApiPromise): Promise<PoolMember[]> {
  try {
    const entries = await api.query.validatorPool.poolMembers.entries();
    
    const members: PoolMember[] = entries.map(([key, value]) => {
      const address = key.args[0].toString();
      const category = value.unwrap();
      
      let categoryType: ValidatorPoolCategory;
      if (category.isStakeValidator) {
        categoryType = ValidatorPoolCategory.StakeValidator;
      } else if (category.isParliamentaryValidator) {
        categoryType = ValidatorPoolCategory.ParliamentaryValidator;
      } else {
        categoryType = ValidatorPoolCategory.MeritValidator;
      }
      
      return {
        address,
        category: categoryType,
        joinedAt: 0, // Block number not stored in this version
      };
    });

    return members;
  } catch (error) {
    console.error('Get all pool members error:', error);
    return [];
  }
}

/**
 * Check if address meets requirements for category
 */
export async function checkCategoryRequirements(
  api: ApiPromise,
  address: string,
  category: ValidatorPoolCategory
): Promise<{ eligible: boolean; reason?: string }> {
  try {
    // Get trust score
    const trustScore = await api.query.trust.trustScores(address);
    const score = trustScore.toNumber();

    if (score < 500) {
      return { eligible: false, reason: 'Trust score below 500' };
    }

    // Check Tiki for Parliamentary/Merit validators
    if (
      category === ValidatorPoolCategory.ParliamentaryValidator ||
      category === ValidatorPoolCategory.MeritValidator
    ) {
      const tikiScore = await api.query.tiki.tikiScores(address);
      if (tikiScore.isNone || tikiScore.unwrap().toNumber() === 0) {
        return { eligible: false, reason: 'Tiki citizenship required' };
      }
    }

    return { eligible: true };
  } catch (error) {
    console.error('Check category requirements error:', error);
    return { eligible: false, reason: 'Failed to check requirements' };
  }
}
