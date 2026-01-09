// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { OverrideBundleDefinition } from '@pezkuwi/types/types';

// @ts-expect-error No definitions provided in package
import { standardTypes } from '@digitalnative/type-definitions';

export default standardTypes as OverrideBundleDefinition;
