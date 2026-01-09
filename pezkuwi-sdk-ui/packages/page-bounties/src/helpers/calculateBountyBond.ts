// Copyright 2017-2026 @pezkuwi/app-bounties authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { BN } from '@pezkuwi/util';

export function calculateBountyBond (description: string, depositBase: BN, depositPerByte: BN): BN {
  return depositBase.add(depositPerByte.muln(countUtf8Bytes(description)));
}

export function countUtf8Bytes (str: string): number {
  return new Blob([str]).size;
}
