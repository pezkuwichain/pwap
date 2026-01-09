// Copyright 2017-2026 @pezkuwi/app-alliance authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React from 'react';

import { AddressSmall } from '@pezkuwi/react-components';

interface Props {
  className?: string;
  value: string;
}

function Account ({ className, value }: Props): React.ReactElement<Props> {
  return (
    <tr className={className}>
      <td className='address all'>
        <AddressSmall value={value} />
      </td>
    </tr>
  );
}

export default React.memo(Account);
