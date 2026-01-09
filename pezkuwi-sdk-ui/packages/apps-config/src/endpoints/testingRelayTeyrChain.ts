// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { EndpointOption } from './types.js';

import { chainsCoretimeKusamaSVG, chainsPeoplePolkadotSVG, chainsRococoSVG } from '../ui/logos/chains/index.js';
import { nodesAssetHubSVG, nodesBridgeHubSVG, nodesCollectivesSVG } from '../ui/logos/nodes/index.js';

import { PASEO_GENESIS } from '../api/constants.js';
import { getTeleports } from './util.js';

// The available endpoints that will show in the dropdown.
// Only TeyrChain (Pezkuwi parachain test) ecosystem chains are included.
//
// IMPORTANT: Alphabetical based on text
export const testParasTeyrChain: Omit<EndpointOption, 'teleport'>[] = [
  // TeyrChain ecosystem only - no 3rd party parachains
];

export const testParasTeyrChainCommon: EndpointOption[] = [
  {
    info: 'TeyrChainAssetHub',
    isPeopleForIdentity: true,
    paraId: 1000,
    providers: {
      Dwellir: 'wss://asset-hub-paseo-rpc.n.dwellir.com',
      IBP1: 'wss://sys.ibp.network/asset-hub-paseo',
      IBP2: 'wss://asset-hub-paseo.dotters.network',
      StakeWorld: 'wss://pas-rpc.stakeworld.io/assethub',
      TurboFlakes: 'wss://sys.turboflakes.io/asset-hub-paseo'
    },
    relayName: 'teyrchain',
    teleport: [-1, 1002, 1111],
    text: 'Asset Hub',
    ui: {
      color: '#77bb77',
      logo: nodesAssetHubSVG
    }
  },
  {
    info: 'TeyrChainBridgeHub',
    isPeopleForIdentity: true,
    paraId: 1002,
    providers: {
      IBP1: 'wss://sys.ibp.network/bridgehub-paseo',
      IBP2: 'wss://bridge-hub-paseo.dotters.network'
    },
    relayName: 'teyrchain',
    teleport: [-1, 1000],
    text: 'Bridge Hub',
    ui: {
      color: '#AAADD7',
      logo: nodesBridgeHubSVG
    }
  },
  {
    info: 'TeyrChainCollectives',
    isPeopleForIdentity: true,
    paraId: 1001,
    providers: {
      IBP1: 'wss://collectives-paseo.rpc.amforc.com',
      IBP2: 'wss://collectives-paseo.dotters.network'
    },
    relayName: 'teyrchain',
    teleport: [-1, 1000],
    text: 'Collectives',
    ui: {
      color: '#e6777a',
      logo: nodesCollectivesSVG
    }
  },
  {
    info: 'TeyrChainCoretime',
    isPeopleForIdentity: true,
    paraId: 1005,
    providers: {
      IBP1: 'wss://sys.ibp.network/coretime-paseo',
      IBP2: 'wss://coretime-paseo.dotters.network'
    },
    relayName: 'teyrchain',
    teleport: [-1],
    text: 'Coretime',
    ui: {
      color: '#113911',
      logo: chainsCoretimeKusamaSVG
    }
  },
  {
    info: 'TeyrChainContractsHub',
    isPeopleForIdentity: true,
    paraId: 1111,
    providers: {
      IBP1: 'wss://passet-hub-paseo.ibp.network',
      IBP2: 'wss://passet-hub-paseo.dotters.network',
      Parity: 'wss://testnet-passet-hub.polkadot.io'
    },
    relayName: 'teyrchain',
    teleport: [-1, 1000],
    text: 'Contracts Hub',
    ui: {
      color: '#77bb77',
      logo: nodesAssetHubSVG
    }
  },
  {
    info: 'TeyrChainPeople',
    isPeople: true,
    isPeopleForIdentity: false,
    paraId: 1004,
    providers: {
      Amforc: 'wss://people-paseo.rpc.amforc.com',
      IBP1: 'wss://sys.ibp.network/people-paseo',
      IBP2: 'wss://people-paseo.dotters.network'
    },
    relayName: 'teyrchain',
    teleport: [-1],
    text: 'People',
    ui: {
      color: '#e84366',
      logo: chainsPeoplePolkadotSVG
    }
  },
  {
    info: 'TeyrChainPeopleLite',
    isPeople: true,
    isPeopleForIdentity: false,
    paraId: 1044,
    providers: {
      Parity: 'wss://paseo-people-next-rpc.polkadot.io'
    },
    relayName: 'teyrchain',
    teleport: [-1],
    text: 'People Lite',
    ui: {
      color: '#e84366',
      logo: chainsPeoplePolkadotSVG
    }
  }
];

export const testRelayTeyrChain: EndpointOption = {
  dnslink: 'teyrchain',
  genesisHash: PASEO_GENESIS,
  info: 'teyrchain',
  isPeopleForIdentity: true,
  isRelay: true,
  linked: [
    ...testParasTeyrChainCommon,
    ...testParasTeyrChain
  ],
  providers: {
    Amforc: 'wss://paseo.rpc.amforc.com',
    Dwellir: 'wss://paseo-rpc.n.dwellir.com',
    IBP1: 'wss://rpc.ibp.network/paseo',
    IBP2: 'wss://paseo.dotters.network',
    StakeWorld: 'wss://pas-rpc.stakeworld.io'
  },
  teleport: getTeleports(testParasTeyrChainCommon),
  text: 'TeyrChain Relay',
  ui: {
    color: '#38393F',
    identityIcon: 'pezkuwi',
    logo: chainsRococoSVG
  }
};
