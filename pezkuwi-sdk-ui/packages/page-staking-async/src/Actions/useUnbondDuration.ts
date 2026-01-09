// Copyright 2017-2026 @pezkuwi/app-staking-async authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveSessionInfo } from '@pezkuwi/api-derive/types';
import type { BN } from '@pezkuwi/util';

import { useMemo } from 'react';

import { createNamedHook, useCall, useStakingAsyncApis } from '@pezkuwi/react-hooks';
import { BN_ONE, BN_ZERO } from '@pezkuwi/util';

function useUnbondDurationImpl (): BN | undefined {
  const { ahApi: api } = useStakingAsyncApis();
  const sessionInfo = useCall<DeriveSessionInfo>(api?.derive.session.info);

  return useMemo(
    () => (sessionInfo && sessionInfo.sessionLength.gt(BN_ONE))
      ? sessionInfo.eraLength.mul(api?.consts.staking.bondingDuration ?? BN_ZERO)
      : undefined,
    [api, sessionInfo]
  );
}

export default createNamedHook('useUnbondDuration', useUnbondDurationImpl);
