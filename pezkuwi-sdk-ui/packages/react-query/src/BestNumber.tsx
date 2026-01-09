// Copyright 2017-2026 @pezkuwi/react-query authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { BlockNumber } from '@pezkuwi/types/interfaces';

import React from 'react';

import { useApi, useCall } from '@pezkuwi/react-hooks';
import { formatNumber } from '@pezkuwi/util';

interface Props {
  children?: React.ReactNode;
  className?: string;
  isFinalized?: boolean;
  label?: React.ReactNode;
  withPound?: boolean;
}

function BestNumber ({ children, className = '', isFinalized, label, withPound }: Props): React.ReactElement<Props> {
  const { api, isApiReady } = useApi();
  const bestNumber = useCall<BlockNumber>(isApiReady && (isFinalized ? api.derive.chain.bestNumberFinalized : api.derive.chain.bestNumber));

  return (
    <div className={`${className} ${bestNumber ? '' : '--tmp'}`}>
      {label || ''}{withPound && '#'}{
        <span className='--digits'>{formatNumber(bestNumber || 1234)}</span>
      }{children}
    </div>
  );
}

export default React.memo(BestNumber);
