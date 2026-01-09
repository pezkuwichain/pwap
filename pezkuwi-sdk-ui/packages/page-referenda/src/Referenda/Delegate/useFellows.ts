// Copyright 2017-2026 @pezkuwi/app-referenda authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { StorageKey } from '@pezkuwi/types';
import type { AccountId } from '@pezkuwi/types/interfaces';

import { useMemo } from 'react';

import { createNamedHook, useApi, useMapKeys } from '@pezkuwi/react-hooks';
import { isFunction } from '@pezkuwi/util';

const MEMBERS_OPT = {
  transform: (keys: StorageKey<[AccountId]>[]): string[] =>
    keys.map(({ args: [id] }) => id.toString())
};

function useFellowsImpl (): string[] | null | undefined {
  const { api } = useApi();
  const members = useMapKeys(api.query.fellowshipCollective?.members, [], MEMBERS_OPT);

  return useMemo(
    () => isFunction(api.query.fellowshipCollective?.members)
      ? members
      : [],
    [api, members]
  );
}

export default createNamedHook('useFellows', useFellowsImpl);
