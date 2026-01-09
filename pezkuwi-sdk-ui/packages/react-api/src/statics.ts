// Copyright 2017-2026 @pezkuwi/react-api authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ApiPromise } from '@pezkuwi/api';

import { TypeRegistry } from '@pezkuwi/types/create';

interface Statics {
  api: ApiPromise;
  registry: TypeRegistry;
}

// NOTE We are assuming that the Api class _will_ set it correctly
export const statics = {
  api: undefined,
  registry: new TypeRegistry()
} as unknown as Statics;
