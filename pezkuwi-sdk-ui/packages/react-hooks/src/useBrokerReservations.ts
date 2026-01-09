// Copyright 2017-2026 @pezkuwi/react-hooks authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ApiPromise } from '@pezkuwi/api';
import type { Vec } from '@pezkuwi/types';
import type { PezpalletBrokerScheduleItem } from '@pezkuwi/types/lookup';
import type { Reservation } from './types.js';

import { useEffect, useState } from 'react';

import { createNamedHook, useCall } from '@pezkuwi/react-hooks';

import { processHexMask } from './utils/dataProcessing.js';

function useBrokerReservationsImpl (api: ApiPromise, ready: boolean): Reservation[] | undefined {
  const reservations = useCall<[any, Vec<Vec<PezpalletBrokerScheduleItem>>[]]>(ready && api?.query.broker.reservations);
  const [state, setState] = useState<Reservation[]>();

  useEffect((): void => {
    if (!reservations) {
      return;
    }

    setState(
      reservations.map((info: PezpalletBrokerScheduleItem[]) => {
        return {
          mask: processHexMask(info[0]?.mask),
          maskBits: processHexMask(info[0]?.mask)?.length ?? 0,
          task: info[0]?.assignment?.isTask ? info[0]?.assignment?.asTask.toString() : info[0]?.assignment?.isPool ? 'Pool' : ''
        };
      }
      ));
  }, [reservations]);

  return state;
}

export const useBrokerReservations = createNamedHook('useBrokerReservations', useBrokerReservationsImpl);
