// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Option, u32 } from '@pezkuwi/types';
import type { BN } from '@pezkuwi/util';
import type { Params } from './types.js';

import { createNamedHook, useApi, useCallMulti } from '@pezkuwi/react-hooks';
import { BN_ONE, BN_ZERO } from '@pezkuwi/util';

const OPT_MULTI = {
  defaultValue: {
    lastPoolId: BN_ZERO,
    maxMembers: 0,
    maxMembersPerPool: 0,
    maxPools: 0,
    nextPoolId: BN_ONE
  },
  transform: ([lastPoolId, maxPoolMembers, maxPoolMembersPerPool, maxPools, minCreateBond, minJoinBond, minNominatorBond]: [BN, Option<u32>, Option<u32>, Option<u32>, BN, BN, BN]): Params => ({
    lastPoolId,
    maxMembers: maxPoolMembers.unwrapOr(BN_ZERO).toNumber(),
    maxMembersPerPool: maxPoolMembersPerPool.unwrapOr(BN_ZERO).toNumber(),
    maxPools: maxPools.unwrapOr(BN_ZERO).toNumber(),
    minCreateBond,
    minJoinBond,
    minMemberBond: minJoinBond,
    minNominatorBond,
    nextPoolId: lastPoolId.add(BN_ONE)
  })
};

function useParamsImpl (): Params {
  const { api } = useApi();

  return useCallMulti<Params>([
    api.query.nominationPools.lastPoolId,
    api.query.nominationPools.maxPoolMembers,
    api.query.nominationPools.maxPoolMembersPerPool,
    api.query.nominationPools.maxPools,
    api.query.nominationPools.minCreateBond,
    api.query.nominationPools.minJoinBond,
    api.query.staking.minNominatorBond
  ], OPT_MULTI);
}

export default createNamedHook('useParams', useParamsImpl);
