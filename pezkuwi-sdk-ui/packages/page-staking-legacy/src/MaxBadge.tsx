// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { u32 } from '@pezkuwi/types';

import React from 'react';

import { Badge } from '@pezkuwi/react-components';
import { useApi } from '@pezkuwi/react-hooks';

interface Props {
  numNominators?: number;
}

function MaxBadge ({ numNominators }: Props): React.ReactElement<Props> | null {
  const { api } = useApi();

  const max = api.consts.staking?.maxNominatorRewardedPerValidator as u32;

  if (!numNominators || !max || max.gten(numNominators)) {
    return null;
  }

  return (
    <Badge
      className='media--1200'
      color='red'
      icon='balance-scale-right'
    />
  );
}

export default React.memo(MaxBadge);
