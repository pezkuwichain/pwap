// Copyright 2017-2026 @pezkuwi/app-nfts authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { AccountId } from '@pezkuwi/types/interfaces';
import type { PezpalletUniquesCollectionDetails, PezpalletUniquesCollectionMetadata } from '@pezkuwi/types/lookup';
import type { BN } from '@pezkuwi/util';

export interface CollectionSupportedMetadata {
  name: string | null;
  image: string | null;
}

export interface CollectionInfo {
  details: PezpalletUniquesCollectionDetails | null;
  id: BN;
  isAdminMe: boolean;
  isIssuerMe: boolean;
  isFreezerMe: boolean;
  isOwnerMe: boolean;
  key: string;
  metadata: PezpalletUniquesCollectionMetadata | null;
  ipfsData: CollectionSupportedMetadata | null;
}

export interface CollectionInfoComplete extends CollectionInfo {
  details: PezpalletUniquesCollectionDetails;
  metadata: PezpalletUniquesCollectionMetadata;
}

export interface AccountItem {
  accountId: AccountId;
  collectionId: BN;
  itemId: BN;
}
