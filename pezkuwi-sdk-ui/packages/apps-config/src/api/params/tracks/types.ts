// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { BN } from '@pezkuwi/util';

export type Origin = { system: string } | { Origins: string };

export interface TrackInfo {
  // TODO We would want to make this generic for non-fellowship
  compare?: (memberInfo: BN) => boolean;
  id: number;
  name: string;
  origin: Origin | Origin[];
  text?: string;
}
