// Copyright 2017-2026 @pezkuwi/app-parachains authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { PezkuwiRuntimeTeyrchainsParasParaLifecycle } from '@pezkuwi/types/lookup';
import type { QueuedAction } from '../types.js';

import React from 'react';

import { SessionToTime } from '@pezkuwi/react-query';

interface Props {
  lifecycle: PezkuwiRuntimeTeyrchainsParasParaLifecycle | null;
  nextAction?: QueuedAction;
}

function Lifecycle ({ lifecycle, nextAction }: Props): React.ReactElement<Props> | null {
  return lifecycle && (
    <>
      {lifecycle.toString()}
      {nextAction && (
        <SessionToTime value={nextAction.sessionIndex} />
      )}
    </>
  );
}

export default React.memo(Lifecycle);
