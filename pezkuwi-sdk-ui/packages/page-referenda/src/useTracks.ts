// Copyright 2017-2026 @pezkuwi/app-referenda authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { PezpalletReferendaTrackDetails } from '@pezkuwi/types/lookup';
import type { BN } from '@pezkuwi/util';
import type { PezpalletReferenda, TrackDescription } from './types.js';

import { useMemo } from 'react';

import { createNamedHook, useApi } from '@pezkuwi/react-hooks';
import { BN_ZERO } from '@pezkuwi/util';

import { calcCurves } from './util.js';

const zeroGraph = { approval: [BN_ZERO], support: [BN_ZERO], x: [BN_ZERO] };

function expandTracks (tracks: [BN, PezpalletReferendaTrackDetails][]): TrackDescription[] {
  return tracks.map(([id, info]) => ({
    graph: info.decisionDeposit && info.minApproval && info.minSupport ? calcCurves(info) : zeroGraph,
    id,
    info
  }));
}

function useTracksImpl (palletReferenda: PezpalletReferenda): TrackDescription[] {
  const { api } = useApi();

  return useMemo(
    () => expandTracks(api.consts[palletReferenda as 'referenda'].tracks),
    [api, palletReferenda]
  );
}

export default createNamedHook('useTracks', useTracksImpl);
