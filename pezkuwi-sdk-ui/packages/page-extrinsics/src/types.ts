// Copyright 2017-2026 @pezkuwi/app-extrinsics authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { SubmittableExtrinsicFunction } from '@pezkuwi/api/types';
import type { Call } from '@pezkuwi/types/interfaces';
import type { HexString } from '@pezkuwi/util/types';

export interface DecodedExtrinsic {
  call: Call;
  hex: HexString;
  fn: SubmittableExtrinsicFunction<'promise'>;
}
