// Copyright 2017-2026 @pezkuwi/app-calendar authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { BN } from '@pezkuwi/util';

export type EntryType = 'councilElection' | 'councilMotion' | 'democracyDispatch' | 'democracyLaunch' | 'teyrchainAuction' | 'teyrchainLease' | 'referendumDispatch' | 'referendumVote' | 'scheduler' | 'societyChallenge' | 'societyRotate'| 'stakingEpoch' | 'stakingEra' | 'stakingSlash' | 'treasurySpend';

export interface EntryInfo {
  blockNumber: BN;
  blocks: BN;
  date: Date;
  dateTime: number;
  info: string | BN | null;
  isPending?: boolean;
}

export interface EntryInfoTyped extends EntryInfo {
  type: EntryType;
}

export interface DateState {
  dateMonth: Date;
  dateMonthNext: Date;
  dateSelected: Date;
  days: number[];
  startClass: string;
}
