// Copyright 2017-2026 @pezkuwi/app-assets authors & contributors
// SPDX-License-Identifier: Apache-2.0

// augment package
import '@pezkuwi/api-augment/bizinikiwi';

import type { PezpalletAssetsAssetAccount } from '@pezkuwi/types/lookup';
import type { bool } from '@pezkuwi/types-codec';
import type { BN } from '@pezkuwi/util';

import React from 'react';

import { AddressSmall } from '@pezkuwi/react-components';
import { FormatBalance } from '@pezkuwi/react-query';

import { useTranslation } from '../translate.js';
import Transfer from './Transfer.js';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore This looks correct in the editor, but incorrect in composite mode
interface AccountExt extends PezpalletAssetsAssetAccount {
  isFrozen?: bool;
  sufficient?: bool
}

interface Props {
  account: AccountExt;
  accountId: string;
  assetId: BN;
  className?: string;
  minBalance: BN;
  siFormat: [number, string];
}

function Account ({ account: { balance, isFrozen, reason, sufficient }, accountId, assetId, minBalance, siFormat }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();

  return (
    <>
      <td className='address'>
        <AddressSmall value={accountId} />
      </td>
      <td className='start'>
        {isFrozen?.isTrue ? t('Yes') : t('No')}
      </td>
      <td className='start'>
        {sufficient
          ? sufficient.isTrue ? t('Yes') : t('No')
          : reason?.toString()}
      </td>
      <td className='number all'>
        <FormatBalance
          format={siFormat}
          value={balance}
        />
      </td>
      <td className='button'>
        <Transfer
          accountId={accountId}
          assetId={assetId}
          minBalance={minBalance}
          siFormat={siFormat}
        />
      </td>
    </>
  );
}

export default React.memo(Account);
