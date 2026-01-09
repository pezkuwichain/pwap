// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { SubmittableExtrinsic } from '@pezkuwi/api/types';

export interface BondInfo {
  bondTx?: SubmittableExtrinsic<'promise'> | null;
  controllerId?: string | null;
  controllerTx?: SubmittableExtrinsic<'promise'> | null;
  stashId?: string | null;
}

export interface NominateInfo {
  nominateTx?: SubmittableExtrinsic<'promise'> | null;
}

export interface SessionInfo {
  sessionTx?: SubmittableExtrinsic<'promise'> | null;
}

export interface ValidateInfo {
  validateTx?: SubmittableExtrinsic<'promise'> | null;
}
