// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { StakerState } from '@pezkuwi/react-hooks/types';

import { useMemo } from 'react';

import { createNamedHook } from '@pezkuwi/react-hooks';

function useOwnNominatorsImpl (ownStashes?: StakerState[]): StakerState[] | undefined {
  return useMemo(
    () => ownStashes?.filter(({ isOwnController, isStashValidating }) =>
      isOwnController &&
      !isStashValidating
    ),
    [ownStashes]
  );
}

export default createNamedHook('useOwnNominators', useOwnNominatorsImpl);
