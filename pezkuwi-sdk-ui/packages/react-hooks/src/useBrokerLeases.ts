// Copyright 2017-2026 @pezkuwi/react-hooks authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ApiPromise } from '@pezkuwi/api';
import type { Vec } from '@pezkuwi/types';
import type { PezpalletBrokerLeaseRecordItem } from '@pezkuwi/types/lookup';
import type { LegacyLease } from './types.js';

import { useEffect, useState } from 'react';

import { createNamedHook, useCall } from '@pezkuwi/react-hooks';

function useBrokerLeasesImpl (api: ApiPromise, ready: boolean): LegacyLease[] | undefined {
  const leases = useCall<Vec<PezpalletBrokerLeaseRecordItem>>(ready && api?.query?.broker?.leases);
  const [state, setState] = useState<LegacyLease[]>();

  useEffect((): void => {
    if (!leases) {
      return;
    }

    setState(
      leases.map((info, index: number) => ({
        core: index,
        task: info.task.toString(),
        until: info.until.toNumber()
      })
      ));
  }, [leases]);

  return state;
}

export const useBrokerLeases = createNamedHook('useBrokerLeases', useBrokerLeasesImpl);
