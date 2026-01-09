// Copyright 2017-2026 @pezkuwi/app-preimages authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Changes } from '@pezkuwi/react-hooks/useEventChanges';
import type { StorageKey } from '@pezkuwi/types';
import type { EventRecord, Hash } from '@pezkuwi/types/interfaces';
import type { HexString } from '@pezkuwi/util/types';

import { useMemo } from 'react';

import { createNamedHook, useApi, useEventChanges, useMapKeys } from '@pezkuwi/react-hooks';

const OPT_HASH = {
  transform: (keys: StorageKey<[Hash]>[]): Hash[] =>
    keys.map(({ args: [hash] }) => hash)
};

function filter (records: EventRecord[]): Changes<Hash> {
  const added: Hash[] = [];
  const removed: Hash[] = [];

  records.forEach(({ event: { data: [hash], method } }): void => {
    if (method === 'CallWhitelisted') {
      added.push(hash as Hash);
    } else {
      removed.push(hash as Hash);
    }
  });

  return { added, removed };
}

function useHashesImpl (): HexString[] | undefined {
  const { api } = useApi();
  const startValue = useMapKeys(api.query.whitelist.whitelistedCall, [], OPT_HASH);
  const hashes = useEventChanges([
    api.events.whitelist.CallWhitelisted,
    api.events.whitelist.WhitelistedCallRemoved
  ], filter, startValue);

  return useMemo(
    () => hashes?.map((h) => h.toHex()),
    [hashes]
  );
}

export default createNamedHook('useHashes', useHashesImpl);
