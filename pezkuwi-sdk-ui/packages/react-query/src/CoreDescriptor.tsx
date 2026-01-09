// Copyright 2017-2026 @pezkuwi/react-query authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { PezkuwiRuntimeTeyrchainsAssignerCoretimeCoreDescriptor } from '@pezkuwi/types/lookup';

import React from 'react';

import { useApi, useCall } from '@pezkuwi/react-hooks';

interface Props {
  children?: React.ReactNode;
  className?: string;
  query: string;
}

function BrokerStatus ({ children, className = '', query }: Props): React.ReactElement<Props> {
  const { api } = useApi();
  const status = useCall<PezkuwiRuntimeTeyrchainsAssignerCoretimeCoreDescriptor>(api.query.broker?.status);
  const strStatus = status === undefined ? '' : status.toJSON()[query];

  return (
    <div className={className}>
      {strStatus?.toString()}
      {children}
    </div>
  );
}

export default React.memo(BrokerStatus);
