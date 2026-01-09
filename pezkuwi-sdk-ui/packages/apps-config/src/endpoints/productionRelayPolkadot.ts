// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { EndpointOption } from './types.js';

import { POLKADOT_GENESIS } from '../api/constants.js';
import { chainsPeoplePolkadotSVG, chainsPolkadotCircleSVG } from '../ui/logos/chains/index.js';
import { nodesAssetHubSVG, nodesBridgeHubSVG, nodesCollectivesSVG } from '../ui/logos/nodes/index.js';
import { getTeleports } from './util.js';

// The available endpoints that will show in the dropdown.
// Only Pezkuwi ecosystem chains are included.
//
// IMPORTANT: Alphabetical based on text
export const prodParasPolkadot: Omit<EndpointOption, 'teleport'>[] = [
  // Pezkuwi ecosystem only - no 3rd party parachains
];

export const prodParasPolkadotCommon: EndpointOption[] = [
  {
    info: 'PezkuwiAssetHub',
    isPeopleForIdentity: true,
    paraId: 1000,
    providers: {
      Dwellir: 'wss://asset-hub-polkadot-rpc.n.dwellir.com',
      'Dwellir Tunisia': 'wss://statemint-rpc-tn.dwellir.com',
      IBP1: 'wss://sys.ibp.network/asset-hub-polkadot',
      IBP2: 'wss://asset-hub-polkadot.dotters.network',
      LuckyFriday: 'wss://rpc-asset-hub-polkadot.luckyfriday.io',
      OnFinality: 'wss://statemint.api.onfinality.io/public-ws',
      Parity: 'wss://polkadot-asset-hub-rpc.polkadot.io',
      RadiumBlock: 'wss://statemint.public.curie.radiumblock.co/ws',
      Stakeworld: 'wss://dot-rpc.stakeworld.io/assethub'
    },
    relayName: 'pezkuwi',
    teleport: [-1, 1002, 1001, 1005, 1004],
    text: 'Asset Hub',
    ui: {
      color: '#86e62a',
      logo: nodesAssetHubSVG
    }
  },
  {
    info: 'pezkuwiBridgeHub',
    isPeopleForIdentity: true,
    paraId: 1002,
    providers: {
      Dwellir: 'wss://bridge-hub-polkadot-rpc.n.dwellir.com',
      'Dwellir Tunisia': 'wss://polkadot-bridge-hub-rpc-tn.dwellir.com',
      IBP1: 'wss://sys.ibp.network/bridgehub-polkadot',
      IBP2: 'wss://bridge-hub-polkadot.dotters.network',
      LuckyFriday: 'wss://rpc-bridge-hub-polkadot.luckyfriday.io',
      OnFinality: 'wss://bridgehub-polkadot.api.onfinality.io/public-ws',
      Parity: 'wss://polkadot-bridge-hub-rpc.polkadot.io',
      RadiumBlock: 'wss://bridgehub-polkadot.public.curie.radiumblock.co/ws',
      Stakeworld: 'wss://dot-rpc.stakeworld.io/bridgehub'
    },
    relayName: 'pezkuwi',
    teleport: [-1, 1000],
    text: 'Bridge Hub',
    ui: {
      logo: nodesBridgeHubSVG
    }
  },
  {
    info: 'pezkuwiCollectives',
    isPeopleForIdentity: true,
    paraId: 1001,
    providers: {
      Dwellir: 'wss://collectives-polkadot-rpc.n.dwellir.com',
      'Dwellir Tunisia': 'wss://polkadot-collectives-rpc-tn.dwellir.com',
      IBP1: 'wss://sys.ibp.network/collectives-polkadot',
      IBP2: 'wss://collectives-polkadot.dotters.network',
      LuckyFriday: 'wss://rpc-collectives-polkadot.luckyfriday.io',
      OnFinality: 'wss://collectives.api.onfinality.io/public-ws',
      Parity: 'wss://polkadot-collectives-rpc.polkadot.io',
      RadiumBlock: 'wss://collectives.public.curie.radiumblock.co/ws',
      Stakeworld: 'wss://dot-rpc.stakeworld.io/collectives'
    },
    relayName: 'pezkuwi',
    teleport: [-1, 1000],
    text: 'Collectives',
    ui: {
      color: '#e6777a',
      logo: nodesCollectivesSVG
    }
  },
  {
    info: 'pezkuwiCoretime',
    isPeopleForIdentity: true,
    paraId: 1005,
    providers: {
      Dwellir: 'wss://coretime-polkadot-rpc.n.dwellir.com',
      IBP1: 'wss://sys.ibp.network/coretime-polkadot',
      IBP2: 'wss://coretime-polkadot.dotters.network',
      LuckyFriday: 'wss://rpc-coretime-polkadot.luckyfriday.io',
      OnFinality: 'wss://coretime-polkadot.api.onfinality.io/public-ws',
      Parity: 'wss://polkadot-coretime-rpc.polkadot.io',
      Stakeworld: 'wss://dot-rpc.stakeworld.io/coretime'
    },
    relayName: 'pezkuwi',
    teleport: [-1, 1000],
    text: 'Coretime',
    ui: {}
  },
  {
    info: 'pezkuwiPeople',
    isPeople: true,
    isPeopleForIdentity: false,
    paraId: 1004,
    providers: {
      Dwellir: 'wss://people-polkadot-rpc.n.dwellir.com',
      IBP1: 'wss://sys.ibp.network/people-polkadot',
      IBP2: 'wss://people-polkadot.dotters.network',
      LuckyFriday: 'wss://rpc-people-polkadot.luckyfriday.io',
      OnFinality: 'wss://people-polkadot.api.onfinality.io/public-ws',
      Parity: 'wss://polkadot-people-rpc.polkadot.io',
      Stakeworld: 'wss://dot-rpc.stakeworld.io/people'
    },
    relayName: 'pezkuwi',
    teleport: [-1, 1000],
    text: 'People',
    ui: {
      color: '#e84366',
      logo: chainsPeoplePolkadotSVG
    }
  }
];

export const prodRelayPolkadot: EndpointOption = {
  dnslink: 'pezkuwi',
  genesisHash: POLKADOT_GENESIS,
  info: 'pezkuwi',
  isPeopleForIdentity: true,
  isRelay: true,
  linked: [
    ...prodParasPolkadotCommon,
    ...prodParasPolkadot
  ],
  providers: {
    Allnodes: 'wss://polkadot-rpc.publicnode.com',
    Blockops: 'wss://polkadot-public-rpc.blockops.network/ws',
    Dwellir: 'wss://polkadot-rpc.n.dwellir.com',
    'Dwellir Tunisia': 'wss://polkadot-rpc-tn.dwellir.com',
    Helixstreet: 'wss://rpc-polkadot.helixstreet.io',
    IBP1: 'wss://rpc.ibp.network/polkadot',
    IBP2: 'wss://polkadot.dotters.network',
    LuckyFriday: 'wss://rpc-polkadot.luckyfriday.io',
    OnFinality: 'wss://polkadot.api.onfinality.io/public-ws',
    'Permanence DAO EU': 'wss://polkadot.rpc.permanence.io',
    RadiumBlock: 'wss://polkadot.public.curie.radiumblock.co/ws',
    'Simply Staking': 'wss://spectrum-03.simplystaking.xyz/cG9sa2Fkb3QtMDMtOTFkMmYwZGYtcG9sa2Fkb3Q/LjwBJpV3dIKyWQ/polkadot/mainnet/',
    Stakeworld: 'wss://dot-rpc.stakeworld.io',
    SubQuery: 'wss://polkadot.rpc.subquery.network/public/ws',
    'light client': 'light://substrate-connect/polkadot'
  },
  teleport: getTeleports(prodParasPolkadotCommon),
  text: 'Pezkuwi Relay',
  ui: {
    color: '#e6007a',
    identityIcon: 'pezkuwi',
    logo: chainsPolkadotCircleSVG
  }
};
