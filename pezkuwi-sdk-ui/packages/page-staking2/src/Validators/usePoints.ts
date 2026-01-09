// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { PezpalletStakingEraRewardPoints } from '@pezkuwi/types/lookup';
import type { SessionInfo } from '../types.js';
import type { UsePoints } from './types.js';

import { useMemo } from 'react';

import { createNamedHook, useApi, useCall } from '@pezkuwi/react-hooks';
import { BN_ZERO } from '@pezkuwi/util';

import { useCacheValue } from '../useCache.js';

const OPT_POINTS = {
  transform: ({ individual }: PezpalletStakingEraRewardPoints): UsePoints =>
    [...individual.entries()]
      .filter(([, points]) => points.gt(BN_ZERO))
      .reduce((result: UsePoints, [stashId, points]): UsePoints => {
        result[stashId.toString()] = points.toNumber();

        return result;
      }, {})
};

function usePointsImpl ({ activeEra }: SessionInfo): UsePoints | undefined {
  const { api } = useApi();

  const queryParams = useMemo(
    () => activeEra && [activeEra],
    [activeEra]
  );

  const points = useCall(queryParams && api.query.staking.erasRewardPoints, queryParams, OPT_POINTS);

  return useCacheValue('usePoints', points);
}

export default createNamedHook('usePoints', usePointsImpl);
