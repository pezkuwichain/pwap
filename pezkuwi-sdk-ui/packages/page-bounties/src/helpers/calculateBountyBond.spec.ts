// Copyright 2017-2026 @pezkuwi/app-bounties authors & contributors
// SPDX-License-Identifier: Apache-2.0

/// <reference types="@pezkuwi/dev-test/globals.d.ts" />

import { TypeRegistry } from '@pezkuwi/types/create';
import { BN } from '@pezkuwi/util';

import { calculateBountyBond } from './calculateBountyBond.js';

describe('Calculate bounty bond', () => {
  it('sums deposit base and deposit for each byte of description', () => {
    const registry = new TypeRegistry();
    const depositBase = registry.createType('BalanceOf', new BN(166666666666));
    const depositPerByte = registry.createType('BalanceOf', new BN(1666666666));

    expect(calculateBountyBond('Dicle network UI Bounty', depositBase, depositPerByte)).toEqual(new BN(206666666650));
  });

  it('handles utf-8 chars', () => {
    const registry = new TypeRegistry();
    const depositBase = registry.createType('BalanceOf', new BN(100));
    const depositPerByte = registry.createType('BalanceOf', new BN(10));

    expect(calculateBountyBond('óy😅€', depositBase, depositPerByte)).toEqual(new BN(200));
  });
});
