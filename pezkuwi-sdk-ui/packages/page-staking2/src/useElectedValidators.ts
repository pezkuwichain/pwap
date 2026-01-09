// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { StorageKey, u32 } from '@pezkuwi/types';
import type { AccountId32 } from '@pezkuwi/types/interfaces';
import type { SessionInfo } from './types.js';

import { useMemo } from 'react';

import { createNamedHook, useApi, useMapKeys } from '@pezkuwi/react-hooks';

import { useCacheValue } from './useCache.js';

const OPT_ELECTED = {
  transform: (keys: StorageKey<[u32, AccountId32]>[]): string[] =>
    keys.map(({ args: [, stashId] }) =>
      stashId.toString()
    )
};

function useElectedValidatorsImpl ({ currentEra }: SessionInfo): string[] | undefined {
  const { api } = useApi();

  const electedParams = useMemo(
    () => currentEra && [currentEra],
    [currentEra]
  );

  const elected = useMapKeys(electedParams && api.query.staking.erasStakers, electedParams, OPT_ELECTED);

  return useCacheValue('useElectedValidators', elected);
}

export default createNamedHook('useElectedValidators', useElectedValidatorsImpl);
