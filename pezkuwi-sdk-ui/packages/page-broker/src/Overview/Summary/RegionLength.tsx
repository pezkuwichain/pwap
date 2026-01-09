// Copyright 2017-2026 @pezkuwi/app-broker authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { PezpalletBrokerConfigRecord } from '@pezkuwi/types/lookup';

import React from 'react';

import { useApi, useCall } from '@pezkuwi/react-hooks';

interface Props {
  className?: string;
  children?: React.ReactNode;
}

function RegionLength ({ children, className }: Props): React.ReactElement<Props> | null {
  const { api } = useApi();
  const config = useCall<PezpalletBrokerConfigRecord>(api.query.broker?.configuration);
  const length = config?.toJSON()?.regionLength;

  return (
    <div className={className}>
      {length?.toString() || '-'}
      {children}
    </div>
  );
}

export default React.memo(RegionLength);
