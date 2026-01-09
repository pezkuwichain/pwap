// Copyright 2017-2026 @pezkuwi/react-components authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ApiPromise } from '@pezkuwi/api';
import type { DefinitionCallNamed } from '@pezkuwi/types/types';

import { useMemo } from 'react';

import { createNamedHook, useApi } from '@pezkuwi/react-hooks';

function getEntries <T> (obj: Record<string, T>): [string, T][] {
  return Object
    .entries(obj)
    .sort(([a], [b]) => a.localeCompare(b));
}

function getAllCalls (api: ApiPromise): [Record<string, Record<string, DefinitionCallNamed>>, DefinitionCallNamed | null] {
  const result: Record<string, Record<string, DefinitionCallNamed>> = {};
  let defValue: DefinitionCallNamed | null = null;
  const sections = getEntries(api.call);

  for (let i = 0, secCount = sections.length; i < secCount; i++) {
    const [section, methodsObj] = sections[i];
    const methods = getEntries(methodsObj);

    for (let j = 0, metCount = methods.length; j < metCount; j++) {
      const [method, { meta }] = methods[j] as unknown as [string, { meta: DefinitionCallNamed }];

      if (meta) {
        if (!result[section]) {
          result[section] = {};

          if (defValue === null) {
            defValue = meta;
          }
        }

        result[section][method] = meta;
      }
    }
  }

  return [result, defValue];
}

function useRuntimeImpl (): [Record<string, Record<string, DefinitionCallNamed>>, DefinitionCallNamed | null] {
  const { api } = useApi();

  return useMemo(
    () => getAllCalls(api),
    [api]
  );
}

export default createNamedHook('useRuntime', useRuntimeImpl);
