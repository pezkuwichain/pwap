// Copyright 2017-2026 @pezkuwi/app-accounts authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { createNamedHook, useAccounts } from '@pezkuwi/react-hooks';

function useCounterImpl (): string | null {
  const { hasAccounts } = useAccounts();

  return hasAccounts ? null : '!';
}

export default createNamedHook('useCounter', useCounterImpl);
