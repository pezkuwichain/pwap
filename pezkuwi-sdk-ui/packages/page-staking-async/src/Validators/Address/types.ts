// Copyright 2017-2026 @pezkuwi/app-staking-async authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Balance } from '@pezkuwi/types/interfaces';

export interface NominatorValue {
  nominatorId: string;
  value: Balance;
}
