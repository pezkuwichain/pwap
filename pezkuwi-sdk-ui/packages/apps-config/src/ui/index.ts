// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { identityNodes, identitySpec } from './identityIcons/index.js';
import { sanitize } from './util.js';

export function getSystemIcon (systemName: string, specName: string): 'beachball' | 'pezkuwi' | 'bizinikiwi' {
  return (
    identityNodes[sanitize(systemName)] ||
    identitySpec[sanitize(specName)] ||
    'bizinikiwi'
  ) as 'bizinikiwi';
}
