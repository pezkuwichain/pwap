// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveSessionProgress } from '@pezkuwi/api-derive/types';
import type { Forcing } from '@pezkuwi/types/interfaces';
import type { BN } from '@pezkuwi/util';

import { useMemo } from 'react';

import { createNamedHook, useApi, useCall } from '@pezkuwi/react-hooks';
import { BN_ONE } from '@pezkuwi/util';

function useEraBlocksImpl (historyDepth?: BN, era?: BN): BN | undefined {
  const { api } = useApi();
  const progress = useCall<DeriveSessionProgress>(api.derive.session.progress);
  const forcing = useCall<Forcing>(api.query.staking.forceEra);

  return useMemo(
    () => (historyDepth && era && forcing && progress && progress.sessionLength.gt(BN_ONE))
      ? (
        forcing.isForceAlways
          ? progress.sessionLength
          : progress.eraLength
      ).mul(
        historyDepth
          .sub(progress.activeEra)
          .iadd(era)
          .iadd(BN_ONE)
      ).isub(
        forcing.isForceAlways
          ? progress.sessionProgress
          : progress.eraProgress
      )
      : undefined,
    [era, forcing, historyDepth, progress]
  );
}

export default createNamedHook('useEraBlocks', useEraBlocksImpl);
