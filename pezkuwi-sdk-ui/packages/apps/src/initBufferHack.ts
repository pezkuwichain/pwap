// Copyright 2017-2026 @pezkuwi/apps authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { xglobal } from '@pezkuwi/x-global';

try {
  // HACK: Construct a Buffer to ensure that it is actually available in our context
  if (Buffer.from([1, 2, 3]).length === 3) {
    xglobal.Buffer = Buffer;
  }
} catch {
  // ignore
}
