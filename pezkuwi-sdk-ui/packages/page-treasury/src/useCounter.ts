// Copyright 2017-2026 @pezkuwi/app-treasury authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveTreasuryProposals } from '@pezkuwi/api-derive/types';

import { useMemo } from 'react';

import { createNamedHook, useAccounts, useApi, useCall } from '@pezkuwi/react-hooks';

function useCounterImpl (): number {
  const { hasAccounts } = useAccounts();
  const { api, isApiReady } = useApi();
  const proposals = useCall<DeriveTreasuryProposals>(isApiReady && hasAccounts && api.derive.treasury?.proposals);

  return useMemo(
    () => proposals?.proposals.length || 0,
    [proposals]
  );
}

export default createNamedHook('useCounter', useCounterImpl);
