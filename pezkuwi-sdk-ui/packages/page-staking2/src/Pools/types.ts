// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { u32 } from '@pezkuwi/types';
import type { PezpalletNominationPoolsBondedPoolInner, PezpalletNominationPoolsPoolMember, PezpalletNominationPoolsRewardPool } from '@pezkuwi/types/lookup';
import type { BN } from '@pezkuwi/util';

export interface PoolAccounts {
  rewardId: string;
  stashId: string;
}

export interface OwnPoolBase {
  members: Record<string, PezpalletNominationPoolsPoolMember>;
  poolId: u32;
}

export interface OwnPool extends OwnPoolBase, PoolAccounts {
  // nothing additional, only combined
}

export interface Params {
  lastPoolId: BN;
  maxMembers: number;
  maxMembersPerPool: number;
  maxPools: number;
  minCreateBond?: BN;
  minJoinBond?: BN;
  minMemberBond?: BN;
  minNominatorBond?: BN;
  nextPoolId: BN;
}

export interface PoolInfoBase {
  bonded: PezpalletNominationPoolsBondedPoolInner;
  reward: PezpalletNominationPoolsRewardPool;
  metadata: string | null;
  nominating: string[];
  rewardClaimable: BN;
}

export interface PoolInfo extends PoolInfoBase, PoolAccounts {
  // nothing extra
}

export interface MembersMapEntry {
  accountId: string;
  member: PezpalletNominationPoolsPoolMember;
}

export type MembersMap = Record<string, MembersMapEntry[]>;
