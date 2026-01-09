// Copyright 2017-2026 @pezkuwi/app-preimages authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Option } from '@pezkuwi/types';
import type { AccountId32 } from '@pezkuwi/types/interfaces';
import type { PezpalletRankedCollectiveMemberRecord } from '@pezkuwi/types/lookup';
import type { BN } from '@pezkuwi/util';
import type { Member, PalletColl } from './types.js';

import { useMemo } from 'react';

import { createNamedHook, useApi, useCall } from '@pezkuwi/react-hooks';

import useMembersIds from './useMemberIds.js';

interface Result {
  memberIds: string[];
  memberRanks: BN[];
  members: Member[];
}

const OPT_MEM = {
  transform: ([[ids], infos]: [[AccountId32[]], Option<PezpalletRankedCollectiveMemberRecord>[]]): Result => {
    const members = infos
      .map((info, i) => [info.unwrapOr(null), ids[i]])
      .filter((r): r is [PezpalletRankedCollectiveMemberRecord, AccountId32] => !!r[0])
      .sort(([a], [b]) => b.rank.cmp(a.rank))
      .map(([info, accountId]): Member => ({
        accountId: accountId.toString(),
        info
      }));

    return {
      memberIds: members.map(({ accountId }) => accountId),
      memberRanks: members.map(({ info }) => info.rank),
      members
    };
  },
  withParamsTransform: true
};

function useMembersImpl (collective: PalletColl): Result | undefined {
  const { api } = useApi();
  const ids = useMembersIds(collective);
  const result = useCall(ids && ids.length !== 0 && api.query[collective].members.multi, [ids], OPT_MEM);

  return useMemo(
    () => ids && ids.length === 0
      ? { memberIds: [], memberRanks: [], members: [] }
      : result,
    [ids, result]
  );
}

export default createNamedHook('useMembers', useMembersImpl);
