// Copyright 2017-2026 @pezkuwi/react-query authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveBalancesAll } from '@pezkuwi/api-derive/types';
import type { BN } from '@pezkuwi/util';

import React from 'react';

import { useApi, useCall } from '@pezkuwi/react-hooks';
import { formatNumber } from '@pezkuwi/util';

interface Props {
  callOnResult?: (accountNonce: BN) => void;
  children?: React.ReactNode;
  className?: string;
  label?: React.ReactNode;
  params?: string | null;
}

function Nonce ({ children, className = '', label, params }: Props): React.ReactElement<Props> {
  const { api } = useApi();
  const allBalances = useCall<DeriveBalancesAll>(api.derive.balances?.all, [params]);

  return (
    <div className={className}>
      {label || ''}{formatNumber(allBalances?.accountNonce)}{children}
    </div>
  );
}

export default React.memo(Nonce);
