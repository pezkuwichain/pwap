// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { AccountId, Balance, UnappliedSlashOther } from '@pezkuwi/types/interfaces';
import type { BN } from '@pezkuwi/util';

export interface AmountValidateState {
  error: string | null;
  warning: string | null;
}

interface Unapplied {
  others: UnappliedSlashOther[];
  own: Balance;
  payout: Balance;
  reporters: AccountId[];
  validator: AccountId;
}

export interface Slash {
  era: BN;
  slashes: Unapplied[];
}

export type DestinationType = 'Staked' | 'Stash' | 'Controller' | 'Account';
