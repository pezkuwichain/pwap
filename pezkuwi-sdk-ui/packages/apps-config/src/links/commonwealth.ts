// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { BN } from '@pezkuwi/util';
import type { ExternalDef } from './types.js';

import { externalCommonwealthPNG } from '../ui/logos/external/index.js';

const HASH_PATHS = ['proposal/councilmotion'];

export const Commonwealth: ExternalDef = {
  chains: {
    Edgeware: 'edgeware',
    Kulupu: 'kulupu',
    Dicle: 'dicle',
    'Dicle CC3': 'dicle'
  },
  create: (chain: string, path: string, data: BN | number | string, hash?: string): string =>
    `https://commonwealth.im/${chain}/${path}/${HASH_PATHS.includes(path) ? (hash || '') : data.toString()}`,
  homepage: 'https://commonwealth.im/',
  isActive: true,
  paths: {
    council: 'proposal/councilmotion',
    democracyProposal: 'proposal/democracyproposal',
    democracyReferendum: 'proposal/referendum',
    treasury: 'proposal/treasuryproposal'
  },
  ui: {
    logo: externalCommonwealthPNG
  }
};
