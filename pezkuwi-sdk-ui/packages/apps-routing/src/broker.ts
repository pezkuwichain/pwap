// Copyright 2017-2026 @pezkuwi/apps-routing authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Route, TFunction } from './types.js';

import Component from '@pezkuwi/app-broker';

export default function create (t: TFunction): Route {
  return {
    Component,
    display: {
      needsApi: [
        'query.broker.status'
      ],
      needsApiInstances: true
    },
    group: 'network',
    icon: 'flask',
    name: 'broker',
    text: t('nav.broker', 'Coretime Broker', { ns: 'app-broker' })
  };
}
