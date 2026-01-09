// Copyright 2017-2026 @pezkuwi/app-referenda authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { PezpalletReferendaDeposit } from '@pezkuwi/types/lookup';
import type { Referendum } from '../types.js';

import { Option } from '@pezkuwi/types';

export function unwrapDeposit (value: PezpalletReferendaDeposit | Option<PezpalletReferendaDeposit>): PezpalletReferendaDeposit | null {
  return value instanceof Option
    ? value.unwrapOr(null)
    : value;
}

export function getNumDeciding (referenda?: Referendum[]): number {
  if (!referenda) {
    return 0;
  }

  return referenda.filter(({ info }) =>
    info.isOngoing &&
    info.asOngoing.deciding.isSome
  ).length;
}
