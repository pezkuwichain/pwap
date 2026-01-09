// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { OverrideBundleDefinition } from '@pezkuwi/types/types';

/* eslint-disable sort-keys */

const definitions: OverrideBundleDefinition = {
  types: [
    {
      // on all versions
      minmax: [0, undefined],
      types: {
        TeyrChainAccountIdOf: 'AccountId',
        Proof: {
          leafHash: 'Hash',
          sortedHashes: 'Vec<Hash>'
        },
        ProxyType: {
          _enum: [
            'Any',
            'NonTransfer',
            'Governance',
            '_Staking',
            'NonProxy'
          ]
        },
        RelayChainAccountId: 'AccountId',
        RootHashOf: 'Hash'
      }
    }
  ]
};

export default definitions;
