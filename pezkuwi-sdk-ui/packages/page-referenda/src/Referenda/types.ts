// Copyright 2017-2025 @pezkuwi/app-democracy authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { BN } from '@pezkuwi/util';

export interface VoteTypeProps {
  accountId: string | null;
  id: BN | number;
  isAye?: boolean;
  onChange: (params: unknown[]) => void;
}
