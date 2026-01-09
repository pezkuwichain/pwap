// Copyright 2017-2026 @pezkuwi/app-nis authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { u32, u128 } from '@pezkuwi/types';
import type { PezpalletNisSummaryRecord } from '@pezkuwi/types/lookup';
import type { NisInfo, QueueTotal } from './types.js';

import { useMemo } from 'react';

import { createNamedHook, useApi, useCallMulti } from '@pezkuwi/react-hooks';

interface State {
  info?: NisInfo;
}

const OPT_GILT = {
  defaultValue: {} as NisInfo,
  transform: ([summary, queueTotals]: [PezpalletNisSummaryRecord, [u32, u128][]]): NisInfo => ({
    queueTotals: queueTotals
      .map(([numItems, balance], index): QueueTotal => ({ balance, index: index + 1, numItems }))
      .filter(({ balance }) => !balance.isZero()),
    summary
  })
};

function useInfoImpl (): State {
  const { api } = useApi();
  const info = useCallMulti<NisInfo>([
    api.query.nis.summary,
    api.query.nis.queueTotals
  ], OPT_GILT);

  return useMemo(
    () => ({ info }),
    [info]
  );
}

export default createNamedHook('useInfo', useInfoImpl);
