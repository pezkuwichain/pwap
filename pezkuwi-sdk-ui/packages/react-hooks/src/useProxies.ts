// Copyright 2017-2026 @pezkuwi/react-hooks authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ApiPromise } from '@pezkuwi/api';
import type { AccountId } from '@pezkuwi/types/interfaces';
import type { KitchensinkRuntimeProxyType, PezpalletProxyProxyDefinition } from '@pezkuwi/types/lookup';
import type { BN } from '@pezkuwi/util';

import { createNamedHook } from './createNamedHook.js';
import { useAccounts } from './useAccounts.js';
import { useApi } from './useApi.js';
import { useCall } from './useCall.js';

const OPTS = {
  transform: (result: [([AccountId, KitchensinkRuntimeProxyType] | PezpalletProxyProxyDefinition)[], BN][], api: ApiPromise): [PezpalletProxyProxyDefinition[], BN][] =>
    api.tx.proxy.addProxy.meta.args.length === 3
      ? result as [PezpalletProxyProxyDefinition[], BN][]
      : (result as [[AccountId, KitchensinkRuntimeProxyType][], BN][]).map(([arr, bn]): [PezpalletProxyProxyDefinition[], BN] =>
        [arr.map(([delegate, proxyType]): PezpalletProxyProxyDefinition =>
          api.createType('ProxyDefinition', {
            delegate,
            proxyType
          })), bn]
      )
};

function useProxiesImpl (): [PezpalletProxyProxyDefinition[], BN][] | undefined {
  const { api } = useApi();
  const { allAccounts } = useAccounts();

  return useCall<[PezpalletProxyProxyDefinition[], BN][]>(api.query.proxy?.proxies.multi, [allAccounts], OPTS);
}

export const useProxies = createNamedHook('useProxies', useProxiesImpl);
