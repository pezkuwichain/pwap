// Copyright 2017-2026 @pezkuwi/app-scheduler authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveDispatch } from '@pezkuwi/api-derive/types';

import React from 'react';

import PreImageButton from '@pezkuwi/app-democracy/Overview/PreImageButton';
import ProposalCell from '@pezkuwi/app-democracy/Overview/ProposalCell';
import { LinkExternal, Table } from '@pezkuwi/react-components';
import { useBestNumber } from '@pezkuwi/react-hooks';
import { BlockToTime } from '@pezkuwi/react-query';
import { formatNumber } from '@pezkuwi/util';

interface Props {
  value: DeriveDispatch;
}

function DispatchEntry ({ value: { at, image, imageHash, index } }: Props): React.ReactElement<Props> {
  const bestNumber = useBestNumber();

  return (
    <tr>
      <Table.Column.Id value={index} />
      <ProposalCell
        imageHash={imageHash}
        proposal={image?.proposal}
      />
      <td className='number together'>
        {bestNumber && (
          <>
            <BlockToTime value={at.sub(bestNumber)} />
            #{formatNumber(at)}
          </>
        )}
      </td>
      <td className='button'>
        {!image?.proposal && (
          <PreImageButton
            imageHash={imageHash}
            isImminent
          />
        )}
      </td>
      <td className='links media--1000'>
        <LinkExternal
          data={index}
          type='democracyReferendum'
        />
      </td>
    </tr>
  );
}

export default React.memo(DispatchEntry);
