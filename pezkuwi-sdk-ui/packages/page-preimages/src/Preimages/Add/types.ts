// Copyright 2017-2026 @pezkuwi/app-preimages authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { SubmittableExtrinsic } from '@pezkuwi/api/types';
import type { BN } from '@pezkuwi/util';
import type { HexString } from '@pezkuwi/util/types';

export interface HashState {
  encodedHash: HexString;
  encodedLength: number;
  encodedProposal?: HexString | null;
  notePreimageTx?: SubmittableExtrinsic<'promise'> | null;
  storageFee: BN;
}
