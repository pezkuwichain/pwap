// Copyright 2017-2026 @pezkuwi/app-referenda authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { PezpalletReferendaReferendumInfoConvictionVotingTally, PezpalletReferendaReferendumInfoRankedCollectiveTally, PezpalletReferendaTrackDetails } from '@pezkuwi/types/lookup';
import type { BN } from '@pezkuwi/util';

export type PezpalletReferenda = 'referenda' | 'rankedPolls' | 'fellowshipReferenda'| 'ambassadorReferenda';

export type PalletVote = 'convictionVoting' | 'rankedCollective' | 'fellowshipCollective' | 'ambassadorCollective';

export interface ReferendaGroup {
  key: string;
  track?: PezpalletReferendaTrackDetails;
  trackGraph?: CurveGraph;
  trackId?: BN;
  trackName?: string;
  referenda?: Referendum[];
}

export interface ReferendaGroupKnown extends ReferendaGroup {
  referenda: Referendum[];
}

export interface Referendum {
  decidingEnd?: BN;
  id: BN;
  info: PezpalletReferendaReferendumInfoConvictionVotingTally | PezpalletReferendaReferendumInfoRankedCollectiveTally;
  isConvictionVote: boolean;
  key: string;
  track?: PezpalletReferendaTrackDetails;
  trackId?: BN;
  trackGraph?: CurveGraph;
}

export interface ReferendumProps {
  className?: string;
  activeIssuance?: BN;
  isMember: boolean;
  members?: string[];
  onExpand?: () => void;
  palletReferenda: PezpalletReferenda;
  palletVote: PalletVote;
  ranks?: BN[];
  trackInfo?: TrackInfo;
  value: Referendum;
}

export interface Summary {
  deciding?: BN;
  refActive?: number;
  refCount?: BN;
}

export interface CurveGraph {
  approval: BN[];
  support: BN[];
  x: BN[];
}

export interface TrackDescription {
  graph: CurveGraph;
  id: BN;
  info: PezpalletReferendaTrackDetails;
}

export interface TrackInfo {
  compare?: (input: BN) => boolean;
  origin: Record<string, string> | Record<string, string>[];
  text?: string;
}

export interface TrackInfoExt extends TrackInfo {
  track: TrackDescription;
  trackName: string;
}

export interface Lock {
  classId: BN;
  endBlock: BN;
  locked: string;
  refId: BN;
  total: BN;
}
