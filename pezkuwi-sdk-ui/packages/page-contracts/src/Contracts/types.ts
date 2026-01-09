// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { AbiMessage, ContractCallOutcome } from '@pezkuwi/api-contract/types';

export interface CallResult extends ContractCallOutcome {
  from: string;
  message: AbiMessage;
  params: unknown[];
  when: Date;
}

export interface ContractLink {
  blockHash: string;
  blockNumber: string;
  contractId: string;
}
