// Copyright 2017-2026 @pezkuwi/app-parachains authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ParaId, SessionIndex } from '@pezkuwi/types/interfaces';
import type { BN } from '@pezkuwi/util';
import type { QueuedAction } from './types.js';

import { useMemo } from 'react';

import { createNamedHook, useApi, useCall } from '@pezkuwi/react-hooks';
import { BN_EIGHT, BN_FIVE, BN_FOUR, BN_NINE, BN_ONE, BN_SEVEN, BN_SIX, BN_TEN, BN_THREE, BN_TWO } from '@pezkuwi/util';

const INC = [BN_ONE, BN_TWO, BN_THREE, BN_FOUR, BN_FIVE, BN_SIX, BN_SEVEN, BN_EIGHT, BN_NINE, BN_TEN];

const OPT_NEXT = {
  withParams: true
};

function useActionsQueueImpl (): QueuedAction[] {
  const { api } = useApi();
  const currentIndex = useCall<SessionIndex>(api.query.session.currentIndex);
  const queryIndexes = useMemo(() => currentIndex && INC.map((i) => currentIndex.add(i)), [currentIndex]);
  const nextActions = useCall<[[BN[]], ParaId[][]]>(queryIndexes && api.query.paras.actionsQueue.multi, [queryIndexes], OPT_NEXT);

  return useMemo(
    (): QueuedAction[] =>
      nextActions
        ? nextActions[0][0]
          .map((sessionIndex, index) => ({
            paraIds: nextActions[1][index],
            sessionIndex
          }))
          .filter(({ paraIds }) => paraIds.length)
        : [],
    [nextActions]
  );
}

export default createNamedHook('useActionsQueue', useActionsQueueImpl);
