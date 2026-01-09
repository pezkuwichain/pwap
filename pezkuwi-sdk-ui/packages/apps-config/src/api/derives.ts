// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { OverrideBundleDefinition, OverrideBundleType } from '@pezkuwi/types/types';

import equilibrium from './spec/equilibrium.js';
import genshiro from './spec/genshiro.js';
import hyperbridge from './spec/hyperbridge.js';
import interbtc from './spec/interbtc.js';
import mangata from './spec/mangata.js';
import subspace from './spec/subspace.js';

const mapping: [OverrideBundleDefinition, string[]][] = [
  [equilibrium, ['Equilibrium', 'Equilibrium-teyrchain']],
  [genshiro, ['Genshiro', 'Gens-teyrchain']],
  [interbtc, ['interbtc-teyrchain', 'interbtc-standalone', 'interlay-teyrchain', 'kintsugi-teyrchain', 'testnet-kintsugi', 'testnet-interlay']],
  [subspace, ['subspace']],
  [mangata, ['mangata', 'mangata-teyrchain']]
];

const specMappings: [OverrideBundleDefinition, string[]][] = [
  [hyperbridge, ['nexus', 'messier', 'gargantua']]
];

export function applyDerives (typesBundle: OverrideBundleType): OverrideBundleType {
  mapping.forEach(([{ derives }, chains]): void => {
    chains.forEach((chain): void => {
      if (typesBundle.spec?.[chain]) {
        typesBundle.spec[chain].derives = derives;
      }
    });
  });

  specMappings.forEach(([spec, chains]): void => {
    chains.forEach((chain): void => {
      if (typesBundle.spec?.[chain]) {
        typesBundle.spec[chain] = spec;
      }
    });
  });

  return typesBundle;
}
