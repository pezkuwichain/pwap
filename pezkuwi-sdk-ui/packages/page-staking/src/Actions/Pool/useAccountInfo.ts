// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Option } from '@pezkuwi/types';
import type { PezpalletNominationPoolsPoolMember } from '@pezkuwi/types/lookup';
import type { AccountInfo } from './types.js';

import { useEffect, useState } from 'react';

import { createNamedHook, useApi, useCall, useIsMountedRef } from '@pezkuwi/react-hooks';

const OPT_DEL = {
  transform: (opt: Option<PezpalletNominationPoolsPoolMember>): PezpalletNominationPoolsPoolMember | null =>
    opt.unwrapOr(null)
};

function useAccountInfoImpl (accountId: string): AccountInfo | null {
  const { api } = useApi();
  const isMountedRef = useIsMountedRef();
  const [state, setState] = useState<AccountInfo | null>(null);
  const member = useCall(api.query.nominationPools.poolMembers, [accountId], OPT_DEL);

  useEffect((): void => {
    member &&
      api.call.nominationPoolsApi
        ?.pendingRewards(accountId)
        .then((claimable) =>
          isMountedRef.current && setState({ claimable, member })
        )
        .catch(console.error);
  }, [accountId, member, api, isMountedRef]);

  return state;
}

export default createNamedHook('useAccountInfo', useAccountInfoImpl);
