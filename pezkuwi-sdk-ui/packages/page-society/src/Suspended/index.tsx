// Copyright 2017-2026 @pezkuwi/app-society authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Option, StorageKey } from '@pezkuwi/types';
import type { AccountId, BalanceOf } from '@pezkuwi/types/interfaces';
import type { PezpalletSocietyBidKind } from '@pezkuwi/types/lookup';
import type { ITuple } from '@pezkuwi/types/types';

import React, { useRef } from 'react';

import { Table } from '@pezkuwi/react-components';
import { useApi, useCall } from '@pezkuwi/react-hooks';

import { useTranslation } from '../translate.js';
import Suspension from './Suspension.js';

interface Props {
  className?: string;
}

interface CandidateSuspend {
  accountId: AccountId;
  balance: BalanceOf;
  bid: PezpalletSocietyBidKind;
}

const OPT_CAN = {
  transform: (entries: [StorageKey<[AccountId]>, Option<ITuple<[BalanceOf, PezpalletSocietyBidKind]>>][]): CandidateSuspend[] =>
    entries
      .filter(([{ args: [accountId] }, opt]) => opt.isSome && accountId)
      .map(([{ args: [accountId] }, opt]) => {
        const [balance, bid] = opt.unwrap();

        return { accountId, balance, bid };
      })
      .sort((a, b) => a.balance.cmp(b.balance))
};

const OPT_ACC = {
  transform: (keys: StorageKey<[AccountId]>[]): AccountId[] =>
    keys
      .map(({ args: [accountId] }) => accountId)
      .filter((a) => !!a)
};

function Suspended ({ className }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const { api } = useApi();
  const candidates = useCall<CandidateSuspend[]>(api.query.society.suspendedCandidates?.entries, undefined, OPT_CAN) ?? [];
  const members = useCall<AccountId[]>(api.query.society.suspendedMembers.keys, undefined, OPT_ACC);

  const headerRef = useRef({
    candidates: [
      [t('candidates'), 'start'],
      [t('bid kind'), 'start'],
      [t('value')]
    ] as [React.ReactNode?, string?, number?][],
    members: [
      [t('members'), 'start', 3]
    ] as [React.ReactNode?, string?, number?][]
  });

  return (
    <div className={className}>
      <Table
        className={className}
        empty={members && t('No suspended members')}
        header={headerRef.current.members}
      >
        {members?.map((accountId): React.ReactNode => (
          <Suspension
            key={accountId.toString()}
            value={accountId}
          />
        ))}
      </Table>
      <Table
        className={className}
        empty={candidates && t('No suspended candidates')}
        header={headerRef.current.candidates}
      >
        {candidates?.map(({ accountId, balance, bid }): React.ReactNode => (
          <Suspension
            balance={balance}
            bid={bid}
            key={accountId.toString()}
            value={accountId}
          />
        ))}
      </Table>
    </div>
  );
}

export default React.memo(Suspended);
