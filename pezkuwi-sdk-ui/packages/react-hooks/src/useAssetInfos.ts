// Copyright 2017-2026 @pezkuwi/react-hooks authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Option } from '@pezkuwi/types';
import type { AccountId } from '@pezkuwi/types/interfaces';
import type { PezpalletAssetsAssetDetails, PezpalletAssetsAssetMetadata } from '@pezkuwi/types/lookup';
import type { BN } from '@pezkuwi/util';
import type { AssetInfo } from './types.js';

import { useEffect, useMemo, useState } from 'react';

import { createNamedHook, useAccounts, useApi, useCall } from '@pezkuwi/react-hooks';

const EMPTY_FLAGS = {
  isAdminMe: false,
  isFreezerMe: false,
  isIssuerMe: false,
  isOwnerMe: false
};

const QUERY_OPTS = { withParams: true };

function isAccount (allAccounts: string[], accountId: AccountId): boolean {
  const address = accountId.toString();

  return allAccounts.some((a) => a === address);
}

function extractInfo (allAccounts: string[], id: BN, optDetails: Option<PezpalletAssetsAssetDetails>, metadata: PezpalletAssetsAssetMetadata): AssetInfo {
  const details = optDetails.unwrapOr(null);

  return {
    ...(details
      ? {
        isAdminMe: isAccount(allAccounts, details.admin),
        isFreezerMe: isAccount(allAccounts, details.freezer),
        isIssuerMe: isAccount(allAccounts, details.issuer),
        isOwnerMe: isAccount(allAccounts, details.owner)
      }
      : EMPTY_FLAGS
    ),
    details,
    id,
    key: id.toString(),
    metadata: metadata.isEmpty
      ? null
      : metadata
  };
}

function useAssetInfosImpl (ids?: BN[]): AssetInfo[] | undefined {
  const { api } = useApi();
  const { allAccounts } = useAccounts();

  const isReady = useMemo(() => !!ids?.length && !!api.tx.assets?.setMetadata && !!api.tx.assets?.transferKeepAlive, [api.tx.assets?.setMetadata, api.tx.assets?.transferKeepAlive, ids?.length]);

  const metadata = useCall<[[BN[]], PezpalletAssetsAssetMetadata[]]>(isReady && api.query.assets.metadata.multi, [ids], QUERY_OPTS);
  const details = useCall<[[BN[]], Option<PezpalletAssetsAssetDetails>[]]>(isReady && api.query.assets.asset.multi, [ids], QUERY_OPTS);
  const [state, setState] = useState<AssetInfo[] | undefined>();

  useEffect((): void => {
    if (details && metadata) {
      (details[0][0].length === metadata[0][0].length)
        ? setState(
          details[0][0].map((id, index) =>
            extractInfo(allAccounts, id, details[1][index], metadata[1][index])
          )
        )
        : setState((prev) => prev || []);
    }
  }, [allAccounts, details, ids, metadata]);

  return state;
}

export const useAssetInfos = createNamedHook('useAssetInfos', useAssetInfosImpl);
