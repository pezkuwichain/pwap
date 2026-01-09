// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveSessionInfo } from '@pezkuwi/api-derive/types';
import type { BN } from '@pezkuwi/util';

import { useMemo } from 'react';

import { createNamedHook, useApi, useCall } from '@pezkuwi/react-hooks';
import { BN_ONE } from '@pezkuwi/util';

function useUnbondDurationImpl (): BN | undefined {
  const { api } = useApi();
  const sessionInfo = useCall<DeriveSessionInfo>(api.derive.session.info);

  return useMemo(
    () => (sessionInfo && sessionInfo.sessionLength.gt(BN_ONE))
      ? sessionInfo.eraLength.mul(api.consts.staking.bondingDuration)
      : undefined,
    [api, sessionInfo]
  );
}

export default createNamedHook('useUnbondDuration', useUnbondDurationImpl);
