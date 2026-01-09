// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveStakingAccount } from '@pezkuwi/api-derive/types';
import type { BN } from '@pezkuwi/util';

import React, { useMemo } from 'react';

import { MarkWarning } from '@pezkuwi/react-components';
import { formatBalance } from '@pezkuwi/util';

import { useTranslation } from '../../translate.js';

interface Props {
  minBond?: BN;
  stakingInfo?: DeriveStakingAccount;
}

function WarnBond ({ minBond, stakingInfo }: Props): React.ReactElement<Props> | null {
  const { t } = useTranslation();

  const isBelow = useMemo(
    () => minBond && stakingInfo && stakingInfo.stakingLedger.active.unwrap().lt(minBond),
    [minBond, stakingInfo]
  );

  return isBelow
    ? <MarkWarning content={t('Your bonded amount is below the on-chain minimum threshold of {{minBond}} and may be chilled. Bond extra funds to increase the bonded amount.', { replace: { minBond: formatBalance(minBond) } })} />
    : null;
}

export default React.memo(WarnBond);
