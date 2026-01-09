// Copyright 2017-2026 @pezkuwi/react-components authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ApiPromise } from '@pezkuwi/api';
import type { DropdownOptions } from '../../util/types.js';

export default function createOptions (api: ApiPromise): DropdownOptions {
  return Object
    .keys(api.consts)
    .filter((s) => !s.startsWith('$'))
    .sort()
    .filter((name): number => Object.keys(api.consts[name]).length)
    .map((name): { text: string; value: string } => ({
      text: name,
      value: name
    }));
}
