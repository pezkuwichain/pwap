// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { PezpalletBagsListListBag, PezpalletBagsListListNode } from '@pezkuwi/types/lookup';
import type { BN } from '@pezkuwi/util';

export interface StashNode {
  stashId: string;
  node: PezpalletBagsListListNode;
}

export interface ListNode {
  bonded: BN;
  index: number;
  jump: string | null;
  stashId: string;
}

export interface BagInfo {
  bagLower: BN;
  bagUpper: BN;
  index: number;
  info: PezpalletBagsListListBag;
  key: string;
}

export type BagMap = Record<string, StashNode[]>;
