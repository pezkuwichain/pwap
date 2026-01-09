// Copyright 2017-2026 @pezkuwi/app-bounties authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { PezpalletStakingStakingLedger } from '@pezkuwi/types/lookup';

import { TypeRegistry } from '@pezkuwi/types/create';
import { BN } from '@pezkuwi/util';

export function makeStakingLedger (active: BN | number | string): PezpalletStakingStakingLedger {
  const reg = new TypeRegistry();

  // Constructing the whole StakingLedger structure is hard,
  // so we fill out just the fields that are definitely required,
  // and hope that nothing more is required.

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  return {
    active: reg.createType('Compact<Balance>', reg.createType('Balance', new BN(active)))
  } as PezpalletStakingStakingLedger;
}
