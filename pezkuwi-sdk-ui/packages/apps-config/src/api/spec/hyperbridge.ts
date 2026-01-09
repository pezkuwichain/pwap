// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { OverrideBundleDefinition } from '@pezkuwi/types/types';

import { keccakAsU8a } from '@pezkuwi/util-crypto';

const definitions: OverrideBundleDefinition = {
  hasher: keccakAsU8a
};

export default definitions;
