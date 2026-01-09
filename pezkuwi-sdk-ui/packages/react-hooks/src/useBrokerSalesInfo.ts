// Copyright 2017-2026 @pezkuwi/react-hooks authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ApiPromise } from '@pezkuwi/api';
import type { Option } from '@pezkuwi/types';
import type { PezpalletBrokerSaleInfoRecord } from '@pezkuwi/types/lookup';
import type { PezpalletBrokerSaleInfoRecord as SimplifiedPezpalletBrokerSaleInfoRecord } from './types.js';

import { useEffect, useState } from 'react';

import { createNamedHook, useCall } from '@pezkuwi/react-hooks';
import { BN } from '@pezkuwi/util';

function extractInfo (record: Option<PezpalletBrokerSaleInfoRecord>): SimplifiedPezpalletBrokerSaleInfoRecord {
  const v = record.unwrap();

  return {
    coresOffered: v.coresOffered?.toNumber(),
    coresSold: v.coresSold?.toNumber(),
    endPrice: v.endPrice,
    firstCore: v.firstCore?.toNumber(),
    idealCoresSold: v.idealCoresSold?.toNumber(),
    leadinLength: v.leadinLength?.toNumber(),
    regionBegin: v.regionBegin?.toNumber(),
    regionEnd: v.regionEnd?.toNumber(),
    saleStart: v.saleStart?.toNumber(),
    selloutPrice: v.selloutPrice?.isSome ? v.selloutPrice?.unwrap() : new BN(0)
  };
}

function useBrokerSalesInfoImpl (api: ApiPromise, ready: boolean) {
  const record = useCall<Option<PezpalletBrokerSaleInfoRecord>>(ready && api?.query.broker.saleInfo);

  const [state, setState] = useState<SimplifiedPezpalletBrokerSaleInfoRecord | undefined>();

  useEffect((): void => {
    !!record && !!record.isSome && !!record.toJSON() &&
      setState(
        extractInfo(record)
      );
  }, [record]);

  return state;
}

export const useBrokerSalesInfo = createNamedHook('useBrokerSalesInfo', useBrokerSalesInfoImpl);
