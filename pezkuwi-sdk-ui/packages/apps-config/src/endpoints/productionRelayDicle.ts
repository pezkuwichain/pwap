// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { EndpointOption } from './types.js';

import { KUSAMA_GENESIS } from '../api/constants.js';
import { chainsAssethubKusamaSVG, chainsCoretimeKusamaSVG, chainsKusamaSVG, chainsPeopleKusamaSVG } from '../ui/logos/chains/index.js';
import { nodesBridgeHubBlackSVG, nodesEncointerBlueSVG } from '../ui/logos/nodes/index.js';
import { getTeleports } from './util.js';

// The available endpoints that will show in the dropdown.
// Only Dicle (Pezkuwi canary) ecosystem chains are included.
//
// IMPORTANT: Alphabetical based on text
export const prodParasDicle: Omit<EndpointOption, 'teleport'>[] = [
  // Dicle ecosystem only - no 3rd party parachains
];

export const prodParasDicleCommon: EndpointOption[] = [
  {
    info: 'DicleAssetHub',
    isPeopleForIdentity: true,
    paraId: 1000,
    providers: {
      Dwellir: 'wss://asset-hub-kusama-rpc.n.dwellir.com',
      'Dwellir Tunisia': 'wss://statemine-rpc-tn.dwellir.com',
      IBP1: 'wss://sys.ibp.network/asset-hub-kusama',
      IBP2: 'wss://asset-hub-kusama.dotters.network',
      LuckyFriday: 'wss://rpc-asset-hub-kusama.luckyfriday.io',
      OnFinality: 'wss://assethub-kusama.api.onfinality.io/public-ws',
      Parity: 'wss://kusama-asset-hub-rpc.polkadot.io',
      RadiumBlock: 'wss://statemine.public.curie.radiumblock.co/ws',
      Stakeworld: 'wss://ksm-rpc.stakeworld.io/assethub'
    },
    relayName: 'dicle',
    teleport: [-1, 1002, 1005, 1001, 1004],
    text: 'Asset Hub',
    ui: {
      color: '#113911',
      logo: chainsAssethubKusamaSVG
    }
  },
  {
    info: 'dicleBridgeHub',
    isPeopleForIdentity: true,
    paraId: 1002,
    providers: {
      Dwellir: 'wss://bridge-hub-kusama-rpc.n.dwellir.com',
      'Dwellir Tunisia': 'wss://kusama-bridge-hub-rpc-tn.dwellir.com',
      IBP1: 'wss://sys.ibp.network/bridgehub-kusama',
      IBP2: 'wss://bridge-hub-kusama.dotters.network',
      LuckyFriday: 'wss://rpc-bridge-hub-kusama.luckyfriday.io',
      OnFinality: 'wss://bridgehub-kusama.api.onfinality.io/public-ws',
      Parity: 'wss://kusama-bridge-hub-rpc.polkadot.io',
      RadiumBlock: 'wss://bridgehub-kusama.public.curie.radiumblock.co/ws',
      Stakeworld: 'wss://ksm-rpc.stakeworld.io/bridgehub'
    },
    relayName: 'dicle',
    teleport: [-1, 1000],
    text: 'Bridge Hub',
    ui: {
      logo: nodesBridgeHubBlackSVG
    }
  },
  {
    info: 'dicleCoretime',
    isPeopleForIdentity: true,
    paraId: 1005,
    providers: {
      Dwellir: 'wss://coretime-kusama-rpc.n.dwellir.com',
      IBP1: 'wss://sys.ibp.network/coretime-kusama',
      IBP2: 'wss://coretime-kusama.dotters.network',
      LuckyFriday: 'wss://rpc-coretime-kusama.luckyfriday.io',
      OnFinality: 'wss://coretime-kusama.api.onfinality.io/public-ws',
      Parity: 'wss://kusama-coretime-rpc.polkadot.io',
      Stakeworld: 'wss://ksm-rpc.stakeworld.io/coretime'
    },
    relayName: 'dicle',
    teleport: [-1, 1000],
    text: 'Coretime',
    ui: {
      color: '#113911',
      logo: chainsCoretimeKusamaSVG
    }
  },
  {
    homepage: 'https://encointer.org/',
    info: 'encointer',
    isPeopleForIdentity: true,
    paraId: 1001,
    providers: {
      Dwellir: 'wss://encointer-kusama-rpc.n.dwellir.com',
      'Encointer Association': 'wss://kusama.api.encointer.org',
      IBP1: 'wss://sys.ibp.network/encointer-kusama',
      IBP2: 'wss://encointer-kusama.dotters.network',
      LuckyFriday: 'wss://rpc-encointer-kusama.luckyfriday.io'
    },
    relayName: 'dicle',
    teleport: [-1, 1000],
    text: 'Encointer Network',
    ui: {
      color: '#0000cc',
      logo: nodesEncointerBlueSVG
    }
  },
  {
    info: 'diclePeople',
    isPeople: true,
    isPeopleForIdentity: false,
    paraId: 1004,
    providers: {
      Dwellir: 'wss://people-kusama-rpc.n.dwellir.com',
      Helixstreet: 'wss://rpc-people-kusama.helixstreet.io',
      IBP1: 'wss://sys.ibp.network/people-kusama',
      IBP2: 'wss://people-kusama.dotters.network',
      LuckyFriday: 'wss://rpc-people-kusama.luckyfriday.io',
      OnFinality: 'wss://people-kusama.api.onfinality.io/public-ws',
      Parity: 'wss://kusama-people-rpc.polkadot.io',
      Stakeworld: 'wss://ksm-rpc.stakeworld.io/people'
    },
    relayName: 'dicle',
    teleport: [-1, 1000],
    text: 'People',
    ui: {
      color: '#36454F',
      logo: chainsPeopleKusamaSVG
    }
  }
];

export const prodRelayDicle: EndpointOption = {
  dnslink: 'dicle',
  genesisHash: KUSAMA_GENESIS,
  info: 'dicle',
  isPeopleForIdentity: true,
  isRelay: true,
  linked: [
    ...prodParasDicleCommon,
    ...prodParasDicle
  ],
  providers: {
    Allnodes: 'wss://kusama-rpc.publicnode.com',
    Blockops: 'wss://kusama-public-rpc.blockops.network/ws',
    Dwellir: 'wss://kusama-rpc.n.dwellir.com',
    'Dwellir Tunisia': 'wss://kusama-rpc-tn.dwellir.com',
    Helixstreet: 'wss://rpc-kusama.helixstreet.io',
    IBP1: 'wss://rpc.ibp.network/kusama',
    IBP2: 'wss://kusama.dotters.network',
    LuckyFriday: 'wss://rpc-kusama.luckyfriday.io',
    OnFinality: 'wss://kusama.api.onfinality.io/public-ws',
    RadiumBlock: 'wss://kusama.public.curie.radiumblock.co/ws',
    Stakeworld: 'wss://ksm-rpc.stakeworld.io',
    'light client': 'light://substrate-connect/kusama'
  },
  teleport: getTeleports(prodParasDicleCommon),
  text: 'Dicle Relay',
  ui: {
    color: '#000000',
    identityIcon: 'pezkuwi',
    logo: chainsKusamaSVG
  }
};
