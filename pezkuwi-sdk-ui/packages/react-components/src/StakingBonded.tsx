// Copyright 2017-2026 @pezkuwi/react-components authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveStakingAccount } from '@pezkuwi/api-derive/types';

import React from 'react';

import { FormatBalance } from '@pezkuwi/react-query';

interface Props {
  className?: string;
  stakingInfo?: DeriveStakingAccount;
}

function StakingBonded ({ className = '', stakingInfo }: Props): React.ReactElement<Props> | null {
  const balance = stakingInfo?.stakingLedger?.active?.unwrap();

  if (!balance?.gtn(0)) {
    return null;
  }

  return (
    <FormatBalance
      className={className}
      value={balance}
    />
  );
}

export default React.memo(StakingBonded);
