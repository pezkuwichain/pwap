// Copyright 2017-2026 @pezkuwi/app-referenda authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { PezpalletConvictionVotingVoteVoting } from '@pezkuwi/types/lookup';
import type { BN } from '@pezkuwi/util';

export interface LockResultItem {
  classId: BN;
}

export type LockResult = Record<string, LockResultItem[]>;

export interface VoteResultCasting {
  refId: BN;
}

export interface VoteResultDelegating {
  conviction: PezpalletConvictionVotingVoteVoting['asDelegating']['conviction']['type'];
  targetId: string;
}

export interface VoteResultItem extends LockResultItem {
  casting?: VoteResultCasting[];
  delegating?: VoteResultDelegating;
}

export type VoteResult = Record<string, VoteResultItem[]>;
