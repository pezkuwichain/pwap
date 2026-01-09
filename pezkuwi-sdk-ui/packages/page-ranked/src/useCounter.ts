// Copyright 2017-2026 @pezkuwi/app-ranked authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useCounterNamed } from '@pezkuwi/app-referenda/useCounter';
import { createNamedHook } from '@pezkuwi/react-hooks';

function useCounterImpl (): number {
  return useCounterNamed('rankedPolls');
}

export default createNamedHook('useCounter', useCounterImpl);
