// Copyright 2017-2026 @pezkuwi/app-bounties authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveCollectiveProposal } from '@pezkuwi/api-derive/types';
import type { Balance, BountyIndex } from '@pezkuwi/types/interfaces';
import type { PezpalletBountiesBountyStatus } from '@pezkuwi/types/lookup';
import type { BN } from '@pezkuwi/util';

import React, { useMemo } from 'react';

import { useBountyStatus } from '../hooks/index.js';
import AwardBounty from './AwardBounty.js';
import BountyAcceptCurator from './BountyAcceptCurator.js';
import BountyClaimAction from './BountyClaimAction.js';
import BountyInitiateVoting from './BountyInitiateVoting.js';
import ProposeCuratorAction from './ProposeCuratorAction.js';

interface Props {
  bestNumber: BN;
  description: string;
  fee?: BN;
  index: BountyIndex;
  proposals?: DeriveCollectiveProposal[];
  status: PezpalletBountiesBountyStatus;
  value: Balance;
}

export function BountyActions ({ bestNumber, description, fee, index, proposals, status, value }: Props): React.ReactElement<Props> {
  const { beneficiary, curator, unlockAt } = useBountyStatus(status);
  const blocksUntilPayout = useMemo(() => unlockAt?.sub(bestNumber), [bestNumber, unlockAt]);

  return (
    <>
      {status.isProposed &&
        <BountyInitiateVoting
          description={description}
          index={index}
          proposals={proposals}
        />
      }
      {status.isFunded &&
        <ProposeCuratorAction
          description={description}
          index={index}
          proposals={proposals}
          value={value}
        />
      }
      {status.isCuratorProposed && curator && fee &&
        <BountyAcceptCurator
          curatorId={curator}
          description={description}
          fee={fee}
          index={index}
        />
      }
      {status.isPendingPayout && beneficiary && blocksUntilPayout &&
        <BountyClaimAction
          beneficiaryId={beneficiary}
          index={index}
          payoutDue={blocksUntilPayout}
        />
      }
      {status.isActive && curator &&
        <AwardBounty
          curatorId={curator}
          description={description}
          index={index}
        />
      }
    </>
  );
}
