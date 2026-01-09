// Copyright 2017-2026 @pezkuwi/react-hooks authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Struct } from '@pezkuwi/types-codec';

export const isEmpty = (struct: Struct) => {
  if (struct.values) {
    for (const v of struct.values()) {
      if (!v.isEmpty) {
        return false;
      }
    }
  }

  return true;
};
