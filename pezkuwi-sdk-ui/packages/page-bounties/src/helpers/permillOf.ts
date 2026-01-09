// Copyright 2017-2026 @pezkuwi/app-bounties authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { BN } from '@pezkuwi/util';

import { BN_MILLION } from '@pezkuwi/util';

export function permillOf (value: BN, perMill: BN): BN {
  return value.mul(perMill).div(BN_MILLION);
}
