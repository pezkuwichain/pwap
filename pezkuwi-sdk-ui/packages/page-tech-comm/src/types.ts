// Copyright 2017-2025 @pezkuwi/app-tech-comm authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { CollectiveType } from '@pezkuwi/react-hooks/types';
import type { Hash } from '@pezkuwi/types/interfaces';

export interface ComponentProps {
  className?: string;
  isMember: boolean;
  prime?: string | null;
  proposalHashes?: Hash[];
  members: string[];
  type: CollectiveType;
}
