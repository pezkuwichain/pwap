// Copyright 2017-2026 @pezkuwi/app-alliance authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { PezpalletAllianceCid, PezpalletAllianceMemberRole } from '@pezkuwi/types/lookup';
import type { BN } from '@pezkuwi/util';

export interface Cid {
  cid: PezpalletAllianceCid;
  ipfs: string | null;
  key: string;
}

export interface Member {
  accountId: string;
  // Founder here is deprecated
  role: PezpalletAllianceMemberRole['type'] | 'Founder';
}

export interface MemberInfo {
  accountId: string;
  deposit?: BN | null;
  isRetiringAt?: BN | null;
  isUpForKicking?: boolean;
}

export interface Rule {
  cid: Cid | null;
  hasRule: boolean;
}

export interface Unscrupulous {
  accounts: string[];
  websites: string[];
}
