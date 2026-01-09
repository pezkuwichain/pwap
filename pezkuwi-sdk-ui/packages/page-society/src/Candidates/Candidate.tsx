// Copyright 2017-2026 @pezkuwi/app-society authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveSocietyCandidate } from '@pezkuwi/api-derive/types';
import type { Option } from '@pezkuwi/types';
import type { AccountId, SocietyVote } from '@pezkuwi/types/interfaces';
import type { VoteType } from '../types.js';

import React, { useMemo } from 'react';

import { AddressSmall, Table } from '@pezkuwi/react-components';
import { useApi, useCall } from '@pezkuwi/react-hooks';

import Votes from '../Overview/Votes.js';
import BidType from './BidType.js';
import CandidateVoting from './CandidateVoting.js';

interface Props {
  allMembers: string[];
  isMember: boolean;
  ownMembers: string[];
  value: DeriveSocietyCandidate;
}

function Candidate ({ allMembers, isMember, ownMembers, value: { accountId, kind, value } }: Props): React.ReactElement<Props> {
  const { api } = useApi();
  const keys = useMemo(
    () => [allMembers.map((memberId): [AccountId, string] => [accountId, memberId])],
    [accountId, allMembers]
  );
  const votes = useCall<VoteType[]>(api.query.society.votes.multi, keys, {
    transform: (voteOpts: Option<SocietyVote>[]): VoteType[] =>
      voteOpts
        .map((voteOpt, index): [string, Option<SocietyVote>] => [allMembers[index], voteOpt])
        .filter(([, voteOpt]) => voteOpt.isSome)
        .map(([accountId, voteOpt]): VoteType => [accountId, voteOpt.unwrap()])
  });

  return (
    <tr>
      <td className='address all'>
        <AddressSmall value={accountId} />
      </td>
      <td className='start'>
        <BidType value={kind} />
      </td>
      <Table.Column.Balance value={value} />
      <Votes votes={votes} />
      <td className='button'>
        <CandidateVoting
          candidateId={accountId.toString()}
          isMember={isMember}
          ownMembers={ownMembers}
        />
      </td>
    </tr>
  );
}

export default React.memo(Candidate);
