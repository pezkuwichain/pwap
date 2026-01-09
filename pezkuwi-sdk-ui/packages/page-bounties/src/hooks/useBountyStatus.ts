// Copyright 2017-2026 @pezkuwi/app-bounties authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { PezpalletBountiesBountyStatus } from '@pezkuwi/types/lookup';
import type { BountyStatusType } from '../types.js';

import { useCallback } from 'react';

import { createNamedHook } from '@pezkuwi/react-hooks';

import { getBountyStatus } from '../helpers/index.js';

function useBountyStatusImpl (status: PezpalletBountiesBountyStatus): BountyStatusType {
  const updateStatus = useCallback(() => getBountyStatus(status), [status]);

  return updateStatus();
}

export const useBountyStatus = createNamedHook('useBountyStatus', useBountyStatusImpl);
