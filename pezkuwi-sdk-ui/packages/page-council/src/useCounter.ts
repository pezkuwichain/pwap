// Copyright 2017-2026 @pezkuwi/app-council authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveCollectiveProposal } from '@pezkuwi/api-derive/types';

import { createNamedHook, useAccounts, useApi, useCall } from '@pezkuwi/react-hooks';

const transformCounter = {
  transform: (motions: DeriveCollectiveProposal[]) => motions.filter(({ votes }) => !!votes).length
};

function useCounterImpl (): number {
  const { hasAccounts } = useAccounts();
  const { api, isApiReady } = useApi();
  const counter = useCall<number>(isApiReady && hasAccounts && api.derive.council?.proposals, undefined, transformCounter) || 0;

  return counter;
}

export default createNamedHook('useCounter', useCounterImpl);
