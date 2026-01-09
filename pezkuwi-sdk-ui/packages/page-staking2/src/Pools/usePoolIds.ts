// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Changes } from '@pezkuwi/react-hooks/useEventChanges';
import type { StorageKey, u32 } from '@pezkuwi/types';
import type { EventRecord } from '@pezkuwi/types/interfaces';

import { createNamedHook, useApi, useEventChanges, useMapKeys } from '@pezkuwi/react-hooks';

const OPT_KEYS = {
  transform: (keys: StorageKey<[u32]>[]): u32[] =>
    keys
      .map(({ args: [poolId] }) => poolId)
      .sort((a, b) => a.cmp(b))
};

function filterEvents (records: EventRecord[]): Changes<u32> {
  const added: u32[] = [];
  const removed: u32[] = [];

  records.forEach(({ event: { data, method } }): void => {
    if (method === 'Created') {
      added.push(data[1] as u32);
    } else {
      removed.push(data[0] as u32);
    }
  });

  return { added, removed };
}

function usePoolIdsImpl (): u32[] | undefined {
  const { api } = useApi();
  const startValue = useMapKeys(api.query.nominationPools.bondedPools, [], OPT_KEYS);

  return useEventChanges([
    api.events.nominationPools.Created,
    api.events.nominationPools.Destroyed
  ], filterEvents, startValue);
}

export default createNamedHook('usePoolIds', usePoolIdsImpl);
