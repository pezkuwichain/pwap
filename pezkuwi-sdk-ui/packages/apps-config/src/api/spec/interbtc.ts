// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */

import type { Observable } from 'rxjs';
import type { ApiInterfaceRx } from '@pezkuwi/api/types';
import type { DeriveBalancesAll } from '@pezkuwi/api-derive/types';
import type { Balance } from '@pezkuwi/types/interfaces';
// PezframeSystemAccountInfo not needed for external chain
import type { OverrideBundleDefinition } from '@pezkuwi/types/types';

import interbtc from '@interlay/interbtc-types';
import { combineLatest, map } from 'rxjs';

import { memo } from '@pezkuwi/api-derive/util';
import { TypeRegistry, U128 } from '@pezkuwi/types';
import { BN, formatBalance } from '@pezkuwi/util';

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
    reservedBalance: balanceOf(0)
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
  const nativeToken = api.registry.chainTokens[0] || formatBalance.getDefaults().unit;

  return memo(
    instanceId,
    (account: string): Observable<DeriveBalancesAll> =>
      combineLatest<[any, any]>([api.query.tokens.accounts(account, { Token: nativeToken }), api.query.system.account(account)]).pipe(
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

const definitions: OverrideBundleDefinition = {
  derives: {
    balances: {
      account: getBalance,
      all: getBalance
    }
  },

  ...interbtc
} as any;

export default definitions;
