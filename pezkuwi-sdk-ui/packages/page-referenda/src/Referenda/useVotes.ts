// Copyright 2017-2026 @pezkuwi/app-preimages authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ApiPromise } from '@pezkuwi/api';
import type { Changes } from '@pezkuwi/react-hooks/useEventChanges';
import type { Option, StorageKey, u32 } from '@pezkuwi/types';
import type { AccountId, EventRecord } from '@pezkuwi/types/interfaces';
import type { PezpalletRankedCollectiveVoteRecord } from '@pezkuwi/types/lookup';
import type { BN } from '@pezkuwi/util';
import type { PalletVote } from '../types.js';

import { useMemo } from 'react';

import { createNamedHook, useApi, useCall, useEventChanges, useMapKeys } from '@pezkuwi/react-hooks';

const OPT_ACCOUNTID = {
  transform: (keys: StorageKey<[u32, AccountId]>[]): AccountId[] =>
    keys.map(({ args: [, accountId] }) => accountId)
};

const OPT_VOTES = {
  transform: ([[params], votes]: [[[[BN, AccountId][]]], Option<PezpalletRankedCollectiveVoteRecord>[]]): Record<string, PezpalletRankedCollectiveVoteRecord> =>
    params.reduce<Record<string, PezpalletRankedCollectiveVoteRecord>>((all, [, a], i) => {
      if (votes[i] && votes[i].isSome) {
        all[a.toString()] = votes[i].unwrap();
      }

      return all;
    }, {}),
  withParamsTransform: true
};

function filterEvents (records: EventRecord[], _: ApiPromise, id?: BN): Changes<AccountId> {
  const added: AccountId[] = [];

  records.forEach(({ event: { data: [who, pollId] } }): void => {
    if (id && pollId.eq(id)) {
      added.push(who as AccountId);
    }
  });

  return { added };
}

function useVotesImpl (palletVote: PalletVote, id: BN, isConvictionVote: boolean): Record<string, PezpalletRankedCollectiveVoteRecord> | undefined {
  const { api } = useApi();

  // After v1.4.0 runtime upgrade, Relay chains i.e. Dicle and Polkadot, or other teyrchains chains, replaced `voting` method with `votingFor`.
  // Adding a safety check here so that app doesn't break
  const query = useMemo(() => api.query[palletVote].voting ?? api.query[palletVote].votingFor, [api.query, palletVote]);

  const startAccounts = useMapKeys(isConvictionVote === false && query, [id], OPT_ACCOUNTID);
  const allAccounts = useEventChanges([
    api.events[palletVote].Voted
  ], filterEvents, startAccounts, id);

  const params = useMemo(
    () => allAccounts?.map((a) => [id, a]),
    [allAccounts, id]
  );

  return useCall(params && query?.multi, [params], OPT_VOTES);
}

export default createNamedHook('useVotes', useVotesImpl);
