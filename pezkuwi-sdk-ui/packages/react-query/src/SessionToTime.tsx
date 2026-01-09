// Copyright 2017-2026 @pezkuwi/react-query authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveSessionProgress } from '@pezkuwi/api-derive/types';
import type { BN } from '@pezkuwi/util';

import React, { useMemo } from 'react';

import { useApi, useCall } from '@pezkuwi/react-hooks';
import { BN_ZERO } from '@pezkuwi/util';

import BlockToTime from './BlockToTime.js';

interface Props {
  children?: React.ReactNode;
  className?: string;
  isInline?: boolean;
  label?: React.ReactNode;
  value?: BN;
}

function SessionToTime ({ children, className, isInline, label, value }: Props): React.ReactElement<Props> | null {
  const { api } = useApi();
  const sessionInfo = useCall<DeriveSessionProgress>(api.derive.session.progress);

  const blocks = useMemo(
    () => sessionInfo && value && sessionInfo.currentIndex.lt(value)
      ? value
        .sub(sessionInfo.currentIndex)
        .imul(sessionInfo.sessionLength)
        .isub(sessionInfo.sessionProgress)
      : BN_ZERO,
    [sessionInfo, value]
  );

  return (
    <BlockToTime
      className={className}
      isInline={isInline}
      label={label}
      value={blocks}
    >
      {children}
    </BlockToTime>
  );
}

export default React.memo(SessionToTime);
