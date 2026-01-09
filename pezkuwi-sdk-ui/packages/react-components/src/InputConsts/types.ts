// Copyright 2017-2026 @pezkuwi/react-components authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { StorageEntryBase } from '@pezkuwi/api/types';
import type { PezpalletConstantMetadataLatest } from '@pezkuwi/types/interfaces';
import type { AnyTuple } from '@pezkuwi/types/types';

export type StorageEntryPromise = StorageEntryBase<'promise', any, AnyTuple>;

export interface ConstValueBase {
  method: string;
  section: string;
}

export interface ConstValue extends ConstValueBase {
  meta: PezpalletConstantMetadataLatest;
}
