// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveSessionProgress } from '@pezkuwi/api-derive/types';
import type { OwnPool } from '@pezkuwi/app-staking2/Pools/types';
import type { PezpalletStakingUnappliedSlash } from '@pezkuwi/types/lookup';
import type { BN } from '@pezkuwi/util';
import type { SortedTargets } from '../types.js';

import React, { useRef } from 'react';

import { Table } from '@pezkuwi/react-components';
import { useApi, useCall } from '@pezkuwi/react-hooks';

import { useTranslation } from '../translate.js';
import Pool from './Pool/index.js';

interface Props {
  allSlashes: [BN, PezpalletStakingUnappliedSlash[]][];
  className?: string;
  isInElection?: boolean;
  list?: OwnPool[];
  minCommission?: BN;
  targets: SortedTargets;
}

function Pools ({ className, list, targets }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const { api } = useApi();
  const sessionProgress = useCall<DeriveSessionProgress>(api.derive.session.progress);

  const hdrRef = useRef<[React.ReactNode?, string?, number?][]>([
    [t('pools'), 'start', 2],
    [t('account'), 'address'],
    [t('bonded')],
    [t('claimable')],
    [],
    []
  ]);

  return (
    <Table
      className={className}
      empty={list && t('Not participating in any pools. Join a pool first.')}
      header={hdrRef.current}
    >
      {list?.map(({ members, poolId }, count): React.ReactNode => (
        <Pool
          count={count}
          key={poolId.toString()}
          members={members}
          poolId={poolId}
          sessionProgress={sessionProgress}
          targets={targets}
        />
      ))}
    </Table>
  );
}

export default React.memo(Pools);
