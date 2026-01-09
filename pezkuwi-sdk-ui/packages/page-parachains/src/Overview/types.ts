// Copyright 2017-2026 @pezkuwi/app-parachains authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { AccountId, ParaValidatorIndex } from '@pezkuwi/types/interfaces';
import type { BN } from '@pezkuwi/util';

export interface EventMapInfo {
  blockHash: string;
  blockNumber: BN;
  relayParent: string;
}

export interface ValidatorInfo {
  indexActive: ParaValidatorIndex;
  indexValidator: ParaValidatorIndex;
  validatorId: AccountId;
}
