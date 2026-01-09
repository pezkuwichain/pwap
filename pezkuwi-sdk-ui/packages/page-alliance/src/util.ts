// Copyright 2017-2026 @pezkuwi/app-alliance authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { PezpalletAllianceCid } from '@pezkuwi/types/lookup';
import type { Registry } from '@pezkuwi/types/types';
import type { Cid } from './types.js';

import { fromIpfsCid, toIpfsCid } from '@pezkuwi/react-params/util';

export function createPalletCid (registry: Registry, cid: string): PezpalletAllianceCid | null {
  const expanded = fromIpfsCid(cid);

  return expanded && registry.createType('PezpalletAllianceCid', expanded);
}

export function createCid (cid: PezpalletAllianceCid): Cid {
  return {
    cid,
    ipfs: toIpfsCid(cid),
    key: cid.toHex()
  };
}
