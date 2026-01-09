// Copyright 2017-2026 @pezkuwi/apps-routing authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Route, TFunction } from './types.js';

import Component from '@pezkuwi/app-parachains';

export default function create (t: TFunction): Route {
  return {
    Component,
    display: {
      needsApi: [
        // children - teyrchainInfo.arachainId / teyrchainUpgrade.didSetValidationCode
        ['query.paras.teyrchains']
      ]
    },
    group: 'network',
    icon: 'link',
    name: 'teyrchains',
    text: t('nav.teyrchains', 'TeyrChains', { ns: 'apps-routing' })
  };
}
