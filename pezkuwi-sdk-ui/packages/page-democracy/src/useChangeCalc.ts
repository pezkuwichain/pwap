// Copyright 2017-2026 @pezkuwi/app-democracy authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { VoteThreshold } from '@pezkuwi/types/interfaces';
import type { BN } from '@pezkuwi/util';

import { useEffect, useState } from 'react';

import { createNamedHook, useApi, useCall } from '@pezkuwi/react-hooks';
import { BN_ZERO } from '@pezkuwi/util';

import { approxChanges } from './util.js';

interface Result {
  changeAye: BN;
  changeNay: BN;
}

function useChangeCalcImpl (threshold: VoteThreshold, votedAye: BN, votedNay: BN, votedTotal: BN): Result {
  const { api } = useApi();
  const sqrtElectorate = useCall<BN>(api.derive.democracy.sqrtElectorate);
  const [result, setResult] = useState<Result>({ changeAye: BN_ZERO, changeNay: BN_ZERO });

  useEffect((): void => {
    sqrtElectorate && setResult(
      approxChanges(threshold, sqrtElectorate, { votedAye, votedNay, votedTotal })
    );
  }, [sqrtElectorate, threshold, votedAye, votedNay, votedTotal]);

  return result;
}

export default createNamedHook('useChangeCalc', useChangeCalcImpl);
