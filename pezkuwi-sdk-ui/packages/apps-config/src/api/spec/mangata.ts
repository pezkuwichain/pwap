// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

// structs need to be in order
/* eslint-disable sort-keys */

import type { Observable } from 'rxjs';
import type { ApiInterfaceRx } from '@pezkuwi/api/types';
import type { DeriveBalancesAll } from '@pezkuwi/api-derive/types';
import type { Balance } from '@pezkuwi/types/interfaces';
// PezframeSystemAccountInfo not needed for external chain
import type { OverrideBundleDefinition } from '@pezkuwi/types/types';

import { mangataTypesBundleForPolkadotApps } from '@mangata-finance/type-definitions';
import { combineLatest, map } from 'rxjs';

import { memo } from '@pezkuwi/api-derive/util';
import { TypeRegistry, U128 } from '@pezkuwi/types';
import { BN } from '@pezkuwi/util';

function balanceOf (number: number | string): U128 {
  return new U128(new TypeRegistry(), number);
}

function defaultAccountBalance (): DeriveBalancesAll {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return {
    accountNonce: new BN(1),
    additional: [],
    availableBalance: balanceOf(0),
    freeBalance: balanceOf(0),
    lockedBalance: balanceOf(0),
    lockedBreakdown: [],
    namedReserves: [],
    reservedBalance: balanceOf(0),
    vestingLocked: balanceOf(0)
  } as any;
}

interface OrmlAccountData {
  free: Balance,
  reserved: Balance,
  frozen: Balance,
}

export function getBalance (
  instanceId: string,
  api: ApiInterfaceRx
): () => Observable<DeriveBalancesAll> {
  return memo(
    instanceId,
    (account: string): Observable<DeriveBalancesAll> =>
      combineLatest<[any, any]>([api.query.tokens.accounts(account, 0), api.query.system.account(account)]).pipe(
        map(([data, systemAccount]: [OrmlAccountData, any]): DeriveBalancesAll => {
          return {
            ...defaultAccountBalance(),
            accountId: api.registry.createType('AccountId', account),
            accountNonce: systemAccount.nonce,
            availableBalance: api.registry.createType('Balance', data.free.sub(data.frozen)),
            freeBalance: data.free,
            lockedBalance: data.frozen,
            reservedBalance: data.reserved
          };
        })
      )
  );
}

const definitions = {
  derives: {
    balances: {
      account: getBalance,
      all: getBalance
    }
  },
  ...mangataTypesBundleForPolkadotApps
} as OverrideBundleDefinition;

export default definitions;
