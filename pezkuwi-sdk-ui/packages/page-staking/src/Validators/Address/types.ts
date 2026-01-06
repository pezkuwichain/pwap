// Copyright 2017-2025 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Balance } from '@pezkuwi/types/interfaces';

export interface NominatorValue {
  nominatorId: string;
  value: Balance;
}
