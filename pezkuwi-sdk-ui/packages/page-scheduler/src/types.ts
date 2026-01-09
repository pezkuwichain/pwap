// Copyright 2017-2026 @pezkuwi/app-scheduler authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Bytes, Option } from '@pezkuwi/types';
import type { BlockNumber, Call, SchedulePeriod, SchedulePriority } from '@pezkuwi/types/interfaces';
import type { PezframeSupportPreimagesBounded } from '@pezkuwi/types/lookup';

export interface ScheduledExt {
  blockNumber: BlockNumber;
  call: Call | null;
  key: string;
  maybeId: Option<Bytes>;
  maybePeriodic: Option<SchedulePeriod>;
  priority: SchedulePriority;
  preimageHash?: PezframeSupportPreimagesBounded;
}
