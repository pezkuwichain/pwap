// Copyright 2017-2026 @pezkuwi/react-hooks authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ApiPromise } from '@pezkuwi/api';
import type { Option, StorageKey, u32 } from '@pezkuwi/types';
import type { PezpalletBrokerPotentialRenewalId, PezpalletBrokerPotentialRenewalRecord } from '@pezkuwi/types/lookup';
import type { PotentialRenewal } from './types.js';

import { useEffect, useState } from 'react';

import { createNamedHook, useCall, useMapKeys } from '@pezkuwi/react-hooks';
import { BN_ZERO } from '@pezkuwi/util';

import { processHexMask } from './utils/dataProcessing.js';

function extractInfo (info: Option<PezpalletBrokerPotentialRenewalRecord>, item: PezpalletBrokerPotentialRenewalId): PotentialRenewal | undefined {
  const unwrapped: PezpalletBrokerPotentialRenewalRecord | null = info.isSome ? info.unwrap() : null;
  let mask: string[] = [];
  let task = '';

  if (!unwrapped) {
    return;
  }

  const completion = unwrapped?.completion;

  if (completion?.isComplete) {
    const complete = completion?.asComplete[0];

    task = complete.assignment.isTask ? complete?.assignment.asTask.toString() : complete?.assignment.isPool ? 'Pool' : 'Idle';
    mask = processHexMask(complete.mask);
  } else if (completion?.isPartial) {
    mask = processHexMask(completion?.asPartial);
    task = '';
  } else {
    mask = [];
  }

  return {
    // How much of a core has been assigned or, if completely assigned, the workload itself.
    completion: completion?.type,
    core: item?.core.toNumber(),
    mask,
    maskBits: mask?.length,
    price: unwrapped?.price.toBn() || BN_ZERO,
    task,
    when: item?.when.toNumber()
  };
}

const OPT_KEY = {
  transform: (keys: StorageKey<[u32]>[]): u32[] =>
    keys.map(({ args: [id] }) => id)
};

function useBrokerPotentialRenewalsImpl (api: ApiPromise, ready: boolean): PotentialRenewal[] | undefined {
  const keys = useMapKeys(ready && api?.query.broker.potentialRenewals, [], OPT_KEY);
  const potentialRenewals = useCall<[[PezpalletBrokerPotentialRenewalId[]], Option<PezpalletBrokerPotentialRenewalRecord>[]]>(ready && api?.query.broker.potentialRenewals.multi, [keys], { withParams: true });

  const [state, setState] = useState<PotentialRenewal[] | undefined>();

  useEffect((): void => {
    if (!potentialRenewals) {
      return;
    }

    const renewals = potentialRenewals[0][0].map((info, index) => extractInfo(potentialRenewals[1][index], info));

    setState(renewals.filter((renewal): renewal is PotentialRenewal => !!renewal));
  }, [potentialRenewals]);

  return state;
}

export const useBrokerPotentialRenewals = createNamedHook('useBrokerPotentialRenewals', useBrokerPotentialRenewalsImpl);
