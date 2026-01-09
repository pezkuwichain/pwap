// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { EndpointOption } from './types.js';

import { WESTEND_GENESIS } from '../api/constants.js';
import { chainsPeoplePolkadotSVG } from '../ui/logos/chains/index.js';
import { nodesAssetHubSVG, nodesBridgeHubSVG, nodesWestendColourSVG } from '../ui/logos/nodes/index.js';
import { getTeleports } from './util.js';

// The available endpoints that will show in the dropdown.
// Only Zagros (Pezkuwi test) ecosystem chains are included.
//
// IMPORTANT: Alphabetical based on text
export const testParasZagros: Omit<EndpointOption, 'teleport'>[] = [
  // Zagros ecosystem only - no 3rd party parachains
  {
    info: 'zagrosTestPenpal',
    isPeopleForIdentity: true,
    paraId: 2042,
    providers: {
      Parity: 'wss://westend-penpal-rpc.polkadot.io'
    },
    relayName: 'zagros',
    text: 'Penpal',
    ui: {
      color: '#964b00'
    }
  }
];

export const testParasZagrosCommon: EndpointOption[] = [
  {
    info: 'ZagrosAssetHub',
    isPeopleForIdentity: true,
    paraId: 1000,
    providers: {
      Dwellir: 'wss://asset-hub-westend-rpc.n.dwellir.com',
      'Dwellir Tunisia': 'wss://westmint-rpc-tn.dwellir.com',
      Parity: 'wss://westend-asset-hub-rpc.polkadot.io'
    },
    relayName: 'zagros',
    teleport: [-1, 1002, 1001, 1005, 1004],
    text: 'Asset Hub',
    ui: {
      color: '#77bb77',
      logo: nodesAssetHubSVG
    }
  },
  {
    info: 'zagrosBridgeHub',
    isPeopleForIdentity: true,
    paraId: 1002,
    providers: {
      Dwellir: 'wss://bridge-hub-westend-rpc.n.dwellir.com',
      'Dwellir Tunisia': 'wss://westend-bridge-hub-rpc-tn.dwellir.com',
      Parity: 'wss://westend-bridge-hub-rpc.polkadot.io'
    },
    relayName: 'zagros',
    teleport: [-1, 1000],
    text: 'Bridge Hub',
    ui: {
      logo: nodesBridgeHubSVG
    }
  },
  {
    info: 'zagrosCollectives',
    isPeopleForIdentity: true,
    paraId: 1001,
    providers: {
      Dwellir: 'wss://collectives-westend-rpc.n.dwellir.com',
      'Dwellir Tunisia': 'wss://westend-collectives-rpc-tn.dwellir.com',
      Parity: 'wss://westend-collectives-rpc.polkadot.io'
    },
    relayName: 'zagros',
    teleport: [-1, 1000],
    text: 'Collectives',
    ui: {
      color: '#e6777a',
      logo: 'fa;people-group'
    }
  },
  {
    info: 'zagrosCoretime',
    isPeopleForIdentity: true,
    paraId: 1005,
    providers: {
      Dwellir: 'wss://coretime-westend-rpc.n.dwellir.com',
      Parity: 'wss://westend-coretime-rpc.polkadot.io'
    },
    relayName: 'zagros',
    teleport: [-1, 1000],
    text: 'Coretime',
    ui: {
      color: '#f19135'
    }
  },
  {
    info: 'zagrosPeople',
    isPeople: true,
    isPeopleForIdentity: false,
    paraId: 1004,
    providers: {
      Dwellir: 'wss://people-westend-rpc.n.dwellir.com',
      Parity: 'wss://westend-people-rpc.polkadot.io'
    },
    relayName: 'zagros',
    teleport: [-1, 1000],
    text: 'People',
    ui: {
      color: '#ec03fc',
      logo: chainsPeoplePolkadotSVG
    }
  }
];

export const testRelayZagros: EndpointOption = {
  dnslink: 'zagros',
  genesisHash: WESTEND_GENESIS,
  info: 'zagros',
  isPeopleForIdentity: true,
  isRelay: true,
  linked: [
    ...testParasZagrosCommon,
    ...testParasZagros
  ],
  providers: {
    Dwellir: 'wss://westend-rpc.n.dwellir.com',
    'Dwellir Tunisia': 'wss://westend-rpc-tn.dwellir.com',
    OnFinality: 'wss://westend.api.onfinality.io/public-ws',
    Parity: 'wss://westend-rpc.polkadot.io',
    RadiumBlock: 'wss://westend.public.curie.radiumblock.co/ws',
    'light client': 'light://substrate-connect/westend'
  },
  teleport: getTeleports(testParasZagrosCommon),
  text: 'Zagros Relay',
  ui: {
    color: '#da68a7',
    identityIcon: 'pezkuwi',
    logo: nodesWestendColourSVG
  }
};
