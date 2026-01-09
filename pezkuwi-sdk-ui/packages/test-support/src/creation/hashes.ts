// Copyright 2017-2026 @pezkuwi/test-support authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Hash } from '@pezkuwi/types/interfaces';

import { POLKADOT_GENESIS } from '@pezkuwi/apps-config';
import { TypeRegistry } from '@pezkuwi/types/create';

export function aGenesisHash (): Hash {
  return new TypeRegistry().createType('Hash', POLKADOT_GENESIS);
}

export function aHash (): Hash {
  return new TypeRegistry().createType('Hash');
}
