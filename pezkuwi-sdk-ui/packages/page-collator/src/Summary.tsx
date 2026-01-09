// Copyright 2017-2026 @pezkuwi/app-collator authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { BN } from '@pezkuwi/util';

import React from 'react';

import { CardSummary, SummaryBox } from '@pezkuwi/react-components';
import { useApi, useCall } from '@pezkuwi/react-hooks';
import { formatNumber } from '@pezkuwi/util';

import { useTranslation } from './translate.js';

interface Props {
  className?: string;
}

function Summary ({ className }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const { api } = useApi();
  const desiredCandidates = useCall<BN>(api.query.collatorSelection.desiredCandidates);

  return (
    <SummaryBox className={className}>
      <section>
        {desiredCandidates && (
          <CardSummary label={t('desired')}>
            {formatNumber(desiredCandidates)}
          </CardSummary>
        )}
      </section>
    </SummaryBox>
  );
}

export default React.memo(Summary);
