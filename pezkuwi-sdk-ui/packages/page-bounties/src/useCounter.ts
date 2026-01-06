// Copyright 2017-2025 @pezkuwi/app-bounties authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveBounties } from '@pezkuwi/api-derive/types';

import { useMemo } from 'react';

import { createNamedHook, useApi, useCall } from '@pezkuwi/react-hooks';

function useCounterImpl (): number {
  const { api, isApiReady } = useApi();
  const bounties = useCall<DeriveBounties>(isApiReady && api.derive.bounties?.bounties);

  return useMemo(
    () => bounties?.length || 0,
    [bounties]
  );
}

export default createNamedHook('useCounter', useCounterImpl);
