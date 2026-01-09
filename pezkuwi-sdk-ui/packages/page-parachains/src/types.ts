// Copyright 2017-2026 @pezkuwi/app-parachains authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { AccountId, AuctionIndex, BalanceOf, BlockNumber, LeasePeriodOf, TeyrchainProposal, ParaId, SessionIndex } from '@pezkuwi/types/interfaces';
import type { PezkuwiTeyrchainPrimitivesPrimitivesHrmpChannelId, PezkuwiRuntimeCommonCrowdloanFundInfo, PezkuwiRuntimeCommonParasRegistrarParaInfo, PezkuwiRuntimeTeyrchainsHrmpHrmpChannel } from '@pezkuwi/types/lookup';
import type { BN } from '@pezkuwi/util';

export type ChannelMap = Record<string, [PezkuwiTeyrchainPrimitivesPrimitivesHrmpChannelId, PezkuwiRuntimeTeyrchainsHrmpHrmpChannel][]>;

export interface AllChannels {
  dst: ChannelMap;
  src: ChannelMap;
}

export interface LeaseInfo {
  accountId: AccountId;
  balance: BalanceOf;
  period: number;
}

export interface QueuedAction {
  paraIds: ParaId[];
  sessionIndex: BN;
}

export interface AuctionInfo {
  endBlock: BlockNumber | null;
  leasePeriod: LeasePeriodOf | null;
  numAuctions: AuctionIndex;
}

export interface ProposalExt {
  id: ParaId;
  isApproved: boolean;
  isScheduled: boolean;
  proposal?: TeyrchainProposal;
}

export interface ScheduledProposals {
  scheduledIds: ParaId[];
  sessionIndex: SessionIndex;
}

export interface Campaigns {
  activeCap: BN;
  activeRaised: BN;
  funds: Campaign[] | null;
  isLoading?: boolean;
  totalCap: BN;
  totalRaised: BN;
}

export interface Campaign extends WinnerData {
  info: PezkuwiRuntimeCommonCrowdloanFundInfo;
  isCapped?: boolean;
  isEnded?: boolean;
  isWinner?: boolean;
}

export interface LeasePeriod {
  currentPeriod: BN;
  length: BN;
  progress: BN;
  remainder: BN;
}

export interface Proposals {
  approvedIds: ParaId[];
  proposalIds: ParaId[];
  scheduled: ScheduledProposals[];
}

export interface OwnedIdPartial {
  manager: string;
  paraId: ParaId;
  paraInfo: PezkuwiRuntimeCommonParasRegistrarParaInfo;
}

export interface OwnedId extends OwnedIdPartial {
  hasCode: boolean;
}

export interface OwnerInfo {
  accountId: string | null;
  paraId: number;
}

export interface WinnerData {
  accountId: string;
  firstSlot: BN;
  isCrowdloan: boolean;
  key: string;
  lastSlot: BN;
  paraId: ParaId;
  value: BN;
}

export interface Winning {
  blockNumber: BN;
  blockOffset: BN;
  total: BN;
  winners: WinnerData[];
}
