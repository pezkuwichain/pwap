// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { OverrideBundleDefinition } from '@pezkuwi/types/types';

import pkg from '@edgeware/node-types';

export default (pkg.spec.typesBundle as { spec: { edgeware: OverrideBundleDefinition } }).spec.edgeware;
