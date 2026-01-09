// Copyright 2017-2026 @pezkuwi/app-collator authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { BN } from '@pezkuwi/util';

export interface Collator {
  accountId: string;
  deposit?: BN;
  isInvulnerable: boolean;
  lastBlock?: BN;
}
