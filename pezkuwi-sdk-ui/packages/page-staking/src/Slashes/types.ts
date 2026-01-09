// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { UnappliedSlash } from '@pezkuwi/types/interfaces';
import type { BN } from '@pezkuwi/util';

export interface Slash {
  era: BN;
  isMine: boolean;
  slash: UnappliedSlash;
  total: BN;
  totalOther: BN;
}

export interface SlashEra {
  era: BN;
  nominators: string[];
  payout: BN;
  reporters: string[];
  slashes: Slash[];
  validators: string[];
  total: BN;
}
