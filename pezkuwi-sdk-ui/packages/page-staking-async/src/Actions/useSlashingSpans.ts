// Copyright 2017-2026 @pezkuwi/app-staking-async authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Option } from '@pezkuwi/types';
import type { PezpalletStakingSlashingSlashingSpans } from '@pezkuwi/types/lookup';

import { createNamedHook, useCall, useStakingAsyncApis } from '@pezkuwi/react-hooks';

const OPT_SPAN = {
  transform: (optSpans: Option<PezpalletStakingSlashingSlashingSpans>): number =>
    optSpans.isNone
      ? 0
      : optSpans.unwrap().prior.length + 1
};

function useSlashingSpansImpl (stashId: string): number {
  const { ahApi: api } = useStakingAsyncApis();

  return useCall<number>(api?.query.staking.slashingSpans, [stashId], OPT_SPAN) || 0;
}

export default createNamedHook('useSlashingSpans', useSlashingSpansImpl);
