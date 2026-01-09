// Copyright 2017-2026 @pezkuwi/app-staking authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { DeriveHasIdentity } from '@pezkuwi/api-derive/types';

import { createNamedHook, useApi, useCall } from '@pezkuwi/react-hooks';

type Result = Record<string, DeriveHasIdentity>;

const OPT_CALL = {
  transform: ([[validatorIds], hasIdentities]: [[string[]], DeriveHasIdentity[]]): Record<string, DeriveHasIdentity> => {
    const result: Record<string, DeriveHasIdentity> = {};

    for (let i = 0; i < validatorIds.length; i++) {
      result[validatorIds[i]] = hasIdentities[i];
    }

    return result;
  },
  withParamsTransform: true
};

function useIdentitiesImpl (validatorIds: string[] = []): Result | undefined {
  const { api } = useApi();
  const allIdentity = useCall<Result>(api.derive.accounts.hasIdentityMulti, [validatorIds], OPT_CALL);

  return allIdentity;
}

export default createNamedHook('useIdentities', useIdentitiesImpl);
