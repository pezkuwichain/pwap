// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { OverrideBundleDefinition } from '@pezkuwi/types/types';

import cere from './cere.js';

// NOTE: The mapping is done from chain name in system.chain
const chain: Record<string, OverrideBundleDefinition> = {
  'Cere Mainnet Beta': cere
};

export default chain;
