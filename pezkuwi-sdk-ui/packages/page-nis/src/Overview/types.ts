// Copyright 2017-2025 @pezkuwi/app-nis authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { u32, u128 } from '@pezkuwi/types';
import type { PezpalletNisSummaryRecord } from '@pezkuwi/types/lookup';

export interface QueueTotal {
  balance: u128;
  index: number;
  numItems: u32;
}

export interface NisInfo {
  queueTotals?: QueueTotal[];
  summary?: PezpalletNisSummaryRecord;
}
