// Copyright 2017-2026 @pezkuwi/apps-config authors & contributors
// SPDX-License-Identifier: Apache-2.0

/// <reference types="@pezkuwi/dev-test/globals.d.ts" />

import type { OverrideBundleDefinition } from '@pezkuwi/types/types';

import spec from './spec/index.js';
import { typesBundle } from './index.js';

function getDerives (spec: Record<string, OverrideBundleDefinition>): string[] {
  return Object
    .entries(spec)
    .filter(([, v]) => !!v.derives)
    .map(([k]) => k);
}

describe('typesBundle checks', (): void => {
  it('all derives are re-exported', (): void => {
    expect(
      getDerives(spec)
    ).toEqual(
      getDerives(typesBundle.spec || {})
    );
  });
});
