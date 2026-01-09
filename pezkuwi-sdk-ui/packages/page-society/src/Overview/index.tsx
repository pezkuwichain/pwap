// Copyright 2017-2026 @pezkuwi/app-society authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveSociety } from '@pezkuwi/api-derive/types';
import type { BN } from '@pezkuwi/util';
import type { MapMember } from '../types.js';

import React from 'react';

import { styled } from '@pezkuwi/react-components';

import Defender from './Defender.js';
import Members from './Members.js';
import Summary from './Summary.js';

interface Props {
  className?: string;
  info?: DeriveSociety;
  isMember: boolean;
  mapMembers?: MapMember[];
  ownMembers: string[];
  payoutTotal?: BN;
}

function Overview ({ className, info, isMember, mapMembers, ownMembers, payoutTotal }: Props): React.ReactElement<Props> {
  return (
    <StyledDiv className={className}>
      <Summary
        info={info}
        payoutTotal={payoutTotal}
      />
      <Defender
        info={info}
        isMember={isMember}
        ownMembers={ownMembers}
      />
      <Members mapMembers={mapMembers} />
    </StyledDiv>
  );
}

const StyledDiv = styled.div`
  .overviewSection {
    margin-bottom: 1.5rem;
  }
`;

export default React.memo(Overview);
