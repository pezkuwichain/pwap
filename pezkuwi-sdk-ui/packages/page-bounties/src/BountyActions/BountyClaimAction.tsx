// Copyright 2017-2026 @pezkuwi/app-bounties authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { AccountId, BountyIndex } from '@pezkuwi/types/interfaces';
import type { BN } from '@pezkuwi/util';

import React, { useMemo } from 'react';

import { TxButton } from '@pezkuwi/react-components';
import { useAccounts } from '@pezkuwi/react-hooks';

import { isClaimable } from '../helpers/index.js';
import { useBounties } from '../hooks/index.js';
import { useTranslation } from '../translate.js';

interface Props {
  beneficiaryId: AccountId;
  index: BountyIndex;
  payoutDue: BN;
}

function BountyClaimAction ({ beneficiaryId, index, payoutDue }: Props) {
  const { t } = useTranslation();
  const { claimBounty } = useBounties();
  const { allAccounts } = useAccounts();

  const isBountyClaimable = useMemo(
    () => isClaimable(allAccounts, beneficiaryId, payoutDue),
    [allAccounts, beneficiaryId, payoutDue]
  );

  return isBountyClaimable
    ? (
      <TxButton
        accountId={beneficiaryId}
        icon='plus'
        label={t('Claim')}
        params={[index]}
        tx={claimBounty}
      />
    )
    : null;
}

export default React.memo(BountyClaimAction);
