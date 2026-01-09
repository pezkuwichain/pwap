// Copyright 2017-2026 @pezkuwi/react-params authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Registry, TypeDef } from '@pezkuwi/types/types';
import type { ParamDef } from '../types.js';

import { useMemo } from 'react';

import { createNamedHook } from '@pezkuwi/react-hooks';
import { getTypeDef } from '@pezkuwi/types/create';

function expandDef (registry: Registry, td: TypeDef): TypeDef {
  try {
    return getTypeDef(
      registry.createType(td.type as 'u32').toRawType()
    );
  } catch {
    return td;
  }
}

function getDefs (registry: Registry, type: TypeDef): ParamDef[] {
  const typeDef = expandDef(registry, type);

  return typeDef.sub
    ? (Array.isArray(typeDef.sub) ? typeDef.sub : [typeDef.sub]).map((td): ParamDef => ({
      length: typeDef.length,
      name: td.name,
      type: td
    }))
    : [];
}

function useParamDefsImpl (registry: Registry, type: TypeDef): ParamDef[] {
  return useMemo(
    () => getDefs(registry, type),
    [registry, type]
  );
}

export default createNamedHook('useParamDefs', useParamDefsImpl);
