// Copyright 2017-2026 @pezkuwi/app-parachains authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Option } from '@pezkuwi/types';
import type { TeyrchainProposal, ParaId } from '@pezkuwi/types/interfaces';
import type { ProposalExt, ScheduledProposals } from '../types.js';

import { useMemo } from 'react';

import { createNamedHook, useApi, useCall } from '@pezkuwi/react-hooks';

function useProposalImpl (id: ParaId, approvedIds: ParaId[], scheduled: ScheduledProposals[]): ProposalExt {
  const { api } = useApi();
  const opt = useCall<Option<TeyrchainProposal>>(api.query.proposeTeyrChain.proposals, [id]);

  return useMemo(
    (): ProposalExt => ({
      id,
      isApproved: approvedIds.some((a) => a.eq(id)),
      isScheduled: scheduled.some(({ scheduledIds }) => scheduledIds.some((s) => s.eq(id))),
      proposal: opt && opt.isSome
        ? opt.unwrap()
        : undefined
    }),
    [approvedIds, id, opt, scheduled]
  );
}

export default createNamedHook('useProposal', useProposalImpl);
