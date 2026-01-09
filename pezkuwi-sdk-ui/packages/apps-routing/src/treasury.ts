// Copyright 2017-2026 @pezkuwi/apps-routing authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Route, TFunction } from './types.js';

import Component, { useCounter } from '@pezkuwi/app-treasury';

export default function create (t: TFunction): Route {
  return {
    Component,
    display: {
      needsApi: [
        'query.treasury.proposals'
      ]
    },
    group: 'governance',
    icon: 'gem',
    name: 'treasury',
    text: t('nav.treasury', 'Treasury', { ns: 'apps-routing' }),
    useCounter
  };
}
