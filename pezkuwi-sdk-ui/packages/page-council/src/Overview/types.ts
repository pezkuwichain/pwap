// Copyright 2017-2026 @pezkuwi/app-council authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveElectionsInfo } from '@pezkuwi/api-derive/types';
import type { SetIndex } from '@pezkuwi/types/interfaces';
import type { BN } from '@pezkuwi/util';

export interface ComponentProps {
  electionsInfo?: DeriveElectionsInfo;
}

export interface VoterPosition {
  setIndex: SetIndex;
  globalIndex: BN;
}
