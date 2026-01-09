// Copyright 2017-2026 @pezkuwi/app-nis authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { NisInfo } from './types.js';

import React from 'react';

import { CardSummary, SummaryBox } from '@pezkuwi/react-components';
import { useApi, useBestNumber } from '@pezkuwi/react-hooks';
import { BN_QUINTILL } from '@pezkuwi/util';

import { useTranslation } from '../translate.js';

interface Props {
  className?: string;
  info?: NisInfo;
  isDisabled?: boolean;
}

function Summary ({ className, info }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const { api } = useApi();
  const bestNumber = useBestNumber();

  return (
    <SummaryBox className={className}>
      <section>
        {bestNumber && (
          <CardSummary
            label={t('intake')}
            progress={{
              total: api.consts.nis.intakePeriod,
              value: bestNumber.mod(api.consts.nis.intakePeriod),
              withTime: true
            }}
          />
        )}
      </section>
      <section>
        {info?.summary && (
          <CardSummary
            label={t('proportion')}
            progress={{
              isPercent: true,
              total: BN_QUINTILL,
              value: info.summary.proportionOwed
            }}
          />
        )}
      </section>
    </SummaryBox>
  );
}

export default React.memo(Summary);
