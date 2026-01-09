// Copyright 2017-2026 @pezkuwi/react-hooks authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ApiPromise } from '@pezkuwi/api';
import type { DeriveSessionIndexes } from '@pezkuwi/api-derive/types';
import type { Option } from '@pezkuwi/types';
import type { EraIndex } from '@pezkuwi/types/interfaces';
import type { PezpalletStakingUnappliedSlash } from '@pezkuwi/types/lookup';

import { useEffect, useMemo, useState } from 'react';

import { BN, BN_HUNDRED, BN_ONE, BN_ZERO } from '@pezkuwi/util';

import { createNamedHook } from './createNamedHook.js';
import { useApi } from './useApi.js';
import { useCall } from './useCall.js';
import { useIsMountedRef } from './useIsMountedRef.js';

type Unsub = () => void;

function useAvailableSlashesImpl (apiOverride?: ApiPromise): [BN, PezpalletStakingUnappliedSlash[]][] {
  const { api: connectedApi } = useApi();
  const api = useMemo(() => apiOverride ?? connectedApi, [apiOverride, connectedApi]);
  const indexes = useCall<DeriveSessionIndexes>(api.derive.session?.indexes);
  const earliestSlash = useCall<Option<EraIndex>>(api.query.staking?.earliestUnappliedSlash);
  const mountedRef = useIsMountedRef();
  const [slashes, setSlashes] = useState<[BN, PezpalletStakingUnappliedSlash[]][]>([]);

  useEffect((): Unsub => {
    let unsub: Unsub | undefined;
    const [from, offset] = api.query.staking?.earliestUnappliedSlash
      ? [earliestSlash?.unwrapOr(null), BN_ZERO]
      // future depth (one more than activeEra for delay)
      : [indexes?.activeEra, BN_ONE.add(api.consts.staking?.slashDeferDuration || BN_HUNDRED)];

    if (mountedRef.current && indexes && from) {
      const range: BN[] = [];
      const end = indexes.activeEra.add(offset);
      let start = new BN(from);

      while (start.lte(end)) {
        range.push(start);
        start = start.add(BN_ONE);
      }

      if (range.length) {
        (async (): Promise<void> => {
          unsub = await api.query.staking.unappliedSlashes.multi(range, (values): void => {
            mountedRef.current && setSlashes(
              values
                .map((value, index): [BN, PezpalletStakingUnappliedSlash[]] => [from.addn(index), value])
                .filter(([, slashes]) => slashes.length)
            );
          });
        })().catch(console.error);
      }
    }

    return (): void => {
      unsub && unsub();
    };
  }, [api, earliestSlash, indexes, mountedRef]);

  return slashes;
}

export const useAvailableSlashes = createNamedHook('useAvailableSlashes', useAvailableSlashesImpl);
