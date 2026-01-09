// Copyright 2017-2026 @pezkuwi/app-broker authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { u32 } from '@pezkuwi/types';

import React from 'react';

import { useApi } from '@pezkuwi/react-hooks';

interface Props {
  className?: string;
  children?: React.ReactNode;
}

function BrokerId ({ children, className }: Props): React.ReactElement<Props> | null {
  const { api } = useApi();
  const period = api.consts.broker?.timeslicePeriod as u32;

  return (
    <div className={className}>
      {period?.toString()}
      {children}
    </div>
  );
}

export default React.memo(BrokerId);
