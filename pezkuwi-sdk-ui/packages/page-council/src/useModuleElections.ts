// Copyright 2017-2026 @pezkuwi/app-council authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react';

import { createNamedHook, useApi } from '@pezkuwi/react-hooks';

function useModuleElectionsImpl (): string | null {
  const { api } = useApi();

  return useMemo(
    () => api.tx.phragmenElection
      ? 'phragmenElection'
      : api.tx.electionsPhragmen
        ? 'electionsPhragmen'
        : api.tx.elections
          ? 'elections'
          : null,
    [api]
  );
}

export const useModuleElections = createNamedHook('useModuleElections', useModuleElectionsImpl);
