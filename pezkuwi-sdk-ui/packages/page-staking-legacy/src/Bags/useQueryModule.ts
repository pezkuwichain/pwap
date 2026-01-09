// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { AugmentedQueries } from '@pezkuwi/api-base/types';

import { useMemo } from 'react';

import { createNamedHook, useApi } from '@pezkuwi/react-hooks';

function useModuleImpl (): AugmentedQueries<'promise'>['voterList'] {
  const { api } = useApi();

  return useMemo(
    () => api.query.voterList || api.query.voterBagsList || api.query.bagsList,
    [api]
  );
}

export default createNamedHook('useQueryModule', useModuleImpl);
