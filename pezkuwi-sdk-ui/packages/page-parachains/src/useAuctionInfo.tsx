// Copyright 2017-2026 @pezkuwi/app-parachains authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Option } from '@pezkuwi/types';
import type { AuctionIndex, BlockNumber, LeasePeriodOf } from '@pezkuwi/types/interfaces';
import type { ITuple } from '@pezkuwi/types/types';
import type { AuctionInfo } from './types.js';

import { createNamedHook, useApi, useCallMulti } from '@pezkuwi/react-hooks';

const OPT_MULTI = {
  transform: ([numAuctions, optInfo]: [AuctionIndex, Option<ITuple<[LeasePeriodOf, BlockNumber]>>]): AuctionInfo => {
    const [leasePeriod, endBlock] = optInfo.unwrapOr([null, null]);

    return {
      endBlock,
      leasePeriod,
      numAuctions
    };
  }
};

function useAuctionInfoImpl (): AuctionInfo | undefined {
  const { api } = useApi();

  return useCallMulti<AuctionInfo>([
    api.query.auctions?.auctionCounter,
    api.query.auctions?.auctionInfo
  ], OPT_MULTI);
}

export default createNamedHook('useAuctionInfo', useAuctionInfoImpl);
