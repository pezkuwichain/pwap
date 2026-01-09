// Copyright 2017-2026 @pezkuwi/app-nfts authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React from 'react';

import { CardSummary, SummaryBox } from '@pezkuwi/react-components';
import { formatNumber } from '@pezkuwi/util';

import { useTranslation } from '../translate.js';

interface Props {
  className?: string;
  numCollections?: number;
}

function Summary ({ className, numCollections }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();

  return (
    <SummaryBox className={className}>
      <CardSummary label={t('collections')}>
        {formatNumber(numCollections)}
      </CardSummary>
    </SummaryBox>
  );
}

export default React.memo(Summary);
