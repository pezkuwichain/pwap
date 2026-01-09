// Copyright 2017-2026 @pezkuwi/test-supports authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveBalancesAll, DeriveStakingAccount } from '@pezkuwi/api-derive/types';
import type { UseAccountInfo } from '@pezkuwi/react-hooks/types';
import type { KeyringJson$Meta } from '@pezkuwi/ui-keyring/types';

export type Override<T> = {
  [P in keyof T]?: T[P];
}

export interface AccountOverrides {
  meta?: Override<KeyringJson$Meta>;
  balance?: Override<DeriveBalancesAll>;
  staking?: Override<DeriveStakingAccount>;
  info?: Override<UseAccountInfo>;
}

export interface WaitOptions { interval?: number, timeout?: number }
