// Copyright 2017-2026 @pezkuwi/apps-routing authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Route, TFunction } from './types.js';

import Component from '@pezkuwi/app-collator';

export default function create (t: TFunction): Route {
  return {
    Component,
    display: {
      needsApi: [
        'query.collatorSelection.candidacyBond'
      ]
    },
    group: 'network',
    icon: 'timeline',
    name: 'collators',
    text: t('nav.collator', 'Collators', { ns: 'apps-routing' })
  };
}
