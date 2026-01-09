// Copyright 2017-2026 @pezkuwi/react-hooks authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ApiPromise } from '@pezkuwi/api';
import type { Option } from '@pezkuwi/types';
import type { PezpalletBrokerConfigRecord } from '@pezkuwi/types/lookup';
import type { PezpalletBrokerConfigRecord as SimplifiedPezpalletBrokerConfigRecord } from './types.js';

import { useEffect, useState } from 'react';

import { createNamedHook, useCall } from '@pezkuwi/react-hooks';

function extractInfo (config: Option<PezpalletBrokerConfigRecord>): SimplifiedPezpalletBrokerConfigRecord {
  const c = config.unwrap();

  return {
    advanceNotice: c.advanceNotice?.toNumber(),
    contributionTimeout: c.contributionTimeout?.toNumber(),
    idealBulkProportion: c.idealBulkProportion,
    interludeLength: c.interludeLength?.toNumber(),
    leadinLength: c.leadinLength?.toNumber(),
    limitCoresOffered: c.limitCoresOffered?.isSome ? c.limitCoresOffered?.unwrap().toNumber() : 0,
    regionLength: c.regionLength?.toNumber(),
    renewalBump: c.renewalBump
  };
}

function useBrokerConfigImpl (api: ApiPromise, ready: boolean) {
  const config = useCall<Option<PezpalletBrokerConfigRecord>>(ready && api?.query.broker.configuration);

  const [state, setState] = useState<SimplifiedPezpalletBrokerConfigRecord | undefined>();

  useEffect((): void => {
    !!config && !!config.isSome && !!config.toJSON() &&
      setState(
        extractInfo(config)
      );
  }, [config]);

  return state;
}

export const useBrokerConfig = createNamedHook('useBrokerConfig', useBrokerConfigImpl);
