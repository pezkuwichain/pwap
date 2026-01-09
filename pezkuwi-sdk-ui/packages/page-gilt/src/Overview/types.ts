// Copyright 2017-2026 @pezkuwi/app-gilt authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ActiveGiltsTotal, BalanceOf } from '@pezkuwi/types/interfaces';
import type { BN } from '@pezkuwi/util';

export interface QueueTotal {
  balance: BalanceOf;
  index: number;
  numItems: BN;
}

export interface GiltInfo {
  activeIndex?: BN | null;
  activeTotal?: ActiveGiltsTotal;
  queueTotals?: QueueTotal[];
}
