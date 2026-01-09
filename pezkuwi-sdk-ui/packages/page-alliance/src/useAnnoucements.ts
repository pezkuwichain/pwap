// Copyright 2017-2026 @pezkuwi/app-alliance authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { PezpalletAllianceCid } from '@pezkuwi/types/lookup';
import type { Cid } from './types.js';

import { createNamedHook, useApi, useCall } from '@pezkuwi/react-hooks';

import { createCid } from './util.js';

const OPT_ANN = {
  transform: (cids: PezpalletAllianceCid[]): Cid[] =>
    cids.map(createCid)
};

function useAnnouncementsImpl (): Cid[] | undefined {
  const { api } = useApi();

  return useCall<Cid[]>(api.query.alliance.announcements, [], OPT_ANN);
}

export default createNamedHook('useAnnouncements', useAnnouncementsImpl);
