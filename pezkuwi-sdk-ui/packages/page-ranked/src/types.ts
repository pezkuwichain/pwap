// Copyright 2017-2026 @pezkuwi/app-ranked authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { PezpalletRankedCollectiveMemberRecord } from '@pezkuwi/types/lookup';

export type PalletColl = 'rankedCollective' | 'fellowshipCollective' | 'ambassadorCollective';

export type PalletPoll = 'rankedPolls' | 'fellowshipReferenda' | 'ambassadorReferenda';

export interface Member {
  accountId: string;
  info: PezpalletRankedCollectiveMemberRecord;
}
