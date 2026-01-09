// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { OverrideBundleDefinition } from '@pezkuwi/types/types';

import { typesBundleForPolkadot } from '@peaqnetwork/type-definitions';

export default (typesBundleForPolkadot as { spec: { peaq: OverrideBundleDefinition } }).spec.peaq;
