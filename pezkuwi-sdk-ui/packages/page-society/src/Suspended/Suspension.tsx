// Copyright 2017-2026 @pezkuwi/app-society authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { AccountId, BalanceOf } from '@pezkuwi/types/interfaces';
import type { PezpalletSocietyBidKind } from '@pezkuwi/types/lookup';

import React from 'react';

import { AddressSmall, Table } from '@pezkuwi/react-components';

import BidType from '../Candidates/BidType.js';

interface Props {
  balance?: BalanceOf;
  bid?: PezpalletSocietyBidKind;
  value: AccountId;
}

function Suspension ({ balance, bid, value }: Props): React.ReactElement<Props> {
  return (
    <tr>
      <td className='address all'>
        <AddressSmall value={value} />
      </td>
      <td className='start'>
        <BidType value={bid} />
      </td>
      <Table.Column.Balance value={balance} />
    </tr>
  );
}

export default React.memo(Suspension);
