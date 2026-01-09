// Copyright 2017-2026 @pezkuwi/app-preimages authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Changes } from '@pezkuwi/react-hooks/useEventChanges';
import type { StorageKey } from '@pezkuwi/types';
import type { EventRecord, Hash } from '@pezkuwi/types/interfaces';
import type { HexString } from '@pezkuwi/util/types';

import { useMemo } from 'react';

import { createNamedHook, useApi, useEventChanges, useMapKeys } from '@pezkuwi/react-hooks';

const EMPTY_PARAMS: unknown[] = [];

const OPT_HASH = {
  transform: (keys: StorageKey<[Hash]>[]): Hash[] =>
    keys.map(({ args: [hash] }) => hash)
};

function filter (records: EventRecord[]): Changes<Hash> {
  const added: Hash[] = [];
  const removed: Hash[] = [];

  records.forEach(({ event: { data: [hash], method } }): void => {
    if (method === 'Noted') {
      added.push(hash as Hash);
    } else {
      removed.push(hash as Hash);
    }
  });

  return { added, removed };
}

function usePreimagesImpl (): HexString[] | undefined {
  const { api } = useApi();
  const startValueStatusFor = useMapKeys(api.query.preimage.statusFor, EMPTY_PARAMS, OPT_HASH);
  const startvalueRequstStatusFor = useMapKeys(api.query.preimage.requestStatusFor, EMPTY_PARAMS, OPT_HASH);
  const hashes = useEventChanges([
    api.events.preimage.Cleared,
    api.events.preimage.Noted
  ], filter, startValueStatusFor?.concat(startvalueRequstStatusFor || []));

  return useMemo(
    () => hashes?.map((h) => h.toHex()),
    [hashes]
  );
}

export default createNamedHook('usePreimages', usePreimagesImpl);
