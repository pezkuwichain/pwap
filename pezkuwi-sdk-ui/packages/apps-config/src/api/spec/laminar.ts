// Copyright 2017-2025 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { OverrideBundleDefinition } from '@pezkuwi/types/types';

import { typesBundleForPolkadot } from '@laminar/type-definitions';

export default typesBundleForPolkadot.spec.laminar as unknown as OverrideBundleDefinition;
