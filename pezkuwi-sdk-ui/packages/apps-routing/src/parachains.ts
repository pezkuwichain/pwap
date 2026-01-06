// Copyright 2017-2025 @pezkuwi/apps-routing authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Route, TFunction } from './types.js';

import Component from '@pezkuwi/app-parachains';

export default function create (t: TFunction): Route {
  return {
    Component,
    display: {
      needsApi: [
        // children - parachainInfo.arachainId / parachainUpgrade.didSetValidationCode
        ['query.paras.parachains']
      ]
    },
    group: 'network',
    icon: 'link',
    name: 'parachains',
    text: t('nav.parachains', 'Parachains', { ns: 'apps-routing' })
  };
}
