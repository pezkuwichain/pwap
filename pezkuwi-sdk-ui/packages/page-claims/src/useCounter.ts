// Copyright 2017-2025 @pezkuwi/app-settings authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { createNamedHook } from '@pezkuwi/react-hooks';

import usePolkadotPreclaims from './usePolkadotPreclaims.js';

function useCounterImpl (): number {
  const needAttest = usePolkadotPreclaims();

  return needAttest.length;
}

export default createNamedHook('useCounter', useCounterImpl);
