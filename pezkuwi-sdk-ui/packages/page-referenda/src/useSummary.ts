// Copyright 2017-2026 @pezkuwi/app-referenda authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { u32 } from '@pezkuwi/types';
import type { PezpalletReferenda, ReferendaGroup, Summary } from './types.js';

import { useMemo } from 'react';

import { createNamedHook, useApi, useCall } from '@pezkuwi/react-hooks';

function calcActive (grouped: ReferendaGroup[] = []): number {
  return grouped.reduce((total, { referenda = [] }) =>
    total + referenda.filter((r) =>
      r.info.isOngoing
    ).length,
  0);
}

function useSummaryImpl (palletReferenda: PezpalletReferenda, grouped?: ReferendaGroup[] | undefined): Summary {
  const { api } = useApi();
  const refCount = useCall<u32>(api.query[palletReferenda].referendumCount);
  const refActive = useMemo(
    () => calcActive(grouped),
    [grouped]
  );

  return useMemo(
    () => ({ refActive, refCount }),
    [refActive, refCount]
  );
}

export default createNamedHook('useSummary', useSummaryImpl);
