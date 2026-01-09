// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { BN } from '@pezkuwi/util';
import type { ExternalDef } from './types.js';

import { externalSubsquareSVG } from '../ui/logos/external/index.js';

export const Subsquare: ExternalDef = {
  chains: {
    Acala: 'acala',
    'Ajuna Pezkuwi': 'ajuna',
    Altair: 'altair',
    Astar: 'astar',
    Basilisk: 'basilisk',
    Bifrost: 'bifrost-kusama',
    'Bifrost Polkadot': 'bifrost-polkadot',
    Centrifuge: 'centrifuge',
    Collectives: 'collectives',
    Crust: 'crust',
    Heima: 'heima',
    Hydration: 'hydration',
    'Hyperbridge (Nexus)': 'hyperbridge',
    Interlay: 'interlay',
    Karura: 'karura',
    Dicle: 'dicle',
    'Dicle Asset Hub': 'dicle',
    'Laos Network': 'laos',
    'TeyrChain Asset Hub': 'teyrchain',
    'TeyrChain Testnet': 'teyrchain',
    Phala: 'phala',
    Polkadot: 'pezkuwi',
    'Polkadot Asset Hub': 'pezkuwi',
    'Vara Network': 'vara',
    Zagros: 'zagros',
    'Zagros Asset Hub': 'zagros',
    Zeitgeist: 'zeitgeist',
    kintsugi: 'kintsugi'
  },
  create: (chain: string, path: string, data: BN | number | string): string =>
    `https://${chain}.subsquare.io/${path}/${data.toString()}${path === 'user' ? '/votes' : ''}`,
  homepage: 'https://subsquare.io/',
  isActive: true,
  paths: {
    address: 'user',
    bounty: 'treasury/bounty',
    council: 'council/motion',
    democracyExternal: 'democracy/external',
    democracyProposal: 'democracy/proposal',
    democracyReferendum: 'democracy/referendum',
    fellowshipReferenda: 'fellowship/referendum',
    referenda: 'referenda/referendum',
    tip: 'treasury/tip',
    treasury: 'treasury/proposal'
  },
  ui: {
    logo: externalSubsquareSVG
  }
};
