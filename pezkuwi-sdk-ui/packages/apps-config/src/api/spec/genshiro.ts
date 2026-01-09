// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { OverrideBundleDefinition } from '@pezkuwi/types/types';

import { createDerives } from './equilibrium.js';

const TOKENS = ['gens'];

const definitions: OverrideBundleDefinition = {
  derives: createDerives(TOKENS),
  instances: { balances: TOKENS }
};

export default definitions;
