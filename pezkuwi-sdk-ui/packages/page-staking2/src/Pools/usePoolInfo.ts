// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Bytes, Option } from '@pezkuwi/types';
import type { PezframeSystemAccountInfo, PezpalletNominationPoolsBondedPoolInner, PezpalletNominationPoolsRewardPool, PezpalletStakingNominations } from '@pezkuwi/types/lookup';
import type { BN } from '@pezkuwi/util';
import type { PoolInfo, PoolInfoBase } from './types.js';

import { useMemo } from 'react';

import { createNamedHook, useApi, useCallMulti } from '@pezkuwi/react-hooks';
import { BN_ZERO, bnMax } from '@pezkuwi/util';

import usePoolAccounts from './usePoolAccounts.js';

const OPT_MULTI = {
  defaultValue: null,
  transform: ([optBonded, metadata, optReward, optNominating, accountInfo]: [Option<PezpalletNominationPoolsBondedPoolInner>, Bytes, Option<PezpalletNominationPoolsRewardPool>, Option<PezpalletStakingNominations>, PezframeSystemAccountInfo]): PoolInfoBase | null =>
    optBonded.isSome && optReward.isSome
      ? {
        bonded: optBonded.unwrap(),
        metadata: metadata.length
          ? transformName(
            metadata.isUtf8
              ? metadata.toUtf8()
              : metadata.toString()
          )
          : null,
        nominating: optNominating
          .unwrapOr({ targets: [] })
          .targets.map((n) => n.toString()),
        reward: optReward.unwrap(),
        rewardClaimable: accountInfo.data.free
      }
      : null
};

function transformName (input: string): string {
  return input.replace(/[^\x20-\x7E]/g, '');
}

function usePoolInfoImpl (poolId: BN): PoolInfo | null | undefined {
  const { api } = useApi();
  const accounts = usePoolAccounts(poolId);
  const baseInfo = useCallMulti([
    [api.query.nominationPools.bondedPools, poolId],
    [api.query.nominationPools.metadata, poolId],
    [api.query.nominationPools.rewardPools, poolId],
    [api.query.staking.nominators, accounts.stashId],
    [api.query.system.account, accounts.rewardId]
  ], OPT_MULTI);

  return useMemo(
    () => baseInfo && {
      ...accounts,
      ...baseInfo,
      rewardClaimable: bnMax(BN_ZERO, baseInfo.rewardClaimable.sub(api.consts.balances.existentialDeposit))
    },
    [api, baseInfo, accounts]
  );
}

export default createNamedHook('usePoolInfo', usePoolInfoImpl);
