// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

// structs need to be in order
/* eslint-disable sort-keys */

import type { Observable } from 'rxjs';
import type { ApiInterfaceRx } from '@pezkuwi/api/types';
import type { Struct, u64 } from '@pezkuwi/types';
import type { AccountId32, Digest, Header } from '@pezkuwi/types/interfaces';
import type { OverrideBundleDefinition, Registry } from '@pezkuwi/types/types';

import { combineLatest, map } from 'rxjs';

import { bestNumber, bestNumberFinalized, bestNumberLag, getBlock, subscribeNewBlocks } from '@pezkuwi/api-derive/chain';
import { memo } from '@pezkuwi/api-derive/util';

interface HeaderExtended extends Header {
  readonly author: AccountId32 | undefined;
}

interface Solution extends Struct {
  readonly public_key: AccountId32;
  readonly reward_address: AccountId32;
}

interface SubPreDigest extends Struct {
  readonly slot: u64;
  readonly solution: Solution;
}

function extractAuthor (
  digest: Digest,
  api: ApiInterfaceRx
): AccountId32 | undefined {
  const preRuntimes = digest.logs.filter(
    (log) => log.isPreRuntime && log.asPreRuntime[0].toString() === 'SUB_'
  );

  if (!preRuntimes || preRuntimes.length === 0) {
    return undefined;
  }

  const { solution }: SubPreDigest = api.registry.createType('SubPreDigest', preRuntimes[0].asPreRuntime[1]);

  return solution.reward_address;
}

function createHeaderExtended (
  registry: Registry,
  header: Header,
  api: ApiInterfaceRx
): HeaderExtended {
  const HeaderBase = registry.createClass('Header');

  class SubHeaderExtended extends HeaderBase {
    readonly #author?: AccountId32;

    constructor (registry: Registry, header: Header, api: ApiInterfaceRx) {
      super(registry, header);
      this.#author = extractAuthor((this as any).digest, api);
      (this as any).createdAtHash = header?.createdAtHash;
    }

    public get author (): AccountId32 | undefined {
      return this.#author;
    }
  }

  return new SubHeaderExtended(registry, header, api) as unknown as HeaderExtended;
}

function subscribeNewHeads (
  instanceId: string,
  api: ApiInterfaceRx
): () => Observable<HeaderExtended> {
  return memo(
    instanceId,
    (): Observable<HeaderExtended> =>
      combineLatest([api.rpc.chain.subscribeNewHeads()]).pipe(
        map(([header]): HeaderExtended => {
          return createHeaderExtended(header.registry, header, api);
        })
      )
  );
}

function getHeader (
  instanceId: string,
  api: ApiInterfaceRx
): () => Observable<HeaderExtended> {
  return memo(instanceId, (blockHash: Uint8Array | string): Observable<HeaderExtended | undefined> =>
    combineLatest([api.rpc.chain.getHeader(blockHash)]).pipe(
      map(([header]): HeaderExtended => {
        return createHeaderExtended(header.registry, header, api);
      })
    )
  );
}

const definitions: OverrideBundleDefinition = {
  derives: {
    chain: {
      bestNumber,
      bestNumberFinalized,
      bestNumberLag,
      getBlock,
      getHeader,
      subscribeNewBlocks,
      subscribeNewHeads
    }
  },
  types: [
    {
      minmax: [0, undefined],
      types: {
        Solution: {
          public_key: 'AccountId32',
          reward_address: 'AccountId32'
        },
        SubPreDigest: {
          slot: 'u64',
          solution: 'Solution'
        }
      }
    }
  ]
};

export default definitions;
