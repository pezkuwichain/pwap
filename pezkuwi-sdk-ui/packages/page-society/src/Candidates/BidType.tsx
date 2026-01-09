// Copyright 2017-2026 @pezkuwi/app-society authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { PezpalletSocietyBidKind } from '@pezkuwi/types/lookup';

import React, { useMemo } from 'react';

import { AddressSmall, styled } from '@pezkuwi/react-components';

interface Props {
  className?: string;
  value?: PezpalletSocietyBidKind;
}

function BidType ({ className, value }: Props): React.ReactElement<Props> {
  const vouchId = useMemo(
    () => value?.isVouch
      ? value.asVouch[0]
      : null,
    [value]
  );

  return (
    <StyledDiv className={className}>
      <div>{value?.type}</div>
      {vouchId && <AddressSmall value={vouchId} />}
    </StyledDiv>
  );
}

const StyledDiv = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: no-wrap;

  > div {
    flex: 0;

    &:first-child {
      padding-right: 1.5rem;
    }
  }
`;

export default React.memo(BidType);
