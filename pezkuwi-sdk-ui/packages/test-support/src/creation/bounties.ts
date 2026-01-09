// Copyright 2017-2026 @pezkuwi/test-support authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ApiPromise } from '@pezkuwi/api';
import type { BountyIndex } from '@pezkuwi/types/interfaces';
import type { PezpalletBountiesBounty, PezpalletBountiesBountyStatus } from '@pezkuwi/types/lookup';
import type { Registry } from '@pezkuwi/types/types';

import { balanceOf } from './balance.js';

export class BountyFactory {
  readonly #api: ApiPromise;
  readonly #registry: Registry;

  constructor (api: ApiPromise) {
    this.#api = api;
    this.#registry = this.#api.registry;
  }

  public aBountyIndex = (index = 0): BountyIndex =>
    this.#registry.createType('BountyIndex', index);

  public defaultBounty = (): PezpalletBountiesBounty =>
    this.#registry.createType<PezpalletBountiesBounty>('Bounty');

  public aBountyStatus = (status: string): PezpalletBountiesBountyStatus =>
    this.#registry.createType('PezpalletBountiesBountyStatus', status);

  public bountyStatusWith = ({ curator = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', status = 'Active', updateDue = 100000 } = {}): PezpalletBountiesBountyStatus => {
    if (status === 'Active') {
      return this.#registry.createType('PezpalletBountiesBountyStatus', { active: { curator, updateDue }, status });
    }

    if (status === 'CuratorProposed') {
      return this.#registry.createType('PezpalletBountiesBountyStatus', { curatorProposed: { curator }, status });
    }

    throw new Error('Unsupported status');
  };

  public bountyWith = ({ status = 'Proposed', value = 1 } = {}): PezpalletBountiesBounty =>
    this.aBounty({ status: this.aBountyStatus(status), value: balanceOf(value) });

  public aBounty = ({ fee = balanceOf(10), status = this.aBountyStatus('Proposed'), value = balanceOf(500) }: Partial<PezpalletBountiesBounty> = {}): PezpalletBountiesBounty =>
    this.#registry.createType<PezpalletBountiesBounty>('Bounty', { fee, status, value });
}
