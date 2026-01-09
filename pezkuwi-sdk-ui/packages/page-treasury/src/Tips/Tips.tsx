// Copyright 2017-2026 @pezkuwi/app-treasury authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Option } from '@pezkuwi/types';
import type { OpenTipTo225 } from '@pezkuwi/types/interfaces';
import type { PezpalletTipsOpenTip } from '@pezkuwi/types/lookup';
import type { BN } from '@pezkuwi/util';

import React, { useMemo, useRef, useState } from 'react';

import { styled, Table, Toggle } from '@pezkuwi/react-components';
import { useApi, useBestNumber, useCall } from '@pezkuwi/react-hooks';

import { useTranslation } from '../translate.js';
import Tip from './Tip.js';

interface Props {
  className?: string;
  defaultId: string | null;
  hashes?: string[] | null;
  isMember: boolean;
  members: string[];
  onSelectTip: (hash: string, isSelected: boolean, value: BN) => void,
}

type TipType = [string, PezpalletTipsOpenTip | OpenTipTo225];

const TIP_OPTS = { withParams: true };

function extractTips (tipsWithHashes?: [[string[]], Option<PezpalletTipsOpenTip>[]], inHashes?: string[] | null): TipType[] | undefined {
  if (!tipsWithHashes || !inHashes) {
    return undefined;
  }

  const [[hashes], optTips] = tipsWithHashes;

  return optTips
    .map((opt, index): [string, PezpalletTipsOpenTip | null] => [hashes[index], opt.unwrapOr(null)])
    .filter((val): val is [string, PezpalletTipsOpenTip] => inHashes.includes(val[0]) && !!val[1])
    .sort((a, b) =>
      a[1].closes.isNone
        ? b[1].closes.isNone
          ? 0
          : -1
        : b[1].closes.isSome
          ? b[1].closes.unwrap().cmp(a[1].closes.unwrap())
          : 1
    );
}

function Tips ({ className = '', defaultId, hashes, isMember, members, onSelectTip }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const { api } = useApi();
  const [onlyUntipped, setOnlyUntipped] = useState(false);
  const bestNumber = useBestNumber();
  const tipsWithHashes = useCall<[[string[]], Option<PezpalletTipsOpenTip>[]]>(hashes && (api.query.tips || api.query.treasury).tips.multi, [hashes], TIP_OPTS);

  const tips = useMemo(
    () => extractTips(tipsWithHashes, hashes),
    [hashes, tipsWithHashes]
  );

  const headerRef = useRef<([React.ReactNode?, string?, number?] | false)[]>([
    [t('tips'), 'start'],
    [t('finder'), 'address media--1400'],
    [t('reason'), 'start'],
    [undefined, 'media--1100'],
    [],
    [undefined, 'badge media--1700'],
    [],
    [undefined, 'media--1700']
  ]);

  return (
    <StyledTable
      className={className}
      empty={tips && t('No open tips')}
      filter={isMember && (
        <div className='tipsFilter'>
          <Toggle
            label={t('show only untipped/closing')}
            onChange={setOnlyUntipped}
            value={onlyUntipped}
          />
        </div>
      )}
      header={headerRef.current}
    >
      {tips?.map(([hash, tip]): React.ReactNode => (
        <Tip
          bestNumber={bestNumber}
          defaultId={defaultId}
          hash={hash}
          isMember={isMember}
          key={hash}
          members={members}
          onSelect={onSelectTip}
          onlyUntipped={onlyUntipped}
          tip={tip}
        />
      ))}
    </StyledTable>
  );
}

const StyledTable = styled(Table)`
  .tipsFilter {
    text-align: right;

    .ui--Toggle {
      margin-right: 1rem;
      margin-top: 0.75rem;
    }
  }
`;

export default React.memo(Tips);
