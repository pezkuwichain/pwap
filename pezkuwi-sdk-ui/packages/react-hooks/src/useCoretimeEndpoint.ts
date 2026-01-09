// Copyright 2017-2026 @pezkuwi/react-hooks authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { LinkOption } from '@pezkuwi/apps-config/endpoints/types';

import { useMemo } from 'react';

import { createWsEndpoints } from '@pezkuwi/apps-config';
import { isString } from '@pezkuwi/util';

import { createNamedHook } from './createNamedHook.js';

const endpoints = createWsEndpoints((k, v) => v?.toString() || k);

export function getCoretimeEndpoint (curApiInfo?: string): LinkOption | null {
  return endpoints.find(({ info }) => isString(info) && isString(curApiInfo) && info.toLowerCase().includes('coretime') && info.toLowerCase().includes(curApiInfo.toLowerCase())) || null;
}

function useCoretimeEndpointImpl (relayInfo?: string): LinkOption | null {
  return useMemo(() => getCoretimeEndpoint(relayInfo), [relayInfo]);
}

export const useCoretimeEndpoint = createNamedHook('useCoretimeEndpoint', useCoretimeEndpointImpl);
