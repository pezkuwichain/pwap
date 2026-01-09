// Copyright 2017-2026 @pezkuwi/apps-routing authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Route, TFunction } from './types.js';

import Component from '@pezkuwi/app-assets';

export default function create (t: TFunction): Route {
  return {
    Component,
    display: {
      needsApi: [
        'tx.assets.setMetadata',
        'tx.assets.transferKeepAlive'
      ]
    },
    group: 'network',
    icon: 'shopping-basket',
    name: 'assets',
    text: t('nav.assets', 'Assets', { ns: 'apps-routing' })
  };
}
