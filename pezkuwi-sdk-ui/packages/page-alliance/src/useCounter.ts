// Copyright 2017-2026 @pezkuwi/app-democracy authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react';

import { createNamedHook, useApi, useCall } from '@pezkuwi/react-hooks';

function useCounterImpl (): number {
  const { api, isApiReady } = useApi();
  const proposalHashes = useCall<unknown[]>(isApiReady && api.derive.alliance.proposalHashes);

  return useMemo(
    () => proposalHashes?.length || 0,
    [proposalHashes]
  );
}

export default createNamedHook('useCounter', useCounterImpl);
