// Copyright 2017-2026 @pezkuwi/app-bounties authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { AccountId } from '@pezkuwi/types/interfaces';
import type { BN } from '@pezkuwi/util';

export function isClaimable (accounts: string[], beneficiary: AccountId, payoutDue: BN): boolean {
  return payoutDue.ltn(0) && accounts.includes(beneficiary.toString());
}
