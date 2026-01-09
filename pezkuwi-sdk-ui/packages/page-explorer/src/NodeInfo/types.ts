// Copyright 2017-2026 @pezkuwi/app-explorer authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Vec } from '@pezkuwi/types';
import type { BlockNumber, Extrinsic, Health, PeerInfo } from '@pezkuwi/types/interfaces';

export interface Info {
  blockNumber?: BlockNumber;
  extrinsics?: Vec<Extrinsic> | null;
  health?: Health | null;
  peers?: PeerInfo[] | null;
}
