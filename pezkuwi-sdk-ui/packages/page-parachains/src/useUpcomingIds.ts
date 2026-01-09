// Copyright 2017-2026 @pezkuwi/app-parachains authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Option, StorageKey } from '@pezkuwi/types';
import type { ParaId } from '@pezkuwi/types/interfaces';
import type { PezkuwiRuntimeTeyrchainsParasParaLifecycle } from '@pezkuwi/types/lookup';

import { createNamedHook, useApi, useEventTrigger, useMapEntries } from '@pezkuwi/react-hooks';

const OPT_ENTRIES = {
  transform: (entries: [StorageKey<[ParaId]>, Option<PezkuwiRuntimeTeyrchainsParasParaLifecycle>][]): ParaId[] =>
    entries
      .map(([{ args: [paraId] }, optValue]): ParaId | null => {
        const value = optValue.unwrapOr(null);

        return value && (
          value.isParathread ||
          value.isUpgradingParathread ||
          value.isOffboardingParathread ||
          value.isOnboarding
        )
          ? paraId
          : null;
      })
      .filter((paraId): paraId is ParaId => !!paraId)
      .sort((a, b) => a.cmp(b))
};

function useUpomingIdsImpl (): ParaId[] | undefined {
  const { api } = useApi();
  const trigger = useEventTrigger([
    api.events.session.NewSession,
    api.events.registrar.Registered
  ]);

  return useMapEntries(api.query.paras.paraLifecycles, [], OPT_ENTRIES, trigger.blockHash);
}

export default createNamedHook('useUpomingIds', useUpomingIdsImpl);
