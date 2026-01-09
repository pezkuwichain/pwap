// Copyright 2017-2026 @pezkuwi/app-runtime authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Codec, DefinitionCallNamed } from '@pezkuwi/types/types';

export interface Result {
  id: number;
  error?: Error;
  def: DefinitionCallNamed;
  result?: Codec;
}
