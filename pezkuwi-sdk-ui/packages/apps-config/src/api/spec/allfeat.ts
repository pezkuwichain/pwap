// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { OverrideBundleDefinition } from '@pezkuwi/types/types';

const definitions: OverrideBundleDefinition = {
  types: [
    {
      // on all versions
      minmax: [0, undefined],
      types: {
        AccountId: 'EthereumAccountId',
        Address: 'AccountId',
        LookupSource: 'AccountId'
      }
    }
  ]
};

export default definitions;
