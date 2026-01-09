// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Option, StorageKey, u64 } from '@pezkuwi/types';
import type { PezpalletBagsListListBag } from '@pezkuwi/types/lookup';
import type { BN } from '@pezkuwi/util';
import type { BagInfo } from './types.js';

import { useEffect, useState } from 'react';

import { createNamedHook, useCall, useMapKeys } from '@pezkuwi/react-hooks';
import { BN_ZERO } from '@pezkuwi/util';

import useQueryModule from './useQueryModule.js';

const KEY_OPTS = {
  transform: (keys: StorageKey<[u64]>[]): BN[] =>
    keys.map(({ args: [id] }) => id)
};

const MULTI_OPTS = {
  transform: ([[ids], opts]: [[BN[]], Option<PezpalletBagsListListBag>[]]): BagInfo[] => {
    const sorted = ids
      .map((id, index): [BN, Option<PezpalletBagsListListBag>] => [id, opts[index]])
      .filter(([, o]) => o.isSome)
      .sort(([a], [b]) => b.cmp(a))
      .map(([bagUpper, o], index): BagInfo => ({
        bagLower: BN_ZERO,
        bagUpper,
        index,
        info: o.unwrap(),
        key: bagUpper.toString()
      }));

    return sorted.map((entry, index) =>
      (index === (sorted.length - 1))
        ? entry
        // We could probably use a .add(BN_ONE) here
        : { ...entry, bagLower: sorted[index + 1].bagUpper }
    );
  },
  withParamsTransform: true
};

function merge (prev: BagInfo[] | undefined, curr: BagInfo[]): BagInfo[] {
  return !prev || curr.length !== prev.length
    ? curr
    : curr.map((q, i) =>
      JSON.stringify(q) === JSON.stringify(prev[i])
        ? prev[i]
        : q
    );
}

function useBagsListImpl (): BagInfo[] | undefined {
  const mod = useQueryModule();
  const [result, setResult] = useState<BagInfo[] | undefined>();
  const ids = useMapKeys(mod.listBags, [], KEY_OPTS);
  const query = useCall(ids && ids.length !== 0 && mod.listBags.multi, [ids], MULTI_OPTS);

  useEffect((): void => {
    query && setResult((prev) => merge(prev, query));
  }, [query]);

  return result;
}

export default createNamedHook('useBagsList', useBagsListImpl);
