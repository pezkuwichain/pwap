// Copyright 2017-2026 @pezkuwi/app-nfts authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { AccountId } from '@pezkuwi/types/interfaces';
import type { PezpalletUniquesItemMetadata } from '@pezkuwi/types/lookup';
import type { BN } from '@pezkuwi/util';

export interface ItemSupportedMetadata {
  name: string | null;
  image: string | null;
}

export interface ItemInfo {
  account: AccountId,
  id: BN;
  key: string;
  metadata: PezpalletUniquesItemMetadata | null;
  ipfsData: ItemSupportedMetadata | null;
}
