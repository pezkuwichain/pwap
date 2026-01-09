// Copyright 2017-2026 @pezkuwi/app-settings authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { createNamedHook } from '@pezkuwi/react-hooks';

import useExtensions from './useExtensions.js';

function useCounterImpl (): number {
  const { count } = useExtensions();

  return count;
}

export default createNamedHook('useCounter', useCounterImpl);
