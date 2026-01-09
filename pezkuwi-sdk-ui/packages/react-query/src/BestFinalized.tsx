// Copyright 2017-2026 @pezkuwi/react-query authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { BlockNumber } from '@pezkuwi/types/interfaces';

import React from 'react';

import { useApi, useCall } from '@pezkuwi/react-hooks';
import { formatNumber } from '@pezkuwi/util';

interface Props {
  children?: React.ReactNode;
  className?: string;
  label?: React.ReactNode;
}

function BestFinalized ({ children, className = '', label }: Props): React.ReactElement<Props> {
  const { api } = useApi();
  const bestNumberFinalized = useCall<BlockNumber>(api.derive.chain.bestNumberFinalized);

  return (
    <div className={`${className} ${bestNumberFinalized ? '' : '--tmp'}`}>
      {label || ''}{
        <span className='--digits'>{formatNumber(bestNumberFinalized || 1234)}</span>
      }{children}
    </div>
  );
}

export default React.memo(BestFinalized);
