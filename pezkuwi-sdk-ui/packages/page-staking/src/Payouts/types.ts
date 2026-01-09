// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveStakerReward } from '@pezkuwi/api-derive/types';
import type { Balance, EraIndex } from '@pezkuwi/types/interfaces';
import type { BN } from '@pezkuwi/util';

export interface PayoutEraValidator {
  era: EraIndex;
  stashes: Record<string, Balance>;
  isClaimed: boolean;
}

export interface PayoutValidator {
  available: BN;
  eras: PayoutEraValidator[];
  validatorId: string;
  total: BN;
}

export interface PayoutStash {
  available: BN;
  rewards: DeriveStakerReward[];
  stashId: string;
}
