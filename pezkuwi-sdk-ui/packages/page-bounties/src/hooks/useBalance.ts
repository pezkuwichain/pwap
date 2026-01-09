// Copyright 2017-2026 @pezkuwi/app-bounties authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveBalancesAll } from '@pezkuwi/api-derive/types';
import type { Balance } from '@pezkuwi/types/interfaces';

import { createNamedHook, useApi, useCall } from '@pezkuwi/react-hooks';

function useBalanceImpl (accountId: string | null): Balance | undefined {
  const { api } = useApi();
  const balancesAll = useCall<DeriveBalancesAll>(api.derive.balances?.all, [accountId]);

  return balancesAll?.transferable || balancesAll?.availableBalance;
}

export const useBalance = createNamedHook('useBalance', useBalanceImpl);
