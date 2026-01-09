// Copyright 2017-2026 @pezkuwi/react-query authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ApiPromise } from '@pezkuwi/api';
import type { Option } from '@pezkuwi/types';
import type { PezpalletBrokerStatusRecord } from '@pezkuwi/types/lookup';
import type { BrokerStatus } from './types.js';

import { useEffect, useState } from 'react';

import { createNamedHook, useCall } from '@pezkuwi/react-hooks';

function useBrokerStatusImpl (api: ApiPromise, ready: boolean): BrokerStatus | undefined {
  const status = useCall<Option<PezpalletBrokerStatusRecord>>(ready && api?.query.broker?.status);
  const [state, setState] = useState<BrokerStatus | undefined>();

  useEffect((): void => {
    if (!!status && status.isSome) {
      const s = status.unwrap();

      setState({
        coreCount: s.coreCount?.toNumber(),
        lastCommittedTimeslice: s.lastCommittedTimeslice?.toNumber(),
        lastTimeslice: s.lastTimeslice?.toNumber(),
        privatePoolSize: s.privatePoolSize?.toNumber(),
        systemPoolSize: s.systemPoolSize?.toNumber()
      });
    }
  }, [status]);

  return state;
}

export const useBrokerStatus = createNamedHook('useBrokerStatus', useBrokerStatusImpl);
