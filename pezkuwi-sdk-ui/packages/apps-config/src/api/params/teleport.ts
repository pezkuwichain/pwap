// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ApiPromise } from '@pezkuwi/api';

import { KUSAMA_GENESIS } from '../constants.js';

// 4 * BaseXcmWeight on Dicle
const KUSAMA_WEIGHT = 4 * 1_000_000_000;

const DEFAULT_WEIGHT = KUSAMA_WEIGHT;

const KNOWN_WEIGHTS: Record<string, number> = {
  [KUSAMA_GENESIS]: KUSAMA_WEIGHT
};

export function getTeleportWeight (api: ApiPromise): number {
  return KNOWN_WEIGHTS[api.genesisHash.toHex()] || DEFAULT_WEIGHT;
}
