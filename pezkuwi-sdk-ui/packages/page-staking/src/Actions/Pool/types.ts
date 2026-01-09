// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { PezpalletNominationPoolsPoolMember } from '@pezkuwi/types/lookup';
import type { BN } from '@pezkuwi/util';

export interface AccountInfo {
  claimable: BN;
  member: PezpalletNominationPoolsPoolMember;
}
